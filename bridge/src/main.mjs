#!/usr/bin/env node
import { readFileSync } from "node:fs";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createPanelLink } from "./panelLink.mjs";
import { createMcpServer, log, parsePort, startPanelServer } from "./server.mjs";

/**
 * Entrypoint. Starts the loopback WebSocket server the panel dials, then hands
 * this process's stdio to MCP.
 *
 * Order matters: the MCP transport takes over stdout, so anything that might
 * need to fail loudly — a port already in use, an unreadable package.json —
 * does it before that happens, while a plain stderr message is still the whole
 * story.
 */

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

const port = parsePort(process.argv.slice(2));
const link = createPanelLink({ log });

startPanelServer({ link, port });

const server = createMcpServer({ link, version });

await server.connect(new StdioServerTransport());

log(`openlayer-mcp-bridge v${version} ready.`);

// Without this, an unhandled rejection anywhere in the relay would take the
// process down and present to the MCP client as the server vanishing mid-call.
// A bridge that logs and keeps running is strictly more debuggable.
process.on("unhandledRejection", (error) => {
  log(`Unhandled rejection: ${error instanceof Error ? error.message : String(error)}`);
});
