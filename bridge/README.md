# openlayer-mcp-bridge

Lets an MCP client — Claude first, any MCP-speaking client eventually — drive the OpenLayer
Photoshop panel's existing tools from natural language.

Status: **Phase 2.** All seven generation tools are wired up: `text_to_image`,
`image_to_image`, `sketch_to_image`, `inpaint`, `outpaint`, `upscale`, `prompt_from_layer`.
`ask_agent` (the panel asking the agent for help) is Phase 3, not yet built. See
`docs/mcp-bridge.md` for the design and the phases after this one.

Nothing here is Claude-specific. This is a standard MCP server over stdio — the most widely
supported transport — so any MCP-speaking client can drive it (Claude Code and Desktop, Codex
CLI, VS Code agent mode, Cursor, Windsurf, Zed, Cline, Continue, and others). Only the place
you paste the config differs between them; the command is always the same.

## What it is

**Two processes**, because they need different lifetimes:

```
Photoshop panel ──────────────┐
                               ├──▶ openlayer-hub  (long-lived, owns 127.0.0.1:8199)
Claude ──stdio──▶ openlayer-mcp ┘
Codex  ──stdio──▶ openlayer-mcp ┘
```

- **`src/hub.mjs`** — you start it once and leave it running, the way you leave ComfyUI
  running. It owns the socket and outlives everything else.
- **`src/main.mjs`** — what your MCP client launches. A thin agent that connects to the hub.

The panel is a WebSocket *client* even though it sounds like the server, because a Photoshop
UXP panel cannot listen on a port — it can only dial out.

### Why not one process

An MCP stdio server's lifetime belongs to its client: Claude spawns it when a session opens and
kills it when the session closes. But the panel needs something *already listening* before it
can connect. The first version of this feature put both jobs in one process and hit all three
consequences: the panel had to be toggled on after Claude every time, it broke whenever Claude
restarted, and a second Claude session died on `EADDRINUSE`.

Splitting them also means several clients — Claude, Codex, VS Code — can drive one Photoshop
panel at once, and closing any of them takes nothing down.

## What it deliberately cannot do

The bridge holds no Photoshop or ComfyUI logic. Its only two verbs are *ask the panel to run a
tool it already has* and *read back what the panel said happened*. Nothing here can reach
`batchPlay`, touch a layer, or build a ComfyUI workflow, so every safety invariant the panel
already enforces — document identity binding, mask ordering, transactional import, one active
run at a time — applies identically whether a person clicked the button or an agent asked for
it. That is the load-bearing property of the whole design, not an implementation detail.

It also does not decide whether a generation is allowed right now. A command that arrives
mid-run hits the same busy lockout an extra click would, because it goes through the same code.

## Running it

Not installed by the `.ccx` — a Photoshop plugin package has no way to install or start a Node
process — so this is a separate step, and the feature is off by default at both ends.

**1. Install once:**

```bash
cd bridge && npm install
```

**2. Start the hub, and leave it running:**

```bash
npm run hub
```

This is the step people miss. Nothing connects until the hub is listening, and `claude mcp add`
does *not* start it — it only writes a config entry.

**3. Register the MCP client, once:**

```bash
claude mcp add openlayer -- node /absolute/path/to/OpenLayer/bridge/src/main.mjs
```

**4. In Photoshop:** open the OpenLayer panel, go to **Setup**, and turn on **Agent Bridge**.

Order between 2, 3 and 4 does not matter much — the MCP client connects to the hub lazily on
its first tool call, so starting Claude before the hub is fine. Only the hub has to be running
by the time you actually ask for something.

`--port <n>` moves the socket off the default 8199. Pass it to *both* commands, and set the
same port in the panel's Setup field.

## Checking it works

```bash
npm run smoke
```

Boots the real bridge, attaches a fake panel, and drives a full tool call over MCP. Needs
neither Photoshop nor ComfyUI. The relay's logic is unit-tested from the repo root instead
(`npm test` → `tests/scripts/bridge*.test.ts`).

From the repo root, `npm run test:e2e` goes one further: the same real bridge process, but
talking to the **real panel modules** over a real socket rather than a fake panel. That is the
last thing that can be verified before Photoshop is involved.

If a call fails, ask the agent to call `get_panel_state` first — it answers instantly without
touching Photoshop and tells you whether the panel ever connected.

## Layout

| File | What it holds |
| --- | --- |
| `src/protocol.mjs` | The wire format. Canonical; `src/ui/agentProtocol.ts` mirrors it. |
| `src/pendingRequests.mjs` | Outstanding commands, and the three ways one ends. |
| `src/hubRouter.mjs` | The routing. All the behaviour worth testing, no sockets. |
| `src/hub.mjs` | Hub entrypoint: the WebSocket server. |
| `src/agentClient.mjs` | The MCP process's connection to the hub. |
| `src/tools.mjs` | The MCP tool surface and its schemas. |
| `src/server.mjs` | MCP plumbing. |
| `src/main.mjs` | MCP entrypoint. |

One rule worth knowing before editing any of it: **stdout belongs to MCP.** It carries framed
JSON-RPC, so a single stray `console.log` corrupts the session and usually presents as a client
that connects and then reports a parse error. Diagnostics go to stderr via `log()`.
