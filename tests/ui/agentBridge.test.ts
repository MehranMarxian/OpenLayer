import { describe, expect, it, vi } from "vitest";
import {
  AgentField,
  AgentToolRegistration,
  applyParams,
  createAgentBridge,
  readOutcome
} from "../../src/ui/agentBridge";

/**
 * The suite is node-only and these are DOM writes, so the fields are stubs —
 * the same approach `previewHub.test.ts` and `statusBarFanOut.test.ts` take.
 * They only need `value`, `dispatchEvent`, and for selects an `options`
 * collection, because that is genuinely all `applyParams` touches.
 */

class StubEvent {
  constructor(public type: string) {}
}

// `applyParams` constructs `Event` inside a try/catch, so the node env needs one
// to exist for the happy path to be what is under test.
(globalThis as unknown as { Event: unknown }).Event ??= StubEvent;

function input(value = ""): AgentField {
  return { value, dispatchEvent: vi.fn(() => true) } as unknown as AgentField;
}

function select(values: string[], value = values[0] ?? ""): AgentField {
  return {
    value,
    options: values.map((optionValue) => ({ value: optionValue })),
    dispatchEvent: vi.fn(() => true)
  } as unknown as AgentField;
}

function statusElement(text: string, classes: string[] = []) {
  return {
    textContent: text,
    classList: { contains: (name: string) => classes.includes(name) }
  } as unknown as HTMLElement;
}

describe("applyParams", () => {
  it("writes values and notifies, so the panel reacts as it would to typing", () => {
    const fields = { prompt: input(), steps: input("20") };

    const result = applyParams(fields, { prompt: "a cat", steps: 30 });

    expect(result.rejected).toEqual([]);
    expect(result.applied.sort()).toEqual(["prompt", "steps"]);
    expect(fields.prompt.value).toBe("a cat");
    // Numbers become field text, because that is what a form control holds.
    expect(fields.steps.value).toBe("30");
    expect(fields.prompt.dispatchEvent).toHaveBeenCalled();
  });

  it("rejects a select value that is not an option, and lists what is", () => {
    const fields = { checkpoint: select(["sd15.safetensors", "flux1-dev.gguf"]) };

    const result = applyParams(fields, { checkpoint: "not-installed.safetensors" });

    expect(result.applied).toEqual([]);
    expect(result.rejected[0].reason).toContain("not-installed.safetensors");
    expect(result.rejected[0].reason).toContain("sd15.safetensors");
    // The value must be left alone. Assigning an absent option to a real select
    // is silently ignored, which is the whole reason this check exists: without
    // it the generation runs on whatever was already selected.
    expect(fields.checkpoint.value).toBe("sd15.safetensors");
  });

  it("rejects a parameter the tool does not have", () => {
    const result = applyParams({ prompt: input() }, { denoise: 0.5 });

    expect(result.rejected[0].reason).toContain("not a parameter of this tool");
  });

  it("survives a host with no Event constructor", () => {
    const original = (globalThis as unknown as { Event: unknown }).Event;
    (globalThis as unknown as { Event: unknown }).Event = undefined;

    try {
      const fields = { prompt: input() };

      // UXP is a DOM subset and nothing else in src/ constructs an Event, so
      // this may be the real behaviour in Photoshop. The value must still land.
      expect(() => applyParams(fields, { prompt: "a cat" })).not.toThrow();
      expect(fields.prompt.value).toBe("a cat");
    } finally {
      (globalThis as unknown as { Event: unknown }).Event = original;
    }
  });
});

describe("readOutcome", () => {
  it("trusts the pill's error class over the words in the status", () => {
    // "Error" appears in a perfectly successful message here. The pill is what
    // the handler actually set, so it wins.
    expect(readOutcome(statusElement("Recovered from a ComfyUI error."), statusElement("", []))).toEqual({
      ok: true,
      status: "Recovered from a ComfyUI error."
    });

    expect(readOutcome(statusElement("Done."), statusElement("", ["error"]))).toEqual({
      ok: false,
      status: "Done."
    });
  });

  it("falls back to reading the text when a tool has no pill", () => {
    expect(readOutcome(statusElement("Prompt required.")).ok).toBe(false);
    expect(readOutcome(statusElement("Imported as new layer.")).ok).toBe(true);
  });
});

