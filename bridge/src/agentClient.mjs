import { WebSocket } from "ws";

import { buildAgentHello, buildCommand, buildResult, buildStateRequest, parseFrame } from "./protocol.mjs";
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
  connectTimeoutMs = 5000,
  /**
   * Answers a question the panel asked. Injected rather than reaching for the
   * MCP server from here, so this module stays testable without one.
   */
  answerAsk = null,
  /**
   * Whether this agent can answer asks, evaluated when the hello is sent.
   *
   * A function, not a boolean, and that matters: the connection is opened
   * lazily on the first tool call, while the MCP client's capabilities only
   * become known after `initialize`. Capturing a boolean at construction time
   * would read it before it exists and claim sampling support that was never
   * offered — which the hub would then trust, routing asks that hang until the
   * timeout instead of being refused instantly.
   */
  canAnswer = () => Boolean(answerAsk)
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

      // Covers the whole handshake, not just the TCP connect. Something is
      // listening but never says `welcome` — a stale build, or an unrelated
      // program on this port — and the failure has to be seconds and specific
      // rather than a silent wait for the generation timeout.
      const timer = setTimeout(() => {
        opened.terminate();
        reject(
          new Error(
            `Something is listening on ${url} but it did not answer as an OpenLayer hub. ` +
              `Check for an old bridge still running, or another program using that port.`
          )
        );
      }, connectTimeoutMs);

      opened.on("open", () => {
        // Deliberately not resolved here. An open socket only proves *something*
        // is listening on this port; the `welcome` below proves it is a hub.
        opened.send(JSON.stringify(buildAgentHello(client, clientVersion, canAnswer() === true)));
      });

      opened.on("message", (data) => {
        const parsed = parseFrame(data.toString());

        if (!parsed.ok) {
          log(`Ignoring a frame from the hub: ${parsed.reason}`);
          return;
        }

        if (parsed.message.type === "welcome") {
          clearTimeout(timer);
          socket = opened;
          log(`Connected to the hub v${parsed.message.hubVersion} at ${url}.`);
          resolve(opened);
          return;
        }

        if (parsed.message.type === "ask") {
          void handleAsk(opened, parsed.message);
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

  /**
   * Answers a question the panel asked, and always replies.
   *
   * The hub is holding a two-minute timer and the panel is showing a spinner,
   * so every path here ends in a `result` — including the paths where sampling
   * throws, which it will whenever a client declines the request or the user
   * rejects it. Failing silently would leave the panel's button stuck until the
   * timeout for something the user could be told about instantly.
   */
  async function handleAsk(open, message) {
    const reply = (ok, status) => {
      try {
        open.send(JSON.stringify(buildResult({ id: message.id, ok, status })));
      } catch (error) {
        log(`Could not answer the panel's question: ${error.message}`);
      }
    };

    if (!answerAsk || !canAnswer()) {
      // The hub should not have routed here at all — it filters on `canAnswer`
      // — so this is defence against a hub and client that disagree, not an
      // expected path.
      reply(false, "This agent's MCP client cannot answer questions.");
      return;
    }

    try {
      const answer = await answerAsk(message.question);

      reply(Boolean(answer), answer || "The agent returned an empty answer.");
    } catch (error) {
      reply(false, `The agent could not answer: ${error instanceof Error ? error.message : error}`);
    }
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
