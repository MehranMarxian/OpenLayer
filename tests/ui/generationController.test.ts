import { describe, expect, it, vi } from "vitest";
import {
  createGenerationController,
  GenerationPipelineMessages,
  GenerationPipelineUi
} from "../../src/ui/generationController";
import { createPhotoshopDocumentIdentity } from "../../src/photoshop/documentContext";
import { isGenerationCancelledError } from "../../src/comfy/generationCancel";

const origin = createPhotoshopDocumentIdentity(7, "Doc.psd");

const MESSAGES: GenerationPipelineMessages = {
  submitStatus: "Submitting...",
  submitPreview: "Submitting preview...",
  generateStatus: "Generating...",
  generatePreview: "Generating preview...",
  retrieveStatus: "Retrieving...",
  retrievePreview: "Retrieving preview...",
  livePreview: "Live preview..."
};

type FakeClientScript = {
  submitPrompt?: () => Promise<string>;
  duringPoll?: (callbacks: { onTick: (message: string) => void; isCancelled: () => boolean }) => void | Promise<void>;
  retrieve?: () => Promise<{ blob: Blob }>;
};

function createFakeClient(script: FakeClientScript = {}) {
  const watcher = { close: vi.fn() };
  const client = {
    submitPrompt: vi.fn(script.submitPrompt ?? (async () => "prompt-1")),
    watchProgress: vi.fn(() => watcher),
    pollUntilComplete: vi.fn(async (_promptId: string, options: { onTick: (m: string) => void; isCancelled: () => boolean }) => {
      await script.duringPoll?.(options);

      if (options.isCancelled()) {
        const { createGenerationCancelledError } = await import("../../src/comfy/generationCancel");
        throw createGenerationCancelledError();
      }

      return { outputs: {} };
    }),
    retrieveFirstOutputImage: vi.fn(script.retrieve ?? (async () => ({ blob: new Blob(["image"]) }))),
    cancelPrompt: vi.fn(async () => "interrupted" as const)
  };
  return { client, watcher };
}

function createUi(): GenerationPipelineUi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    status: (message) => calls.push(`status:${message}`),
    progressPreview: (message, blob) => calls.push(`preview:${message}${blob ? ":blob" : ""}`),
    stepProgress: (value, max) => calls.push(`step:${value}/${max}`),
    diagnostics: (message) => calls.push(`diag:${message}`),
    cancelled: (promptId) => calls.push(`cancelled:${promptId ?? "none"}`)
  };
}

function createController() {
  const hooks = { onRunStarted: vi.fn(), onRunFinished: vi.fn() };
  return { controller: createGenerationController(hooks), hooks };
}

