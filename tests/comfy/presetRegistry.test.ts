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
  it("keeps runnable Flux fp8 and Z_image_Turbo presets while future Flux stack presets stay disabled", () => {
    const allTxt2ImgIds = listWorkflowPresets("txt2img").map((preset) => preset.id);
    const runnableTxt2ImgIds = listRunnableWorkflowPresets("txt2img").map((preset) => preset.id);
    const allImg2ImgIds = listWorkflowPresets("img2img").map((preset) => preset.id);
    const runnableImg2ImgIds = listRunnableWorkflowPresets("img2img").map((preset) => preset.id);
    const runnablePromptIds = listRunnableWorkflowPresets("prompt").map((preset) => preset.id);
    const allInpaintIds = listWorkflowPresets("inpaint").map((preset) => preset.id);
    const runnableInpaintIds = listRunnableWorkflowPresets("inpaint").map((preset) => preset.id);
    const allOutpaintIds = listWorkflowPresets("outpaint").map((preset) => preset.id);
    const runnableOutpaintIds = listRunnableWorkflowPresets("outpaint").map((preset) => preset.id);
    const runnableUpscaleIds = listRunnableWorkflowPresets("upscale").map((preset) => preset.id);

    expect(allTxt2ImgIds).toContain("txt2img-z-image-turbo");
    expect(allTxt2ImgIds).toContain("txt2img-flux1-dev-fp8");
    expect(allTxt2ImgIds).toContain("txt2img-flux1-dev");
    expect(runnableTxt2ImgIds).toEqual(["txt2img-basic", "txt2img-flux1-dev-fp8", "txt2img-z-image-turbo"]);
    expect(allImg2ImgIds).toContain("img2img-z-image-turbo");
    expect(runnableImg2ImgIds).toEqual(["img2img-basic", "img2img-z-image-turbo"]);
    expect(runnablePromptIds).toEqual(["prompt-from-layer-florence2"]);
    expect(allInpaintIds).toEqual(["inpaint-basic", "inpaint-flux-fill-basic"]);
    expect(runnableInpaintIds).toEqual(["inpaint-basic", "inpaint-flux-fill-basic"]);
    expect(allOutpaintIds).toEqual(["outpaint-flux-fill-basic"]);
    expect(runnableOutpaintIds).toEqual(["outpaint-flux-fill-basic"]);
    expect(runnableUpscaleIds).toEqual(["upscale-basic"]);
  });

  it("registers upscale-basic as an experimental pixel upscale workflow", () => {
    const preset = getWorkflowPreset("upscale-basic");

    expect(preset.status).toBe("experimental");
    expect(preset.mode).toBe("upscale");
    expect(preset.modelSource.kind).toBe("upscale");
    expect(preset.requiredModels?.some((model) =>
      model.modelName === "4x-UltraSharp.pth" &&
      model.acceptedModelNames?.includes("RealESRGAN_x4plus.pth")
    )).toBe(true);
    expect(preset.injections.sourceImage).toEqual({ nodeId: "10", inputName: "image" });
    expect(preset.injections.checkpoint).toEqual({ nodeId: "11", inputName: "model_name" });
    expect(preset.requiredNodes.some((node) => node.classType === "UpscaleModelLoader")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "ImageUpscaleWithModel")).toBe(true);
  });

  it("registers Flux1-dev fp8 text-to-image as an experimental checkpoint workflow", () => {
    const preset = getWorkflowPreset("txt2img-flux1-dev-fp8");

    expect(preset.status).toBe("experimental");
    expect(preset.mode).toBe("txt2img");
    expect(preset.modelSource.kind).toBe("checkpoint");
    expect(preset.supportedModelFamilies).toEqual(["flux"]);
    expect(preset.requiredModels?.some((model) => model.modelName === "flux1-dev-fp8.safetensors")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "FluxGuidance")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "EmptySD3LatentImage")).toBe(true);
    expect(preset.injections.cfg).toEqual({ nodeId: "35", inputName: "guidance" });
  });

  it("registers Prompt from Layer as an experimental Florence text workflow", () => {
    const preset = getWorkflowPreset("prompt-from-layer-florence2");

    expect(preset.status).toBe("experimental");
    expect(preset.mode).toBe("prompt");
    expect(preset.modelSource.kind).toBe("vision-language");
    expect(preset.capability?.output.kind).toBe("prompt-text");
    expect(preset.requiredModels?.some((model) => model.modelName === "Florence-2-base-PromptGen-v2.0")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "Florence2ModelLoader")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "Florence2Run")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "ShowText|pysssss")).toBe(true);
    expect(preset.injections.sourceImage).toEqual({ nodeId: "42", inputName: "image" });
    expect(preset.injections.task).toEqual({ nodeId: "38", inputName: "task" });
    expect(preset.injections.numBeams).toEqual({ nodeId: "38", inputName: "num_beams" });
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
    expect(preset.requiredModels?.some((model) =>
      model.modelName === "t5xxl_fp16.safetensors" &&
      model.acceptedModelNames?.includes("t5xxl_fp8_e4m3fn.safetensors")
    )).toBe(true);
    expect(preset.requiredModels?.some((model) =>
      model.modelName === "clip_l.safetensors" &&
      model.inputName === "clip_name1"
    )).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "DifferentialDiffusion")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "FluxGuidance")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "KSampler")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "ImageCompositeMasked")).toBe(false);
  });

  it("registers Flux Fill outpaint as a diffusion model stack preset", () => {
    const preset = getWorkflowPreset("outpaint-flux-fill-basic");

    expect(preset.status).toBe("experimental");
    expect(preset.mode).toBe("outpaint");
    expect(preset.modelSource.kind).toBe("diffusion-model-stack");
    expect(preset.supportedModelFamilies).toEqual(["flux"]);
    expect(preset.requiredModels?.some((model) => model.modelName === "flux1-fill-dev.safetensors")).toBe(true);
    expect(preset.requiredModels?.some((model) =>
      model.modelName === "t5xxl_fp16.safetensors" &&
      model.acceptedModelNames?.includes("t5xxl_fp8_e4m3fn.safetensors")
    )).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "ImagePadForOutpaint")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "DifferentialDiffusion")).toBe(true);
    expect(preset.requiredNodes.some((node) => node.classType === "FluxGuidance")).toBe(true);
    expect(preset.injections.sourceImage).toEqual({ nodeId: "17", inputName: "image" });
    expect(preset.injections.outpaintLeft).toEqual({ nodeId: "44", inputName: "left" });
    expect(preset.injections.outpaintFeathering).toEqual({ nodeId: "44", inputName: "feathering" });
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
