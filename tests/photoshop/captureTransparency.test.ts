import { describe, expect, it } from "vitest";
import { hasMeaningfulTransparency } from "../../src/photoshop/photoshopAdapter";

function rgbaWithAlpha(alphas: number[]): Uint8Array {
  const rgba = new Uint8Array(alphas.length * 4);

  alphas.forEach((alpha, index) => {
    rgba[index * 4] = 200;
    rgba[index * 4 + 1] = 120;
    rgba[index * 4 + 2] = 40;
    rgba[index * 4 + 3] = alpha;
  });

  return rgba;
}

/**
 * Decides whether an edit of the captured layer comes back as a cut-out. Too
 * eager and an ordinary photograph imports with the model's faint edge alpha
 * across the whole frame; too strict and a cut-out product loses its edges.
 */
describe("hasMeaningfulTransparency", () => {
  it("reads a fully opaque layer as opaque", () => {
    expect(hasMeaningfulTransparency(rgbaWithAlpha(new Array(10_000).fill(255)))).toBe(false);
  });

  it("ignores a handful of soft pixels on an otherwise opaque photograph", () => {
    const alphas = new Array(10_000).fill(255);

    // Nine pixels -- under one in a thousand -- erased at a corner.
    for (let index = 0; index < 9; index += 1) {
      alphas[index] = 0;
    }

    expect(hasMeaningfulTransparency(rgbaWithAlpha(alphas))).toBe(false);
  });

  it("ignores antialiasing that never drops below half opacity", () => {
    const alphas = new Array(10_000).fill(255).map((alpha, index) => (index % 10 === 0 ? 130 : alpha));

    expect(hasMeaningfulTransparency(rgbaWithAlpha(alphas))).toBe(false);
  });

  it("recognises a cut-out", () => {
    // The measured Qwen teapot was 69% clear.
    const alphas = new Array(10_000).fill(255).map((alpha, index) => (index < 6_900 ? 0 : alpha));

    expect(hasMeaningfulTransparency(rgbaWithAlpha(alphas))).toBe(true);
  });

  it("recognises a mostly opaque layer with a real transparent region", () => {
    const alphas = new Array(10_000).fill(255);

    for (let index = 0; index < 50; index += 1) {
      alphas[index] = 10;
    }

    expect(hasMeaningfulTransparency(rgbaWithAlpha(alphas))).toBe(true);
  });

  it("treats an empty buffer as opaque", () => {
    expect(hasMeaningfulTransparency(new Uint8Array(0))).toBe(false);
  });
});
