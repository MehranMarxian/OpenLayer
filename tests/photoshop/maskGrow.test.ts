import { describe, expect, it } from "vitest";
import { growMaskPng, growMaskRgba } from "../../src/photoshop/maskGrow";
import { decodeRgbaPng, encodeRgbaPng } from "../../src/utils/png";

function mask(width: number, height: number, white: Array<[number, number]>) {
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) rgba[index * 4 + 3] = 255;
  for (const [x, y] of white) {
    const offset = (y * width + x) * 4;
    rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = 255;
  }
  return rgba;
}

function whiteAt(rgba: Uint8Array, width: number, x: number, y: number) {
  return rgba[(y * width + x) * 4] === 255;
}

/** Brute-force square dilation, to check the linear-time version against. */
function bruteForce(rgba: Uint8Array, width: number, height: number, radius: number) {
  const out: boolean[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let hit = false;
      for (let dy = -radius; dy <= radius && !hit; dy += 1) {
        for (let dx = -radius; dx <= radius && !hit; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && rgba[(ny * width + nx) * 4] === 255) hit = true;
        }
      }
      out.push(hit);
    }
  }
  return out;
}

describe("growMaskRgba", () => {
  it("grows a single pixel into a square of the given radius", () => {
    const grown = growMaskRgba(mask(9, 9, [[4, 4]]), 9, 9, 2);

    expect(whiteAt(grown, 9, 2, 2)).toBe(true);
    expect(whiteAt(grown, 9, 6, 6)).toBe(true);
    expect(whiteAt(grown, 9, 1, 4)).toBe(false);
    expect(whiteAt(grown, 9, 4, 7)).toBe(false);
  });

  it("matches a brute-force dilation on an irregular mask, edges included", () => {
    const width = 23;
    const height = 17;
    const points: Array<[number, number]> = [[0, 0], [5, 3], [6, 3], [22, 16], [11, 8], [3, 15], [20, 1]];
    const source = mask(width, height, points);

    for (const radius of [0, 1, 3, 7]) {
      const grown = growMaskRgba(source, width, height, radius);
      const actual = Array.from({ length: width * height }, (_, index) => grown[index * 4] === 255);
      expect(actual, `radius ${radius}`).toEqual(bruteForce(source, width, height, radius));
    }
  });

  it("keeps alpha and writes grey, as ImageToMask(red) reads it", () => {
    const grown = growMaskRgba(mask(3, 1, [[1, 0]]), 3, 1, 1);

    expect(Array.from(grown)).toEqual([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
  });
});

describe("growMaskPng", () => {
  it("round-trips through OpenLayer's own PNG encoding", async () => {
    const png = encodeRgbaPng({ width: 5, height: 5, rgba: mask(5, 5, [[2, 2]]) });
    const grown = await growMaskPng(new Blob([png], { type: "image/png" }), 1);
    const decoded = decodeRgbaPng(new Uint8Array(await grown.arrayBuffer()));

    expect([decoded.width, decoded.height]).toEqual([5, 5]);
    expect(whiteAt(decoded.rgba, 5, 1, 1)).toBe(true);
    expect(whiteAt(decoded.rgba, 5, 0, 0)).toBe(false);
  });
});
