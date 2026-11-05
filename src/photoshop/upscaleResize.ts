import type { PixelDimensions } from "./exactInpaintMask";

// An upscale model returns a larger image than it was given -- 4x-UltraSharp
// returns exactly 4x. Placing that onto an unchanged canvas leaves the artist
// with a layer that overflows their document on every side, so the document
// itself has to grow to meet the result.
export type UpscaleResizePlan = Readonly<{
  sourceDimensions: PixelDimensions;
  resizedWidth: number;
  resizedHeight: number;
  // Reported to the artist so the diagnostics can say "4x", not just the pixels.
  scale: number;
  // The upscaled result covers the whole resized document.
  resultBounds: Readonly<{ left: number; top: number; right: number; bottom: number }>;
}>;

// Upscale models scale both axes by the same factor, but rounding inside the
// model can leave a single pixel of drift on one axis. Anything beyond that is
// a different image, not a rounding artifact.
const ASPECT_TOLERANCE_PIXELS = 1;

export function createUpscaleResizePlan(
  source: PixelDimensions,
  result: PixelDimensions
): UpscaleResizePlan {
  if (!isPositiveInteger(source.width) || !isPositiveInteger(source.height)) {
    throw new Error("The captured Upscale source has invalid dimensions.");
  }

  if (!isPositiveInteger(result.width) || !isPositiveInteger(result.height)) {
    throw new Error("The generated Upscale result has invalid dimensions.");
  }

  return {
    sourceDimensions: { width: source.width, height: source.height },
    resizedWidth: result.width,
    resizedHeight: result.height,
    scale: result.width / source.width,
    resultBounds: { left: 0, top: 0, right: result.width, bottom: result.height }
  };
}

// Resampling the artist's whole document is destructive to every layer in it,
// so it only happens when the result is unambiguously an upscale of exactly
// what we captured. Every rejection here falls back to the plain floating-layer
// import, which changes nothing about their document.
export function validateUpscaleResultDimensions(
  result: PixelDimensions | null,
  source: PixelDimensions
): string | null {
  if (!result) {
    return "The generated Upscale result dimensions could not be read, so the document will not be resized.";
  }

  const width = Math.round(result.width);
  const height = Math.round(result.height);

  if (width <= 0 || height <= 0) {
    return "The generated Upscale result has no usable dimensions, so the document will not be resized.";
  }

  if (width < source.width || height < source.height) {
    return `The generated Upscale result is ${width} x ${height}, which is smaller than the ${source.width} x ${source.height} source. Importing as a floating layer instead of shrinking the document.`;
  }

  if (width === source.width && height === source.height) {
    return `The generated Upscale result is the same ${width} x ${height} as the source, so there is nothing to resize.`;
  }

  // Both axes must have grown by the same factor, or the result does not
  // correspond to the document we would be resizing.
  const scale = width / source.width;
  const expectedHeight = source.height * scale;

  if (Math.abs(height - expectedHeight) > ASPECT_TOLERANCE_PIXELS) {
    return `The generated Upscale result is ${width} x ${height}, which is not a uniform scale of the ${source.width} x ${source.height} source. Importing as a floating layer instead of distorting the document.`;
  }

  return null;
}

/**
 * A layer capture's upscale opens as a document of its own, at the result's
 * true size.
 *
 * A layer has no relationship to the canvas, so growing the document (above)
 * would resample every other layer by a factor that means nothing to them.
 * Placing the result into the document does not work either: Photoshop's
 * default "Resize Image During Place" shrinks anything larger than the canvas
 * to fit, so a 4x result of a full-canvas layer came back at 25% and looked
 * exactly like the layer it came from (G4 smoke run, 2026-11-05, finding 2).
 * With that preference off it overflowed the canvas on every side instead
 * (a3ea019). A document of its own is the one place the artist sees what they
 * upscaled whichever way the preference is set, and their own document is left
 * untouched. Canvas captures keep growing the document.
 */
export type UpscaleNewDocumentPlan = Readonly<{ width: number; height: number }>;

/** The new document is exactly the result's size; null when that size is unusable. */
export function createUpscaleNewDocumentPlan(result: PixelDimensions | null): UpscaleNewDocumentPlan | null {
  if (!result) {
    return null;
  }

  const width = Math.round(result.width);
  const height = Math.round(result.height);

  return isPositiveInteger(width) && isPositiveInteger(height) ? { width, height } : null;
}

// Photoshop's own default for a new document.
const DEFAULT_PIXELS_PER_INCH = 72;

/**
 * The new document takes the source document's resolution. The placed PNG is
 * stamped with that same value (saveBlobForPlacement), and a mismatch between
 * the two is what made Photoshop scale placed images by the ppi ratio (#156).
 */
export function resolveUpscaleDocumentResolution(sourcePixelsPerInch: number | undefined): number {
  const value = Number(sourcePixelsPerInch);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_PIXELS_PER_INCH;
}

// "4x" reads better than "4.0000000001x"; a non-integer factor keeps one
// decimal so an unexpected scale is still visible rather than rounded away.
export function formatUpscaleScale(scale: number): string {
  if (!Number.isFinite(scale) || scale <= 0) {
    return "unknown scale";
  }

  const rounded = Math.round(scale);
  return Math.abs(scale - rounded) < 0.01 ? `${rounded}x` : `${scale.toFixed(1)}x`;
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}
