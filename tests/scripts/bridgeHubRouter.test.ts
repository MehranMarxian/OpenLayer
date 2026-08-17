import { describe, expect, it } from "vitest";

// @ts-expect-error -- bridge/ is plain .mjs and sits outside the tsconfig `include`.
import { createHubRouter } from "../../bridge/src/hubRouter.mjs";

function createTimers() {
  const scheduled = new Map<number, () => void>();
  let nextId = 1;

  return {
    setTimer: (callback: () => void) => {
      const id = nextId++;
      scheduled.set(id, callback);
      return id;
    },
    clearTimer: (id: number) => scheduled.delete(id),
    fireAll: () => {
      const due = [...scheduled.values()];
      scheduled.clear();
      for (const callback of due) {
        callback();
      }
    }
  };
}

type Peer = {
  sent: Record<string, never>[];
  closed: boolean;
  receive: (raw: string) => void;
  detach: (reason?: string) => number;
  /** The hub's handshake reply, for agents. */
  welcome?: Record<string, never>;
};

function hub(options: Record<string, unknown> = {}) {
  const timers = createTimers();
  const router = createHubRouter({ log: () => {}, ...timers, ...options });

  function connect(): Peer {
    const sent: Record<string, never>[] = [];
    const peer = { sent, closed: false } as Peer;

    const handle = router.attach({
      send: (frame: string) => sent.push(JSON.parse(frame)),
      close: () => {
        peer.closed = true;
      }
    });

    peer.receive = handle.receive;
    peer.detach = (reason = "gone") => handle.detach(reason);

    return peer;
  }

  function panel(tools = ["text_to_image"], version = "0.15.0") {
    const peer = connect();

    peer.receive(
      JSON.stringify({ v: 1, type: "hello", role: "panel", panelVersion: version, tools })
    );

    return peer;
  }

  function agent(name = "claude") {
    const peer = connect();

    peer.receive(
      JSON.stringify({ v: 1, type: "hello", role: "agent", client: name, clientVersion: "1" })
    );

    // The hub welcomes every agent. That is handshake noise for every test but
    // the one about the handshake, so it is lifted out of `sent` and kept
    // separately rather than shifting the index of every reply under test.
    const [welcome] = peer.sent.splice(0, peer.sent.length);

    peer.welcome = welcome;

    return peer;
  }

  return { router, connect, panel, agent, timers };
}

const command = (id: string, tool = "text_to_image", params: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, type: "command", id, tool, params });

