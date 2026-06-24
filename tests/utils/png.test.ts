import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { encodeRgbaPng } from "../../src/utils/png";

describe("encodeRgbaPng", () => {
  it("creates a valid RGBA PNG with lossless pixel bytes", () => {
    const rgba = new Uint8Array([
      255, 0, 0, 255,
      0, 255, 0, 128
    ]);
    const png = encodeRgbaPng({ width: 2, height: 1, rgba });

    expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(readUint32(png, 16)).toBe(2);
    expect(readUint32(png, 20)).toBe(1);
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(6);

    const idatData = readChunkData(png, "IDAT");
    const inflated = inflateSync(idatData);

    expect([...inflated]).toEqual([
      0,
      255, 0, 0, 255,
      0, 255, 0, 128
    ]);
  });

  it("rejects mismatched RGBA buffer sizes", () => {
    expect(() =>
      encodeRgbaPng({
        width: 2,
        height: 1,
        rgba: new Uint8Array([255, 0, 0, 255])
      })
    ).toThrow("PNG RGBA buffer size does not match width and height.");
  });
});

function readChunkData(png: Uint8Array, chunkType: string) {
  let offset = 8;

  while (offset < png.byteLength) {
    const length = readUint32(png, offset);
    const type = String.fromCharCode(...png.slice(offset + 4, offset + 8));

    if (type === chunkType) {
      return png.slice(offset + 8, offset + 8 + length);
    }

    offset += 12 + length;
  }

  throw new Error(`PNG chunk ${chunkType} was not found.`);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  ) >>> 0;
}
