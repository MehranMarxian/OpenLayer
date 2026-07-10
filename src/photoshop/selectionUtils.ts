export type SelectionBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type NormalizedSelectionBounds = SelectionBounds & {
  width: number;
  height: number;
};

export type DocumentSize = {
  width: number;
  height: number;
};

export function normalizeSelectionBounds(bounds: SelectionBounds): NormalizedSelectionBounds {
  const normalized = {
    left: Math.round(bounds.left),
    top: Math.round(bounds.top),
    right: Math.round(bounds.right),
    bottom: Math.round(bounds.bottom)
  };

  if (
    !isFiniteNumber(normalized.left) ||
    !isFiniteNumber(normalized.top) ||
    !isFiniteNumber(normalized.right) ||
    !isFiniteNumber(normalized.bottom)
  ) {
    throw new Error("Selection bounds must contain finite pixel values.");
  }

  const width = normalized.right - normalized.left;
  const height = normalized.bottom - normalized.top;

  if (width <= 0 || height <= 0) {
    throw new Error("Selection bounds must describe a visible rectangular area.");
  }

  return {
    ...normalized,
    width,
    height
  };
}

export function createPaddedSelectionBounds(
  selectionBounds: SelectionBounds,
  documentSize: DocumentSize,
  padding: number
): NormalizedSelectionBounds {
  const selection = normalizeSelectionBounds(selectionBounds);
  const documentWidth = Math.round(documentSize.width);
  const documentHeight = Math.round(documentSize.height);
  const normalizedPadding = Math.max(0, Math.round(padding));

  if (
    !isFiniteNumber(documentWidth) ||
    !isFiniteNumber(documentHeight) ||
    documentWidth <= 0 ||
    documentHeight <= 0
  ) {
    throw new Error("Document size must contain visible pixel dimensions.");
  }

  return normalizeSelectionBounds({
    left: Math.max(0, selection.left - normalizedPadding),
    top: Math.max(0, selection.top - normalizedPadding),
    right: Math.min(documentWidth, selection.right + normalizedPadding),
    bottom: Math.min(documentHeight, selection.bottom + normalizedPadding)
  });
}

export function snapBoundsToMultiple(
  bounds: SelectionBounds,
  documentSize: DocumentSize,
  multiple: number
): NormalizedSelectionBounds {
  const selection = normalizeSelectionBounds(bounds);
  const documentWidth = Math.round(documentSize.width);
  const documentHeight = Math.round(documentSize.height);
  const normalizedMultiple = Math.max(1, Math.round(multiple));

  if (
    !isFiniteNumber(documentWidth) ||
    !isFiniteNumber(documentHeight) ||
    documentWidth <= 0 ||
    documentHeight <= 0
  ) {
    throw new Error("Document size must contain visible pixel dimensions.");
  }

  const horizontal = snapAxisToMultiple(selection.left, selection.right, documentWidth, normalizedMultiple);
  const vertical = snapAxisToMultiple(selection.top, selection.bottom, documentHeight, normalizedMultiple);

  return normalizeSelectionBounds({
    left: horizontal.start,
    top: vertical.start,
    right: horizontal.end,
    bottom: vertical.end
  });
}

function snapAxisToMultiple(start: number, end: number, documentLength: number, multiple: number) {
  const size = end - start;
  const expandedSize = Math.ceil(size / multiple) * multiple;
  const largestFit = Math.floor(documentLength / multiple) * multiple;
  const targetSize = Math.min(expandedSize, largestFit);

  if (targetSize <= 0 || targetSize === size) {
    return { start, end };
  }

  const nextEnd = Math.min(documentLength, start + targetSize);

  return {
    start: nextEnd - targetSize,
    end: nextEnd
  };
}

export function formatSelectionBounds(bounds: SelectionBounds) {
  const normalized = normalizeSelectionBounds(bounds);
  return `${normalized.width} x ${normalized.height} at ${normalized.left}, ${normalized.top}`;
}

function isFiniteNumber(value: number) {
  return Number.isFinite(value);
}