function registration(overrides: Partial<AgentToolRegistration> = {}): AgentToolRegistration {
  return {
    run: vi.fn(),
    fields: { prompt: input() },
    statusText: statusElement("Imported as new layer."),
    statusPill: statusElement("", []),
    ...overrides
  };
}

describe("createAgentBridge", () => {
  it("refuses a tool that never registered", async () => {
    const bridge = createAgentBridge();

    await expect(bridge.execute("text_to_image", {})).resolves.toEqual({
      ok: false,
      status: "text_to_image is not available in this panel."
    });
  });

  it("refuses to run when capability says it cannot", async () => {
    const bridge = createAgentBridge();
    const run = vi.fn();

    bridge.register("text_to_image", registration({ run }));
    bridge.publishCapability("text_to_image", {
      canRun: false,
      reason: "A generation is already running."
    });

    // The A4 gate. The handler itself does not check isBusy — it sets it — so
    // without this a second pipeline starts against the same document.
    await expect(bridge.execute("text_to_image", {})).resolves.toEqual({
      ok: false,
      status: "A generation is already running."
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses when no capability was ever published", async () => {
    const bridge = createAgentBridge();
    const run = vi.fn();

    bridge.register("text_to_image", registration({ run }));

    // Absent is not permission. A tool registered before syncBusy has run must
    // not be drivable on the strength of an empty map.
    const outcome = await bridge.execute("text_to_image", {});

    expect(outcome.ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the existing handler and reports its status bar", async () => {
    const bridge = createAgentBridge();
    const fields = { prompt: input() };
    const run = vi.fn();

    bridge.register(
      "text_to_image",
      registration({ run, fields, statusText: statusElement("Imported as new layer.") })
    );
    bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

    await expect(bridge.execute("text_to_image", { prompt: "a cat" })).resolves.toEqual({
      ok: true,
      status: "Imported as new layer."
    });
    expect(fields.prompt.value).toBe("a cat");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not run when a parameter was rejected", async () => {
    const bridge = createAgentBridge();
    const run = vi.fn();

    bridge.register(
      "text_to_image",
      registration({ run, fields: { checkpoint: select(["sd15.safetensors"]) } })
    );
    bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

    const outcome = await bridge.execute("text_to_image", { checkpoint: "missing.safetensors" });

    expect(outcome.ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("reports a handler that throws instead of leaving the agent waiting", async () => {
    const bridge = createAgentBridge();

    bridge.register(
      "text_to_image",
      registration({
        run: vi.fn(() => {
          throw new Error("Photoshop went away.");
        })
      })
    );
    bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

    await expect(bridge.execute("text_to_image", {})).resolves.toEqual({
      ok: false,
      status: "Photoshop went away."
    });
  });

  describe("two-pass application", () => {
    it("applies a leading param, settles, then lets an explicit value win", async () => {
      const order: string[] = [];
      const steps = input("20");
      const workflow = select(["txt2img-basic", "flux-krea"], "txt2img-basic");

      const settle = vi.fn(async () => {
        // Stands in for the workflow's change listener: it overwrites steps
        // with the preset recommendation and repopulates the model list.
        order.push("settle");
        steps.value = "8";
      });

      const bridge = createAgentBridge();

      bridge.register(
        "text_to_image",
        registration({
          fields: { workflow, steps },
          leadingParams: ["workflow"],
          settle,
          run: vi.fn(() => {
            order.push("run");
          })
        })
      );
      bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

      await bridge.execute("text_to_image", { steps: 30, workflow: "flux-krea" });

      expect(order).toEqual(["settle", "run"]);
      expect(workflow.value).toBe("flux-krea");
      // The agent asked for 30. The preset default of 8 landed in between, and
      // the explicit value was written after it rather than being clobbered.
      expect(steps.value).toBe("30");
    });

    it("skips the settle when no leading param was supplied", async () => {
      const settle = vi.fn(async () => {});
      const bridge = createAgentBridge();

      bridge.register(
        "text_to_image",
        registration({
          fields: { prompt: input(), workflow: select(["txt2img-basic"]) },
          leadingParams: ["workflow"],
          settle
        })
      );
      bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

      await bridge.execute("text_to_image", { prompt: "a cat" });

      // A prompt-only command should not pay for a model-list refresh.
      expect(settle).not.toHaveBeenCalled();
    });

    it("does not settle or run when the leading param itself is rejected", async () => {
      const settle = vi.fn(async () => {});
      const run = vi.fn();
      const bridge = createAgentBridge();

      bridge.register(
        "text_to_image",
        registration({
          fields: { workflow: select(["txt2img-basic"]), steps: input("20") },
          leadingParams: ["workflow"],
          settle,
          run
        })
      );
      bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

      const outcome = await bridge.execute("text_to_image", {
        workflow: "no-such-preset",
        steps: 30
      });

      expect(outcome.ok).toBe(false);
      expect(settle).not.toHaveBeenCalled();
      expect(run).not.toHaveBeenCalled();
    });

    it("reports a settle that fails rather than generating anyway", async () => {
      const run = vi.fn();
      const bridge = createAgentBridge();

      bridge.register(
        "text_to_image",
        registration({
          fields: { workflow: select(["txt2img-basic", "flux-krea"]) },
          leadingParams: ["workflow"],
          settle: vi.fn(async () => {
            throw new Error("ComfyUI is offline.");
          }),
          run
        })
      );
      bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

      const outcome = await bridge.execute("text_to_image", { workflow: "flux-krea" });

      expect(outcome.ok).toBe(false);
      expect(outcome.status).toContain("ComfyUI is offline.");
      expect(run).not.toHaveBeenCalled();
    });
  });

  describe("describeResult", () => {
    it("appends the described result to a successful outcome", async () => {
      const bridge = createAgentBridge();

      bridge.register(
        "prompt_from_layer",
        registration({
          statusText: statusElement("Prompt text generated."),
          describeResult: () => 'Generated text: "a red fox in snow"'
        })
      );
      bridge.publishCapability("prompt_from_layer", { canRun: true, reason: "" });

      // The status line alone ("Prompt text generated.") is true and useless —
      // it doesn't say what was generated, which is the entire reason to call
      // this tool from an agent instead of clicking the button.
      await expect(bridge.execute("prompt_from_layer", {})).resolves.toEqual({
        ok: true,
        status: 'Prompt text generated. Generated text: "a red fox in snow"'
      });
    });

    it("does not call describeResult when the run failed", async () => {
      const bridge = createAgentBridge();
      const describeResult = vi.fn(() => "should not appear");

      bridge.register(
        "prompt_from_layer",
        registration({
          statusText: statusElement("Source required."),
          statusPill: statusElement("", ["error"]),
          describeResult
        })
      );
      bridge.publishCapability("prompt_from_layer", { canRun: true, reason: "" });

      const outcome = await bridge.execute("prompt_from_layer", {});

      expect(outcome).toEqual({ ok: false, status: "Source required." });
      expect(describeResult).not.toHaveBeenCalled();
    });

    it("leaves the status alone when describeResult has nothing to add", async () => {
      const bridge = createAgentBridge();

      bridge.register(
        "prompt_from_layer",
        registration({
          statusText: statusElement("Prompt text generated."),
          // A field could theoretically be empty even on a reported success.
          describeResult: () => ""
        })
      );
      bridge.publishCapability("prompt_from_layer", { canRun: true, reason: "" });

      await expect(bridge.execute("prompt_from_layer", {})).resolves.toEqual({
        ok: true,
        status: "Prompt text generated."
      });
    });

    it("falls back to the plain status when describeResult throws", async () => {
      const bridge = createAgentBridge();

      bridge.register(
        "prompt_from_layer",
        registration({
          statusText: statusElement("Prompt text generated."),
          describeResult: () => {
            throw new Error("field is gone");
          }
        })
      );
      bridge.publishCapability("prompt_from_layer", { canRun: true, reason: "" });

      // The generation already succeeded and the panel already has its result;
      // a broken describer must not turn a real success into a reported failure.
      await expect(bridge.execute("prompt_from_layer", {})).resolves.toEqual({
        ok: true,
        status: "Prompt text generated."
      });
    });
  });

  describe("errorText", () => {
    it("appends the tool's own error detail to a failed outcome", async () => {
      const bridge = createAgentBridge();

      bridge.register(
        "text_to_image",
        registration({
          statusText: statusElement("Generation failed."),
          statusPill: statusElement("", ["error"]),
          errorText: statusElement("ComfyUI HTTP 500: checkpoint failed to load.")
        })
      );
      bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

      // "Generation failed." alone sends an agent no further than telling the
      // user to go open the panel — this is the real, reason a person could act
      // on, and it lives in a separate element the status line never carries.
      await expect(bridge.execute("text_to_image", {})).resolves.toEqual({
        ok: false,
        status: "Generation failed. ComfyUI HTTP 500: checkpoint failed to load."
      });
    });

    it("appends the detail on a source-required refusal too, not only on a thrown error", async () => {
      const bridge = createAgentBridge();

      bridge.register(
        "image_to_image",
        registration({
          statusText: statusElement("Source required."),
          statusPill: statusElement("", ["error"]),
          errorText: statusElement("Capture the active Photoshop layer before generating Image to Image.")
        })
      );
      bridge.publishCapability("image_to_image", { canRun: true, reason: "" });

      await expect(bridge.execute("image_to_image", {})).resolves.toEqual({
        ok: false,
        status: "Source required. Capture the active Photoshop layer before generating Image to Image."
      });
    });

    it("does not call errorText on a successful outcome", async () => {
      const bridge = createAgentBridge();
      const read = vi.fn(() => "should never be read");
      const errorText = {} as HTMLElement;

      Object.defineProperty(errorText, "textContent", { get: read });

      bridge.register(
        "text_to_image",
        registration({ statusText: statusElement("Generation complete."), errorText })
      );
      bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

      await expect(bridge.execute("text_to_image", {})).resolves.toEqual({
        ok: true,
        status: "Generation complete."
      });
      expect(read).not.toHaveBeenCalled();
    });

    it("leaves the status alone when the error element is empty or unset", async () => {
      const bridge = createAgentBridge();

      bridge.register(
        "text_to_image",
        registration({
          statusText: statusElement("Generation failed."),
          statusPill: statusElement("", ["error"]),
          // Cleared to "" on the next successful run, same as every tool's
          // error element — this is what a fresh run looks like before it fails.
          errorText: statusElement("")
        })
      );
      bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

      await expect(bridge.execute("text_to_image", {})).resolves.toEqual({
        ok: false,
        status: "Generation failed."
      });
    });

    it("does not double a detail that already matches the status", async () => {
      const bridge = createAgentBridge();

      bridge.register(
        "text_to_image",
        registration({
          statusText: statusElement("Prompt required."),
          statusPill: statusElement("", ["error"]),
          errorText: statusElement("Prompt required.")
        })
      );
      bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

      await expect(bridge.execute("text_to_image", {})).resolves.toEqual({
        ok: false,
        status: "Prompt required."
      });
    });

    it("falls back to the plain status when reading errorText throws", async () => {
      const bridge = createAgentBridge();
      const errorText = {
        get textContent(): string {
          throw new Error("element is gone");
        }
      } as unknown as HTMLElement;

      bridge.register(
        "text_to_image",
        registration({
          statusText: statusElement("Generation failed."),
          statusPill: statusElement("", ["error"]),
          errorText
        })
      );
      bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

      // A failure is already being reported; a broken reader must not hide that
      // behind an exception of its own.
      await expect(bridge.execute("text_to_image", {})).resolves.toEqual({
        ok: false,
        status: "Generation failed."
      });
    });
  });

  it("reports which tools registered, for the handshake", () => {
    const bridge = createAgentBridge();

    bridge.register("text_to_image", registration());
    bridge.register("upscale", registration());

    expect(bridge.registeredTools().sort()).toEqual(["text_to_image", "upscale"]);
  });

  it("lets a remount replace a registration without the old cleanup killing it", () => {
    const bridge = createAgentBridge();
    const first = registration();
    const unregisterFirst = bridge.register("text_to_image", first);

    bridge.register("text_to_image", registration());
    unregisterFirst();

    // Same identity check as importBridge.register: a stale cleanup must not
    // tear down the registration that replaced it.
    expect(bridge.registeredTools()).toEqual(["text_to_image"]);
  });

  it("does not notify subscribers for an unchanged capability", () => {
    const bridge = createAgentBridge();
    const listener = vi.fn();

    bridge.register("text_to_image", registration());
    bridge.subscribe(listener);
    bridge.publishCapability("text_to_image", { canRun: true, reason: "" });
    listener.mockClear();

    // syncBusy runs on every state change; an unchanged snapshot must not churn.
    bridge.publishCapability("text_to_image", { canRun: true, reason: "" });
    expect(listener).not.toHaveBeenCalled();

    bridge.publishCapability("text_to_image", { canRun: false, reason: "Busy." });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
