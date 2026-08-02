import { describe, expect, it } from "vitest";
import {
  createUpscaleResizePlan,
  formatUpscaleScale,
  validateUpscaleResultDimensions
} from "../../src/photoshop/upscaleResize";

describe("upscale resize plan", () => {
  it("covers the resized document with the 4x result", () => {
    const plan = createUpscaleResizePlan({ width: 1024, height: 1024 }, { width: 4096, height: 4096 });

    expect(plan.resizedWidth).toBe(4096);
    expect(plan.resizedHeight).toBe(4096);
    expect(plan.scale).toBe(4);
    expect(plan.resultBounds).toEqual({ left: 0, top: 0, right: 4096, bottom: 4096 });
  });

  it("keeps the source dimensions so the import can refuse a document that changed underneath it", () => {
    const plan = createUpscaleResizePlan({ width: 800, height: 600 }, { width: 3200, height: 2400 });

    expect(plan.sourceDimensions).toEqual({ width: 800, height: 600 });
  });

  it("rejects non-integer or zero dimensions rather than resampling to a broken size", () => {
    expect(() => createUpscaleResizePlan({ width: 0, height: 512 }, { width: 2048, height: 2048 })).toThrow();
    expect(() => createUpscaleResizePlan({ width: 512, height: 512 }, { width: 2048.5, height: 2048 })).toThrow();
  });
});

describe("upscale result validation", () => {
  const source = { width: 1024, height: 1024 };

  it("accepts a clean 4x result", () => {
    expect(validateUpscaleResultDimensions({ width: 4096, height: 4096 }, source)).toBeNull();
  });

  it("accepts a one-pixel rounding difference from the model", () => {
    expect(validateUpscaleResultDimensions({ width: 4096, height: 4095 }, source)).toBeNull();
  });

  // Resizing the artist's document is destructive to every layer in it, so each
  // of these falls back to the untouched floating-layer import instead.
  it("refuses when the dimensions could not be read", () => {
    expect(validateUpscaleResultDimensions(null, source)).toContain("could not be read");
  });

  it("refuses to shrink the document when the result is smaller", () => {
    const reason = validateUpscaleResultDimensions({ width: 512, height: 512 }, source);

    expect(reason).toContain("smaller");
    expect(reason).toContain("floating layer");
  });

  it("refuses when the result is the same size, because there is nothing to resize", () => {
    expect(validateUpscaleResultDimensions({ width: 1024, height: 1024 }, source)).toContain("nothing to resize");
  });

  it("refuses a non-uniform scale rather than distorting the artwork", () => {
    const reason = validateUpscaleResultDimensions({ width: 4096, height: 2048 }, source);

    expect(reason).toContain("not a uniform scale");
    expect(reason).toContain("floating layer");
  });

  it("handles a non-square source, where a uniform scale means different pixel totals per axis", () => {
    expect(validateUpscaleResultDimensions({ width: 3200, height: 2400 }, { width: 800, height: 600 })).toBeNull();
    expect(validateUpscaleResultDimensions({ width: 3200, height: 3200 }, { width: 800, height: 600 }))
      .toContain("not a uniform scale");
  });
});

describe("upscale scale formatting", () => {
  it("prints whole factors without decimals", () => {
    expect(formatUpscaleScale(4)).toBe("4x");
    expect(formatUpscaleScale(3.999999)).toBe("4x");
  });

  it("keeps a decimal when the factor genuinely is not whole, so a surprise stays visible", () => {
    expect(formatUpscaleScale(2.5)).toBe("2.5x");
  });

  // Mirrors the formatBytes(0) rule: an unmeasurable value must never read as a
  // real one.
  it("says unknown rather than 0x for a nonsense scale", () => {
    expect(formatUpscaleScale(0)).toBe("unknown scale");
    expect(formatUpscaleScale(Number.NaN)).toBe("unknown scale");
  });
});
