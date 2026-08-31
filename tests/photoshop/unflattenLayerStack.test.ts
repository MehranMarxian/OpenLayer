import { describe, expect, it } from "vitest";
import {
  placementUsesSourcePixels,
  planLayerScale,
  planUnflattenLayerStack,
  UNFLATTEN_COMPOSITE_INDEX
} from "../../src/photoshop/unflattenLayerStack";

describe("planUnflattenLayerStack", () => {
  it("drops the composite and keeps every layer after it", () => {
    // A layers: 4 run returns five images.
    const plan = planUnflattenLayerStack({ imageCount: 5, sourceName: "Photo" });

    expect(plan.placements.map((placement) => placement.imageIndex)).toEqual([1, 2, 3, 4]);
    expect(plan.placements.some((placement) => placement.imageIndex === UNFLATTEN_COMPOSITE_INDEX)).toBe(false);
  });

  it("places back to front, so the frontmost layer ends up on top", () => {
    const plan = planUnflattenLayerStack({ imageCount: 4 });

    expect(plan.placements.map((placement) => placement.depth)).toEqual([1, 2, 3]);
    // Placement order is the array order; depth 1 goes down first.
    expect(plan.placements[0].imageIndex).toBe(1);
    expect(plan.placements[plan.placements.length - 1].imageIndex).toBe(3);
  });

  it("names the ends of the stack so the order is legible in the Layers panel", () => {
    const plan = planUnflattenLayerStack({ imageCount: 5 });

    expect(plan.placements.map((placement) => placement.layerName)).toEqual([
      "Layer 1 (back)",
      "Layer 2",
      "Layer 3",
      "Layer 4 (front)"
    ]);
  });

  it("does not label a single layer as back or front", () => {
    const plan = planUnflattenLayerStack({ imageCount: 2 });

    expect(plan.placements.map((placement) => placement.layerName)).toEqual(["Layer 1"]);
  });

  it("names the group after the captured layer, and falls back when there is no name", () => {
    expect(planUnflattenLayerStack({ imageCount: 3, sourceName: "Background copy" }).groupName).toBe(
      "Unflatten Background copy"
    );
    expect(planUnflattenLayerStack({ imageCount: 3, sourceName: "   " }).groupName).toBe("Unflatten");
    expect(planUnflattenLayerStack({ imageCount: 3 }).groupName).toBe("Unflatten");
  });

  it("refuses a run that returned nothing to import", () => {
    // One image is the composite alone: nothing was separated.
    expect(() => planUnflattenLayerStack({ imageCount: 1 })).toThrow(/composite plus at least one layer/);
    expect(() => planUnflattenLayerStack({ imageCount: 0 })).toThrow(/composite plus at least one layer/);
  });
});

describe("planLayerScale", () => {
  it("grows a 640px result back onto the region it was captured from", () => {
    // The case Q5 found: placeEvent never enlarges, and the aligner only moves.
    const plan = planLayerScale({ width: 640, height: 424 }, { width: 3840, height: 2544 });

    expect(plan?.horizontalPercent).toBeCloseTo(600, 5);
    expect(plan?.verticalPercent).toBeCloseTo(600, 5);
  });

  it("scales each axis independently when the aspect ratio drifted", () => {
    const plan = planLayerScale({ width: 640, height: 400 }, { width: 1280, height: 1200 });

    expect(plan?.horizontalPercent).toBeCloseTo(200, 5);
    expect(plan?.verticalPercent).toBeCloseTo(300, 5);
  });

  it("returns null when the layer is already the right size", () => {
    expect(planLayerScale({ width: 1024, height: 768 }, { width: 1024, height: 768 })).toBeNull();
  });

  it("ignores sub-pixel rounding rather than resampling for nothing", () => {
    expect(planLayerScale({ width: 1000, height: 1000 }, { width: 1000.4, height: 999.6 })).toBeNull();
  });

  it("returns null for degenerate measurements instead of a nonsense scale", () => {
    expect(planLayerScale({ width: 0, height: 100 }, { width: 500, height: 500 })).toBeNull();
    expect(planLayerScale({ width: 100, height: 100 }, { width: 0, height: 500 })).toBeNull();
    expect(planLayerScale({ width: Number.NaN, height: 100 }, { width: 500, height: 500 })).toBeNull();
    expect(planLayerScale({ width: 100, height: 100 }, { width: Number.POSITIVE_INFINITY, height: 5 })).toBeNull();
  });

  it("shrinks as well, so a result larger than its target is not left oversized", () => {
    const plan = planLayerScale({ width: 2000, height: 2000 }, { width: 1000, height: 1000 });

    expect(plan?.horizontalPercent).toBeCloseTo(50, 5);
  });
});

describe("placementUsesSourcePixels", () => {
  const placements = planUnflattenLayerStack({ imageCount: 5 }).placements;

  it("builds every layer in front from the artist's own pixels", () => {
    // The model's RGB for these is a 640px re-render of content the document
    // already holds at full resolution. Only the matte is new.
    expect(placements.filter(placementUsesSourcePixels).map((p) => p.depth)).toEqual([2, 3, 4]);
  });

  it("leaves the backmost layer on the model's pixels", () => {
    // Depth 1 holds what the model invented behind the subject. Masking the
    // source with it would reveal the subject again rather than the fill.
    expect(placementUsesSourcePixels(placements[0])).toBe(false);
    expect(placements[0].depth).toBe(1);
  });

  it("keeps a two-image run entirely on the model's pixels", () => {
    // One layer means one background and nothing in front of it.
    const single = planUnflattenLayerStack({ imageCount: 2 }).placements;

    expect(single.some(placementUsesSourcePixels)).toBe(false);
  });
});
