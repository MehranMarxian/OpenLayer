/**
 * Boots the real bridge, attaches a fake panel, and drives it over MCP stdio
 * exactly as an MCP client would. Run with `npm run smoke` from `bridge/`.
 *
 * This exists because the vitest suite in `tests/scripts/` covers the relay's
 * logic against a `send` function, and there are three ways this package can be
 * broken that no such test can see:
 *
 * 1. **stdout hygiene.** The MCP stdio transport *is* stdout. One stray
 *    `console.log` anywhere in the process — including inside a dependency —
 *    interleaves with the JSON-RPC stream and corrupts the session. Only a real
 *    boot catches it, and this asserts every line stdout produces parses as JSON.
 * 2. **The MCP surface as a client actually sees it.** Tool registration is
 *    declarative, so a schema that is wrong in a way the SDK only rejects at
 *    call time (`get_panel_state` once required an `arguments` key it does not
 *    take) passes every unit test and fails on first contact.
 * 3. **The socket really binding loopback and really carrying frames.**
 *
 * It needs neither Photoshop nor ComfyUI — the panel here is a dozen lines of
 * WebSocket — so it is the last check that can run before Photoshop is involved.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Deliberately not the default 8199: this must not fight a hub the developer
// already has running for a real Photoshop session.
const PORT = 8399;
const bridgeDir = dirname(fileURLToPath(import.meta.url));

// Two processes now, because their lifetimes differ: the hub outlives every MCP
// session, and the MCP server is spawned and killed by its client.
const hub = spawn(process.execPath, ["src/hub.mjs", "--port", String(PORT)], {
  cwd: bridgeDir,
  stdio: ["ignore", "pipe", "pipe"]
});

const hubStderr = [];
hub.stderr.on("data", (chunk) => hubStderr.push(chunk.toString()));

await new Promise((resolve) => setTimeout(resolve, 600));

const child = spawn(process.execPath, ["src/main.mjs", "--port", String(PORT)], {
  cwd: bridgeDir,
  stdio: ["pipe", "pipe", "pipe"]
});

const stderr = [];
child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));

const responses = new Map();
let buffer = "";
let corrupted = null;

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    try {
      const message = JSON.parse(line);

      if (message.id !== undefined) {
        responses.set(message.id, message);
      }
    } catch {
      corrupted ??= line;
    }
  }
});

const results = [];

function check(label, condition, detail = "") {
  results.push({ label, ok: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);

async function waitFor(id, label, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (responses.has(id)) {
      return responses.get(id);
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  console.error(`FAIL  no response to ${label}\n--- bridge stderr ---\n${stderr.join("")}`);
  child.kill();
  process.exit(1);
}

await new Promise((resolve) => setTimeout(resolve, 700));

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" }
  }
});

const init = await waitFor(1, "initialize");
check(
  "MCP initialize returns the openlayer server",
  init.result?.serverInfo?.name === "openlayer",
  JSON.stringify(init.result?.serverInfo)
);

send({ jsonrpc: "2.0", method: "notifications/initialized" });

send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
const list = await waitFor(2, "tools/list");
const toolNames = (list.result?.tools ?? []).map((tool) => tool.name).sort();
check(
  "exposes get_panel_state and all seven generation tools",
  toolNames.join(",") ===
    [
      "get_panel_state",
      "image_to_image",
      "inpaint",
      "outpaint",
      "prompt_from_layer",
      "sketch_to_image",
      "text_to_image",
      "upscale"
    ].join(","),
  toolNames.join(",")
);

// With no panel this must fail in milliseconds with something a person can act
// on, not hang the agent until the ten-minute generation timeout.
send({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: { name: "text_to_image", arguments: { prompt: "a cat" } }
});
const noPanel = await waitFor(3, "text_to_image with no panel");
check(
  "fails fast and actionably with no panel connected",
  noPanel.result?.isError === true && noPanel.result?.content?.[0]?.text?.includes("Agent Bridge"),
  noPanel.result?.content?.[0]?.text?.slice(0, 55)
);

// Node's global WebSocket is client-only, which is the same shape UXP gives the
// real panel: it can dial out, and it could not host this server if it tried.
const panel = new WebSocket(`ws://127.0.0.1:${PORT}`);

await new Promise((resolve, reject) => {
  panel.addEventListener("open", resolve);
  panel.addEventListener("error", () => reject(new Error("panel could not connect")));
  setTimeout(() => reject(new Error("panel connect timed out")), 5000);
});

check("panel connected over loopback WebSocket", true);

panel.send(JSON.stringify({ v: 1, type: "hello", panelVersion: "0.15.0", tools: ["text_to_image"] }));

const received = [];

panel.addEventListener("message", (event) => {
  const command = JSON.parse(event.data.toString());

  if (command.type !== "command") {
    return;
  }

  received.push(command);
  panel.send(
    JSON.stringify({
      v: 1,
      type: "result",
      id: command.id,
      ok: true,
      status: "Imported as new layer."
    })
  );
});

await new Promise((resolve) => setTimeout(resolve, 300));

// No `arguments` key at all: legal per the MCP spec for a tool that takes none,
// and the case an empty object schema used to reject.
send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_panel_state" } });
const state = await waitFor(4, "get_panel_state");
const parsedState = JSON.parse(state.result?.content?.[0]?.text ?? "{}");
check(
  "get_panel_state answers without an arguments key, and reports the handshake",
  parsedState.connected === true && parsedState.panelVersion === "0.15.0",
  JSON.stringify(parsedState)
);

send({
  jsonrpc: "2.0",
  id: 5,
  method: "tools/call",
  params: { name: "text_to_image", arguments: { prompt: "a cat on a bicycle", steps: 30 } }
});
const called = await waitFor(5, "text_to_image with a panel attached");

check(
  "the command reached the panel with its parameters intact",
  received[0]?.tool === "text_to_image" &&
    received[0]?.params?.prompt === "a cat on a bicycle" &&
    received[0]?.params?.steps === 30,
  JSON.stringify(received[0]?.params)
);

check(
  "the panel's own status text came back to MCP",
  called.result?.content?.[0]?.text === "Imported as new layer." && called.result?.isError !== true,
  called.result?.content?.[0]?.text
);

check("stdout carried nothing but JSON-RPC", corrupted === null, corrupted ?? "");

panel.close();
child.kill();
hub.kill();

const failed = results.filter((result) => !result.ok);

console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length > 0) {
  console.log(`\n--- mcp stderr ---\n${stderr.join("")}`);
  console.log(`\n--- hub stderr ---\n${hubStderr.join("")}`);
  process.exit(1);
}
