import { describe, expect, it } from "vitest";
import { findImageOutput } from "../../src/comfy/comfyClient";

describe("ComfyClient output selection", () => {
  it("uses the preferred SaveImage node instead of the first history image", () => {
    const image = findImageOutput(
      {
        outputs: {
          "12": {
            images: [
              {
                filename: "uploaded-mask-preview.png",
                type: "input"
              }
            ]
          },
          "9": {
            images: [
              {
                filename: "OpenLayer_Flux_Inpaint_00001.png",
                type: "output"
              }
            ]
          }
        }
      },
      "9"
    );

    expect(image?.filename).toBe("OpenLayer_Flux_Inpaint_00001.png");
  });

  it("returns null when the expected SaveImage node has no image", () => {
    const image = findImageOutput(
      {
        outputs: {
          "12": {
            images: [
              {
                filename: "uploaded-mask-preview.png",
                type: "input"
              }
            ]
          }
        }
      },
      "9"
    );

    expect(image).toBeNull();
  });
});
