import { describe, expect, it } from "vitest";
import {
  createPaddedSelectionBounds,
  formatSelectionBounds,
  normalizeSelectionBounds,
  snapBoundsToMultiple
} from "../../src/photoshop/selectionUtils";

describe("selectionUtils", () => {
  it("normalizes rectangular Photoshop selection bounds", () => {
    const bounds = normalizeSelectionBounds({
      left: 10.4,
      top: 20.2,
      right: 110.6,
      bottom: 220.8
    });

    expect(bounds).toEqual({
      left: 10,
      top: 20,
      right: 111,
      bottom: 221,
      width: 101,
      height: 201
    });
  });

  it("formats bounds for beginner-friendly status text", () => {
    expect(formatSelectionBounds({ left: 5, top: 8, right: 45, bottom: 58 })).toBe("40 x 50 at 5, 8");
  });

  it("creates padded inpaint context bounds clamped to the document", () => {
    expect(
      createPaddedSelectionBounds(
        { left: 20, top: 30, right: 80, bottom: 90 },
        { width: 100, height: 120 },
        50
      )
    ).toEqual({
      left: 0,
      top: 0,
      right: 100,
      bottom: 120,
      width: 100,
      height: 120
    });
  });

  it("rejects empty selection bounds", () => {
    expect(() => normalizeSelectionBounds({ left: 10, top: 10, right: 10, bottom: 20 })).toThrow(
      "visible rectangular area"
    );
  });

  it("snaps bounds to multiples of 8 by expanding right and bottom first", () => {
    expect(
      snapBoundsToMultiple(
        { left: 10, top: 20, right: 25, bottom: 41 },
        { width: 100, height: 120 },
        8
      )
    ).toEqual({
      left: 10,
      top: 20,
      right: 26,
      bottom: 44,
      width: 16,
      height: 24
    });
  });

  it("keeps bounds unchanged when they are already multiples", () => {
    expect(
      snapBoundsToMultiple(
        { left: 0, top: 0, right: 64, bottom: 80 },
        { width: 100, height: 120 },
        8
      )
    ).toEqual({
      left: 0,
      top: 0,
      right: 64,
      bottom: 80,
      width: 64,
      height: 80
    });
  });

  it("expands leftward and upward when the document edge blocks expansion", () => {
    expect(
      snapBoundsToMultiple(
        { left: 95, top: 113, right: 100, bottom: 120 },
        { width: 100, height: 120 },
        8
      )
    ).toEqual({
      left: 92,
      top: 112,
      right: 100,
      bottom: 120,
      width: 8,
      height: 8
    });
  });

  it("shrinks to the largest multiple that fits a non-multiple document", () => {
    expect(
      snapBoundsToMultiple(
        { left: 0, top: 0, right: 100, bottom: 100 },
        { width: 100, height: 100 },
        8
      )
    ).toEqual({
      left: 0,
      top: 0,
      right: 96,
      bottom: 96,
      width: 96,
      height: 96
    });
  });

  it("leaves bounds unchanged when the document is smaller than the multiple", () => {
    expect(
      snapBoundsToMultiple(
        { left: 0, top: 0, right: 5, bottom: 6 },
        { width: 5, height: 6 },
        8
      )
    ).toEqual({
      left: 0,
      top: 0,
      right: 5,
      bottom: 6,
      width: 5,
      height: 6
    });
  });

  it("always produces multiple-of-8 sizes when the document allows it", () => {
    const documentSize = { width: 1024, height: 768 };
    const samples = [
      { left: 3, top: 7, right: 130, bottom: 99 },
      { left: 500, top: 300, right: 1021, bottom: 765 },
      { left: 0, top: 0, right: 1, bottom: 1 },
      { left: 900, top: 700, right: 1024, bottom: 768 }
    ];

    for (const sample of samples) {
      const snapped = snapBoundsToMultiple(sample, documentSize, 8);

      expect(snapped.width % 8).toBe(0);
      expect(snapped.height % 8).toBe(0);
      expect(snapped.left).toBeGreaterThanOrEqual(0);
      expect(snapped.top).toBeGreaterThanOrEqual(0);
      expect(snapped.right).toBeLessThanOrEqual(documentSize.width);
      expect(snapped.bottom).toBeLessThanOrEqual(documentSize.height);
    }
  });
});
