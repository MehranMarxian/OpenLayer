import { describe, expect, it } from "vitest";
import { extractSolidMask, measurePlateSample } from "../../src/photoshop/photoshopAdapter";
import {
  classifyPlateSample,
  containmentFraction,
  isPlateRedundant,
  PLATE_REDUNDANT_CONTAINMENT_CEILING
} from "../../src/photoshop/unflattenLayerStack";

/** Builds interleaved RGBA bytes the way the imaging API hands them over. */
function rgba(pixels: readonly [number, number, number, number][]) {
  const raw = new Uint8Array(pixels.length * 4);

  pixels.forEach(([r, g, b, a], index) => {
    raw.set([r, g, b, a], index * 4);
  });

  return raw;
}

describe("measurePlateSample", () => {
  it("counts how much is solid, so a small subject is not mistaken for a faint plate", () => {
    const smallButSolid = rgba([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [200, 30, 30, 255]
    ]);
    // Everything present, none of it more than a quarter opaque: the shape of
    // the plate that defeated the previous rule.
    const largeButFaint = rgba([
      [200, 30, 30, 63],
      [200, 30, 30, 63],
      [200, 30, 30, 63],
      [200, 30, 30, 63]
    ]);

    expect(measurePlateSample(smallButSolid, 4).solidFraction).toBeCloseTo(0.25, 5);
    expect(measurePlateSample(largeButFaint, 4).solidFraction).toBe(0);
  });

  it("counts only fully transparent pixels as clear", () => {
    const raw = rgba([
      [0, 0, 0, 0],
      [0, 0, 0, 1],
      [10, 20, 30, 255],
      [10, 20, 30, 255]
    ]);

    expect(measurePlateSample(raw, 4).clearFraction).toBeCloseTo(0.25, 5);
  });

  it("measures flatness only where something is visible", () => {
    // The RGB beneath a fully transparent pixel is arbitrary. Including it
    // would make a flat cut-out look busy, or a busy one look flat, depending
    // on what the encoder happened to leave there.
    const raw = rgba([
      [255, 0, 0, 0],
      [0, 255, 0, 0],
      [0, 0, 255, 0],
      [128, 128, 128, 255],
      [128, 128, 128, 255]
    ]);

    expect(measurePlateSample(raw, 4).rgbStandardDeviation).toBeCloseTo(0, 5);
  });

  it("treats a plate with no alpha channel as fully opaque", () => {
    // Three components means the plate carries no transparency at all, which
    // for a decomposed layer means opaque, not empty.
    const raw = new Uint8Array([10, 20, 30, 40, 50, 60]);
    const sample = measurePlateSample(raw, 3);

    expect(sample.solidFraction).toBe(1);
    expect(sample.clearFraction).toBe(0);
  });

  it("does not divide by zero on an empty read, and still imports the layer", () => {
    const sample = measurePlateSample(new Uint8Array(), 4);

    // The exact kind does not matter here; what matters is that a read telling
    // us nothing never drops a layer. Importing something empty is a visible
    // nuisance, dropping something real is silent data loss.
    expect(["blank", "flat-fill"]).not.toContain(classifyPlateSample(sample));
    expect(Number.isFinite(sample.rgbStandardDeviation)).toBe(true);
    expect(Number.isFinite(sample.clearFraction)).toBe(true);
  });

  it("classifies the three plates that came out of one real run", () => {
    // A flat white fill, a background, and a cut-out subject, as measured off
    // an actual decomposition of a photograph.
    const flatFill = measurePlateSample(rgba([
      [254, 255, 254, 255],
      [255, 254, 255, 255],
      [254, 254, 255, 255],
      [255, 255, 254, 255]
    ]), 4);
    const background = measurePlateSample(rgba([
      [10, 20, 30, 255],
      [200, 180, 160, 255],
      [90, 40, 20, 255],
      [140, 200, 60, 255]
    ]), 4);
    const cutout = measurePlateSample(rgba([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [200, 180, 160, 255],
      [20, 40, 90, 255]
    ]), 4);

    expect(classifyPlateSample(flatFill)).toBe("flat-fill");
    expect(classifyPlateSample(background)).toBe("full-frame");
    expect(classifyPlateSample(cutout)).toBe("cutout");
  });
});

describe("extractSolidMask and containment", () => {
  it("marks exactly the pixels measurePlateSample counts as solid", () => {
    const raw = rgba([
      [0, 0, 0, 0],
      [9, 9, 9, 127],
      [9, 9, 9, 128],
      [9, 9, 9, 255]
    ]);

    // The two functions share a floor, so "how much is solid" and "which parts
    // are solid" can never disagree.
    expect([...extractSolidMask(raw, 4)]).toEqual([0, 0, 1, 1]);
    expect(measurePlateSample(raw, 4).solidFraction).toBeCloseTo(0.5, 5);
  });

  it("reports how much of a plate sits inside another", () => {
    const candidate = Uint8Array.from([1, 1, 1, 1, 0, 0]);
    const half = Uint8Array.from([1, 1, 0, 0, 1, 1]);
    const all = Uint8Array.from([1, 1, 1, 1, 1, 1]);

    expect(containmentFraction(candidate, half)).toBeCloseTo(0.5, 5);
    expect(containmentFraction(candidate, all)).toBe(1);
    expect(containmentFraction(Uint8Array.from([0, 0]), all)).toBe(0);
  });

  it("drops a plate the stack already holds, and keeps one that adds something", () => {
    const placed = [Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 0, 0])];
    // 90% inside what is already down: the shape of the layer that arrived as a
    // third near-identical mask of the same person.
    const repeat = Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
    // Half of it is new, which is what a real second layer looks like.
    const distinct = Uint8Array.from([1, 1, 0, 0, 0, 0, 0, 0, 1, 1]);

    expect(isPlateRedundant(repeat, placed)).toBe(true);
    expect(isPlateRedundant(distinct, placed)).toBe(false);
  });

  it("sits above every good run measured and below every bad one", () => {
    // Worst containment within a run, measured across five sources:
    //   bench 5.7%  balloon 23.0%  large-subject 53.0%  cat 99.8%  poster 100%
    const good = [0.057, 0.23, 0.53];
    const bad = [0.875, 0.998, 1];

    for (const value of good) expect(value).toBeLessThan(PLATE_REDUNDANT_CONTAINMENT_CEILING);
    for (const value of bad) expect(value).toBeGreaterThan(PLATE_REDUNDANT_CONTAINMENT_CEILING);
  });
});

describe("the background must never join the comparison set", () => {
  it("would swallow every later plate, because it covers the whole frame", () => {
    const background = Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1]);
    const subject = Uint8Array.from([0, 0, 1, 1, 0, 0, 0, 0]);
    const bench = Uint8Array.from([1, 1, 0, 0, 0, 0, 0, 0]);

    // Everything is inside a full-frame plate by definition, so comparing
    // against one reports every real layer as redundant. Replaying the rule
    // over nine recorded runs is what caught this: it dropped all three layers
    // of the cleanest decomposition measured.
    expect(containmentFraction(subject, background)).toBe(1);
    expect(containmentFraction(bench, background)).toBe(1);
    expect(isPlateRedundant(subject, [background])).toBe(true);

    // Against each other, which is the comparison that means something, they
    // are plainly different layers.
    expect(isPlateRedundant(subject, [bench])).toBe(false);
    expect(isPlateRedundant(bench, [subject])).toBe(false);
  });
});
