import type { PixelDimensions } from "./exactInpaintMask";

export type OutpaintPads = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

// ComfyUI's VAE encode rounds the padded image down to multiples of 8, so a
// padded size that is not a multiple of 8 comes back smaller than requested and
// the translate-only aligned import would drift by up to 7px. Mirrors
// INPAINT_CONTEXT_MULTIPLE in photoshopAdapter/inpaintReadiness.
export const OUTPAINT_DIMENSION_MULTIPLE = 8;

export type SnappedOutpaintPads = Readonly<{
  pads: OutpaintPads;
  adjustedRight: number;
  adjustedBottom: number;
}>;

// Grows the right/bottom pads just enough that the padded totals are multiples
// of 8. Right/bottom are chosen because extending them never shifts the
// artist's existing content, so the alignment math stays exact.
export function snapOutpaintPads(pads: OutpaintPads, source: PixelDimensions): SnappedOutpaintPads {
  const totalWidth = source.width + pads.left + pads.right;
  const totalHeight = source.height + pads.top + pads.bottom;
  const widthRemainder = totalWidth % OUTPAINT_DIMENSION_MULTIPLE;
  const heightRemainder = totalHeight % OUTPAINT_DIMENSION_MULTIPLE;
  const adjustedRight = widthRemainder === 0 ? 0 : OUTPAINT_DIMENSION_MULTIPLE - widthRemainder;
  const adjustedBottom = heightRemainder === 0 ? 0 : OUTPAINT_DIMENSION_MULTIPLE - heightRemainder;

  return {
    pads: {
      left: pads.left,
      top: pads.top,
      right: pads.right + adjustedRight,
      bottom: pads.bottom + adjustedBottom
    },
    adjustedRight,
    adjustedBottom
  };
}

export type OutpaintExpansionPlan = Readonly<{
  sourceDimensions: PixelDimensions;
  pads: OutpaintPads;
  expandedWidth: number;
  expandedHeight: number;
  // Where the artist's original content sits inside the expanded canvas.
  contentOffset: Readonly<{ x: number; y: number }>;
  // The generated result covers the whole expanded canvas.
  resultBounds: Readonly<{ left: number; top: number; right: number; bottom: number }>;
}>;

export function createOutpaintExpansionPlan(
  source: PixelDimensions,
  pads: OutpaintPads
): OutpaintExpansionPlan {
  if (!isNonNegativeInteger(pads.left) || !isNonNegativeInteger(pads.top) ||
      !isNonNegativeInteger(pads.right) || !isNonNegativeInteger(pads.bottom)) {
    throw new Error("Outpaint padding must be non-negative whole pixel values.");
  }

  if (!isPositiveInteger(source.width) || !isPositiveInteger(source.height)) {
    throw new Error("The captured Outpaint source has invalid dimensions.");
  }

  if (pads.left + pads.top + pads.right + pads.bottom === 0) {
    throw new Error("Outpaint padding is zero on every side; there is nothing to expand.");
  }

  const expandedWidth = source.width + pads.left + pads.right;
  const expandedHeight = source.height + pads.top + pads.bottom;

  return {
    sourceDimensions: { width: source.width, height: source.height },
    pads,
    expandedWidth,
    expandedHeight,
    contentOffset: { x: pads.left, y: pads.top },
    resultBounds: { left: 0, top: 0, right: expandedWidth, bottom: expandedHeight }
  };
}

// The generated image must exactly match the canvas the plan will create;
// anything else means the workflow resized behind our back, and expanding the
// artist's canvas around a wrong-sized image would misalign their artwork.
export function validateOutpaintResultDimensions(
  result: PixelDimensions | null,
  plan: OutpaintExpansionPlan
): string | null {
  if (!result) {
    return "The generated Outpaint result dimensions could not be read, so the canvas will not be expanded.";
  }

  if (Math.round(result.width) !== plan.expandedWidth || Math.round(result.height) !== plan.expandedHeight) {
    return `The generated Outpaint result is ${Math.round(result.width)} x ${Math.round(result.height)}, but the expanded canvas needs ${plan.expandedWidth} x ${plan.expandedHeight}. Generate again before importing with canvas expansion.`;
  }

  return null;
}

function isNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}
