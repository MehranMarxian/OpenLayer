import { AGENT_TOOLS, buildCommand, buildResult, buildWelcome, parseFrame } from "./protocol.mjs";
import { createPendingRequests } from "./pendingRequests.mjs";

/**
 * The hub's routing core: one panel, any number of agents, and the rules for
 * what happens when any of them goes away.
 *
 * Deliberately knows nothing about WebSockets. Connections are handed in as a
 * `send`/`close` pair and fed frames through the handle `attach` returns, so
 * every interesting behaviour — refusing a command with no panel attached,
 * routing a reply to the agent that asked for it and not the other one,
 * surviving a panel reconnect mid-generation — is testable without a socket, a
 * port, or a timer that actually waits. `hub.mjs` supplies the `ws` plumbing
 * and contains no decisions.
 *
 * ## Why the hub mints its own ids
 *
 * An agent picks the id it puts on a command, and two agents will eventually
 * pick the same one — they have no way to coordinate, and `req-1` is an obvious
 * first guess for everybody. So the hub allocates a fresh id toward the panel
 * and remembers which agent asked under which of *their* ids. Without that, two
 * Claude sessions generating at once would receive each other's results, which
 * is both wrong and almost impossible to debug from either end.
 *
 * ## What it deliberately does not do
 *
 * It does not know whether a generation is currently allowed. The panel owns
 * that: invariant A4 is enforced by `agentBridge.execute` against the capability
 * `syncBusy` publishes, and a command arriving mid-run is refused there. A
 * second opinion here could only disagree with the first.
 *
 * It holds no Photoshop or ComfyUI concepts at all. Its only two verbs are
 * "ask the panel to run a tool it already has" and "pass back what the panel
 * said happened". Nothing here can reach `batchPlay`, which is the load-bearing
 * safety property of the whole feature.
 */
