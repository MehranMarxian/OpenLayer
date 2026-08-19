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

/**
 * Whether this MCP client can answer a question from the panel.
 *
 * Read live, every time, and that is the whole subtlety here: `server.connect()`
 * resolves as soon as the transport is wired, *before* the client has sent
 * `initialize`, so capabilities read straight after it are always empty. A
 * cached answer taken at startup therefore says "no sampling" even for a client
 * that offers it. Asking at the moment the question matters is the only reading
 * that is true.
 *
 * Sampling is what makes an ask possible at all: a client that did not declare
 * it has no handler for the request, so asking anyway hangs until the hub's
 * timeout rather than being refused. The hub filters on this, via `canAnswer`
 * in the hello, so a refusal arrives in milliseconds instead.
 */
let announcedSamplingSupport = false;

function clientCanSample() {
  const capable = Boolean(server.server.getClientCapabilities()?.sampling);

  if (!announcedSamplingSupport) {
    announcedSamplingSupport = true;
    // Logged once, and only now, because before the first check the answer is
    // not yet knowable. "Ask the agent" quietly refusing is otherwise
    // indistinguishable from a bug in OpenLayer, and this is the only place the
    // real reason is ever visible.
    log(
      capable
        ? "This MCP client offers sampling, so the panel can ask it questions."
        : "This MCP client did not offer sampling, so the panel's Ask the agent button will " +
            "refuse. That is a client feature, not an OpenLayer setting."
    );
  }

  return capable;
}

const agent = createAgentClient({
  url: `ws://127.0.0.1:${port}`,
  client: "mcp",
  clientVersion: version,
  log,
  canAnswer: clientCanSample,
  answerAsk: async (question) => {
    const response = await server.server.createMessage({
      messages: [{ role: "user", content: { type: "text", text: question } }],
      maxTokens: 400,
      // A hint, not a demand: the client picks the model and may ignore this.
      // The panel is asking for a short piece of creative text next to a prompt
      // box, so speed matters more than depth.
      modelPreferences: { intelligencePriority: 0.3, speedPriority: 0.8 }
    });

    return response?.content?.type === "text" ? response.content.text.trim() : "";
  }
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
