import { afterEach, describe, expect, it, vi } from "vitest";
import { createPhotoshopDocumentIdentity } from "../../src/photoshop/documentContext";
import {
  LivePaintingSessionV2,
  type LivePaintingV2Callbacks,
  type LivePaintingV2Options,
  type PhotoshopActionModule
} from "../../src/ui/tools/livePainting";

const origin = createPhotoshopDocumentIdentity(7, "Live.psd");
const completeHistory = { outputs: {} };

const completeInventory = {
  checkpoints: [],
  diffusionModels: ["krea2_turbo_fp8_scaled.safetensors"],
  clipModels: ["qwen3vl_4b_fp8_scaled.safetensors"],
  vaeModels: ["qwen_image_vae.safetensors"],
  controlNetModels: [],
  visionLanguageModels: [],
  upscaleModels: [],
  missingSources: []
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function createFakeClient(overrides: Record<string, unknown> = {}) {
  let nextPrompt = 0;
  const client = {
    checkOnline: vi.fn(async () => undefined),
    getLoraNames: vi.fn(async () => ["lcm/SD1.5/pytorch_lora_weights.safetensors"]),
    getModelInventory: vi.fn(async () => completeInventory),
    uploadImage: vi.fn(async (_blob: Blob, fileName?: string) => fileName ?? "source.png"),
    submitPrompt: vi.fn(async () => `prompt-${++nextPrompt}`),
    pollUntilComplete: vi.fn(async () => completeHistory),
    retrieveFirstOutputImage: vi.fn(async () => ({ blob: new Blob(["result"], { type: "image/png" }) })),
    cancelPrompt: vi.fn(async () => "interrupted" as const)
  };

  return Object.assign(client, overrides);
}

function createFakeActionModule() {
  const handlers = new Map<string, (eventName: string, descriptor: unknown) => void>();
  const readEventName = (events: readonly string[] | readonly { event: string }[]) => {
    const first = events[0];
    return typeof first === "string" ? first : first.event;
  };
  const actionModule: PhotoshopActionModule = {
    addNotificationListener: vi.fn(async (events, handler) => {
      handlers.set(readEventName(events), handler);
    }),
    removeNotificationListener: vi.fn(async (events) => {
      handlers.delete(readEventName(events));
    })
  };

  return {
    actionModule,
    trigger(eventName: string) {
      handlers.get(eventName)?.(eventName, {});
    }
  };
}

function createCallbacks(): LivePaintingV2Callbacks {
  return {
    onStatus: vi.fn(),
    onTimings: vi.fn(),
    onPreviewBlob: vi.fn(),
    onRefineResult: vi.fn(),
    onStateChanged: vi.fn(),
    onStopped: vi.fn()
  };
}

function createHarness(
  options: Partial<LivePaintingV2Options> = {},
  clientOverrides: Record<string, unknown> = {}
) {
  const client = createFakeClient(clientOverrides);
  const callbacks = createCallbacks();
  const action = createFakeActionModule();
  const capture = vi.fn(async (maxDimension: number) => ({
    blob: new Blob([`capture-${maxDimension}`], { type: "image/png" }),
    width: maxDimension,
    height: Math.max(64, Math.round(maxDimension / 2)),
    mode: "non-modal-scaled" as const,
    captureMs: 1,
    originatingDocument: origin
  }));
  const session = new LivePaintingSessionV2(
    {
      checkpointName: "sd15.safetensors",
      prompt: "a painted harbor",
      denoise: 0.6,
      ...options
    },
    callbacks,
    {
      client,
      capture,
      actionModule: action.actionModule,
      timers: {
        setTimeout: (handler, delayMs) => globalThis.setTimeout(handler, delayMs),
        clearTimeout: (timer) => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>)
      }
    }
  );

  return { session, client, callbacks, action, capture };
}

async function startAndWaitForLive(harness: ReturnType<typeof createHarness>) {
  await harness.session.start();
  await vi.waitFor(() => {
    expect(harness.callbacks.onPreviewBlob).toHaveBeenCalledTimes(1);
  });
}

