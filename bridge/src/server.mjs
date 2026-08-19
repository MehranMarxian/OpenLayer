import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { DEFAULT_PORT } from "./protocol.mjs";
import { MCP_TOOLS } from "./tools.mjs";

/**
 * The MCP surface, relayed to the hub. Plumbing only — every decision lives in
 * `hubRouter.mjs` (routing) or `agentClient.mjs` (connecting).
 *
 * ## stdout belongs to MCP
 *
 * The MCP stdio transport *is* this process's stdout, carrying framed JSON-RPC.
 * A single stray `console.log` — from here, from a dependency, from a debugging
 * session someone forgot to undo — interleaves with that stream and corrupts
 * the session, usually presenting as a client that connects and then reports a
 * parse error. Every diagnostic goes to stderr through `log`, which MCP clients
 * surface as server logs.
 */
export function log(message) {
  process.stderr.write(`[openlayer-mcp] ${message}\n`);
}

/**
 * Reads `--port <n>` out of argv, defaulting to `DEFAULT_PORT`.
 *
 * Lives here rather than in `main.mjs` so a test can import it: `main.mjs`
 * seizes stdio at import time, so importing it to reach one pure function would
 * be a side effect nobody wants in a test run.
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

/** Builds the MCP server, with every tool in `MCP_TOOLS` relayed to the hub. */
export function createMcpServer({ agent, version }) {
  const server = new McpServer({ name: "openlayer", version });

  server.registerTool(
    "get_panel_state",
    {
      title: "OpenLayer panel state",
      description:
        "Whether the OpenLayer Photoshop panel is connected to the hub, which version it is, " +
        "which tools it offers, and how many commands are in flight. Answers without touching " +
        "Photoshop — call it first when a tool call fails to connect."
      // No `inputSchema`, deliberately. An empty object schema is not the same
      // as no schema: it makes `arguments` mandatory, so `tools/call` without an
      // `arguments` key — which the MCP spec permits for a tool that takes none —
      // fails validation before reaching the handler. This is the tool an agent
      // calls when something is already wrong, so it must be the least fussy
      // thing in the package.
    },
    async () => {
      try {
        const result = await agent.requestState();

        return { content: [{ type: "text", text: JSON.stringify(result.data ?? {}, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: error.message }], isError: true };
      }
    }
  );

  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.schema },
      async (params) => {
        try {
          const result = await agent.runTool({ tool: tool.name, params });

          // A failed generation is a successful relay: the panel answered, and
          // its status text is the most useful thing an agent can show a user.
          // `isError` marks it so the agent does not report a failure as done.
          return { content: [{ type: "text", text: result.status }], isError: !result.ok };
        } catch (error) {
          // Reaching here means no answer exists at all — no hub, no panel, or
          // the deadline passed.
          return { content: [{ type: "text", text: error.message }], isError: true };
        }
      }
    );
  }

  return server;
}
