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

export function formatSelectionBounds(bounds: SelectionBounds) {
  const normalized = normalizeSelectionBounds(bounds);
  return `${normalized.width} x ${normalized.height} at ${normalized.left}, ${normalized.top}`;
}

function isFiniteNumber(value: number) {
  return Number.isFinite(value);
}
