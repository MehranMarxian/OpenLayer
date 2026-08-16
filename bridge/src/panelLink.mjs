import { AGENT_TOOLS, buildCommand, parseInbound } from "./protocol.mjs";
import { createPendingRequests } from "./pendingRequests.mjs";

/**
 * The relay itself: one connected panel, a set of outstanding commands, and the
 * rules for what happens when either end goes away.
 *
 * Deliberately knows nothing about WebSockets. It is handed a `send` function
 * and fed frames through `receive`, so the whole of the interesting behaviour —
 * refusing a call with no panel attached, matching replies to requests,
 * surviving a reconnect mid-generation — is testable without a socket, a port,
 * or a timer that actually waits. `server.mjs` supplies the `ws` plumbing and
 * contains no logic worth testing.
 *
 * ## What this deliberately does not do
 *
 * It does not know whether a generation is currently allowed. The panel owns
 * that: invariant A4 (one active run) is enforced inside `generationController`,
 * and a command that arrives mid-run hits the same busy lockout an extra click
 * would. A second opinion here could only ever disagree with the first — the
 * same reasoning that keeps `importBridge` pushing capability rather than
 * recomputing it (`src/ui/importBridge.ts`). The bridge relays and reports.
 *
 * It also holds no Photoshop or ComfyUI concepts at all. The only two verbs it
 * has are "ask the panel to run a tool it already has" and "read back what the
 * panel said happened". Nothing here can reach `batchPlay`, and that is the
 * load-bearing safety property of the whole feature (`docs/mcp-bridge.md` §3.3).
 */
export function createPanelLink({ log = () => {}, setTimer, clearTimer } = {}) {
  const pending = createPendingRequests({ setTimer, clearTimer });

  /** @type {{ send: (frame: string) => void, panelVersion: string, tools: string[] } | null} */
  let panel = null;
  /** @type {((event: { name: string, payload?: unknown }) => void) | null} */
  let eventListener = null;

  // Never reset, not even across reconnects. A counter that restarted at 1
  // could match a late reply from the previous connection to a fresh request
  // and hand an agent another generation's status.
  let nextId = 1;

  const disconnectMessage =
    "The OpenLayer panel is not connected. In Photoshop, open the OpenLayer panel, " +
    "go to Setup, and turn on Agent Bridge.";

  return {
    /**
     * Registers the panel's socket. A second connection replaces the first
     * rather than being refused.
     *
     * Two Photoshop windows, or one that reloaded without its old socket
     * closing cleanly, would otherwise leave the bridge holding a dead handle
     * and silently timing out every call. Newest-wins is the recoverable
     * choice: the stale connection is dropped, its in-flight work is failed
     * with a reason, and the tester's most recent action is the one that works.
     * `docs/mcp-bridge.md` §5 leaves genuine multi-panel arbitration open; this
     * is the behaviour that fails understandably until then.
     */
    attach({ send, close }) {
      if (panel) {
        log("A second panel connected; dropping the previous connection.");
        pending.rejectAll("The panel connection was replaced by a newer one.");
        panel.close?.();
      }

      const connection = { send, close, panelVersion: null, tools: [] };

      panel = connection;

      // Returns a detach scoped to *this* connection, and that scoping is
      // load-bearing rather than tidy. Replacing a panel closes the old socket,
      // which fires its close handler a tick later; an unscoped detach would
      // then tear down the connection that had just replaced it, leaving a live
      // socket the bridge believes is gone. Same identity check, for the same
      // reason, as `importBridge.register`'s unregister in src/ui/importBridge.ts.
      return (reason) => {
        if (panel !== connection) {
          return 0;
        }

        panel = null;

        return pending.rejectAll(reason);
      };
    },

    /** Whether a panel has connected *and* completed its handshake. */
    isReady: () => Boolean(panel?.panelVersion),

    state: () => ({
      connected: Boolean(panel),
      panelVersion: panel?.panelVersion ?? null,
      tools: panel?.tools ?? [],
      inFlight: pending.size
    }),

    onEvent(listener) {
      eventListener = listener;
    },

    /**
     * Sends a tool command and resolves with the panel's own account of what
     * happened.
     *
     * Resolves rather than rejects on a failed generation: `{ ok: false }` with
     * the panel's status text is a *successful relay* of a real answer, and an
     * agent handles "the model produced nothing usable, here is why" far better
     * than an exception. Rejection is reserved for the cases where no answer
     * exists — no panel, no such tool, or the deadline passed.
     */
    async dispatch({ tool, params, timeoutMs }) {
      if (!panel) {
        throw new Error(disconnectMessage);
      }

      if (!panel.panelVersion) {
        throw new Error("The OpenLayer panel is connecting but has not finished its handshake yet.");
      }

      if (!panel.tools.includes(tool)) {
        // Caught here rather than by timeout, because a panel built before this
        // tool existed will never reply and the agent deserves to know why in
        // milliseconds instead of minutes.
        throw new Error(
          `The connected OpenLayer panel (v${panel.panelVersion}) does not offer ${tool}. ` +
            `It offers: ${panel.tools.join(", ") || "nothing yet"}.`
        );
      }

      const id = `req-${nextId++}`;
      const settled = pending.open(id, timeoutMs);

      try {
        panel.send(JSON.stringify(buildCommand({ id, tool, params })));
      } catch (error) {
        // The send failed, so no reply can ever arrive for this id and its
        // ten-minute timer is pure waste. Cleared with `settle` rather than a
        // rejection because nothing is awaiting `settled` yet — this function
        // throws instead of returning it — and rejecting a promise with no
        // handler attached would surface as an unhandled rejection rather than
        // as the error below.
        pending.settle(id, null);

        throw new Error(`Could not reach the OpenLayer panel: ${error.message}`, {
          cause: error
        });
      }

      return settled;
    },

    /**
     * Feeds one raw frame in. Never throws: this runs on a socket's data
     * handler, where an exception would take down a relay that should survive
     * a single bad frame.
     */
    receive(raw) {
      const parsed = parseInbound(raw);

      if (!parsed.ok) {
        log(`Ignoring a frame from the panel: ${parsed.reason}`);
        return;
      }

      const message = parsed.message;

      if (message.type === "hello") {
        if (!panel) {
          log("Ignoring a hello from a panel that is no longer attached.");
          return;
        }

        // Intersected rather than trusted: a panel is free to name a tool this
        // bridge has no MCP surface for, and dispatching one would build a
        // command the panel could not route.
        panel.panelVersion = message.panelVersion;
        panel.tools = message.tools.filter((tool) => AGENT_TOOLS.includes(tool));

        log(`Panel v${message.panelVersion} connected, offering: ${panel.tools.join(", ")}.`);
        return;
      }

      if (message.type === "result") {
        const matched = pending.settle(message.id, {
          ok: message.ok,
          status: message.status
        });

        if (!matched) {
          // Expected, not alarming — see pendingRequests.mjs. Logged because a
          // sudden run of these is the signature of timeouts set too tight.
          log(`Discarded a late or duplicate result for ${message.id}.`);
        }

        return;
      }

      if (message.type === "event") {
        eventListener?.({ name: message.name, payload: message.payload });
        return;
      }

      // `ask` is Phase 3. Parsed already so a newer panel gets a real answer
      // rather than silence, which would look identical to a hung bridge.
      if (message.type === "ask") {
        panel?.send(
          JSON.stringify({
            v: 1,
            type: "result",
            id: message.id,
            ok: false,
            status: "This bridge does not implement ask_agent yet."
          })
        );
      }
    }
  };
}