export function createHubRouter({
  log = () => {},
  setTimer,
  clearTimer,
  commandTimeoutMs = 10 * 60 * 1000,
  hubVersion = "0"
} = {}) {
  /** Commands in flight toward the panel, keyed by the hub's own id. */
  const pending = createPendingRequests({ setTimer, clearTimer });
  /** Where each in-flight command came from, so its reply can go home. */
  const origins = new Map();

  let panel = null;
  const agents = new Set();

  // Never reset, not even across reconnects. A counter that restarted could
  // match a late reply from a previous panel connection to a fresh command.
  let nextCommandId = 1;

  const panelMissing =
    "The OpenLayer panel is not connected to the hub. In Photoshop, open the OpenLayer panel, " +
    "go to Setup, and turn on Agent Bridge.";

  function send(connection, frame) {
    try {
      connection.send(JSON.stringify(frame));
    } catch (error) {
      log(`Could not write to a ${connection.role ?? "pending"} connection: ${error.message}`);
    }
  }

  function panelState() {
    return {
      connected: Boolean(panel),
      panelVersion: panel?.panelVersion ?? null,
      tools: panel?.tools ?? [],
      inFlight: pending.size,
      agents: agents.size
    };
  }

  /** Fails an agent's command without it ever reaching the panel. */
  function refuse(connection, id, status) {
    send(connection, buildResult({ id, ok: false, status }));
  }

  function handleAgentCommand(connection, message) {
    if (!panel) {
      refuse(connection, message.id, panelMissing);
      return;
    }

    if (!panel.panelVersion) {
      refuse(connection, message.id, "The OpenLayer panel is connecting but has not finished its handshake yet.");
      return;
    }

    if (!panel.tools.includes(message.tool)) {
      // Refused here rather than by timeout: a panel built before this tool
      // existed will never reply, and the agent deserves to know why in
      // milliseconds instead of minutes.
      refuse(
        connection,
        message.id,
        `The connected OpenLayer panel (v${panel.panelVersion}) does not offer ${message.tool}. ` +
          `It offers: ${panel.tools.join(", ") || "nothing yet"}.`
      );
      return;
    }

    const hubId = `hub-${nextCommandId++}`;

    origins.set(hubId, { connection, agentId: message.id });

    const settled = pending.open(hubId, commandTimeoutMs);

    settled
      .then((outcome) => {
        deliver(hubId, buildResult({ id: message.id, ok: outcome.ok, status: outcome.status }));
      })
      .catch((error) => {
        deliver(hubId, buildResult({ id: message.id, ok: false, status: error.message }));
      });

    send(panel, buildCommand({ id: hubId, tool: message.tool, params: message.params }));
  }

  /**
   * Sends a reply to the agent that asked, if it is still there.
   *
   * An agent that disconnected mid-generation is the ordinary case, not an
   * error: the Claude session ended while Photoshop kept working. The panel
   * still finishes the job, and the answer has nowhere to go.
   */
  function deliver(hubId, frame) {
    const origin = origins.get(hubId);

    origins.delete(hubId);

    if (!origin || !agents.has(origin.connection)) {
      log(`Dropped a reply for ${hubId}: the agent that asked is gone.`);
      return;
    }

    send(origin.connection, frame);
  }

  return {
    /**
     * Registers a new connection whose role is not known yet, and returns the
     * handle its socket drives.
     *
     * The role arrives in the `hello`, not at connect time, so every connection
     * starts roleless and is promoted on its first frame.
     */
    attach({ send: write, close }) {
      const connection = { send: write, close, role: null, panelVersion: null, tools: [] };

      return {
        receive(raw) {
          const parsed = parseFrame(raw);

          if (!parsed.ok) {
            log(`Ignoring a frame: ${parsed.reason}`);
            return;
          }

          const message = parsed.message;

          if (message.type === "hello") {
            promote(connection, message);
            return;
          }

          if (!connection.role) {
            log(`Ignoring a ${message.type} from a connection that never said hello.`);
            return;
          }

          if (connection.role === "agent") {
            receiveFromAgent(connection, message);
          } else {
            receiveFromPanel(connection, message);
          }
        },

        detach(reason) {
          if (connection.role === "agent") {
            agents.delete(connection);

            // Its in-flight commands stay running: the panel is mid-generation
            // and stopping it because a Claude session closed would be worse
            // than finishing work nobody collects. The replies are dropped by
            // `deliver`.
            log(`An agent disconnected. ${agents.size} still connected.`);
            return 0;
          }

          // Scoped to this connection: replacing a panel closes the old socket,
          // whose close handler fires a tick later, and an unscoped detach would
          // tear down the panel that had just replaced it. Same identity check,
          // for the same reason, as `importBridge.register`'s unregister.
          if (panel !== connection) {
            return 0;
          }

          panel = null;

          return pending.rejectAll(reason);
        }
      };
    },

    state: panelState,
    agentCount: () => agents.size,
    hasPanel: () => Boolean(panel)
  };

  function promote(connection, message) {
    if (message.role === "agent") {
      connection.role = "agent";
      agents.add(connection);
      // Acknowledged so the agent can tell a real hub from anything else that
      // happens to be listening on this port. See `buildWelcome`.
      send(connection, buildWelcome(hubVersion, panelState()));
      log(`Agent connected (${message.client} ${message.clientVersion}). ${agents.size} connected.`);
      return;
    }

    if (panel && panel !== connection) {
      // Newest wins. Two Photoshop windows, or one that reloaded without its
      // old socket closing cleanly, would otherwise leave the hub holding a
      // dead handle and timing out every later command.
      log("A second panel connected; dropping the previous connection.");
      pending.rejectAll("The panel connection was replaced by a newer one.");
      panel.close?.();
    }

    connection.role = "panel";
    // Intersected rather than trusted: a panel is free to name a tool this
    // build has no surface for, and forwarding one would build a command
    // nothing could route.
    connection.panelVersion = message.panelVersion;
    connection.tools = message.tools.filter((tool) => AGENT_TOOLS.includes(tool));
    panel = connection;

    log(`Panel v${message.panelVersion} connected, offering: ${connection.tools.join(", ")}.`);
  }

  function receiveFromAgent(connection, message) {
    if (message.type === "command") {
      handleAgentCommand(connection, message);
      return;
    }

    if (message.type === "state") {
      send(
        connection,
        buildResult({
          id: message.id,
          ok: true,
          status: panel ? "Panel connected." : "Panel not connected.",
          data: panelState()
        })
      );
      return;
    }

    log(`Ignoring a ${message.type} from an agent, which may not send one.`);
  }

  function receiveFromPanel(connection, message) {
    if (message.type === "result") {
      if (!pending.settle(message.id, { ok: message.ok, status: message.status })) {
        // Expected, not alarming: the panel finished after the deadline, or
        // after being replaced. Logged because a run of these is the signature
        // of a timeout set too tight.
        log(`Discarded a late or unmatched result for ${message.id}.`);
      }

      return;
    }

    if (message.type === "event") {
      // Phase 2 has no subscriber for these yet. Parsed and dropped rather than
      // rejected, so a panel that starts sending them early costs nothing.
      return;
    }

    if (message.type === "ask") {
      send(
        connection,
        buildResult({ id: message.id, ok: false, status: "This hub does not implement ask_agent yet." })
      );
      return;
    }

    log(`Ignoring a ${message.type} from the panel, which may not send one.`);
  }
}
