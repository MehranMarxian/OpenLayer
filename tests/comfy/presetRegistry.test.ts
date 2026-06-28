import { describe, expect, it } from "vitest";
import {
  getWorkflowPreset,
  listRunnableWorkflowPresets,
  listWorkflowPresets,
  validateWorkflowForPreset
} from "../../src/comfy/presetRegistry";
import { ComfyWorkflow } from "../../src/comfy/types";
import { getTechnicalErrorDetails } from "../../src/utils/errors";

describe("presetRegistry", () => {
  it("keeps Z_image_Turbo runnable while future Flux presets stay registered but disabled", () => {
    const allTxt2ImgIds = listWorkflowPresets("txt2img").map((preset) => preset.id);
    const runnableTxt2ImgIds = listRunnableWorkflowPresets("txt2img").map((preset) => preset.id);
    const allImg2ImgIds = listWorkflowPresets("img2img").map((preset) => preset.id);
    const runnableImg2ImgIds = listRunnableWorkflowPresets("img2img").map((preset) => preset.id);
    const allInpaintIds = listWorkflowPresets("inpaint").map((preset) => preset.id);
    const runnableInpaintIds = listRunnableWorkflowPresets("inpaint").map((preset) => preset.id);

    expect(allTxt2ImgIds).toContain("txt2img-z-image-turbo");
    expect(allTxt2ImgIds).toContain("txt2img-flux1-dev");
    expect(runnableTxt2ImgIds).toEqual(["txt2img-basic", "txt2img-z-image-turbo"]);
    expect(allImg2ImgIds).toContain("img2img-z-image-turbo");
    expect(runnableImg2ImgIds).toEqual(["img2img-basic", "img2img-z-image-turbo"]);
    expect(allInpaintIds).toEqual(["inpaint-basic", "inpaint-flux-fill-basic"]);
    expect(runnableInpaintIds).toEqual(["inpaint-basic", "inpaint-flux-fill-basic"]);
  });

  it("maps inpaint-basic mask and source injections", () => {
    const preset = getWorkflowPreset("inpaint-basic");

    expect(preset.status).toBe("experimental");
    expect(preset.supportedModelFamilies).toEqual(["sd1"]);
    expect(preset.injections.sourceImage).toEqual({ nodeId: "10", inputName: "image" });
    expect(preset.injections.maskImage).toEqual({ nodeId: "12", inputName: "image" });
    expect(preset.requiredNodes.some((node) => node.classType === "InpaintModelConditioning")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "ImageToMask")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "ImageCompositeMasked")).toBe(true);
  });

  it("registers Flux Fill inpaint as a diffusion model stack preset", () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");

    expect(preset.status).toBe("experimental");
    expect(preset.modelSource.kind).toBe("diffusion-model-stack");
    expect(preset.supportedModelFamilies).toEqual(["flux"]);
    expect(preset.requiredModels?.some((model) => model.modelName === "flux1-fill-dev.safetensors")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "SamplerCustomAdvanced")).toBe(true);
  });

  it("marks Z_image_Turbo as a diffusion model stack preset", () => {
    const preset = getWorkflowPreset("txt2img-z-image-turbo");

    expect(preset.status).toBe("experimental");
    expect(preset.modelSource.kind).toBe("diffusion-model-stack");
    expect(preset.modelStack?.some((model) => model.modelName === "z_image_turbo_bf16.safetensors")).toBe(true);
    expect(preset.requiredModels?.some((model) => model.modelName === "qwen_3_4b.safetensors")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "ModelSamplingAuraFlow")).toBe(true);
  });

  it("reports missing workflow inputs with remapping guidance", () => {
    const preset = getWorkflowPreset("txt2img-basic");
    const invalidWorkflow: ComfyWorkflow = {
      "4": {
        class_type: "CheckpointLoaderSimple",
        inputs: {}
      },
      "6": {
        class_type: "CLIPTextEncode",
        inputs: { text: "x", clip: ["4", 1] }
      },
      "7": {
        class_type: "CLIPTextEncode",
        inputs: { text: "", clip: ["4", 1] }
      },
      "5": {
        class_type: "EmptyLatentImage",
        inputs: { width: 512, height: 512, batch_size: 1 }
      },
      "3": {
        class_type: "KSampler",
        inputs: {
          seed: 1,
          steps: 4,
          cfg: 7,
          denoise: 1,
          model: ["4", 0],
          positive: ["6", 0],
          negative: ["7", 0],
          latent_image: ["5", 0]
        }
      },
      "9": {
        class_type: "SaveImage",
        inputs: { images: ["8", 0] }
      }
    };

    try {
      validateWorkflowForPreset(invalidWorkflow, preset);
      throw new Error("Expected validation to fail.");
    } catch (error) {
      expect(getTechnicalErrorDetails(error)).toContain("Remap txt2img-basic");
    }
  });
});
