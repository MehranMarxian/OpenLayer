/**
 * Pure planning for the Unflatten import: which of a run's images become
 * Photoshop layers, in what order, under what names, and how much each has to
 * be scaled to sit back over the region it came from.
 *
 * All of this is host-free on purpose. The adapter half cannot be tested
 * outside Photoshop, so everything that can be decided without Photoshop is
 * decided here instead.
 */

export type UnflattenLayerPlacement = Readonly<{
  /** Index into the run's images, in ComfyUI's output order. */
  imageIndex: number;
  /** 1 is the backmost layer. Placement happens in this order. */
  depth: number;
  layerName: string;
}>;

export type UnflattenStackPlan = Readonly<{
  groupName: string;
  /** Back to front. Placing in this order leaves the frontmost layer on top. */
  placements: readonly UnflattenLayerPlacement[];
}>;

export type UnflattenStackPlanInput = Readonly<{
  /** How many images the run returned, composite included. */
  imageCount: number;
  /** The captured layer's name, used to name the group after its source. */
  sourceName?: string;
}>;

/**
 * The graph returns `layers + 1` images. Index 0 is the flattened composite --
 * the whole picture, opaque -- and the layers run back-to-front from index 1.
 * Measured over twenty runs; see docs/unflatten-gate-findings.md, Q8.
 *
 * Importing index 0 would stack a flat copy of the entire picture over the
 * group and read as an import bug rather than a misunderstood contract, so it
 * is dropped here, once, where a test can hold it still.
 */
export const UNFLATTEN_COMPOSITE_INDEX = 0;

export function planUnflattenLayerStack(input: UnflattenStackPlanInput): UnflattenStackPlan {
  const layerCount = input.imageCount - 1;

  if (!Number.isInteger(input.imageCount) || layerCount < 1) {
    throw new Error(
      `An Unflatten run must return a composite plus at least one layer; it returned ${input.imageCount} image(s).`
    );
  }

  const placements: UnflattenLayerPlacement[] = [];

  for (let depth = 1; depth <= layerCount; depth += 1) {
    placements.push({
      imageIndex: UNFLATTEN_COMPOSITE_INDEX + depth,
      depth,
      layerName: formatLayerName(depth, layerCount)
    });
  }

  return {
    groupName: formatGroupName(input.sourceName),
    placements
  };
}

function formatLayerName(depth: number, layerCount: number) {
  if (layerCount === 1) return "Layer 1";
  if (depth === 1) return "Layer 1 (back)";
  if (depth === layerCount) return `Layer ${depth} (front)`;
  return `Layer ${depth}`;
}

function formatGroupName(sourceName?: string) {
  const trimmed = sourceName?.trim();

  return trimmed ? `Unflatten ${trimmed}` : "Unflatten";
}

export type LayerScalePlan = Readonly<{
  horizontalPercent: number;
  verticalPercent: number;
}>;

/**
 * How much a placed layer has to grow to cover the region it was captured from.
 *
 * This exists because of a measured Photoshop behaviour rather than a
 * preference. `placeEvent` shrinks an oversized image to fit the canvas and
 * **never enlarges a small one**, and the aligner beside it only translates.
 * The graph caps its output at 640px on the long side, so a layer captured from
 * a large document comes back a fraction of the size it has to occupy and
 * nothing on the existing import path would grow it. See
 * docs/unflatten-gate-findings.md, Q5.
 *
 * Returns null when no transform is warranted: identical size, or a degenerate
 * measurement that would produce a nonsense scale. Callers skip the transform
 * rather than applying 100%, because a no-op transform is still a history step
 * and still resamples.
 */
export function planLayerScale(
  placed: { width: number; height: number },
  target: { width: number; height: number }
): LayerScalePlan | null {
  if (!isPositiveFinite(placed.width) || !isPositiveFinite(placed.height)) return null;
  if (!isPositiveFinite(target.width) || !isPositiveFinite(target.height)) return null;

  const horizontalPercent = (target.width / placed.width) * 100;
  const verticalPercent = (target.height / placed.height) * 100;

  // Sub-pixel differences are the VAE's rounding, not a scale anyone asked for.
  if (isEffectivelyUnscaled(horizontalPercent) && isEffectivelyUnscaled(verticalPercent)) {
    return null;
  }

  return { horizontalPercent, verticalPercent };
}

function isEffectivelyUnscaled(percent: number) {
  return Math.abs(percent - 100) < 0.1;
}

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}
