import { AgentBridge } from "./agentBridge";
import { AgentToolId, buildHello, buildResult, parseCommand } from "./agentProtocol";

/**
 * Holds the panel's outbound connection to the bridge process, and turns
 * incoming commands into `agentBridge.execute` calls.
 *
 * The panel dials out because it has no choice: a UXP panel cannot listen on a
 * port. So the bridge is the server even though the panel is the thing being
 * driven.
 *
 * ## Why it never reconnects on its own
 *
 * A dropped connection sets an error status and stops. It does not retry on a
 * timer, and that is a deliberate choice rather than a missing feature: a panel
 * quietly redialling a socket every few seconds is indistinguishable, from the
 * outside, from a plugin that has hung — and it would keep a failed connection
 * producing log noise for the rest of the session. The toggle is the retry.
 *
 * The socket is injected rather than constructed here so the whole of this
 * module's behaviour is testable in the node suite. `openWebSocket` below is
 * the only part that touches UXP, and it holds no decisions.
 */

export type AgentConnectionState = "off" | "connecting" | "connected" | "error";

export type AgentConnectionStatus = {
  state: AgentConnectionState;
  message: string;
};

export type AgentSocket = {
  send: (data: string) => void;
  close: () => void;
};

export type SocketHandlers = {
  onOpen: () => void;
  onMessage: (data: unknown) => void;
  onClose: () => void;
  onError: (message: string) => void;
};

export type OpenSocket = (url: string, handlers: SocketHandlers) => AgentSocket;

export type AgentConnection = {
  enable: (port: number) => void;
  disable: () => void;
  isEnabled: () => boolean;
  status: () => AgentConnectionStatus;
};

/**
 * How a tester starts the missing half. Repeated in the status line because
 * "could not connect" without it is a dead end — the bridge is a separate
 * install, so a perfectly healthy panel legitimately shows this on first run.
 */
export const BRIDGE_START_HINT = "Start it from the OpenLayer folder: cd bridge && npm install, then run it from your MCP client.";

export function createAgentConnection({
  bridge,
  openSocket,
  panelVersion,
  onStatus,
  log = (message: string) => console.warn(`[OpenLayer] ${message}`)
}: {
  bridge: AgentBridge;
  openSocket: OpenSocket;
  panelVersion: string;
  onStatus: (status: AgentConnectionStatus) => void;
  log?: (message: string) => void;
}): AgentConnection {
  let socket: AgentSocket | null = null;
  let enabled = false;
  let status: AgentConnectionStatus = { state: "off", message: "Agent Bridge is off." };

  const setStatus = (next: AgentConnectionStatus) => {
    status = next;
    onStatus(next);
  };

  const send = (payload: unknown) => {
    try {
      socket?.send(JSON.stringify(payload));
    } catch (error) {
      log(`Could not send to the agent bridge. ${error instanceof Error ? error.message : error}`);
    }
  };

  async function handleCommand(raw: unknown) {
    const parsed = parseCommand(raw);

    if (!parsed.ok) {
      // Nothing to reply to — a frame this broken has no id to answer with —
      // so it is logged and dropped rather than crashing the socket handler.
      log(`Ignoring a frame from the agent bridge: ${parsed.reason}`);
      return;
    }

    const { id, tool, params } = parsed.command;

    // `execute` is written to always resolve, but a reply is the one thing that
    // must not depend on that: without it the agent waits out a ten-minute
    // timeout. The catch is the belt to that braces.
    try {
      const outcome = await bridge.execute(tool as AgentToolId, params);

      send(buildResult(id, outcome.ok, outcome.status));
    } catch (error) {
      send(buildResult(id, false, error instanceof Error ? error.message : String(error)));
    }
  }

  return {
    enable(port) {
      if (enabled) {
        return;
      }

      enabled = true;

      const url = `ws://127.0.0.1:${port}`;

      setStatus({ state: "connecting", message: `Connecting to the agent bridge on 127.0.0.1:${port}...` });

      try {
        socket = openSocket(url, {
          onOpen: () => {
            // The handshake tells the bridge which tools this build actually
            // registered, so it can refuse a call for a missing one instead of
            // sending a command nothing will answer.
            const tools = bridge.registeredTools();

            send(buildHello(panelVersion, tools));
            setStatus({
              state: "connected",
              message: `Connected. An agent can drive: ${tools.join(", ") || "nothing yet"}.`
            });
          },
          onMessage: (data) => {
            void handleCommand(data);
          },
          onClose: () => {
            socket = null;

            if (enabled) {
              // Enabled but closed means the bridge went away, not that the
              // user turned this off. Say so, and say the toggle is the retry.
              enabled = false;
              setStatus({
                state: "error",
                message: `The agent bridge on 127.0.0.1:${port} disconnected. Turn Agent Bridge off and on to reconnect.`
              });
            } else {
              setStatus({ state: "off", message: "Agent Bridge is off." });
            }
          },
          onError: (message) => {
            log(`Agent bridge socket error. ${message}`);
          }
        });
      } catch (error) {
        enabled = false;
        socket = null;
        setStatus({
          state: "error",
          message: `Could not reach the agent bridge on 127.0.0.1:${port}. ${BRIDGE_START_HINT}`
        });
        log(`Could not open the agent bridge socket. ${error instanceof Error ? error.message : error}`);
      }
    },

    disable() {
      // Cleared before closing so the close handler reports "off" rather than
      // the disconnected-unexpectedly error.
      enabled = false;

      const open = socket;

      socket = null;
      setStatus({ state: "off", message: "Agent Bridge is off." });

      try {
        open?.close();
      } catch (error) {
        log(`Could not close the agent bridge socket. ${error instanceof Error ? error.message : error}`);
      }
    },

    isEnabled: () => enabled,
    status: () => status
  };
}

/**
 * The real socket. The only UXP-touching code here, and it holds no decisions.
 *
 * `WebSocket` is feature-detected because `comfyClient.watchProgress` already
 * does the same — UXP has shipped builds without it, and a missing constructor
 * must surface as a status message rather than a thrown ReferenceError during
 * panel setup.
 */
export const openWebSocket: OpenSocket = (url, handlers) => {
  if (typeof WebSocket !== "function") {
    throw new Error("WebSocket is unavailable in this UXP environment.");
  }

  const socket = new WebSocket(url);

  socket.onopen = () => handlers.onOpen();
  socket.onmessage = (event) => handlers.onMessage(event.data);
  socket.onclose = () => handlers.onClose();
  socket.onerror = () => handlers.onError("The connection reported an error.");

  return {
    send: (data) => socket.send(data),
    close: () => socket.close()
  };
};