async function flushAsyncWork(turns = 20) {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve();
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("LivePaintingSessionV2", () => {
  it("publishes a live preview with its originating document and per-cycle timings", async () => {
    const harness = createHarness();

    await startAndWaitForLive(harness);

    expect(harness.session.getState()).toBe("listening");
    expect(harness.capture).toHaveBeenCalledWith(512);
    expect(harness.callbacks.onPreviewBlob).toHaveBeenCalledWith(expect.any(Blob), origin);
    expect(harness.callbacks.onTimings).toHaveBeenCalledWith(
      expect.stringMatching(/^Cycle 1: \| capture \d+ms \(non-modal-scaled, 512x256\) \| upload \d+ms \| generate \d+ms \| total \d+\.\d{2}s$/)
    );
    expect(harness.client.pollUntilComplete.mock.calls[0][1]).toMatchObject({
      intervalMs: 250,
      timeoutMs: 120000
    });
    expect(harness.client.submitPrompt.mock.calls[0][0]["3"].inputs).toMatchObject({
      denoise: 0.6,
      sampler_name: "lcm"
    });

    harness.session.stop();
  });

  it("drops three rapid strokes into at most one follow-up live cycle", async () => {
    const firstPoll = createDeferred<typeof completeHistory>();
    const secondPoll = createDeferred<typeof completeHistory>();
    const pollUntilComplete = vi.fn()
      .mockImplementationOnce(() => firstPoll.promise)
      .mockImplementationOnce(() => secondPoll.promise);
    const harness = createHarness({}, { pollUntilComplete });

    await harness.session.start();
    await vi.waitFor(() => expect(harness.client.submitPrompt).toHaveBeenCalledTimes(1));

    harness.action.trigger("paint");
    harness.action.trigger("paint");
    harness.action.trigger("paint");
    expect(harness.client.submitPrompt).toHaveBeenCalledTimes(1);

    firstPoll.resolve(completeHistory);
    await vi.waitFor(() => expect(harness.client.submitPrompt).toHaveBeenCalledTimes(2));
    secondPoll.resolve(completeHistory);
    await vi.waitFor(() => expect(harness.callbacks.onPreviewBlob).toHaveBeenCalledTimes(2));

    expect(harness.client.submitPrompt.mock.calls.length).toBeLessThanOrEqual(2);
    expect(harness.capture).toHaveBeenCalledTimes(2);
    harness.session.stop();
  });

  it("submits the Krea-2 workflow and publishes the refine result", async () => {
    const harness = createHarness({ refineDenoise: 0.47 });
    await startAndWaitForLive(harness);

    harness.session.refineNow();
    await vi.waitFor(() => expect(harness.callbacks.onRefineResult).toHaveBeenCalledTimes(1));

    const workflow = harness.client.submitPrompt.mock.calls[1][0];
    expect(workflow["20"]).toMatchObject({
      class_type: "UNETLoader",
      inputs: { unet_name: "krea2_turbo_fp8_scaled.safetensors" }
    });
    expect(workflow["3"].inputs).toMatchObject({ denoise: 0.47, steps: 8 });
    expect(harness.capture).toHaveBeenLastCalledWith(1024);
    expect(harness.client.pollUntilComplete.mock.calls[1][1]).toMatchObject({
      intervalMs: 500,
      timeoutMs: 180000
    });
    expect(harness.callbacks.onRefineResult).toHaveBeenCalledWith(expect.any(Blob), origin);
    expect(harness.session.getState()).toBe("refined");

    harness.session.stop();
  });

  it("lets a refine finish before running the live cycle queued by a stroke", async () => {
    const refinePoll = createDeferred<typeof completeHistory>();
    let pollCall = 0;
    const pollUntilComplete = vi.fn(() => {
      pollCall += 1;
      return pollCall === 2 ? refinePoll.promise : Promise.resolve(completeHistory);
    });
    const harness = createHarness({}, { pollUntilComplete });
    const published: string[] = [];
    vi.mocked(harness.callbacks.onPreviewBlob).mockImplementation(() => published.push("live"));
    vi.mocked(harness.callbacks.onRefineResult).mockImplementation(() => published.push("refine"));
    await startAndWaitForLive(harness);
    published.length = 0;

    harness.session.refineNow();
    await vi.waitFor(() => expect(harness.client.submitPrompt).toHaveBeenCalledTimes(2));
    harness.action.trigger("paint");
    expect(harness.client.submitPrompt).toHaveBeenCalledTimes(2);
    expect(harness.client.cancelPrompt).not.toHaveBeenCalled();

    refinePoll.resolve(completeHistory);
    await vi.waitFor(() => expect(harness.client.submitPrompt).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(harness.callbacks.onPreviewBlob).toHaveBeenCalledTimes(2));

    expect(published).toEqual(["refine", "live"]);
    harness.session.stop();
  });

  it("cancels and restarts an in-flight refine when refineNow is pressed again", async () => {
    const firstRefinePoll = createDeferred<typeof completeHistory>();
    let pollCall = 0;
    const pollUntilComplete = vi.fn(() => {
      pollCall += 1;
      return pollCall === 2 ? firstRefinePoll.promise : Promise.resolve(completeHistory);
    });
    const harness = createHarness({}, { pollUntilComplete });
    await startAndWaitForLive(harness);

    harness.session.refineNow();
    await vi.waitFor(() => expect(harness.client.submitPrompt).toHaveBeenCalledTimes(2));
    harness.session.refineNow();

    expect(harness.client.cancelPrompt).toHaveBeenCalledTimes(1);
    expect(harness.client.cancelPrompt).toHaveBeenCalledWith("prompt-2");

    firstRefinePoll.resolve(completeHistory);
    await vi.waitFor(() => expect(harness.client.submitPrompt).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(harness.callbacks.onRefineResult).toHaveBeenCalledTimes(1));

    expect(harness.client.submitPrompt.mock.calls[2][0]["20"].class_type).toBe("UNETLoader");
    harness.session.stop();
  });

  it("auto-refines after a pause only when the option is enabled", async () => {
    vi.useFakeTimers();

    const disabled = createHarness({ autoRefineOnPause: false, pauseSeconds: 4 });
    await disabled.session.start();
    await flushAsyncWork();
    disabled.action.trigger("paint");
    await flushAsyncWork();
    await vi.advanceTimersByTimeAsync(4000);
    await flushAsyncWork();

    expect(disabled.client.submitPrompt).toHaveBeenCalledTimes(2);
    expect(disabled.callbacks.onRefineResult).not.toHaveBeenCalled();
    disabled.session.stop();

    const enabled = createHarness({ autoRefineOnPause: true, pauseSeconds: 4 });
    await enabled.session.start();
    await flushAsyncWork();
    enabled.action.trigger("paint");
    await flushAsyncWork();
    await vi.advanceTimersByTimeAsync(3999);
    await flushAsyncWork();
    expect(enabled.callbacks.onRefineResult).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flushAsyncWork();
    expect(enabled.callbacks.onRefineResult).toHaveBeenCalledTimes(1);
    expect(enabled.client.submitPrompt.mock.calls[2][0]["20"].class_type).toBe("UNETLoader");
    enabled.session.stop();
  });

  it("reports a refine setup gap, skips refine, and keeps the live tier working", async () => {
    const missingInventory = {
      ...completeInventory,
      diffusionModels: []
    };
    const harness = createHarness({}, {
      getModelInventory: vi.fn(async () => missingInventory)
    });
    await startAndWaitForLive(harness);

    harness.session.refineNow();
    expect(harness.callbacks.onStatus).toHaveBeenCalledWith(
      expect.stringContaining("Krea-2 refine setup is missing: diffusion model")
    );
    expect(harness.client.submitPrompt).toHaveBeenCalledTimes(1);

    harness.action.trigger("paint");
    await vi.waitFor(() => expect(harness.callbacks.onPreviewBlob).toHaveBeenCalledTimes(2));
    expect(harness.client.submitPrompt).toHaveBeenCalledTimes(2);
    harness.session.stop();
  });

  it("stops after three consecutive live or refine cycle failures", async () => {
    const harness = createHarness();
    harness.capture.mockRejectedValue(new Error("ComfyUI disappeared"));

    await harness.session.start();
    await vi.waitFor(() => {
      expect(harness.callbacks.onStatus).toHaveBeenCalledWith(expect.stringContaining("(1/3 consecutive)"));
    });

    harness.action.trigger("paint");
    await vi.waitFor(() => {
      expect(harness.callbacks.onStatus).toHaveBeenCalledWith(expect.stringContaining("(2/3 consecutive)"));
    });

    harness.action.trigger("paint");
    await vi.waitFor(() => expect(harness.callbacks.onStopped).toHaveBeenCalledTimes(1));

    expect(harness.session.getState()).toBe("stopped");
    expect(harness.callbacks.onStopped).toHaveBeenCalledWith(
      expect.stringContaining("stopped after 3 consecutive cycle failures")
    );
  });

  it("stop cancels the current prompt, removes listeners, and is idempotent", async () => {
    const poll = createDeferred<typeof completeHistory>();
    const harness = createHarness({}, {
      pollUntilComplete: vi.fn(() => poll.promise)
    });
    await harness.session.start();
    await vi.waitFor(() => expect(harness.client.pollUntilComplete).toHaveBeenCalledTimes(1));

    harness.session.stop("Panel closed.");
    harness.session.stop("Ignored second stop.");

    expect(harness.session.getState()).toBe("stopped");
    expect(harness.client.cancelPrompt).toHaveBeenCalledTimes(1);
    expect(harness.client.cancelPrompt).toHaveBeenCalledWith("prompt-1");
    expect(harness.callbacks.onStopped).toHaveBeenCalledTimes(1);
    expect(harness.callbacks.onStopped).toHaveBeenCalledWith("Panel closed.");
    expect(harness.action.actionModule.removeNotificationListener).toHaveBeenCalledTimes(5);

    poll.resolve(completeHistory);
    await flushAsyncWork();
    expect(harness.callbacks.onPreviewBlob).not.toHaveBeenCalled();
  });

  it("cancels a prompt ID that arrives after the session has stopped", async () => {
    const submittedPrompt = createDeferred<string>();
    const harness = createHarness({}, {
      submitPrompt: vi.fn(() => submittedPrompt.promise)
    });
    await harness.session.start();
    await vi.waitFor(() => expect(harness.client.submitPrompt).toHaveBeenCalledTimes(1));

    harness.session.stop();
    submittedPrompt.resolve("late-prompt");
    await vi.waitFor(() => expect(harness.client.cancelPrompt).toHaveBeenCalledWith("late-prompt"));

    expect(harness.client.pollUntilComplete).not.toHaveBeenCalled();
    expect(harness.callbacks.onPreviewBlob).not.toHaveBeenCalled();
  });
});
