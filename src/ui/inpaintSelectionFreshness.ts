import type { InpaintSourceMode } from "../photoshop/inpaintSourceMode";
import type { SelectedRegionSourceImage } from "../photoshop/photoshopAdapter";
import type { NormalizedSelectionBounds } from "../photoshop/selectionUtils";

// What the document shows at the moment Generate is pressed. Bounds are null when
// nothing is selected.
export type LiveSelection = Readonly<{
  documentId: number | null;
  bounds: NormalizedSelectionBounds | null;
}>;

export type InpaintSelectionFreshness =
  | Readonly<{ stale: false }>
  | Readonly<{ stale: true; message: string; technicalMessage: string }>;

const CAPTURE_BUTTON_LABELS: Record<InpaintSourceMode, string> = {
  "visible-canvas": "Capture Visible",
  "active-layer": "Capture Active Layer"
};

// Only a live selection that visibly disagrees with the capture counts as stale.
// Deselecting after a capture is normal (it is how you see the image clean) and
// is also the way to say "use what I captured", so no selection passes. A capture
// from another document is the document-binding check's business, not this one's:
// the two selections have nothing to do with each other.
//
// Bounds are a cheap proxy. A change that keeps the same bounding box, such as
// adding an area inside it, is not caught: comparing the real mask would mean
// redoing the capture, which builds a temporary layer in the artist's document.
export function evaluateInpaintSelectionFreshness(
  source: Pick<SelectedRegionSourceImage, "originatingDocument" | "selection" | "sourceMode">,
  live: LiveSelection
): InpaintSelectionFreshness {
  if (!live.bounds || live.documentId !== source.originatingDocument?.id) {
    return { stale: false };
  }

  const captured = source.selection.bounds;

  if (sameBounds(captured, live.bounds)) {
    return { stale: false };
  }

  return {
    stale: true,
    message: `The selection changed after it was captured, so Generate stopped and nothing was sent. Click ${CAPTURE_BUTTON_LABELS[source.sourceMode]} to use the new selection. To use the captured selection instead, deselect, then click Generate.`,
    technicalMessage: `Captured selection ${formatBounds(captured)}; live selection ${formatBounds(live.bounds)}.`
  };
}

function sameBounds(left: NormalizedSelectionBounds, right: NormalizedSelectionBounds) {
  return left.left === right.left &&
    left.top === right.top &&
    left.right === right.right &&
    left.bottom === right.bottom;
}

function formatBounds(bounds: NormalizedSelectionBounds) {
  return `${bounds.width} x ${bounds.height} at ${bounds.left}, ${bounds.top}`;
}
