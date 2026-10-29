const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ZLIB_NO_COMPRESSION_HEADER = new Uint8Array([0x78, 0x01]);
const MAX_DEFLATE_BLOCK_SIZE = 0xffff;

export type RgbaPngOptions = {
  width: number;
  height: number;
  rgba: Uint8Array;
};

export type DecodedRgbaPng = RgbaPngOptions;

export function encodeRgbaPng(options: RgbaPngOptions): Uint8Array {
  validatePngOptions(options);

  const scanlines = createUnfilteredScanlines(options.width, options.height, options.rgba);
  const compressed = createZlibStoredBlocks(scanlines);
  const ihdr = createIhdrChunk(options.width, options.height);
  const idat = createChunk("IDAT", compressed);
  const iend = createChunk("IEND", new Uint8Array());

  return concatUint8Arrays([PNG_SIGNATURE, ihdr, idat, iend]);
}

const METRES_PER_INCH = 0.0254;

/**
 * Stamps a PNG with a physical resolution (a pHYs chunk) so Photoshop places it
 * at one image pixel per document pixel.
 *
 * `placeEvent` keeps a placed image's physical size, not its pixel size. A PNG
 * without pHYs counts as 72 ppi, so in a 240 ppi document every placed result
 * arrived 3.33 times too large, and the import paths beside it only translate.
 * Confirmed in Photoshop 2025 on 2026-10-29: an Inpaint import in a 240 ppi
 * document lost its whole mask off the canvas, while the same pixels at 72 ppi
 * imported exactly.
 *
 * Any existing pHYs is replaced and the new one goes straight after IHDR, where
 * the PNG spec requires it (before IDAT). Bytes that are not a PNG, or a
 * resolution that is not a positive number, come back untouched: leaving
 * Photoshop's default is better than guessing.
 */
export function setPngResolution(bytes: Uint8Array, pixelsPerInch: number): Uint8Array {
  if (!hasPngSignature(bytes) || !Number.isFinite(pixelsPerInch) || pixelsPerInch <= 0) {
    return bytes;
  }

  const pixelsPerMetre = Math.round(pixelsPerInch / METRES_PER_INCH);
  const phys = new Uint8Array(9);
  writeUint32(phys, 0, pixelsPerMetre);
  writeUint32(phys, 4, pixelsPerMetre);
  phys[8] = 1;

  const parts: Uint8Array[] = [PNG_SIGNATURE];
  let offset = PNG_SIGNATURE.byteLength;
  let wrotePhys = false;

  while (offset + 12 <= bytes.byteLength) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const chunkEnd = offset + 12 + length;

    if (chunkEnd > bytes.byteLength) {
      throw new Error("PNG chunk length is invalid.");
    }

    if (type !== "pHYs") {
      parts.push(bytes.subarray(offset, chunkEnd));
    }

    if (type === "IHDR") {
      parts.push(createChunk("pHYs", phys));
      wrotePhys = true;
    }

    offset = chunkEnd;

    if (type === "IEND") {
      break;
    }
  }

  if (!wrotePhys) {
    throw new Error("PNG IHDR chunk was not found.");
  }

  return concatUint8Arrays(parts);
}

export function decodeRgbaPng(bytes: Uint8Array): DecodedRgbaPng {
  if (!hasPngSignature(bytes)) {
    throw new Error("PNG signature was not found.");
  }

  let offset = PNG_SIGNATURE.byteLength;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset + 12 <= bytes.byteLength) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > bytes.byteLength) {
      throw new Error("PNG chunk length is invalid.");
    }

    const data = bytes.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (width <= 0 || height <= 0 || bitDepth !== 8 || colorType !== 6) {
    throw new Error("Only 8-bit RGBA PNG files are supported.");
  }

  if (idatChunks.length === 0) {
    throw new Error("PNG IDAT chunk was not found.");
  }

  const scanlines = inflateStoredZlib(concatUint8Arrays(idatChunks));
  const rowBytes = width * 4;
  const expectedScanlineBytes = (rowBytes + 1) * height;

  if (scanlines.byteLength !== expectedScanlineBytes) {
    throw new Error("PNG scanline data does not match image dimensions.");
  }

  const rgba = new Uint8Array(width * height * 4);
  let sourceOffset = 0;
  let targetOffset = 0;

  for (let row = 0; row < height; row += 1) {
    const filterType = scanlines[sourceOffset];
    sourceOffset += 1;

    if (filterType !== 0) {
      throw new Error("Only unfiltered OpenLayer PNG files are supported.");
    }

    rgba.set(scanlines.subarray(sourceOffset, sourceOffset + rowBytes), targetOffset);
    sourceOffset += rowBytes;
    targetOffset += rowBytes;
  }

  return { width, height, rgba };
}

