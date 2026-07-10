import { describe, expect, it } from "vitest";
import { assertCaptureSizeWithinLimit, MAX_CAPTURE_PIXELS } from "../../src/photoshop/photoshopAdapter";
import { OpenLayerError } from "../../src/utils/errors";

describe("capture size limit", () => {
  it("allows captures up to exactly 4096 x 4096", () => {
    expect(() => assertCaptureSizeWithinLimit(4096, 4096)).not.toThrow();
    expect(() => assertCaptureSizeWithinLimit(272, 328)).not.toThrow();
    expect(MAX_CAPTURE_PIXELS).toBe(4096 * 4096);
  });

  it("rejects captures above the 16-megapixel limit with a friendly message", () => {
    try {
      assertCaptureSizeWithinLimit(5000, 5000);
      throw new Error("Expected the capture size check to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(OpenLayerError);
      expect((error as OpenLayerError).code).toBe("PHOTOSHOP_EXPORT_FAILED");
      expect((error as OpenLayerError).message).toContain("5000 x 5000");
      expect((error as OpenLayerError).message).toContain("16-megapixel");
    }
  });

  it("rejects wide but short captures that exceed the pixel budget", () => {
    expect(() => assertCaptureSizeWithinLimit(20000, 1000)).toThrow("16-megapixel");
  });
});
