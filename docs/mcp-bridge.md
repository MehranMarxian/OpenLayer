# MCP Agent Bridge — Technical Specification

Status: **approved direction, not yet implemented.** Written 2026-08-15, targeted at v0.15.
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
  submission-time snapshotting) are preserved automatically, because every MCP tool call routes
  through the existing handler and `generationController.runPipeline`. No path in this design
  calls `batchPlay` or `photoshopAdapter` directly from the bridge.

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
     (`elements.prompt.value = ...`), dispatching `input` events for any reactive listeners,
   - invokes the existing zero-arg handler,
   - awaits `generationController`'s existing busy/result signals (`syncBusy`/status bars),
   - reads the resulting status bar text to report success/error back over the socket, since
     handlers swallow throws.

   Phase 1 requires **no changes to any handler's signature or internals.**

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
- A4 (single active run) is inherited for free: an agent-issued command during a human's
  in-flight generation hits the same busy lockout an extra click would.
- Analytics: tag generation events with `origin: "agent" | "panel"` at the point `agentBridge`
  invokes a handler vs. a real click handler does — smallest possible hook, no new pipeline.

## 4. Phasing (all v0.15, in order)

1. **Spike**: bridge process skeleton (MCP stdio + WS server, loopback only, no auth needed
   beyond that), panel-side `agentBridge.ts` connecting out, ONE tool wired end-to-end
   (`text_to_image`) via DOM injection, behind the opt-in toggle. Proves the whole chain.
2. **State + remaining six tools**: `get_panel_state`, then the other six handlers registered
   the same way.
3. **`ask_agent` bidirectional hook**: one UI affordance calling back out through the same
   socket.
4. **Cloud transport**: explicitly deferred until local proves out.

## 5. Open questions for whoever picks this up

- Exact WS message schema (request id, tool name, args, timeout) — not designed yet, just the
  shape above.
- Whether the bridge process ships as part of the plugin package or as a separate install step
  (`npx openlayer-mcp-bridge` or similar) — affects the "how does a user even start this"
  onboarding story.
- Multi-instance: what happens if two agent clients connect to one bridge, or one Claude
  session tries to drive two open Photoshop documents.
- `ask_agent` UX: what happens if no agent is connected when the button is pressed (must
  degrade gracefully — this is a bidirectional nice-to-have, not a dependency of the panel's
  core function).

## 6. See also

- `docs/ORCHESTRATION.md` §2 (safety invariants), §3 (why `renderApp` is not refactored),
  §6 item 4 (Assisted Install's per-item confirmation precedent this borrows).
- `src/ui/importBridge.ts` — the structural precedent this design copies.
- `docs/LIVE_PAINTING_V2.md` — another approved-but-unbuilt design doc, same doc shape.
