import { describe, expect, it } from "vitest";
import { createFluxFillInpaintDebugSummary } from "../../src/comfy/inpaintValidation";

describe("inpaint validation", () => {
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
