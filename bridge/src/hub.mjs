#!/usr/bin/env node
import { WebSocketServer } from "ws";

import { createHubRouter } from "./hubRouter.mjs";
import { DEFAULT_PORT } from "./protocol.mjs";

/**
 * The long-lived hub. Start it once and leave it running, the way ComfyUI is
 * left running.
 *
 * ## Why this is a separate process from the MCP server
 *
 * An MCP stdio server's lifetime belongs to its client: Claude spawns it when a
 * session opens and kills it when the session ends. The panel needs something
 * already listening before it can connect, and UXP can only dial out — it
 * cannot host. Those two facts are irreconcilable in one process, and the first
 * version of this feature tried anyway: the bridge only existed while a Claude
 * session did, so the panel had to be toggled on *after* Claude every time,
 * broke whenever Claude restarted, and a second session died on `EADDRINUSE`.
 *
 * Splitting them fixes all three. The hub owns the socket and outlives every
 * client. `main.mjs` — what an MCP client actually launches — is a thin agent
 * that connects here.
 *
 * Unlike `main.mjs`, this process does not speak MCP, so its stdout is its own
 * and logging there is safe. It still logs to stderr for consistency, so a
 * transcript from either process reads the same way.
 */

const log = (message) => process.stderr.write(`[openlayer-hub] ${message}\n`);

function parsePort(argv) {
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

const port = parsePort(process.argv.slice(2));
const router = createHubRouter({ log });

// `host` is not a default worth leaving to convention. Bound to 0.0.0.0 this
// would offer "run arbitrary generations in this person's Photoshop" to every
// machine on the network, including coffee-shop wifi. Loopback only, stated.
const wss = new WebSocketServer({ host: "127.0.0.1", port });

wss.on("connection", (socket, request) => {
  const origin = request.socket.remoteAddress ?? "unknown";

  // Belt and braces behind the loopback bind: a proxy or an SSH tunnel can
  // present a remote peer to a loopback listener, and this refuses it rather
  // than trusting the bind alone.
  if (!isLoopback(origin)) {
    log(`Refused a connection from ${origin}: the hub accepts loopback clients only.`);
    socket.close(1008, "Loopback clients only.");
    return;
  }

  const connection = router.attach({
    send: (frame) => socket.send(frame),
    close: () => socket.close(1000, "Replaced by a newer panel connection.")
  });

  socket.on("message", (data) => connection.receive(data.toString()));
  socket.on("error", (error) => log(`Socket error: ${error.message}`));
  socket.on("close", () => {
    const abandoned = connection.detach("The OpenLayer panel disconnected.");

    if (abandoned > 0) {
      log(`Panel disconnected with ${abandoned} command(s) in flight; those were failed.`);
    }
  });
});

wss.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    log(
      `Port ${port} is already in use. The hub is probably already running — you only need one. ` +
        `If you meant to run a second, give it --port <n> and set the same port in the panel.`
    );
    process.exit(1);
  }

  log(`WebSocket server error: ${error.message}`);
});

wss.on("listening", () => {
  log(`Listening on ws://127.0.0.1:${port}.`);
  log("Leave this running. Turn on Agent Bridge in the panel's Setup screen to connect.");
});

process.on("unhandledRejection", (error) => {
  log(`Unhandled rejection: ${error instanceof Error ? error.message : String(error)}`);
});

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
