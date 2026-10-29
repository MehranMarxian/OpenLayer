import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeRgbaPng, encodeRgbaPng, setPngResolution } from "../../src/utils/png";

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

  it("decodes OpenLayer RGBA PNG bytes", () => {
    const rgba = new Uint8Array([
      10, 20, 30, 255,
      40, 50, 60, 0
    ]);
    const png = encodeRgbaPng({ width: 2, height: 1, rgba });
    const decoded = decodeRgbaPng(png);

    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(1);
    expect([...decoded.rgba]).toEqual([...rgba]);
  });
});

describe("setPngResolution", () => {
  const rgba = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 128]);
  const png = encodeRgbaPng({ width: 2, height: 1, rgba });

  it("adds a pHYs chunk straight after IHDR so Photoshop places one pixel per document pixel", () => {
    const stamped = setPngResolution(png, 240);

    expect(listChunkTypes(stamped)).toEqual(["IHDR", "pHYs", "IDAT", "IEND"]);
    const phys = readChunkData(stamped, "pHYs");
    // 240 ppi is 9448.8 px/m; rounded, as Photoshop writes it too.
    expect(readUint32(phys, 0)).toBe(9449);
    expect(readUint32(phys, 4)).toBe(9449);
    expect(phys[8]).toBe(1);
    const decoded = decodeRgbaPng(stamped);
    expect([decoded.width, decoded.height, ...decoded.rgba]).toEqual([2, 1, ...rgba]);
  });

  it("writes a valid CRC for the new chunk", () => {
    const stamped = setPngResolution(png, 72);
    const offset = findChunkOffset(stamped, "pHYs");

    expect(readUint32(stamped, offset + 17)).toBe(crc32(stamped.slice(offset + 4, offset + 17)));
    expect(readUint32(readChunkData(stamped, "pHYs"), 0)).toBe(2835);
  });

  it("replaces an existing pHYs instead of adding a second one", () => {
    const restamped = setPngResolution(setPngResolution(png, 72), 300);

    expect(listChunkTypes(restamped)).toEqual(["IHDR", "pHYs", "IDAT", "IEND"]);
    expect(readUint32(readChunkData(restamped, "pHYs"), 0)).toBe(11811);
  });

  it("leaves bytes that are not a PNG, or a resolution that is not usable, untouched", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

    expect(setPngResolution(jpeg, 240)).toBe(jpeg);
    expect(setPngResolution(png, 0)).toBe(png);
    expect(setPngResolution(png, Number.NaN)).toBe(png);
  });
});

function listChunkTypes(png: Uint8Array) {
  const types: string[] = [];
  let offset = 8;

  while (offset + 12 <= png.byteLength) {
    types.push(String.fromCharCode(...png.slice(offset + 4, offset + 8)));
    offset += 12 + readUint32(png, offset);
  }

  return types;
}

function findChunkOffset(png: Uint8Array, chunkType: string) {
  let offset = 8;

  while (offset + 12 <= png.byteLength) {
    if (String.fromCharCode(...png.slice(offset + 4, offset + 8)) === chunkType) return offset;
    offset += 12 + readUint32(png, offset);
  }

  throw new Error(`PNG chunk ${chunkType} was not found.`);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }

  return (crc ^ 0xffffffff) >>> 0;
}

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
