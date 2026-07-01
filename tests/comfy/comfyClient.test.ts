import { describe, expect, it } from "vitest";
import { findImageOutput, readComfyModelNameList } from "../../src/comfy/comfyClient";

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

describe("ComfyClient object_info model parsing", () => {
  it("reads newer COMBO option lists from ComfyUI object_info", () => {
    const names = readComfyModelNameList(
      {
        UpscaleModelLoader: {
          input: {
            required: {
              model_name: [
                "COMBO",
                {
                  multiselect: false,
                  options: ["4x-UltraSharp.pth"]
                }
              ]
            }
          }
        }
      },
      "UpscaleModelLoader",
      "model_name"
    );

    expect(names).toEqual(["4x-UltraSharp.pth"]);
  });

  it("keeps reading older direct array object_info lists", () => {
    const names = readComfyModelNameList(
      {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [["model-a.safetensors", "model-b.safetensors"]]
            }
          }
        }
      },
      "CheckpointLoaderSimple",
      "ckpt_name"
    );

    expect(names).toEqual(["model-a.safetensors", "model-b.safetensors"]);
  });
});
