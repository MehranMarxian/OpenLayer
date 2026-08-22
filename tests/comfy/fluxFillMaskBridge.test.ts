import { describe, expect, it } from "vitest";
import {
  createFluxFillEmbeddedMaskRgba,
  createFluxFillEmbeddedMaskSource,
  FLUX_FILL_EMBEDDED_MASK_FILENAME,
  presetUsesEmbeddedMaskAlpha
} from "../../src/comfy/fluxFillMaskBridge";
import { decodeRgbaPng, encodeRgbaPng } from "../../src/utils/png";

describe("fluxFillMaskBridge", () => {
  it("embeds OpenLayer's white repaint mask as transparent alpha for ComfyUI LoadImage", () => {
    const source = {
      width: 2,
      height: 1,
      rgba: new Uint8Array([
        10, 20, 30, 255,
        40, 50, 60, 255
      ])
    };
    const mask = {
      width: 2,
      height: 1,
      rgba: new Uint8Array([
        255, 255, 255, 255,
        0, 0, 0, 255
      ])
    };

    const embedded = createFluxFillEmbeddedMaskRgba(source, mask);

    expect([...embedded]).toEqual([
      10, 20, 30, 0,
      40, 50, 60, 255
    ]);
  });

  it("creates a PNG blob with the expected filename and dimensions", async () => {
    const source = new Blob([
      encodeRgbaPng({
        width: 1,
        height: 1,
        rgba: new Uint8Array([100, 110, 120, 255])
      })
    ], { type: "image/png" });
    const mask = new Blob([
      encodeRgbaPng({
        width: 1,
        height: 1,
        rgba: new Uint8Array([255, 255, 255, 255])
      })
    ], { type: "image/png" });

    const result = await createFluxFillEmbeddedMaskSource(source, mask);
    const decoded = decodeRgbaPng(new Uint8Array(await result.blob.arrayBuffer()));

    expect(result.filename).toBe(FLUX_FILL_EMBEDDED_MASK_FILENAME);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect([...decoded.rgba]).toEqual([100, 110, 120, 0]);
  });

  it("names every preset whose graph reads the mask out of the source alpha", () => {
    // The list is not "the Flux Fill presets" any more. inpaint-flux2-klein
    // shares the single-PNG upload but must not share the Flux Fill sampler
    // defaults, which is why this predicate exists separately from
    // isFluxFillPreset -- a caller that used the wrong one would either upload
    // a mask the graph has nowhere to put, or overwrite Klein's 4-step
    // operating point with Flux Fill's 20 steps.
    expect(presetUsesEmbeddedMaskAlpha("inpaint-flux-fill-basic")).toBe(true);
    expect(presetUsesEmbeddedMaskAlpha("inpaint-flux-fill-cropstitch")).toBe(true);
    expect(presetUsesEmbeddedMaskAlpha("inpaint-flux2-klein")).toBe(true);
    expect(presetUsesEmbeddedMaskAlpha("inpaint-basic")).toBe(false);
  });

  it("rejects mismatched source and mask dimensions", () => {
    expect(() =>
      createFluxFillEmbeddedMaskRgba(
        { width: 2, height: 1, rgba: new Uint8Array(8) },
        { width: 1, height: 1, rgba: new Uint8Array(4) }
      )
    ).toThrow("Source and mask dimensions must match");
  });
});
