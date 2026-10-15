import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMFY_REQUEST_TIMEOUT_MS,
  createComfyNotRespondingError,
  fetchWithTimeout,
  isComfyNotRespondingError
} from "../../src/comfy/requestTimeout";
import { ComfyClient } from "../../src/comfy/comfyClient";

const neverAnswers = () => new Promise<Response>(() => undefined);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchWithTimeout", () => {
  it("returns the response when ComfyUI answers in time, and leaves no timer behind", async () => {
    vi.useFakeTimers();
    const response = new Response("{}", { status: 200 });

    await expect(fetchWithTimeout(async () => response, "http://c/system_stats", undefined, "status")).resolves.toBe(
      response
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives up with a plain-language error when ComfyUI never answers", async () => {
    vi.useFakeTimers();
    const pending = fetchWithTimeout(neverAnswers, "http://c/system_stats", undefined, "status");
    const outcome = pending.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(COMFY_REQUEST_TIMEOUT_MS.status);
    const error = await outcome;

    expect(isComfyNotRespondingError(error)).toBe(true);
    expect((error as Error).message).toContain("did not answer a status check within 10 seconds");
    // Status strings render through textContent.
    expect((error as Error).message).not.toMatch(/`|--/);
  });

  it("does not give up a moment early", async () => {
    vi.useFakeTimers();
    let settled = false;
    void fetchWithTimeout(neverAnswers, "http://c/queue", undefined, "status").catch(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(COMFY_REQUEST_TIMEOUT_MS.status - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  it("aborts the request when the host supports it", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const pending = fetchWithTimeout(
      (_url, init) => {
        signal = init?.signal ?? undefined;
        return neverAnswers();
      },
      "http://c/view",
      undefined,
      "download"
    ).catch(() => undefined);

    await vi.advanceTimersByTimeAsync(COMFY_REQUEST_TIMEOUT_MS.download);
    await pending;
    expect(signal?.aborted).toBe(true);
  });

  it("names what it was doing, for each kind of request", () => {
    for (const kind of Object.keys(COMFY_REQUEST_TIMEOUT_MS) as Array<keyof typeof COMFY_REQUEST_TIMEOUT_MS>) {
      const error = createComfyNotRespondingError(kind, "http://c", COMFY_REQUEST_TIMEOUT_MS[kind]);

      expect(error.message).toMatch(/^ComfyUI did not answer [a-z ]+ within \d+ seconds\./);
      expect(error.technicalDetails).toContain("http://c");
    }
  });
});

describe("ComfyClient never waits forever", () => {
  it("routes every request through the time limit", () => {
    const source = readFileSync("src/comfy/comfyClient.ts", "utf8");
    // The one direct fetch is the wrapped call inside request().
    expect(source.match(/\bfetch\(/g)).toHaveLength(1);
    expect(source).toContain("fetchWithTimeout((target, options) => fetch(target, options)");
  });

  it("reports a frozen ComfyUI from Check ComfyUI instead of hanging", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", neverAnswers);
    const outcome = new ComfyClient("http://127.0.0.1:8188").checkOnline().catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(COMFY_REQUEST_TIMEOUT_MS.status);

    // Not "offline": it is running and not answering, which needs a different fix.
    expect(isComfyNotRespondingError(await outcome)).toBe(true);
  });

  it("still reports a stopped ComfyUI as offline", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(new ComfyClient("http://127.0.0.1:8188").checkOnline()).rejects.toMatchObject({ code: "COMFY_OFFLINE" });
  });

  it("rides out two unanswered history reads during a generation", async () => {
    vi.useFakeTimers();
    // The poll loop sleeps with window.setTimeout, as it must in UXP.
    vi.stubGlobal("window", globalThis);
    let reads = 0;
    vi.stubGlobal("fetch", (url: string) => {
      if (url.includes("/history/")) {
        reads += 1;
        if (reads <= 2) return neverAnswers();
        return Promise.resolve(
          new Response(JSON.stringify({ p1: { status: { status_str: "success" }, outputs: { "9": { images: [{ filename: "a.png", type: "output" }] } } } }))
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ queue_running: [], queue_pending: [] })));
    });

    const result = new ComfyClient("http://127.0.0.1:8188").pollUntilComplete("p1", { intervalMs: 10 });
    await vi.advanceTimersByTimeAsync(3 * COMFY_REQUEST_TIMEOUT_MS.status);

    await expect(result).resolves.toMatchObject({ status: { status_str: "success" } });
    expect(reads).toBe(3);
  });

  it("stops a generation after three unanswered history reads in a row", async () => {
    vi.useFakeTimers();
    // The poll loop sleeps with window.setTimeout, as it must in UXP.
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("fetch", (url: string) =>
      url.includes("/history/")
        ? neverAnswers()
        : Promise.resolve(new Response(JSON.stringify({ queue_running: [], queue_pending: [] })))
    );

    const outcome = new ComfyClient("http://127.0.0.1:8188")
      .pollUntilComplete("p1", { intervalMs: 10 })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(4 * COMFY_REQUEST_TIMEOUT_MS.status);

    expect(isComfyNotRespondingError(await outcome)).toBe(true);
  });
});
