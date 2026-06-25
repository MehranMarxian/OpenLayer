import { describe, expect, it } from "vitest";
import {
  createPaddedSelectionBounds,
  formatSelectionBounds,
  normalizeSelectionBounds
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
});
