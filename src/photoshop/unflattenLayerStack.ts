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

/**
 * The names a finished stack of `count` layers carries, back to front.
 *
 * Exported because the count is not always known when the layers are placed:
 * a plate that turns out to be blank is skipped, and the survivors are renamed
 * so an artist does not get "Layer 1" and "Layer 4" with nothing between them.
 */
export function stackLayerNames(count: number): string[] {
  const names: string[] = [];

  for (let depth = 1; depth <= count; depth += 1) {
    names.push(formatLayerName(depth, count));
  }

  return names;
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

/**
 * What a decomposed plate turns out to hold, once its pixels have been read.
 *
 * This replaced a rule based on the plate's position in the batch, which the
 * gate's own runs supported and a real photograph disproved. Q8 found index 1
 * carrying the background every time it was measured, so the import treated
 * depth 1 as the background and everything after it as foreground. On a source
 * outside that sample the model emitted a **pure white fill** at index 1 --
 * RGB standard deviation 1.08, mean (254, 255, 254) -- and put the actual
 * background at index 2. Position is a coincidence of the runs that were
 * measured; content is the thing itself.
 */
export type PlateKind =
  /** No visible alpha anywhere. Nothing to import. */
  | "blank"
  /** Visible, but a single flat colour: a base fill, carrying no picture. */
  | "flat-fill"
  /** Covers the whole frame with real content. This is a background. */
  | "full-frame"
  /** Real content with real transparency. This is something in front. */
  | "cutout";

export type PlateSample = Readonly<{
  /**
   * Fraction of the sample that is at least half opaque, 0-1.
   *
   * Deliberately not the peak alpha, which was the first test here and is a
   * single-pixel statistic: one stray value decides it. This asks how much of
   * the plate could actually show, which is the question.
   */
  solidFraction: number;
  /** Fraction of the sample that is fully transparent, 0-1. */
  clearFraction: number;
  /** Standard deviation of the RGB channels across the sample. */
  rgbStandardDeviation: number;
}>;

/**
 * Every threshold below is a bright line between two measured populations
 * rather than a tuned value, which is why they are stated as constants and
 * tested rather than adjusted when a result disappoints.
 */
/**
 * A plate needs a real, if small, amount of substantially opaque pixels.
 *
 * Measured across every run: plates carrying nothing peaked at 5, 8, 12, 20 and
 * 63 -- the last of those is a quarter opaque at its strongest point, so it can
 * never show anything, yet it cleared a ceiling set at 24 and arrived as a
 * layer masked to near-black. Every plate carrying real content reached 255.
 * 0.1% of a 128-square sample is sixteen pixels, which the smallest real
 * subject measured -- 5% of its frame -- clears by two orders of magnitude.
 */
export const PLATE_MIN_SOLID_FRACTION = 0.001;
/** A flat fill measured 1.08; every plate carrying a picture measured over 40. */
export const PLATE_FLAT_FILL_DEVIATION_CEILING = 6;
/** A background covered the frame exactly; a cut-out left 41% of it clear. */
export const PLATE_FULL_FRAME_CLEAR_CEILING = 0.05;

export function classifyPlateSample(sample: PlateSample): PlateKind {
  if (!(sample.solidFraction > PLATE_MIN_SOLID_FRACTION)) {
    return "blank";
  }

  // Checked before coverage, because a flat fill covers the frame completely
  // and would otherwise be mistaken for a background and imported as one.
  if (sample.rgbStandardDeviation < PLATE_FLAT_FILL_DEVIATION_CEILING) {
    return "flat-fill";
  }

  if (sample.clearFraction < PLATE_FULL_FRAME_CLEAR_CEILING) {
    return "full-frame";
  }

  return "cutout";
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
