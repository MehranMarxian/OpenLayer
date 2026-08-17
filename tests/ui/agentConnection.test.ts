import { describe, expect, it, vi } from "vitest";
import { AgentBridge } from "../../src/ui/agentBridge";
import {
  AgentConnectionStatus,
  createAgentConnection,
  OpenSocket,
  SocketHandlers
} from "../../src/ui/agentConnection";

/**
 * The socket is injected, so all of this runs in the node suite with no port
 * open and no UXP. `openWebSocket` is the only part left untested, and it holds
 * no decisions — it wires four callbacks and returns two methods.
 */
function harness({
  execute = vi.fn(async () => ({ ok: true, status: "Imported as new layer." })),
  registeredTools = () => ["text_to_image"],
  failToOpen = false
}: {
  execute?: AgentBridge["execute"];
  registeredTools?: () => string[];
  failToOpen?: boolean;
} = {}) {
  const sent: Record<string, unknown>[] = [];
  const statuses: AgentConnectionStatus[] = [];
  let handlers: SocketHandlers | null = null;
  let closed = false;

  const openSocket: OpenSocket = (_url, socketHandlers) => {
    if (failToOpen) {
      throw new Error("WebSocket is unavailable in this UXP environment.");
    }

    handlers = socketHandlers;

    return {
      send: (data) => sent.push(JSON.parse(data)),
      close: () => {
        closed = true;
      }
    };
  };

  const bridge = { execute, registeredTools } as unknown as AgentBridge;

  const connection = createAgentConnection({
    bridge,
    openSocket,
    panelVersion: "0.15.0",
    onStatus: (status) => statuses.push(status),
    log: () => {}
  });

  return {
    connection,
    sent,
    statuses,
    execute,
    get handlers() {
      return handlers as unknown as SocketHandlers;
    },
    get closed() {
      return closed;
    },
    latest: () => statuses[statuses.length - 1]
  };
}

const command = (id: string, tool = "text_to_image", params: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, type: "command", id, tool, params });

describe("createAgentConnection", () => {
  it("starts off and stays off until enabled", () => {
    const test = harness();

    expect(test.connection.isEnabled()).toBe(false);
    expect(test.connection.status().state).toBe("off");
  });

  it("announces its registered tools on open", () => {
    const test = harness();

    test.connection.enable(8199);
    expect(test.latest().state).toBe("connecting");

    test.handlers.onOpen();

    expect(test.sent[0]).toEqual({
      v: 1,
      type: "hello",
      panelVersion: "0.15.0",
      tools: ["text_to_image"]
    });
    expect(test.latest().state).toBe("connected");
    expect(test.latest().message).toContain("text_to_image");
  });

  it("runs a command and replies with the outcome", async () => {
    const test = harness();

    test.connection.enable(8199);
    test.handlers.onOpen();
    test.handlers.onMessage(command("req-1", "text_to_image", { prompt: "a cat" }));

    await vi.waitFor(() => expect(test.sent).toHaveLength(2));

    expect(test.execute).toHaveBeenCalledWith("text_to_image", { prompt: "a cat" });
    expect(test.sent[1]).toEqual({
      v: 1,
      type: "result",
      id: "req-1",
      ok: true,
      status: "Imported as new layer."
    });
  });

  it("relays a refusal as a result rather than silence", async () => {
    const test = harness({
      execute: vi.fn(async () => ({ ok: false, status: "OpenLayer is busy." }))
    });

    test.connection.enable(8199);
    test.handlers.onOpen();
    test.handlers.onMessage(command("req-1"));

    await vi.waitFor(() => expect(test.sent).toHaveLength(2));

    expect(test.sent[1]).toMatchObject({ id: "req-1", ok: false, status: "OpenLayer is busy." });
  });

  it("still replies when execute throws, so the agent is not left waiting", async () => {
    const test = harness({
      execute: vi.fn(async () => {
        throw new Error("Something unexpected.");
      })
    });

    test.connection.enable(8199);
    test.handlers.onOpen();
    test.handlers.onMessage(command("req-1"));

    await vi.waitFor(() => expect(test.sent).toHaveLength(2));

    // execute is written to always resolve; this is the belt to that braces,
    // because a missing reply costs the agent a ten-minute timeout.
    expect(test.sent[1]).toMatchObject({ id: "req-1", ok: false, status: "Something unexpected." });
  });

  it("drops an unparseable frame without replying or throwing", async () => {
    const test = harness();

    test.connection.enable(8199);
    test.handlers.onOpen();

    expect(() => test.handlers.onMessage("{ not json")).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Nothing to answer: a frame this broken has no id to address a reply to.
    expect(test.sent).toHaveLength(1);
    expect(test.execute).not.toHaveBeenCalled();
  });

  it("reports a bridge that stopped after being connected", () => {
    const test = harness();

    test.connection.enable(8199);
    test.handlers.onOpen();
    test.handlers.onClose();

    expect(test.latest().state).toBe("error");
    expect(test.latest().message).toContain("stopped");
    expect(test.latest().message).toContain("Turn Agent Bridge off and on");
    // Silent redialling is indistinguishable from a hung plugin, so the toggle
    // is the retry. Enabled must be cleared or the toggle would read as "on".
    expect(test.connection.isEnabled()).toBe(false);
  });

  it("distinguishes a bridge that was never there from one that stopped", () => {
    const test = harness();

    test.connection.enable(8199);
    // A refused connection arrives as onClose with no onOpen before it. Saying
    // "disconnected" here sends someone whose bridge was never running off
    // looking for the wrong problem — which is exactly what it did once.
    test.handlers.onClose();

    expect(test.latest().state).toBe("error");
    expect(test.latest().message).toContain("No agent bridge is listening");
    expect(test.latest().message).toContain("node bridge/src/main.mjs");
    expect(test.latest().message).not.toContain("stopped");
  });

  it("does not carry a previous success into the next attempt", () => {
    const test = harness();

    test.connection.enable(8199);
    test.handlers.onOpen();
    test.handlers.onClose();

    // Second attempt fails to connect. It must report "never there", not
    // inherit hasOpened from the attempt before it.
    test.connection.enable(8199);
    test.handlers.onClose();

    expect(test.latest().message).toContain("No agent bridge is listening");
  });

  it("reports a close after disable as off, not as an error", () => {
    const test = harness();

    test.connection.enable(8199);
    test.handlers.onOpen();
    test.connection.disable();
    test.handlers.onClose();

    expect(test.latest().state).toBe("off");
    expect(test.closed).toBe(true);
  });

  it("reports a host with no WebSocket as an actionable error", () => {
    const test = harness({ failToOpen: true });

    test.connection.enable(8199);

    expect(test.latest().state).toBe("error");
    expect(test.latest().message).toContain("8199");
    expect(test.connection.isEnabled()).toBe(false);
  });

  it("ignores a second enable while already connected", () => {
    const test = harness();

    test.connection.enable(8199);
    test.handlers.onOpen();
    const openCount = test.sent.length;

    test.connection.enable(8199);

    expect(test.sent).toHaveLength(openCount);
  });
});
