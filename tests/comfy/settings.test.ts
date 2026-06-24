import { describe, expect, it } from "vitest";
import {
  validateGenerationSettings,
  validateImageToImageSettings,
  validateSketchToImageSettings
} from "../../src/comfy/settings";

describe("settings validation", () => {
  it("rounds dimensions to supported 64-pixel increments", () => {
    const result = validateGenerationSettings({
      width: "777",
      height: "513",
      steps: "20",
      cfg: "7",
      seed: "123"
    });

    expect(result.settings.width).toBe(768);
    expect(result.settings.height).toBe(512);
    expect(result.warnings).toContain("Width adjusted to 768.");
    expect(result.warnings).toContain("Height adjusted to 512.");
  });

  it("clamps image-to-image denoise safely", () => {
    const result = validateImageToImageSettings({
      steps: "12",
      cfg: "7",
      seed: "1",
      denoise: "4"
    });

    expect(result.settings.denoise).toBe(1);
    expect(result.warnings).toContain("Denoise adjusted to 1.");
  });

  it("clamps Sketch ControlNet strength safely", () => {
    const result = validateSketchToImageSettings({
      steps: "12",
      cfg: "7",
      seed: "1",
      denoise: "0.5",
      controlStrength: "3"
    });

    expect(result.settings.controlStrength).toBe(2);
    expect(result.warnings).toContain("ControlNet strength adjusted to 2.");
  });

  it("rejects non-numeric settings", () => {
    expect(() =>
      validateGenerationSettings({
        width: "wide",
        height: "512",
        steps: "20",
        cfg: "7",
        seed: "1"
      })
    ).toThrow("Width must be a whole number.");
  });
});
