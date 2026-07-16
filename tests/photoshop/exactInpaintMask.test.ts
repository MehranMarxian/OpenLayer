import { describe, expect, it } from "vitest";
import { calculatePlacementOffset, createOpaqueGrayscaleMaskPng, validateExactInpaintMaskInput } from "../../src/photoshop/exactInpaintMask";
import { decodeRgbaPng, encodeRgbaPng } from "../../src/utils/png";

function maskBlob(width: number, height: number, values: number[]) {
  const rgba = new Uint8Array(values.flatMap((value) => [value, value, value, 255]));
  const bytes = encodeRgbaPng({ width, height, rgba });
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: "image/png" });
}

describe("exact Inpaint mask import", () => {
  it("preserves freeform regions, holes, disconnected regions, and feathered grayscale as alpha", async () => {
    const values = [0, 255, 0, 96, 255, 0, 255, 0, 192];
    const dimensions = { width: 3, height: 3 };
    const output = await createOpaqueGrayscaleMaskPng({ blob: maskBlob(3, 3, values), dimensions, sourceDimensions: dimensions, resultDimensions: dimensions });
    const decoded = decodeRgbaPng(new Uint8Array(await output.arrayBuffer()));
    expect(Array.from(decoded.rgba.filter((_, index) => index % 4 === 0))).toEqual(values);
    expect(Array.from(decoded.rgba.filter((_, index) => index % 4 === 3))).toEqual(values.map(() => 255));
  });

  it("rejects a mask dimension mismatch", () => {
    expect(() => validateExactInpaintMaskInput({ blob: maskBlob(2, 2, [0, 0, 0, 0]), dimensions: { width: 2, height: 2 }, sourceDimensions: { width: 3, height: 2 }, resultDimensions: { width: 3, height: 2 } })).toThrow(/mask dimensions/i);
  });

  it("rejects a result dimension mismatch", () => {
    expect(() => validateExactInpaintMaskInput({ blob: maskBlob(2, 2, [0, 0, 0, 0]), dimensions: { width: 2, height: 2 }, sourceDimensions: { width: 2, height: 2 }, resultDimensions: { width: 1, height: 2 } })).toThrow(/result dimensions/i);
  });

  it("rejects an empty saved mask", () => {
    const dimensions = { width: 1, height: 1 };
    expect(() => validateExactInpaintMaskInput({ blob: new Blob(), dimensions, sourceDimensions: dimensions, resultDimensions: dimensions })).toThrow(/invalid/i);
  });

  it("reuses the result placement offset instead of deriving one from trimmed mask bounds", () => {
    const resultOffset = calculatePlacementOffset({ left: 486, top: 214 }, { left: 120, top: 80 });
    expect(resultOffset).toEqual({ deltaX: -366, deltaY: -134 });

    // A transparency-trimmed mask might report a completely different origin;
    // its bounds must not participate in the mask placement calculation.
    expect(calculatePlacementOffset({ left: 702, top: 350 }, { left: 120, top: 80 })).not.toEqual(resultOffset);
  });
});
