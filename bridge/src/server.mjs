import { WebSocketServer } from "ws";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { DEFAULT_PORT } from "./protocol.mjs";
import { MCP_TOOLS } from "./tools.mjs";

/**
 * Plumbing only. Every decision worth testing lives in `panelLink.mjs`; this
 * file exists to connect that to a real socket and a real MCP transport.
 *
 * ## stdout belongs to MCP
 *
 * The MCP stdio transport *is* this process's stdout, carrying framed JSON-RPC.
 * A single stray `console.log` — from here, from a dependency, from a debugging
 * session someone forgot to undo — interleaves with that stream and corrupts
 * the session, usually presenting as an MCP client that connects and then
 * mysteriously reports a parse error. Every diagnostic in this package goes to
 * stderr through `log`, which MCP clients surface as server logs.
 */
export function log(message) {
  process.stderr.write(`[openlayer-mcp-bridge] ${message}\n`);
}

/**
 * Reads `--port <n>` out of argv, defaulting to `DEFAULT_PORT`.
 *
 * Lives here rather than in `main.mjs` so a test can import it: `main.mjs`
 * starts a WebSocket server and seizes stdio at import time, so importing it to
 * reach one pure function would be a side effect nobody wants in a test run.
 */
export function parsePort(argv) {
  const index = argv.indexOf("--port");

  if (index === -1) {
    return DEFAULT_PORT;
  }

  const port = Number(argv[index + 1]);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    log(`--port needs a number between 1 and 65535, got ${JSON.stringify(argv[index + 1])}.`);
    process.exit(1);
  }

  return port;
}

/**
 * Starts the loopback WebSocket server the panel dials out to.
 *
 * The panel is the client and this is the server, which is the opposite of what
 * the topology suggests, because a UXP panel cannot listen on a port — it can
 * only make outbound connections (`docs/mcp-bridge.md` §2).
 */
export function startPanelServer({ link, port = DEFAULT_PORT }) {
  // `host` is not a default worth trusting to convention. Bound to 0.0.0.0 this
  // would expose "run arbitrary generations in this person's Photoshop" to
  // every machine on the network, including coffee-shop wifi. Loopback only,
  // stated explicitly, per docs/mcp-bridge.md §3.3.
  const wss = new WebSocketServer({ host: "127.0.0.1", port });

  wss.on("connection", (socket, request) => {
    const origin = request.socket.remoteAddress ?? "unknown";

    // Belt and braces behind the loopback bind: a proxy or an SSH tunnel can
    // present a remote peer to a loopback listener, and this refuses it rather
    // than trusting the bind alone.
    if (!isLoopback(origin)) {
      log(`Refused a connection from ${origin}: the bridge accepts loopback clients only.`);
      socket.close(1008, "Loopback clients only.");
      return;
    }

    log("Panel connected.");

    const detach = link.attach({
      send: (frame) => socket.send(frame),
      close: () => socket.close(1000, "Replaced by a newer panel connection.")
    });

    socket.on("message", (data) => link.receive(data.toString()));

    socket.on("error", (error) => log(`Panel socket error: ${error.message}`));

    socket.on("close", () => {
      const abandoned = detach("The OpenLayer panel disconnected.");

      log(
        abandoned > 0
          ? `Panel disconnected with ${abandoned} command(s) in flight; those were failed.`
          : "Panel disconnected."
      );
    });
  });

  wss.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      log(
        `Port ${port} is already in use. Another copy of the bridge is probably running — ` +
          `close it, or start this one with --port <n> and set the same port in the panel.`
      );
      process.exit(1);
    }

    log(`WebSocket server error: ${error.message}`);
  });

  wss.on("listening", () => log(`Listening for the OpenLayer panel on ws://127.0.0.1:${port}.`));

  return wss;
}

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

/** Builds the MCP server, with every tool in `MCP_TOOLS` relayed through `link`. */
export function createMcpServer({ link, version }) {
  const server = new McpServer({ name: "openlayer", version });

  server.registerTool(
    "get_panel_state",
    {
      title: "OpenLayer panel state",
      description:
        "Whether the OpenLayer Photoshop panel is connected to this bridge, which version it " +
        "is, which tools it offers, and how many commands are in flight. Answers instantly " +
        "without touching Photoshop — call it first when a tool call fails to connect."
      // No `inputSchema`, deliberately. An empty object schema is not the same
      // as no schema: it makes `arguments` mandatory, so `tools/call` without an
      // `arguments` key — which the MCP spec permits for a tool that takes none —
      // fails validation before reaching the handler. This is the tool an agent
      // calls when something is already wrong, so it must be the least fussy
      // thing in the package.
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(link.state(), null, 2) }]
    })
  );

  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.schema },
      async (params) => {
        try {
          const result = await link.dispatch({
            tool: tool.name,
            params,
            timeoutMs: tool.timeoutMs
          });

          // A failed generation is a successful relay: the panel answered, and
          // its status text is the most useful thing an agent can show a user.
          // `isError` marks it so the agent does not report a failure as done.
          return {
            content: [{ type: "text", text: result.status }],
            isError: !result.ok
          };
        } catch (error) {
          // Reaching here means no answer exists at all — no panel attached, no
          // such tool on this panel build, or the deadline passed.
          return {
            content: [{ type: "text", text: error.message }],
            isError: true
          };
        }
      }
    );
  }

  return server;
}
