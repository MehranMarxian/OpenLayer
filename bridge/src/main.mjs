#!/usr/bin/env node
import { readFileSync } from "node:fs";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createAgentClient } from "./agentClient.mjs";
import { createMcpServer, log, parsePort } from "./server.mjs";

/**
 * What an MCP client launches. A thin agent: it speaks MCP on stdio and relays
 * to the hub over a loopback socket.
 *
 * It binds nothing and owns nothing, which is the point. The hub
 * (`bridge/src/hub.mjs`) owns the socket and outlives every MCP session, so
 * several clients can drive one Photoshop panel and closing one of them takes
 * nothing down. See the header of `hub.mjs` for why this had to be split.
 *
 * The hub connection is opened lazily on the first tool call, so this process
 * starting before the hub is fine.
 */

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const port = parsePort(process.argv.slice(2));

const agent = createAgentClient({
  url: `ws://127.0.0.1:${port}`,
  client: "mcp",
  clientVersion: version,
  log
});

const server = createMcpServer({ agent, version });

await server.connect(new StdioServerTransport());

log(`openlayer-mcp v${version} ready; will reach the hub on 127.0.0.1:${port} when first called.`);

// Without this, an unhandled rejection anywhere in the relay would take the
// process down and present to the MCP client as the server vanishing mid-call.
// A relay that logs and keeps running is strictly more debuggable.
process.on("unhandledRejection", (error) => {
  log(`Unhandled rejection: ${error instanceof Error ? error.message : String(error)}`);
});
