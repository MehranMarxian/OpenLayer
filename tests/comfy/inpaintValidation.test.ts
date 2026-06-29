import { describe, expect, it } from "vitest";
import {
  createFluxFillInpaintDebugSummary,
  validateFluxFillInpaintSource
} from "../../src/comfy/inpaintValidation";

describe("inpaint validation", () => {
  it("allows matching Flux Fill source and mask dimensions", () => {
    const problems = validateFluxFillInpaintSource({
      presetId: "inpaint-flux-fill-basic",
      hasSourceImage: true,
      hasMaskImage: true,
      sourceWidth: 768,
      sourceHeight: 512,
      maskWidth: 768,
      maskHeight: 512,
      hasSelectionContextBounds: true
    });

    expect(problems).toEqual([]);
  });

  it("blocks Flux Fill when source and mask dimensions differ", () => {
    const problems = validateFluxFillInpaintSource({
      presetId: "inpaint-flux-fill-basic",
      hasSourceImage: true,
      hasMaskImage: true,
      sourceWidth: 768,
      sourceHeight: 512,
      maskWidth: 512,
      maskHeight: 512,
      hasSelectionContextBounds: true
    });

    expect(problems.join(" ")).toContain("Source is 768 x 512, mask is 512 x 512");
  });

  it("creates a compact Flux Fill debug summary", () => {
    const summary = createFluxFillInpaintDebugSummary({
      presetId: "inpaint-flux-fill-basic",
      hasSourceImage: true,
      hasMaskImage: true,
      sourceWidth: 512,
      sourceHeight: 512,
      maskWidth: 512,
      maskHeight: 512,
      hasSelectionContextBounds: true,
      selectedFluxModelName: "flux1-fill-dev.safetensors"
    });

    expect(summary).toContain("inpaint-flux-fill-basic");
    expect(summary).toContain("t5xxl_fp16.safetensors");
    expect(summary).toContain("t5xxl_fp8_e4m3fn.safetensors");
    expect(summary).toContain("white = repaint");
  });
});
