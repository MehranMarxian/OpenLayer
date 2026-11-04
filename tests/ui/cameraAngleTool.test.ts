import { describe, expect, it } from "vitest";
import { CAMERA_DIRECTIONS, CAMERA_DISTANCES, CAMERA_HEIGHTS, DEFAULT_CAMERA_ANGLE } from "../../src/comfy/cameraAngle";
import { validateCameraAngleSettings } from "../../src/comfy/settings";
import { createCameraAngleOptionsMarkup, describeCameraAngle, readCameraAngleChoice } from "../../src/ui/tools/cameraAngle";

describe("readCameraAngleChoice", () => {
  it("keeps three known ids as they are", () => {
    expect(readCameraAngleChoice({ direction: "back", height: "low", distance: "close-up" })).toEqual({
      direction: "back",
      height: "low",
      distance: "close-up"
    });
  });

  it("falls back to the default for each part it does not know", () => {
    // An empty select (UXP before options load) must still build a valid pose.
    expect(readCameraAngleChoice({ direction: "", height: "sideways", distance: "medium" })).toEqual({
      direction: DEFAULT_CAMERA_ANGLE.direction,
      height: DEFAULT_CAMERA_ANGLE.height,
      distance: "medium"
    });
  });
});

describe("describeCameraAngle", () => {
  it("reads the labels the artist chose, separated by slashes", () => {
    // Slashes because "Low, looking up" already has a comma in it.
    expect(describeCameraAngle({ direction: "front-right", height: "low", distance: "wide" })).toBe(
      "Front right / Low, looking up / Wide"
    );
  });

  it("stays plain text for every one of the 96 poses", () => {
    for (const direction of CAMERA_DIRECTIONS) {
      for (const height of CAMERA_HEIGHTS) {
        for (const distance of CAMERA_DISTANCES) {
          const text = describeCameraAngle({ direction: direction.id, height: height.id, distance: distance.id });
          expect(text).not.toMatch(/`|--|\*\*|<|>/);
        }
      }
    }
  });
});

describe("createCameraAngleOptionsMarkup", () => {
  it("writes one option per choice and selects the default", () => {
    const markup = createCameraAngleOptionsMarkup(CAMERA_HEIGHTS, "eye-level");

    expect(markup.match(/<option /g)).toHaveLength(CAMERA_HEIGHTS.length);
    expect(markup).toContain('<option value="eye-level" selected>Eye level</option>');
    expect(markup.match(/ selected/g)).toHaveLength(1);
  });
});

describe("validateCameraAngleSettings", () => {
  it("keeps a typed seed", () => {
    expect(validateCameraAngleSettings({ seed: "42" })).toEqual({ settings: { seed: 42 }, warnings: [] });
  });

  it("draws a random seed for an empty field and says which", () => {
    const { settings, warnings } = validateCameraAngleSettings({ seed: "  " });

    expect(Number.isInteger(settings.seed)).toBe(true);
    expect(warnings).toEqual([`Random seed: ${settings.seed}.`]);
  });

  it("refuses a seed that is not a whole number", () => {
    expect(() => validateCameraAngleSettings({ seed: "1.5" })).toThrow(/whole number/);
  });
});