function validatePngOptions(options: RgbaPngOptions) {
  if (!Number.isInteger(options.width) || options.width <= 0) {
    throw new Error("PNG width must be a positive integer.");
  }

  if (!Number.isInteger(options.height) || options.height <= 0) {
    throw new Error("PNG height must be a positive integer.");
  }

  if (options.rgba.byteLength !== options.width * options.height * 4) {
    throw new Error("PNG RGBA buffer size does not match width and height.");
  }
}

function createUnfilteredScanlines(width: number, height: number, rgba: Uint8Array) {
  const rowBytes = width * 4;
  const scanlineBytes = (rowBytes + 1) * height;
  const scanlines = new Uint8Array(scanlineBytes);
  let sourceOffset = 0;
  let targetOffset = 0;

  for (let row = 0; row < height; row += 1) {
    scanlines[targetOffset] = 0;
    targetOffset += 1;
    scanlines.set(rgba.subarray(sourceOffset, sourceOffset + rowBytes), targetOffset);
    sourceOffset += rowBytes;
    targetOffset += rowBytes;
  }

  return scanlines;
}

function createZlibStoredBlocks(data: Uint8Array) {
  const blockCount = Math.max(1, Math.ceil(data.byteLength / MAX_DEFLATE_BLOCK_SIZE));
  const deflateBytes = data.byteLength + blockCount * 5;
  const output = new Uint8Array(ZLIB_NO_COMPRESSION_HEADER.byteLength + deflateBytes + 4);
  let outputOffset = 0;
  let dataOffset = 0;

  output.set(ZLIB_NO_COMPRESSION_HEADER, outputOffset);
  outputOffset += ZLIB_NO_COMPRESSION_HEADER.byteLength;

  for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
    const blockLength = Math.min(MAX_DEFLATE_BLOCK_SIZE, data.byteLength - dataOffset);
    const isFinalBlock = blockIndex === blockCount - 1;
    const invertedLength = 0xffff ^ blockLength;

    output[outputOffset] = isFinalBlock ? 0x01 : 0x00;
    outputOffset += 1;
    output[outputOffset] = blockLength & 0xff;
    output[outputOffset + 1] = (blockLength >>> 8) & 0xff;
    output[outputOffset + 2] = invertedLength & 0xff;
    output[outputOffset + 3] = (invertedLength >>> 8) & 0xff;
    outputOffset += 4;
    output.set(data.subarray(dataOffset, dataOffset + blockLength), outputOffset);
    outputOffset += blockLength;
    dataOffset += blockLength;
  }

  writeUint32(output, outputOffset, calculateAdler32(data));

  return output;
}

function inflateStoredZlib(data: Uint8Array) {
  if (
    data.byteLength < ZLIB_NO_COMPRESSION_HEADER.byteLength + 5 ||
    data[0] !== ZLIB_NO_COMPRESSION_HEADER[0] ||
    data[1] !== ZLIB_NO_COMPRESSION_HEADER[1]
  ) {
    throw new Error("Only OpenLayer's stored zlib PNG compression is supported.");
  }

  const parts: Uint8Array[] = [];
  let offset = ZLIB_NO_COMPRESSION_HEADER.byteLength;
  let isFinalBlock = false;

  while (!isFinalBlock && offset + 5 <= data.byteLength) {
    const header = data[offset] ?? 0;
    offset += 1;
    isFinalBlock = (header & 0x01) === 1;

    const blockType = (header >>> 1) & 0x03;
    if (blockType !== 0) {
      throw new Error("PNG zlib stream uses unsupported compression.");
    }

    const length = (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8);
    const invertedLength = (data[offset + 2] ?? 0) | ((data[offset + 3] ?? 0) << 8);
    offset += 4;

    if (((length ^ invertedLength) & 0xffff) !== 0xffff) {
      throw new Error("PNG zlib block length is invalid.");
    }

    if (offset + length > data.byteLength) {
      throw new Error("PNG zlib block exceeds stream length.");
    }

    parts.push(data.subarray(offset, offset + length));
    offset += length;
  }

  return concatUint8Arrays(parts);
}

function createIhdrChunk(width: number, height: number) {
  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, width);
  writeUint32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return createChunk("IHDR", ihdr);
}

function createChunk(type: string, data: Uint8Array) {
  const typeBytes = asciiBytes(type);
  const chunk = new Uint8Array(12 + data.byteLength);

  writeUint32(chunk, 0, data.byteLength);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.byteLength, calculateCrc32(concatUint8Arrays([typeBytes, data])));

  return chunk;
}

function asciiBytes(value: string) {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index);
  }

  return bytes;
}

function calculateAdler32(data: Uint8Array) {
  let a = 1;
  let b = 0;

  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }

  return ((b << 16) | a) >>> 0;
}

function calculateCrc32(data: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function hasPngSignature(bytes: Uint8Array) {
  if (bytes.byteLength < PNG_SIGNATURE.byteLength) {
    return false;
  }

  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] ?? 0) * 0x1000000) +
    (((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0))
  ) >>> 0;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function concatUint8Arrays(parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }

  return output;
}
