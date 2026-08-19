import { describe, expect, it } from "vitest";
import { snapToStep } from "../../src/ui/spikeArtistControls";

/**
 * SPIKE support, delete with src/ui/spikeArtistControls.ts.
 *
 * These cases are not hypothetical: UXP ignores a range input's `step` and
 * hands back continuous floats. Round 1 of the spike measured 40.541, 47.147
 * and 45.675 from sliders whose step was the HTML default of 1. Quantising is
 * therefore ours to do, and submitting 20.4 steps to ComfyUI is the bug this
 * prevents.
 */
describe("snapToStep", () => {
  it("quantises the raw floats UXP actually returned in the spike", () => {
    expect(snapToStep(40.541, 0, 100, 1)).toBe(41);
    expect(snapToStep(47.147, 0, 100, 1)).toBe(47);
    expect(snapToStep(45.675, 0, 100, 1)).toBe(46);
  });

  it("snaps a denoise-shaped control to its 0.05 grid without float dust", () => {
    expect(snapToStep(0.617, 0, 1, 0.05)).toBe(0.6);
    expect(snapToStep(0.63, 0, 1, 0.05)).toBe(0.65);
    // 0.3 is the classic binary-float trap: 6 * 0.05 is 0.30000000000000004.
    expect(snapToStep(0.29, 0, 1, 0.05)).toBe(0.3);
  });

  it("clamps to the declared range rather than trusting the host", () => {
    expect(snapToStep(-12, 0, 100, 1)).toBe(0);
    expect(snapToStep(240, 0, 100, 1)).toBe(100);
  });

  it("respects a range that does not start at zero", () => {
    // Steps sliders start at the preset's floor, e.g. Klein's 4.
    expect(snapToStep(4.4, 4, 60, 1)).toBe(4);
    expect(snapToStep(19.6, 4, 60, 1)).toBe(20);
  });

  it("leaves a non-finite value alone instead of inventing a number", () => {
    expect(snapToStep(Number.NaN, 0, 100, 1)).toBeNaN();
  });
});
