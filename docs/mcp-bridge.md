# MCP Agent Bridge — Technical Specification

Status: **Phase 1 complete, pending a Photoshop smoke test.** Both halves are built and the
whole chain is verified outside Photoshop: `npm run test:e2e` drives the real bridge process
over real MCP, through a real socket, into the real panel modules, and reads the panel's own
status text back. What that cannot cover is UXP itself — see the note at the end of §4.1.
Written 2026-08-15, targeted at v0.15.

Read `docs/ORCHESTRATION.md` first — its safety invariants (§2) and the closure-extraction
decision (§3) apply to every step here.

---

## 1. Vision

OpenLayer's seven Photoshop tools (Text to Image, Image to Image, Sketch to Image, Inpaint,
Outpaint, Upscale, Prompt from Layer) are reachable today only through panel clicks. This
feature lets an agentic AI — Claude first, any MCP-speaking client eventually — drive the same
tools from natural language: "make this person's eyes pop," "upscale this and inpaint the
torn corner," multi-step requests the AI breaks into calls.

Decisions agreed with Mehran before design started:

1. **Local first, cloud later.** No hosted relay in scope for v0.15; loopback-only.
2. **Bidirectional.** The panel can also ask the connected agent for help (e.g. "suggest a
   prompt"), not only receive commands.
3. **Targeted v0.15.** Named future release, not current work.
4. **Analytics-visible.** Agent-driven generations should be distinguishable from click-driven
   ones once this ships.

## 2. What already exists (verified in code)

- **No backend process today.** `package.json` has no server script. The UXP panel
  (`src/manifest.json`, `network.domains: all`) talks straight to ComfyUI over HTTP/WebSocket
  via `src/comfy/comfyClient.ts`. The bridge process is entirely new infrastructure.
- **UXP panels cannot host a listening server** — only outbound `fetch`/`WebSocket` (client).
  The panel must be the WebSocket *client*, connecting out to a local bridge process that also
  speaks MCP over stdio to Claude.
- **The seven tool handlers live inside the `renderApp` closure** in `src/ui/App.ts`
  (`handleGenerate`, `handleGenerateImg2Img`, `handleGenerateUpscale`, `handleGenerateOutpaint`,
  `handleGenerateSketch`, `handleGenerateInpaint`, `handleGeneratePromptFromLayer`). Per
  `docs/ORCHESTRATION.md` §3, carving up that closure was deliberately rejected as high-risk,
  relocation-only work. This design does not touch it.
- **Handlers read parameters straight from DOM elements**, not from a parameters object — e.g.
  `handleGenerate()` reads `elements.prompt.value`, `elements.width.value`, etc. before calling
  `generation.runPipeline(...)`.
- **Handlers swallow their own errors** — they catch, set the tool's status bar, and return. A
  caller cannot distinguish success from failure by awaiting without a throw; it has to read
  the resulting status text.
- **A shipped precedent solves the identical structural problem.** PR #47 (`src/ui/importBridge.ts`)
  built the Preview panel's Import buttons on top of the same closure-trapped handlers:
  `renderApp` registers references to its *existing* handlers into a second module singleton,
  keyed by tool id. The outside caller never reimplements generation logic. Capability is
  *pushed* by `syncBusy` rather than recomputed (recomputing could race the single-run
  lockout). Outcome is read from the status bar because handlers swallow their errors. **The
  MCP bridge reuses this exact pattern at a different edge.**
- **Safety invariants A1–B2** (`docs/ORCHESTRATION.md` §2 — document identity binding, mask
  ordering, transactional import, single active run, object-URL lifecycle, inpaint
  submission-time snapshotting) are preserved because every MCP tool call routes through the
  existing handler and `generationController.runPipeline`. No path in this design calls
  `batchPlay` or `photoshopAdapter` directly from the bridge.

  **With one exception, found while building and worth reading before trusting this
  paragraph: A4 is not automatic.** It lives in the disabled button, not in the handler, so it
  has to be enforced explicitly at this new edge. See §3.3.

## 3. Architecture

### 3.1 Three components

```
Claude (MCP client) ──stdio──▶ openlayer-mcp-bridge (Node, loopback WS server)
                                        ▲
                                        │ outbound WebSocket (UXP can only dial out)
                                        │
                          src/ui/agentBridge.ts (panel, new module)
                                        │ registers references to existing handlers
                                        ▼
                          renderApp's seven handleGenerate* closures
                          (unchanged) ──▶ generationController.runPipeline (unchanged)
```

1. **`openlayer-mcp-bridge`** — standalone local Node process, new package at repo root
   (e.g. `bridge/`), not inside `src/` since it never ships in the UXP bundle. Speaks MCP over
   stdio to Claude Code/Desktop; hosts a loopback-only WebSocket server (e.g.
   `ws://127.0.0.1:8199`) the panel connects out to. Pure protocol relay: request/response and
   event-push with request IDs and timeouts. Holds no Photoshop or ComfyUI logic itself.

2. **`src/ui/agentBridge.ts`** (panel side, new module, modeled directly on `importBridge.ts`)
   — connects to the bridge process's WebSocket when a new **explicit opt-in toggle** is
   enabled (Setup screen, off by default — mirrors Assisted Install's per-item confirmation
   precedent, `docs/ORCHESTRATION.md` §6 item 4). `renderApp` registers each of the seven
   existing handlers into this module by tool id, the same way it registers into `importBridge`
   today. On an incoming command, `agentBridge`:
   - writes requested parameters into the same DOM elements a human would
     (`elements.prompt.value = ...`), dispatching `input`/`change` events for any reactive
     listeners,
   - invokes the existing zero-arg handler,
   - reads the resulting status bar to report success/error back over the socket, since
     handlers swallow throws. The tool's status *pill* is the signal, not words in the text:
     the pill is what the handler actually set, and "Recovered from a ComfyUI error" is a
     success whose text a regex would fail.

   Phase 1 requires **no changes to any handler's signature or internals.**

   Two things this turned out to need beyond the sketch above, both found in the code rather
   than by reasoning about it:

   - **Parameters are applied in two passes.** Some fields rewrite others: Text to Image's
     `workflow` listener overwrites `steps` and `cfg` with preset recommendations and kicks
     off an *async* refresh of the checkpoint list. One-pass application therefore drops an
     agent's explicit `steps` (the listener overwrites it moments later) and validates
     `checkpoint` against a stale option list. So a registration names its rewriting fields as
     `leadingParams` and supplies a `settle` that awaits their consequences; `execute` applies
     those, awaits `settle`, then applies the rest — the order a person works in.
   - **A rejected `<select>` value cancels the whole command.** Assigning an option a select
     does not have is silently ignored, so an agent asking for an uninstalled checkpoint would
     otherwise get a real generation on whatever was already selected, reported as success.
     The rejection names the available options so the agent can retry correctly.

3. **MCP tool surface**, exposed by the bridge process as thin wrappers over the WS protocol:
   - `get_panel_state` — active tool, ComfyUI health, current prompt/params per tool, last
     result summary. Built from state the UI already computes (`toolDescriptors.ts`,
     `workflowHealth.ts`, `setupTabModel.ts`) — surfaced, not re-derived.
   - One tool per existing handler: `text_to_image`, `image_to_image`, `sketch_to_image`,
     `inpaint`, `outpaint`, `upscale`, `prompt_from_layer`. JSON schema per tool matches that
     tool's known form fields, reused from `appMarkup.ts`/`toolDescriptors.ts`.
   - `ask_agent` (the bidirectional half) — a panel-side call (new small UI affordance, e.g.
     "Suggest a prompt") that sends a request *out* through the same open socket and awaits the
     agent's reply.

### 3.2 Why DOM-value injection, not handler refactoring

Rejected alternative: give each handler an optional `overrides` parameter object instead of
reading `elements.*.value`. Cleaner in isolation, but it means editing the internals of seven
functions inside the protected `renderApp` closure — exactly the class of change §3 of
`docs/ORCHESTRATION.md` says is high-risk and was deliberately skipped once already. DOM
injection keeps the change additive only: the closure gains one new registration call per
handler (same shape as `importBridge`'s existing registration), and every validation/status/
preview path a human trigger hits stays identical for an agent trigger. Trade-off: parameter
validation happens through existing UI validation rather than a dedicated schema-to-args
mapper, so bad agent input surfaces as the same inline error a user typing garbage would see —
acceptable, since it's the already-trusted validation path.

### 3.3 Transport and safety model

- Loopback-only bind (`127.0.0.1`), never `0.0.0.0` — no LAN exposure.
- Bridge connection is **off by default**; enabling it is an explicit Setup-screen toggle.
- No raw `batchPlay` or direct `photoshopAdapter` access is ever exposed to the bridge — the
  only surface is "trigger this existing, already-safe handler" and "read this already-computed
  state." This is the load-bearing safety property of the whole design.
- ~~A4 (single active run) is inherited for free: an agent-issued command during a human's
  in-flight generation hits the same busy lockout an extra click would.~~ **Wrong, corrected
  while building `agentBridge.ts`.** The seven generation handlers do not check `isBusy` — they
  *set* it. Nothing inside `handleGenerate` refuses to start. The lockout an extra *click* hits
  is `syncBusy` disabling the button, and a direct call never goes near it, so injecting values
  and invoking the handler would start a second pipeline against a document the first is still
  writing to. (The only two `isBusy` guards in `App.ts` are in `handleHistoryAction` and
  `handleStartLivePainting`.)

  A4 is therefore enforced deliberately, not inherited: `renderApp` pushes a capability
  snapshot from `syncBusy` — the same place it disables its own buttons — and
  `agentBridge.execute` refuses when that snapshot says it must. This is the arrangement
  `importBridge` already uses, and for the reason its own comment gives: a surface that
  computes its own answer is free to disagree with the one the dashboard is enforcing. An
  unpublished capability counts as "no", so a tool registered before the first `syncBusy`
  cannot be driven.
- Analytics: tag generation events with `origin: "agent" | "panel"` at the point `agentBridge`
  invokes a handler vs. a real click handler does — smallest possible hook, no new pipeline.

## 4. Phasing (all v0.15, in order)

1. **Spike**: bridge process skeleton (MCP stdio + WS server, loopback only, no auth needed
   beyond that), panel-side `agentBridge.ts` connecting out, ONE tool wired end-to-end
   (`text_to_image`) via DOM injection, behind the opt-in toggle. Proves the whole chain.

   *Done, pending Photoshop.* `bridge/` holds the relay; `bridge/src/panelLink.mjs` has all
   the behaviour worth testing and no socket in it, so refusing a call with no panel attached,
   matching replies to requests, and surviving a reconnect mid-generation are unit-tested
   (`tests/scripts/bridge*.test.ts`). `npm run smoke` from `bridge/` boots the real process and
   drives a full tool call through MCP against a fake panel — needed because three failure
   modes are invisible to unit tests: stdout corruption (the MCP transport *is* stdout), a tool
   schema the SDK only rejects at call time, and the socket actually binding.

   The panel half is `src/ui/agentProtocol.ts` (wire format), `src/ui/agentBridge.ts`
   (registry, A4 gate, parameter injection) and `src/ui/agentConnection.ts` (the outbound
   socket, with the logic separated from it the same way). `renderApp` registers
   `handleGenerate` by reference and pushes capability from `syncBusy`. The Setup screen has an
   off-by-default toggle and a port field; the setting is stored under its own key rather than
   in `OpenLayerPreferences`, so Reset Settings cannot open a socket.

   `npm run test:e2e` joins the two: real bridge process, real MCP, real socket, real panel
   modules, only the DOM stubbed.

   **What no test here can cover, and what the Photoshop smoke test is for:** UXP is a DOM
   subset, and two things this feature does are used nowhere else in `src/` — constructing an
   `Event` to notify a field of a change, and `WebSocket` as a *client of a local server*
   rather than of ComfyUI. Both are written to degrade rather than throw, but whether they work
   is genuinely unknown until the panel runs in Photoshop.
2. **State + remaining six tools**: `get_panel_state`, then the other six handlers registered
   the same way.
3. **`ask_agent` bidirectional hook**: one UI affordance calling back out through the same
   socket.
4. **Cloud transport**: explicitly deferred until local proves out.

## 5. Open questions

**Answered while building Phase 1:**

- **WS message schema** — designed and implemented in `bridge/src/protocol.mjs`, which is the
  canonical definition. Five frame types (`command` out; `hello`, `result`, `event`, `ask` in),
  each carrying a protocol version `v` that the handshake checks in both directions. Version
  mismatch names both sides in the error, because the bridge is installed separately from the
  plugin and so the two really can drift by a release.
- **Ships separately, not in the plugin package.** A `.ccx` is a Creative Cloud plugin
  installer; it has no mechanism to install or start a Node process, and forcing one in would
  break the one-click install path. The bridge is its own package under `bridge/`, started by
  the user and registered with their MCP client. This also keeps its dependency tree out of a
  plugin bundle that ships zero runtime deps. Cost: the feature is advanced/opt-in rather than
  something every tester sees, which matches the off-by-default toggle anyway.
- **Two panels on one bridge** — newest connection wins. The previous socket is closed and its
  in-flight commands are failed with a reason, rather than the bridge holding a dead handle and
  timing out every later call. Not full arbitration, but it fails understandably.

**Still open:**

- Multiple *agent clients* on one bridge (the case above is two panels). Today an MCP server is
  one client per stdio process, so this only bites if a hosted transport is ever added.
- One agent session driving two open Photoshop documents. The panel binds document identity at
  submission time (A1), so this is safe rather than corrupting, but the agent has no way to
  say which document it means.
- `ask_agent` UX: what happens if no agent is connected when the button is pressed (must
  degrade gracefully — this is a bidirectional nice-to-have, not a dependency of the panel's
  core function). The bridge already answers an `ask` frame with an explicit "not implemented"
  result rather than silence, so the panel has something to render from day one.

## 6. See also

- `docs/ORCHESTRATION.md` §2 (safety invariants), §3 (why `renderApp` is not refactored),
  §6 item 4 (Assisted Install's per-item confirmation precedent this borrows).
- `src/ui/importBridge.ts` — the structural precedent this design copies.
- `docs/LIVE_PAINTING_V2.md` — another approved-but-unbuilt design doc, same doc shape.
