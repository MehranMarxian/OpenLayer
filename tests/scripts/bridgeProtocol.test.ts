import { describe, expect, it } from "vitest";

// @ts-expect-error -- bridge/ is plain .mjs and sits outside the tsconfig `include`.
import { buildCommand, parseFrame, PROTOCOL_VERSION } from "../../bridge/src/protocol.mjs";
// @ts-expect-error -- see above.
import { createPendingRequests } from "../../bridge/src/pendingRequests.mjs";

describe("buildCommand", () => {
  it("stamps the protocol version and defaults params to an object", () => {
    expect(buildCommand({ id: "req-1", tool: "text_to_image" })).toEqual({
      v: PROTOCOL_VERSION,
      type: "command",
      id: "req-1",
      tool: "text_to_image",
      params: {}
    });
  });

  it("refuses a tool the panel could never route", () => {
    expect(() => buildCommand({ id: "req-1", tool: "delete_everything" })).toThrow(/Unknown tool/);
  });

  it("refuses an empty id, which would make replies unmatchable", () => {
    expect(() => buildCommand({ id: "", tool: "text_to_image" })).toThrow(/non-empty string id/);
  });
});

describe("parseFrame", () => {
  const frame = (message: Record<string, unknown>) => JSON.stringify(message);

  it("accepts a well-formed result", () => {
    const parsed = parseFrame(
      frame({ v: 1, type: "result", id: "req-1", ok: true, status: "Imported as new layer." })
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.message.status).toBe("Imported as new layer.");
  });

  it("accepts a hello and an event", () => {
    expect(
      parseFrame(frame({ v: 1, type: "hello", panelVersion: "0.15.0", tools: ["text_to_image"] }))
        .ok
    ).toBe(true);
    expect(parseFrame(frame({ v: 1, type: "event", name: "busy" })).ok).toBe(true);
  });

  it("reports rather than throws on junk, since this runs on a socket handler", () => {
    expect(parseFrame("not json")).toEqual({ ok: false, reason: "Frame was not valid JSON." });
    expect(parseFrame("[1,2,3]").ok).toBe(false);
    expect(parseFrame(frame({ v: 1, type: "nonsense" })).ok).toBe(false);
  });

  it("names both versions in a mismatch, because that is the update-one-half error", () => {
    const parsed = parseFrame(frame({ v: 99, type: "event", name: "busy" }));

    expect(parsed.ok).toBe(false);
    // A tester who updated the plugin but not the separately installed bridge
    // needs to be told which half is behind, not just that something is wrong.
    expect(parsed.reason).toContain("v1");
    expect(parsed.reason).toContain("99");
  });

  it("rejects a result missing the fields that make it a result", () => {
    expect(parseFrame(frame({ v: 1, type: "result", ok: true, status: "x" })).ok).toBe(false);
    expect(parseFrame(frame({ v: 1, type: "result", id: "req-1", status: "x" })).ok).toBe(false);
    expect(parseFrame(frame({ v: 1, type: "result", id: "req-1", ok: true })).ok).toBe(false);
  });
});

/** A timer queue that never actually waits, so a 10-minute timeout is testable. */
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
    },
    get outstanding() {
      return scheduled.size;
    }
  };
}

describe("createPendingRequests", () => {
  it("settles a request with its matching reply and clears the timer", async () => {
    const timers = createTimers();
    const pending = createPendingRequests(timers);

    const settled = pending.open("req-1", 1000);
    expect(pending.size).toBe(1);

    expect(pending.settle("req-1", { ok: true, status: "done" })).toBe(true);
    await expect(settled).resolves.toEqual({ ok: true, status: "done" });

    expect(pending.size).toBe(0);
    // The timer must go with it, or a settled request still fires a rejection
    // into a promise that already resolved.
    expect(timers.outstanding).toBe(0);
  });

  it("rejects on timeout with a message that says the run may still be going", async () => {
    const timers = createTimers();
    const pending = createPendingRequests(timers);

    const settled = pending.open("req-1", 600_000);
    timers.fireAll();

    await expect(settled).rejects.toThrow(/did not answer within 600s/);
    await expect(settled).rejects.toThrow(/may still be running in Photoshop/);
  });

  it("discards a reply that arrives after its timeout instead of throwing", async () => {
    const timers = createTimers();
    const pending = createPendingRequests(timers);

    const settled = pending.open("req-1", 1000);
    timers.fireAll();
    await expect(settled).rejects.toThrow();

    // The panel finished two seconds late and answered anyway. That is ordinary,
    // and must not be reported as an error or re-settle a dead promise.
    expect(pending.settle("req-1", { ok: true, status: "done" })).toBe(false);
  });

  it("fails everything outstanding when the panel goes away", async () => {
    const timers = createTimers();
    const pending = createPendingRequests(timers);

    const first = pending.open("req-1", 1000);
    const second = pending.open("req-2", 1000);

    expect(pending.rejectAll("The OpenLayer panel disconnected.")).toBe(2);

    await expect(first).rejects.toThrow(/disconnected/);
    await expect(second).rejects.toThrow(/disconnected/);
    expect(timers.outstanding).toBe(0);
  });

  it("refuses to reuse an id, which would cross two agents' results", () => {
    const pending = createPendingRequests(createTimers());

    pending.open("req-1", 1000);
    expect(() => pending.open("req-1", 1000)).toThrow(/already pending/);
  });
});
