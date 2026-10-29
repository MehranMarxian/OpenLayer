import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getWorkflowPreset, listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import {
  getLargestAllowedSource,
  getUpscaleMaxOutputPixels,
  getUpscaleOutputLimitProblem,
  readComfyVramTotalBytes
} from "../../src/comfy/upscaleOutputLimit";
import { ComfySystemStats, ComfyWorkflow, WorkflowUpscaleOutputLimit } from "../../src/comfy/types";

const seedvr2 = getWorkflowPreset("upscale-seedvr2-3b");
const limit = seedvr2.upscaleOutputLimit as WorkflowUpscaleOutputLimit;
const GIB = 1024 ** 3;
/** What /system_stats reported for the 4070 Ti the limit was measured on. */
const DEV_RIG_VRAM = 12878086144;

describe("getUpscaleMaxOutputPixels", () => {
  it("is exactly the measured 5120 x 3840 on the card it was measured on", () => {
    expect(getUpscaleMaxOutputPixels(limit, DEV_RIG_VRAM)).toBe(5120 * 3840);
  });

  it("falls back to the measured card when VRAM is unknown", () => {
    for (const unknown of [null, 0, -1, Number.NaN]) {
      expect(getUpscaleMaxOutputPixels(limit, unknown)).toBe(5120 * 3840);
    }
  });

  it("grows with VRAM by the measured cost of an output pixel", () => {
    const at16 = getUpscaleMaxOutputPixels(limit, 16 * GIB);
    const at24 = getUpscaleMaxOutputPixels(limit, 24 * GIB);

    expect(at16 / 1e6).toBeCloseTo(42.9, 0);
    expect(at24 / 1e6).toBeCloseTo(89.3, 0);
    expect(at24).toBeGreaterThan(at16);
  });

  it("shrinks on a smaller card but never below a 2048 x 2048 result", () => {
    expect(getUpscaleMaxOutputPixels(limit, 10 * GIB) / 1e6).toBeCloseTo(8.1, 0);
    // The arithmetic goes negative on 8 GB; a 1024 layer must still be allowed.
    expect(getUpscaleMaxOutputPixels(limit, 8 * GIB)).toBe(2048 * 2048);
    expect(getUpscaleOutputLimitProblem(seedvr2, { width: 1024, height: 1024 }, 8 * GIB)).toBeNull();
  });

  it("refuses the 6144 x 4608 result that ran 2.7x slower on the measured card", () => {
    // 28.3 MP filled the 12 GB card and ComfyUI fell back to offloading.
    expect(getUpscaleOutputLimitProblem(seedvr2, { width: 3072, height: 2304 }, DEV_RIG_VRAM)).not.toBeNull();
    expect(getUpscaleOutputLimitProblem(seedvr2, { width: 3072, height: 2304 }, 16 * GIB)).toBeNull();
  });
});

describe("the VRAM in the refusal", () => {
  it("names the VRAM and the scaled limit when ComfyUI reported it", () => {
    const problem = getUpscaleOutputLimitProblem(seedvr2, { width: 4000, height: 3000 }, 10 * GIB) ?? "";

    expect(problem).toContain("10.0 GB of VRAM");
    expect(problem).toContain("19.7 megapixels measured on 12.0 GB, scaled by VRAM");
  });

  it("says the measured limit applies when it did not", () => {
    const problem = getUpscaleOutputLimitProblem(seedvr2, { width: 4000, height: 3000 }, null) ?? "";

    expect(problem).toContain("did not report its VRAM");
    expect(problem).toContain("19.7 megapixels measured on 12.0 GB");
  });
});

describe("readComfyVramTotalBytes", () => {
  it("reads the primary device", async () => {
    const stats = { devices: [{ name: "cuda:0", type: "cuda", vramTotalBytes: DEV_RIG_VRAM }] } as ComfySystemStats;

    expect(await readComfyVramTotalBytes({ getSystemStats: async () => stats })).toBe(DEV_RIG_VRAM);
  });

  it("returns null instead of failing the upscale when the read fails", async () => {
    expect(await readComfyVramTotalBytes({ getSystemStats: async () => { throw new Error("offline"); } })).toBeNull();
  });
});

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