/**
 * Lets queued promise callbacks run.
 *
 * A reply reaches its agent through a `.then` on the pending request, so it
 * lands a microtask after the panel's frame arrives. Tests await this rather
 * than the router being made synchronous: routing really is asynchronous, and a
 * test that pretended otherwise would be testing something that does not exist.
 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createHubRouter", () => {
  it("treats a hello with no role as a panel, so an older plugin still works", () => {
    const test = hub();
    const peer = test.connect();

    peer.receive(
      JSON.stringify({ v: 1, type: "hello", panelVersion: "0.15.0", tools: ["text_to_image"] })
    );

    expect(test.router.hasPanel()).toBe(true);
    expect(test.router.state().panelVersion).toBe("0.15.0");
  });

  it("welcomes an agent, so it can tell a real hub from anything else on the port", () => {
    const test = hub({ hubVersion: "0.15.0" });
    const agent = test.agent();

    // Without this the only signal an agent gets is an open socket, which any
    // listening program provides. A stale pre-split bridge on 8199 accepted a
    // connection, mistook it for a panel, kicked the real panel off, and hung
    // the client for minutes — all of which looked like "connected".
    expect(agent.welcome).toMatchObject({ type: "welcome", hubVersion: "0.15.0" });
    expect(agent.welcome?.state).toMatchObject({ connected: false });
  });

  it("does not welcome a panel, which has its own status and ignores it", () => {
    const test = hub();
    const panel = test.panel();

    expect(panel.sent).toHaveLength(0);
  });

  it("refuses an agent command when no panel is connected", () => {
    const test = hub();
    const agent = test.agent();

    agent.receive(command("a-1"));

    expect(agent.sent[0]).toMatchObject({ type: "result", id: "a-1", ok: false });
    expect(agent.sent[0].status).toContain("turn on Agent Bridge");
  });

  it("refuses a tool the connected panel does not offer, without waiting", () => {
    const test = hub();

    test.panel(["text_to_image"]);
    const agent = test.agent();

    agent.receive(command("a-1", "inpaint"));

    expect(agent.sent[0]).toMatchObject({ ok: false });
    expect(agent.sent[0].status).toContain("does not offer inpaint");
  });

  it("forwards a command to the panel and routes the reply back", async () => {
    const test = hub();
    const panel = test.panel();
    const agent = test.agent();

    agent.receive(command("a-1", "text_to_image", { prompt: "a cat" }));

    expect(panel.sent).toHaveLength(1);
    expect(panel.sent[0]).toMatchObject({
      type: "command",
      tool: "text_to_image",
      params: { prompt: "a cat" }
    });

    // The hub mints its own id toward the panel rather than passing the
    // agent's through.
    expect(panel.sent[0].id).not.toBe("a-1");

    panel.receive(
      JSON.stringify({
        v: 1,
        type: "result",
        id: panel.sent[0].id,
        ok: true,
        status: "Imported as new layer."
      })
    );

    await flush();

    // ...and the agent gets its own id back, not the hub's.
    expect(agent.sent[0]).toMatchObject({
      type: "result",
      id: "a-1",
      ok: true,
      status: "Imported as new layer."
    });
  });

  it("keeps two agents' results apart even when they pick the same id", async () => {
    const test = hub();
    const panel = test.panel();
    const first = test.agent("claude");
    const second = test.agent("codex");

    // Both pick "req-1", which they have no way to coordinate and which is the
    // obvious first guess for anybody. Without hub-minted ids these cross.
    first.receive(command("req-1", "text_to_image", { prompt: "fox" }));
    second.receive(command("req-1", "text_to_image", { prompt: "cat" }));

    expect(panel.sent).toHaveLength(2);
    const [toFirst, toSecond] = panel.sent;
    expect(toFirst.id).not.toBe(toSecond.id);

    // Answer the second one first, to prove routing is by id and not by order.
    panel.receive(
      JSON.stringify({ v: 1, type: "result", id: toSecond.id, ok: true, status: "cat done" })
    );
    panel.receive(
      JSON.stringify({ v: 1, type: "result", id: toFirst.id, ok: true, status: "fox done" })
    );

    await flush();

    expect(second.sent[0]).toMatchObject({ id: "req-1", status: "cat done" });
    expect(first.sent[0]).toMatchObject({ id: "req-1", status: "fox done" });
  });

  it("answers a state request without touching the panel", () => {
    const test = hub();

    test.panel(["text_to_image"]);
    const agent = test.agent();

    agent.receive(JSON.stringify({ v: 1, type: "state", id: "a-1" }));

    expect(agent.sent[0]).toMatchObject({ type: "result", id: "a-1", ok: true });
    expect(agent.sent[0].data).toMatchObject({
      connected: true,
      panelVersion: "0.15.0",
      tools: ["text_to_image"],
      agents: 1
    });
  });

  it("fails in-flight commands back to their agents when the panel drops", async () => {
    const test = hub();
    const panel = test.panel();
    const agent = test.agent();

    agent.receive(command("a-1"));
    panel.detach("The OpenLayer panel disconnected.");

    await flush();

    expect(agent.sent[0]).toMatchObject({ id: "a-1", ok: false });
    expect(agent.sent[0].status).toContain("disconnected");
  });

  it("times a command out without leaving the agent waiting", async () => {
    const test = hub({ commandTimeoutMs: 600_000 });

    test.panel();
    const agent = test.agent();

    agent.receive(command("a-1"));
    test.timers.fireAll();

    await flush();

    expect(agent.sent[0]).toMatchObject({ id: "a-1", ok: false });
    expect(agent.sent[0].status).toContain("did not answer");
  });

  it("drops a reply whose agent has gone, without disturbing the panel", () => {
    const test = hub();
    const panel = test.panel();
    const agent = test.agent();

    agent.receive(command("a-1"));
    const hubId = panel.sent[0].id;

    // The Claude session ended mid-generation. Photoshop keeps working and
    // finishes the job; the answer simply has nowhere to go.
    agent.detach("agent gone");

    expect(() =>
      panel.receive(JSON.stringify({ v: 1, type: "result", id: hubId, ok: true, status: "done" }))
    ).not.toThrow();
    expect(agent.sent).toHaveLength(0);
  });

  it("does not stop a running generation when the agent that asked disconnects", () => {
    const test = hub();

    test.panel();
    const agent = test.agent();

    agent.receive(command("a-1"));

    // Reports zero abandoned: an agent leaving must not fail the panel's work.
    expect(agent.detach("agent gone")).toBe(0);
    expect(test.router.hasPanel()).toBe(true);
  });

  describe("when a second panel replaces the first", () => {
    it("closes the old socket and fails its in-flight work", async () => {
      const test = hub();
      const first = test.panel();
      const agent = test.agent();

      agent.receive(command("a-1"));
      test.panel();

      await flush();

      expect(first.closed).toBe(true);
      expect(agent.sent[0]).toMatchObject({ ok: false });
      expect(agent.sent[0].status).toContain("replaced by a newer one");
    });

    it("ignores the old socket's late close instead of detaching the new panel", () => {
      const test = hub();
      const first = test.panel();

      test.panel();

      // Closing a socket is async, so the first connection's close handler
      // fires after the replacement. Without the identity check this is where
      // the hub would believe it had no panel while holding a live socket.
      expect(first.detach("The OpenLayer panel disconnected.")).toBe(0);
      expect(test.router.hasPanel()).toBe(true);
    });
  });

  it("ignores a frame from a connection that never said hello", () => {
    const test = hub();
    const peer = test.connect();

    expect(() => peer.receive(command("a-1"))).not.toThrow();
    expect(peer.sent).toHaveLength(0);
  });

  it("ignores a command sent by the panel and a result sent by an agent", () => {
    const test = hub();
    const panel = test.panel();
    const agent = test.agent();

    // Direction is fixed per frame type; a peer sending the wrong one is a bug
    // in that peer, and must not be acted on.
    expect(() => panel.receive(command("x-1"))).not.toThrow();
    expect(() =>
      agent.receive(JSON.stringify({ v: 1, type: "result", id: "x", ok: true, status: "y" }))
    ).not.toThrow();
    expect(agent.sent).toHaveLength(0);
  });

  it("survives malformed frames", () => {
    const test = hub();
    const agent = test.agent();

    expect(() => agent.receive("{ not json")).not.toThrow();
    expect(() => agent.receive(JSON.stringify({ v: 99, type: "command" }))).not.toThrow();
    expect(agent.sent).toHaveLength(0);
  });
});
