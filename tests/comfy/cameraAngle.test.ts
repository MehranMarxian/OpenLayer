import { describe, expect, it } from "vitest";
import {
  buildCameraAnglePrompt,
  CAMERA_DIRECTIONS,
  CAMERA_DISTANCES,
  CAMERA_HEIGHTS,
  DEFAULT_CAMERA_ANGLE
} from "../../src/comfy/cameraAngle";

describe("buildCameraAnglePrompt", () => {
  it("writes the LoRA's own phrase in direction, height, distance order", () => {
    expect(buildCameraAnglePrompt({ direction: "back", height: "low", distance: "wide" })).toBe(
      "<sks> back view low-angle shot wide shot"
    );
  });

  it("starts from the model card's reference pose", () => {
    expect(buildCameraAnglePrompt(DEFAULT_CAMERA_ANGLE)).toBe("<sks> front-right quarter view eye-level shot medium shot");
  });

  it("covers exactly the 96 trained poses", () => {
    expect(CAMERA_DIRECTIONS).toHaveLength(8);
    expect(CAMERA_HEIGHTS).toHaveLength(4);
    expect(CAMERA_DISTANCES).toHaveLength(3);

    const prompts = new Set<string>();
    for (const direction of CAMERA_DIRECTIONS) {
      for (const height of CAMERA_HEIGHTS) {
        for (const distance of CAMERA_DISTANCES) {
          prompts.add(buildCameraAnglePrompt({ direction: direction.id, height: height.id, distance: distance.id }));
        }
      }
    }

    expect(prompts.size).toBe(96);
  });

  it("refuses an unknown choice instead of sending a different pose", () => {
    expect(() => buildCameraAnglePrompt({ direction: "up", height: "low", distance: "wide" })).toThrow(/direction/);
  });

  it("keeps the artist labels plain text", () => {
    for (const option of [...CAMERA_DIRECTIONS, ...CAMERA_HEIGHTS, ...CAMERA_DISTANCES]) {
      expect(option.label).not.toMatch(/`|--|\*\*|<|>/);
    }
  });
});
