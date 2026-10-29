import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getWorkflowPreset, listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import { getLargestAllowedSource, getUpscaleOutputLimitProblem } from "../../src/comfy/upscaleOutputLimit";
import { ComfyWorkflow } from "../../src/comfy/types";

const seedvr2 = getWorkflowPreset("upscale-seedvr2-3b");

describe("getUpscaleOutputLimitProblem", () => {
  it("lets through every size the spike actually ran", () => {
    // Each of these was run on the 4070 Ti before the limit was written down.
    for (const [width, height] of [[256, 192], [512, 384], [1024, 768], [1536, 1152], [2560, 1920]]) {
      expect(getUpscaleOutputLimitProblem(seedvr2, { width, height })).toBeNull();
    }
  });

  it("refuses a source whose 2x result passes 5120 x 3840", () => {
    const problem = getUpscaleOutputLimitProblem(seedvr2, { width: 4000, height: 3000 });

    expect(problem).toContain("4000 x 3000");
    expect(problem).toContain("8000 x 6000 (48.0 megapixels)");
    expect(problem).toContain("19.7 megapixels");
    expect(problem).toContain("upscale-basic");
  });

  it("refuses one pixel past the limit and not one pixel before", () => {
    expect(getUpscaleOutputLimitProblem(seedvr2, { width: 2560, height: 1920 })).toBeNull();
    expect(getUpscaleOutputLimitProblem(seedvr2, { width: 2561, height: 1920 })).not.toBeNull();
  });

  it("is plain text, because the panel sets it with textContent", () => {
    const problem = getUpscaleOutputLimitProblem(seedvr2, { width: 6000, height: 4000 }) ?? "";

    expect(problem).not.toMatch(/`|--|\*\*/);
  });

  it("does not trip the keyword matchers that would replace it with a wrong hint", () => {
    // getFriendlyUpscaleErrorMessage rewrites any text containing these into
    // "The selected upscale model was not found in ComfyUI."
    const problem = (getUpscaleOutputLimitProblem(seedvr2, { width: 6000, height: 4000 }) ?? "").toLowerCase();

    for (const trigger of ["not found", "upscale model", "missing node", "upscalemodelloader"]) {
      expect(problem).not.toContain(trigger);
    }
  });

  it("never limits a preset that declares no limit", () => {
    expect(getUpscaleOutputLimitProblem(getWorkflowPreset("upscale-basic"), { width: 9000, height: 9000 })).toBeNull();
  });

  it("ignores sizes it cannot reason about rather than refusing them", () => {
    expect(getUpscaleOutputLimitProblem(seedvr2, { width: 0, height: 100 })).toBeNull();
    expect(getUpscaleOutputLimitProblem(seedvr2, { width: Number.NaN, height: 100 })).toBeNull();
  });
});

describe("getLargestAllowedSource", () => {
  it("keeps the aspect ratio and lands inside the limit", () => {
    const largest = getLargestAllowedSource({ width: 4000, height: 3000 }, 2, 5120 * 3840);

    expect(largest).toEqual({ width: 2560, height: 1920 });
  });

  it("suggests a size the guard itself accepts, for awkward aspects too", () => {
    for (const source of [{ width: 7000, height: 1000 }, { width: 999, height: 7777 }, { width: 5001, height: 5001 }]) {
      const largest = getLargestAllowedSource(source, 2, 5120 * 3840);

      expect(getUpscaleOutputLimitProblem(seedvr2, largest)).toBeNull();
    }
  });
});

describe("upscaleOutputLimit and the bundled graphs", () => {
  it("states the same multiplier the bundled graph really applies", () => {
    // The limit is only right if its scale is the graph's. Changing the
    // ResizeImageMaskNode multiplier without this would silently move the limit.
    for (const preset of listRunnableWorkflowPresets("upscale").filter((candidate) => candidate.upscaleOutputLimit)) {
      const workflow = JSON.parse(
        readFileSync(resolve(__dirname, "../../src", preset.workflowFile), "utf8")
      ) as ComfyWorkflow;
      const resizeNodes = Object.values(workflow).filter((node) => node.class_type === "ResizeImageMaskNode");

      expect(resizeNodes).toHaveLength(1);
      expect(resizeNodes[0].inputs.resize_type).toBe("scale by multiplier");
      expect(resizeNodes[0].inputs["resize_type.multiplier"]).toBe(preset.upscaleOutputLimit?.scale);
    }
  });

  it("uses a whole-number scale, because SeedVR2 trims odd edges to even", () => {
    // A whole-number multiplier always gives even dimensions, so the result is
    // an exact multiple of the source and the canvas-resize import accepts it.
    expect(Number.isInteger(seedvr2.upscaleOutputLimit?.scale)).toBe(true);
  });
});
