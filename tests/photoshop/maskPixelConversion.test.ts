import { describe, expect, it } from "vitest";
import { convertMaskPixelsToRgba } from "../../src/photoshop/photoshopAdapter";

// The captured mask layer starts fully transparent, then gets filled white
// through the original selection and black through its inverse. Every pixel
// the two fills actually touched ends up with alpha close to 255, including
// every real feather gradient; only a pixel neither fill reached (a capture
// artifact, not a feather value) can have near-zero alpha.
function onePixel(rgba: [number, number, number, number]) {
  return convertMaskPixelsToRgba(new Uint8Array(rgba), 1, 1, 4);
}

describe("mask pixel conversion", () => {
  it("uses the pixel's own luminance when it was actually painted", () => {
    expect(Array.from(onePixel([200, 200, 200, 255]))).toEqual([200, 200, 200, 255]);
  });

  it("preserves a mid-feather gray at full trusted alpha", () => {
    expect(Array.from(onePixel([128, 128, 128, 255]))).toEqual([128, 128, 128, 255]);
  });

  it("forces a fully untouched pixel to no-repaint regardless of its luminance", () => {
    // Garbage or uninitialized luminance at alpha 0 must not leak into the mask.
    expect(Array.from(onePixel([255, 255, 255, 0]))).toEqual([0, 0, 0, 255]);
  });

  it("does not trust luminance at or below the alpha threshold", () => {
    expect(Array.from(onePixel([255, 255, 255, 8]))).toEqual([0, 0, 0, 255]);
  });

  it("trusts luminance as soon as alpha rises one step above the threshold", () => {
    expect(Array.from(onePixel([90, 90, 90, 9]))).toEqual([90, 90, 90, 255]);
  });

  it("treats a 3-component pixel as fully trusted, since it carries no alpha", () => {
    const rgba = convertMaskPixelsToRgba(new Uint8Array([10, 20, 30]), 1, 1, 3);
    expect(Array.from(rgba)).toEqual([20, 20, 20, 255]);
  });

  it("rejects a component count it does not know how to interpret", () => {
    expect(() => convertMaskPixelsToRgba(new Uint8Array([0, 0, 0, 0, 0]), 1, 1, 5)).toThrow(/5-component/);
  });

  it("rejects fewer pixel bytes than the declared dimensions require", () => {
    expect(() => convertMaskPixelsToRgba(new Uint8Array([0, 0]), 2, 2, 4)).toThrow(/fewer selection mask pixel bytes/);
  });
});