describe("generation controller pipeline", () => {
  it("runs submit, watch, poll, retrieve, commit, finish in order and returns the bound result", async () => {
    const { controller, hooks } = createController();
    const { client, watcher } = createFakeClient();
    const ui = createUi();
    const commit = vi.fn();

    const result = await controller.runPipeline({
      toolType: "image-to-image",
      client,
      workflow: {},
      preferredNodeId: "9",
      originatingDocument: origin,
      ui,
      messages: MESSAGES,
      commit
    });

    expect(result?.originatingDocument).toBe(origin);
    expect(commit).toHaveBeenCalledWith(result);
    expect(hooks.onRunStarted).toHaveBeenCalledWith("image-to-image");
    expect(hooks.onRunFinished).toHaveBeenCalledWith("image-to-image");
    expect(watcher.close).toHaveBeenCalled();
    expect(client.retrieveFirstOutputImage.mock.calls[0][2]).toEqual({ preferredNodeId: "9" });
    expect(ui.calls).toContain("status:Submitting...");
    expect(ui.calls).toContain("status:Generating...");
    expect(ui.calls).toContain("status:Retrieving...");
  });

  it("shows the cancelled state and returns null when cancelled mid-poll", async () => {
    const { controller, hooks } = createController();
    const { client } = createFakeClient({
      duringPoll: () => {
        controller.cancelActive();
      }
    });
    const ui = createUi();
    const commit = vi.fn();

    const result = await controller.runPipeline({
      toolType: "inpaint",
      client,
      workflow: {},
      originatingDocument: origin,
      ui,
      messages: MESSAGES,
      commit
    });

    expect(result).toBeNull();
    expect(commit).not.toHaveBeenCalled();
    expect(ui.calls).toContain("cancelled:prompt-1");
    // The cancelled run is still the current one, so it finalizes shared state.
    expect(hooks.onRunFinished).toHaveBeenCalledWith("inpaint");
  });

  it("cancelActive reports the run and stops its watcher", async () => {
    const { controller } = createController();
    const { client, watcher } = createFakeClient({
      duringPoll: () => {
        const active = controller.cancelActive();
        expect(active?.toolType).toBe("upscale");
        expect(active?.promptId).toBe("prompt-1");
        expect(active?.isCurrent()).toBe(true);
        expect(watcher.close).toHaveBeenCalled();
      }
    });

    await controller.runPipeline({
      toolType: "upscale",
      client,
      workflow: {},
      originatingDocument: origin,
      ui: createUi(),
      messages: MESSAGES,
      commit: vi.fn()
    });

    expect(controller.cancelActive()).toBeNull();
  });

  it("blocks a stale run from publishing, committing, or finalizing after a newer run begins", async () => {
    const { controller, hooks } = createController();
    const ui = createUi();
    const commit = vi.fn();
    const { client } = createFakeClient({
      duringPoll: (options) => {
        // A second generation starts while the first is still polling.
        controller.begin("text-to-image", { cancelPrompt: async () => "interrupted" as const }, "prompt-2");
        options.onTick("stale tick");
      }
    });

    const result = await controller.runPipeline({
      toolType: "image-to-image",
      client,
      workflow: {},
      originatingDocument: origin,
      ui,
      messages: MESSAGES,
      commit
    });

    // The stale tick was gated, the stale commit refused, and the newer run's
    // shared state untouched: onRunFinished never fired for the stale tool.
    expect(ui.calls).not.toContain("status:stale tick");
    expect(commit).not.toHaveBeenCalled();
    expect(result).toBeNull();
    expect(ui.calls).not.toContain("cancelled:prompt-1");
    expect(hooks.onRunFinished).not.toHaveBeenCalledWith("image-to-image");
  });

  it("rethrows non-cancellation errors after closing the watcher and finalizing", async () => {
    const { controller, hooks } = createController();
    const { client, watcher } = createFakeClient({
      retrieve: async () => {
        throw new Error("retrieve exploded");
      }
    });

    await expect(controller.runPipeline({
      toolType: "sketch-to-image",
      client,
      workflow: {},
      originatingDocument: origin,
      ui: createUi(),
      messages: MESSAGES,
      commit: vi.fn()
    })).rejects.toThrow("retrieve exploded");

    expect(watcher.close).toHaveBeenCalled();
    expect(hooks.onRunFinished).toHaveBeenCalledWith("sketch-to-image");
  });

  it("gates live preview frames and diagnostics on run currency", async () => {
    const { controller } = createController();
    const ui = createUi();
    let capturedCallbacks: { onPreviewBlob: (blob: Blob) => void; onError: (message: string) => void } | null = null;
    const watcher = { close: vi.fn() };
    const client = {
      submitPrompt: vi.fn(async () => "prompt-1"),
      watchProgress: vi.fn((_promptId: string, callbacks: typeof capturedCallbacks & object) => {
        capturedCallbacks = callbacks;
        return watcher;
      }),
      pollUntilComplete: vi.fn(async () => {
        capturedCallbacks?.onPreviewBlob(new Blob(["frame"]));
        capturedCallbacks?.onError("transient");
        return { outputs: {} };
      }),
      retrieveFirstOutputImage: vi.fn(async () => ({ blob: new Blob(["image"]) })),
      cancelPrompt: vi.fn(async () => "interrupted" as const)
    };

    await controller.runPipeline({
      toolType: "outpaint",
      client,
      workflow: {},
      originatingDocument: origin,
      ui,
      messages: MESSAGES,
      commit: vi.fn()
    });

    expect(ui.calls).toContain("preview:Live preview...:blob");
    expect(ui.calls).toContain("diag:transient");

    // After the run finished, replayed callbacks must be ignored.
    ui.calls.length = 0;
    capturedCallbacks!.onPreviewBlob(new Blob(["late frame"]));
    capturedCallbacks!.onError("late error");
    expect(ui.calls).toEqual([]);
  });

  it("run handles stay usable for the text pipeline: publish, commit gate, idempotent finish", async () => {
    const { controller, hooks } = createController();
    const run = controller.begin("prompt-from-layer", { cancelPrompt: async () => "interrupted" as const }, "prompt-9");
    const published: string[] = [];

    run.publish(() => published.push("tick"));
    expect(published).toEqual(["tick"]);
    expect(() => run.assertCanCommit()).not.toThrow();

    run.finish();
    run.finish();
    expect(hooks.onRunFinished).toHaveBeenCalledTimes(1);

    run.publish(() => published.push("late"));
    expect(published).toEqual(["tick"]);
    expect(() => run.assertCanCommit()).toThrow();

    try {
      run.assertCanCommit();
    } catch (error) {
      expect(isGenerationCancelledError(error)).toBe(true);
    }
  });

  it("disposeActive cancels polling without finalizing UI state", async () => {
    const { controller, hooks } = createController();
    const ui = createUi();
    const { client, watcher } = createFakeClient({
      duringPoll: () => {
        controller.disposeActive();
      }
    });

    const result = await controller.runPipeline({
      toolType: "text-to-image",
      client,
      workflow: {},
      originatingDocument: origin,
      ui,
      messages: MESSAGES,
      commit: vi.fn()
    });

    expect(result).toBeNull();
    expect(watcher.close).toHaveBeenCalled();
    // The pipeline's own unwind still finalizes; disposeActive itself does not.
    expect(hooks.onRunFinished).toHaveBeenCalledTimes(1);
  });
});
