import { WebSocket } from "ws";

import { buildAgentHello, buildCommand, buildStateRequest, parseFrame } from "./protocol.mjs";
import { createPendingRequests } from "./pendingRequests.mjs";

/**
 * The MCP process's connection to the hub.
 *
 * ## Why it connects lazily rather than at startup
 *
 * An MCP client spawns this process when its session opens, which may well be
 * before the hub is running — the hub is a thing a person starts in a terminal,
 * and the order is theirs to choose. Connecting on the first tool call instead
 * of at boot means starting the hub afterwards just works, with no restart of
 * the MCP client. Failing at startup would make the ordering load-bearing for
 * no reason.
 *
 * A dropped connection clears itself, so the next call redials. That is a
 * different judgement from the panel's, which deliberately never retries: the
 * panel redialling on a timer would be invisible background noise, whereas this
 * only ever reconnects in direct response to someone asking for something.
 */
export function createAgentClient({
  url,
  client = "unknown",
  clientVersion = "0",
  log = () => {},
  requestTimeoutMs = 10 * 60 * 1000,
  connectTimeoutMs = 5000
}) {
  const pending = createPendingRequests();

  let socket = null;
  let connecting = null;
  let nextId = 1;

  const hubMissing =
    `No OpenLayer hub is listening on ${url}. Start it in a terminal with: node bridge/src/hub.mjs ` +
    `(leave it running, the way you leave ComfyUI running).`;

  function teardown(reason) {
    socket = null;
    connecting = null;
    pending.rejectAll(reason);
  }

  async function connect() {
    if (socket) {
      return socket;
    }

    // Collapsed rather than duplicated: two tool calls arriving together must
    // not open two sockets and leave one orphaned.
    connecting ??= new Promise((resolve, reject) => {
      let opened;

      try {
        opened = new WebSocket(url);
      } catch (error) {
        reject(new Error(hubMissing, { cause: error }));
        return;
      }

      const timer = setTimeout(() => {
        opened.terminate();
        reject(new Error(`Timed out connecting to the OpenLayer hub at ${url}.`));
      }, connectTimeoutMs);

      opened.on("open", () => {
        clearTimeout(timer);
        socket = opened;
        opened.send(JSON.stringify(buildAgentHello(client, clientVersion)));
        log(`Connected to the hub at ${url}.`);
        resolve(opened);
      });

      opened.on("message", (data) => {
        const parsed = parseFrame(data.toString());

        if (!parsed.ok) {
          log(`Ignoring a frame from the hub: ${parsed.reason}`);
          return;
        }

        if (parsed.message.type !== "result") {
          log(`Ignoring a ${parsed.message.type} from the hub, which an agent does not expect.`);
          return;
        }

        if (!pending.settle(parsed.message.id, parsed.message)) {
          log(`Discarded a late or unmatched result for ${parsed.message.id}.`);
        }
      });

      opened.on("error", (error) => {
        clearTimeout(timer);
        // A connection that never opened is the common case here, and it means
        // the hub is not running. Say that, rather than surfacing ECONNREFUSED.
        reject(socket ? error : new Error(hubMissing, { cause: error }));
      });

      opened.on("close", () => {
        clearTimeout(timer);
        teardown("The connection to the OpenLayer hub closed.");
      });
    }).catch((error) => {
      connecting = null;
      throw error;
    });

    return connecting;
  }

  async function request(frame) {
    const open = await connect();
    const settled = pending.open(frame.id, requestTimeoutMs);

    try {
      open.send(JSON.stringify(frame));
    } catch (error) {
      // Nothing can arrive for this id now, and leaving it to time out would
      // hang the caller for ten minutes. Cleared with `settle` rather than a
      // rejection because nothing is awaiting `settled` yet.
      pending.settle(frame.id, null);
      throw new Error(`Could not reach the OpenLayer hub: ${error.message}`, { cause: error });
    }

    return settled;
  }

  return {
    runTool: ({ tool, params }) =>
      request(buildCommand({ id: `a-${nextId++}`, tool, params })),
    requestState: () => request(buildStateRequest(`a-${nextId++}`)),
    close() {
      const open = socket;

      socket = null;
      connecting = null;

      try {
        open?.close();
      } catch {
        // Closing a socket that is already gone is not worth reporting.
      }
    }
  };
}
