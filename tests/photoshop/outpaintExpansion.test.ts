import { describe, expect, it } from "vitest";
import {
  createOutpaintExpansionPlan,
  snapOutpaintPads,
  validateOutpaintResultDimensions
} from "../../src/photoshop/outpaintExpansion";

describe("outpaint pad snapping", () => {
  it("leaves pads alone when the padded totals are already multiples of 8", () => {
    const snapped = snapOutpaintPads({ left: 400, top: 0, right: 400, bottom: 400 }, { width: 1024, height: 1024 });

    expect(snapped.pads).toEqual({ left: 400, top: 0, right: 400, bottom: 400 });
    expect(snapped.adjustedRight).toBe(0);
    expect(snapped.adjustedBottom).toBe(0);
  });

  it("grows only right and bottom so existing content never shifts", () => {
    // 1030 + 100 + 100 = 1230 -> needs +2 to reach 1232; 999 + 50 + 50 = 1099 -> +5 to 1104.
    const snapped = snapOutpaintPads({ left: 100, top: 50, right: 100, bottom: 50 }, { width: 1030, height: 999 });

    expect(snapped.pads.left).toBe(100);
    expect(snapped.pads.top).toBe(50);
    expect(snapped.pads.right).toBe(102);
    expect(snapped.pads.bottom).toBe(55);
    expect((1030 + snapped.pads.left + snapped.pads.right) % 8).toBe(0);
    expect((999 + snapped.pads.top + snapped.pads.bottom) % 8).toBe(0);
  });

  it("reports how much it adjusted, for the diagnostics line", () => {
    const snapped = snapOutpaintPads({ left: 0, top: 0, right: 1, bottom: 3 }, { width: 512, height: 512 });

    expect(snapped.adjustedRight).toBe(7);
    expect(snapped.adjustedBottom).toBe(5);
  });
});

describe("outpaint expansion plan", () => {
  it("places the original content at the pad offset inside the expanded canvas", () => {
    const plan = createOutpaintExpansionPlan({ width: 1024, height: 768 }, { left: 400, top: 0, right: 400, bottom: 400 });

    expect(plan.expandedWidth).toBe(1824);
    expect(plan.expandedHeight).toBe(1168);
    expect(plan.contentOffset).toEqual({ x: 400, y: 0 });
    expect(plan.resultBounds).toEqual({ left: 0, top: 0, right: 1824, bottom: 1168 });
  });

  it("rejects all-zero padding", () => {
    expect(() => createOutpaintExpansionPlan({ width: 512, height: 512 }, { left: 0, top: 0, right: 0, bottom: 0 }))
      .toThrow(/nothing to expand/i);
  });

  it("rejects negative or fractional padding", () => {
    expect(() => createOutpaintExpansionPlan({ width: 512, height: 512 }, { left: -1, top: 0, right: 0, bottom: 0 }))
      .toThrow(/non-negative/i);
    expect(() => createOutpaintExpansionPlan({ width: 512, height: 512 }, { left: 0.5, top: 0, right: 0, bottom: 0 }))
      .toThrow(/non-negative/i);
  });

  it("rejects an invalid source size", () => {
    expect(() => createOutpaintExpansionPlan({ width: 0, height: 512 }, { left: 8, top: 0, right: 0, bottom: 0 }))
      .toThrow(/invalid dimensions/i);
  });
});

describe("outpaint result validation", () => {
  const plan = createOutpaintExpansionPlan({ width: 1024, height: 1024 }, { left: 400, top: 0, right: 400, bottom: 400 });

  it("accepts a result exactly matching the expanded canvas", () => {
    expect(validateOutpaintResultDimensions({ width: 1824, height: 1424 }, plan)).toBeNull();
  });

  it("refuses to expand the canvas around a wrong-sized result", () => {
    const message = validateOutpaintResultDimensions({ width: 1820, height: 1424 }, plan);

    expect(message).toContain("1820 x 1424");
    expect(message).toContain("1824 x 1424");
  });

  it("refuses when the result dimensions could not be read", () => {
    expect(validateOutpaintResultDimensions(null, plan)).toMatch(/could not be read/i);
  });
});
