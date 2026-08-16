# openlayer-mcp-bridge

Lets an MCP client — Claude first, any MCP-speaking client eventually — drive the OpenLayer
Photoshop panel's existing tools from natural language.

Status: **Phase 1.** `text_to_image` only. See `docs/mcp-bridge.md` for the design and the
phases after this one.

Nothing here is Claude-specific. This is a standard MCP server over stdio — the most widely
supported transport — so any MCP-speaking client can drive it (Claude Code and Desktop, Codex
CLI, VS Code agent mode, Cursor, Windsurf, Zed, Cline, Continue, and others). Only the place
you paste the config differs between them; the command is always the same.

## What it is

A small local relay with two faces. It speaks MCP over stdio to your agent, and hosts a
loopback WebSocket server that the OpenLayer panel dials out to:

```
Claude ──stdio──▶ openlayer-mcp-bridge ◀──WebSocket── OpenLayer panel ──▶ existing handlers
```

The panel is the WebSocket *client* even though it sounds like the server, because a
Photoshop UXP panel cannot listen on a port — it can only make outbound connections.

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

It is not installed by the `.ccx`. A Photoshop plugin package has no way to install or start a
Node process, so this is a separate step, and the feature is off by default at both ends.

```bash
cd bridge && npm install
```

Then point your MCP client at it. For Claude Code:

```bash
claude mcp add openlayer -- node /absolute/path/to/OpenLayer/bridge/src/main.mjs
```

And in Photoshop: open the OpenLayer panel, go to **Setup**, and turn on **Agent Bridge**.
Both halves must be on before anything connects.

`--port <n>` moves the WebSocket off the default 8199; the panel's Setup field has to match.

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
| `src/panelLink.mjs` | The relay. All the behaviour worth testing, no sockets. |
| `src/tools.mjs` | The MCP tool surface and its schemas. |
| `src/server.mjs` | WebSocket and MCP plumbing. |
| `src/main.mjs` | Entrypoint. |

One rule worth knowing before editing any of it: **stdout belongs to MCP.** It carries framed
JSON-RPC, so a single stray `console.log` corrupts the session and usually presents as a client
that connects and then reports a parse error. Diagnostics go to stderr via `log()`.
