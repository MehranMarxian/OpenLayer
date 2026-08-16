import { describe, expect, it } from "vitest";

// @ts-expect-error -- bridge/ is plain .mjs and sits outside the tsconfig `include`.
import { createPanelLink } from "../../bridge/src/panelLink.mjs";

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

/** A link with a fake socket attached, plus the frames that socket received. */
function connect({ handshake = true } = {}) {
  const timers = createTimers();
  const sent: Record<string, unknown>[] = [];
  const closed: string[] = [];
  const link = createPanelLink(timers);

  const detach = link.attach({
    send: (frame: string) => sent.push(JSON.parse(frame)),
    close: () => closed.push("closed")
  });

  if (handshake) {
    link.receive(
      JSON.stringify({
        v: 1,
        type: "hello",
        panelVersion: "0.15.0",
        tools: ["text_to_image", "upscale"]
      })
    );
  }

  return { link, detach, sent, closed, timers };
}

describe("createPanelLink", () => {
  it("refuses a command with no panel attached, and says how to fix it", async () => {
    const link = createPanelLink(createTimers());

    // The whole point is that this fails in milliseconds with something
    // actionable, rather than hanging the agent for a ten-minute timeout.
    await expect(link.dispatch({ tool: "text_to_image", params: {}, timeoutMs: 1000 })).rejects
      .toThrow(/Setup, and turn on Agent Bridge/);
  });

  it("refuses a command before the handshake completes", async () => {
    const { link } = connect({ handshake: false });

    expect(link.isReady()).toBe(false);
    await expect(
      link.dispatch({ tool: "text_to_image", params: {}, timeoutMs: 1000 })
    ).rejects.toThrow(/has not finished its handshake/);
  });

  it("records the handshake and reports state", () => {
    const { link } = connect();

    expect(link.isReady()).toBe(true);
    expect(link.state()).toEqual({
      connected: true,
      panelVersion: "0.15.0",
      tools: ["text_to_image", "upscale"],
      inFlight: 0
    });
  });

  it("ignores tools in a hello that this bridge has no surface for", () => {
    const timers = createTimers();
    const link = createPanelLink(timers);

    link.attach({ send: () => {}, close: () => {} });
    link.receive(
      JSON.stringify({
        v: 1,
        type: "hello",
        panelVersion: "0.15.0",
        tools: ["text_to_image", "launch_the_missiles"]
      })
    );

    expect(link.state().tools).toEqual(["text_to_image"]);
  });

  it("relays a command and resolves with the panel's own status text", async () => {
    const { link, sent } = connect();

    const settled = link.dispatch({
      tool: "text_to_image",
      params: { prompt: "a cat" },
      timeoutMs: 1000
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      v: 1,
      type: "command",
      tool: "text_to_image",
      params: { prompt: "a cat" }
    });

    link.receive(
      JSON.stringify({
        v: 1,
        type: "result",
        id: sent[0].id,
        ok: true,
        status: "Imported as new layer."
      })
    );

    await expect(settled).resolves.toEqual({ ok: true, status: "Imported as new layer." });
  });

  it("resolves rather than rejects when the panel reports a failure", async () => {
    const { link, sent } = connect();

    const settled = link.dispatch({ tool: "text_to_image", params: {}, timeoutMs: 1000 });

    link.receive(
      JSON.stringify({
        v: 1,
        type: "result",
        id: sent[0].id,
        ok: false,
        status: "Checkpoint not found on the server."
      })
    );

    // A failed generation is a successful relay. The agent gets the panel's real
    // message to pass on, and the MCP layer flags it with isError.
    await expect(settled).resolves.toEqual({
      ok: false,
      status: "Checkpoint not found on the server."
    });
  });

  it("refuses a tool this panel build does not offer, without waiting for a timeout", async () => {
    const { link } = connect();

    await expect(
      link.dispatch({ tool: "inpaint", params: {}, timeoutMs: 600_000 })
    ).rejects.toThrow(/does not offer inpaint/);
  });

  it("fails in-flight commands when the panel disconnects", async () => {
    const { link, detach } = connect();

    const settled = link.dispatch({ tool: "text_to_image", params: {}, timeoutMs: 600_000 });

    expect(detach("The OpenLayer panel disconnected.")).toBe(1);
    await expect(settled).rejects.toThrow(/disconnected/);
  });

  it("never reuses a request id, even across reconnects", () => {
    const { link, sent, detach } = connect();

    void link.dispatch({ tool: "text_to_image", params: {}, timeoutMs: 600_000 }).catch(() => {});
    const firstId = sent[0].id;

    detach("The OpenLayer panel disconnected.");

    // The same panel reconnects — Photoshop reloaded, or the toggle was flipped
    // off and on. A counter that restarted here would hand the next request the
    // id an in-flight command from the previous connection still answers to.
    const reconnected: Record<string, unknown>[] = [];
    link.attach({ send: (frame: string) => reconnected.push(JSON.parse(frame)), close: () => {} });
    link.receive(
      JSON.stringify({ v: 1, type: "hello", panelVersion: "0.15.0", tools: ["text_to_image"] })
    );

    void link.dispatch({ tool: "text_to_image", params: {}, timeoutMs: 600_000 }).catch(() => {});

    expect(reconnected).toHaveLength(1);
    expect(reconnected[0].id).not.toBe(firstId);
  });

  describe("when a second panel replaces the first", () => {
    it("closes the old socket and fails its in-flight work", async () => {
      const { link, sent, closed } = connect();

      const abandoned = link.dispatch({
        tool: "text_to_image",
        params: {},
        timeoutMs: 600_000
      });

      link.attach({ send: () => {}, close: () => {} });

      expect(closed).toEqual(["closed"]);
      await expect(abandoned).rejects.toThrow(/replaced by a newer one/);
      expect(sent).toHaveLength(1);
    });

    it("ignores the old socket's late close instead of detaching the new panel", async () => {
      const { link, detach: detachFirst } = connect();

      // Replace, then let the first socket's close handler fire — which is what
      // actually happens, a tick later, because closing a socket is async.
      const secondSent: Record<string, unknown>[] = [];
      link.attach({
        send: (frame: string) => secondSent.push(JSON.parse(frame)),
        close: () => {}
      });
      link.receive(
        JSON.stringify({ v: 1, type: "hello", panelVersion: "0.15.0", tools: ["text_to_image"] })
      );

      // Reports 0 abandoned: this detach belongs to a connection that is already
      // gone, so it has no business failing the new panel's work.
      expect(detachFirst("The OpenLayer panel disconnected.")).toBe(0);

      // Without the identity check in attach(), this is where the bridge would
      // believe it had no panel while holding a perfectly live socket.
      expect(link.isReady()).toBe(true);

      const settled = link.dispatch({ tool: "text_to_image", params: {}, timeoutMs: 600_000 });

      // The command reached the surviving socket rather than being rejected for
      // want of a panel. Settle it so the pending promise does not outlive the test.
      expect(secondSent).toHaveLength(1);
      link.receive(
        JSON.stringify({ v: 1, type: "result", id: secondSent[0].id, ok: true, status: "Done." })
      );
      await expect(settled).resolves.toEqual({ ok: true, status: "Done." });
    });
  });

  it("forwards events to a listener", () => {
    const { link } = connect();
    const seen: unknown[] = [];

    link.onEvent((event: unknown) => seen.push(event));
    link.receive(JSON.stringify({ v: 1, type: "event", name: "busy", payload: { isBusy: true } }));

    expect(seen).toEqual([{ name: "busy", payload: { isBusy: true } }]);
  });

  it("answers an ask instead of leaving a newer panel hanging", () => {
    const { link, sent } = connect();

    link.receive(JSON.stringify({ v: 1, type: "ask", id: "ask-1", question: "suggest a prompt" }));

    expect(sent[0]).toMatchObject({ type: "result", id: "ask-1", ok: false });
    expect(sent[0].status).toContain("does not implement ask_agent yet");
  });

  it("survives a malformed frame without throwing", () => {
    const { link } = connect();

    expect(() => link.receive("{ not json")).not.toThrow();
    expect(() => link.receive(JSON.stringify({ v: 1, type: "result" }))).not.toThrow();
    expect(link.isReady()).toBe(true);
  });
});
