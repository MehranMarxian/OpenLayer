import { decodeRgbaPng, encodeRgbaPng } from "../utils/png";

export type PixelDimensions = Readonly<{ width: number; height: number }>;
export type PixelOrigin = Readonly<{ left: number; top: number }>;

export type ExactInpaintMaskInput = Readonly<{
  blob: Blob;
  dimensions: PixelDimensions;
  sourceDimensions: PixelDimensions;
  resultDimensions: PixelDimensions;
}>;

export function validateExactInpaintMaskInput(input: ExactInpaintMaskInput) {
  const dimensions = [input.dimensions, input.sourceDimensions, input.resultDimensions];
  if (input.blob.size === 0 || dimensions.some(({ width, height }) => !isPositiveInteger(width) || !isPositiveInteger(height))) {
    throw new Error("The saved Inpaint mask or its dimensions are invalid. Capture the selection and generate again.");
  }

  if (!sameDimensions(input.dimensions, input.sourceDimensions)) {
    throw new Error("The saved Inpaint mask dimensions do not match its captured source context.");
  }

  if (!sameDimensions(input.resultDimensions, input.sourceDimensions)) {
    throw new Error("The generated Inpaint result dimensions do not match its captured source context.");
  }
}

export async function createOpaqueGrayscaleMaskPng(input: ExactInpaintMaskInput) {
  validateExactInpaintMaskInput(input);
  const decoded = decodeRgbaPng(new Uint8Array(await input.blob.arrayBuffer()));
  if (!sameDimensions(decoded, input.dimensions)) {
    throw new Error("The saved Inpaint mask PNG dimensions do not match its capture metadata.");
  }

  const rgba = new Uint8Array(decoded.rgba.length);
  for (let index = 0; index < decoded.rgba.length; index += 4) {
    const grayscale = Math.round(
      ((decoded.rgba[index] ?? 0) + (decoded.rgba[index + 1] ?? 0) + (decoded.rgba[index + 2] ?? 0)) / 3
    );
    rgba[index] = grayscale;
    rgba[index + 1] = grayscale;
    rgba[index + 2] = grayscale;
    rgba[index + 3] = 255;
  }

  const pngBytes = encodeRgbaPng({ width: decoded.width, height: decoded.height, rgba });
  const pngBuffer = pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength) as ArrayBuffer;
  return new Blob([pngBuffer], { type: "image/png" });
}

export function calculatePlacementOffset(current: PixelOrigin, target: PixelOrigin) {
  return {
    deltaX: Math.round(target.left - current.left),
    deltaY: Math.round(target.top - current.top)
  };
}

function sameDimensions(left: PixelDimensions, right: PixelDimensions) {
  return left.width === right.width && left.height === right.height;
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}
