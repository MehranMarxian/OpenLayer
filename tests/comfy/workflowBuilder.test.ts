import { describe, expect, it } from "vitest";
import {
  buildInpaintWorkflow,
  buildImg2ImgWorkflow,
  buildSketchToImageWorkflow,
  buildTxt2ImgWorkflow
} from "../../src/comfy/workflowBuilder";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";
import { createRequiredModelSelectionKey } from "../../src/comfy/workflowModelRequirements";

describe("workflowBuilder", () => {
  it("injects text-to-image settings into txt2img-basic", async () => {
    const result = await buildTxt2ImgWorkflow({
      presetId: "txt2img-basic",
      prompt: "a quiet moon",
      negativePrompt: "noise",
      checkpointName: "epicrealism_naturalSinRC1VAE.safetensors",
      width: 768,
      height: 512,
      steps: 24,
      cfg: 6.5,
      seed: 1234
    });

    expect(result.preset.id).toBe("txt2img-basic");
    expect(result.workflow["4"].inputs.ckpt_name).toBe("epicrealism_naturalSinRC1VAE.safetensors");
    expect(result.workflow["6"].inputs.text).toBe("a quiet moon");
    expect(result.workflow["7"].inputs.text).toBe("noise");
    expect(result.workflow["5"].inputs.width).toBe(768);
    expect(result.workflow["5"].inputs.height).toBe(512);
    expect(result.workflow["3"].inputs.steps).toBe(24);
    expect(result.workflow["3"].inputs.cfg).toBe(6.5);
    expect(result.workflow["3"].inputs.seed).toBe(1234);
  });

  it("injects source image and denoise into img2img-basic", async () => {
    const result = await buildImg2ImgWorkflow({
      presetId: "img2img-basic",
      prompt: "reinterpret the source",
      negativePrompt: "",
      checkpointName: "sd_xl_base_1.0.safetensors",
      sourceImageName: "openlayer-source.png",
      steps: 18,
      cfg: 7,
      denoise: 0.45,
      seed: 42
    });

    expect(result.workflow["10"].inputs.image).toBe("openlayer-source.png");
    expect(result.workflow["3"].inputs.denoise).toBe(0.45);
  });

  it("injects ControlNet strength into sketch2img-linecn-basic", async () => {
    const result = await buildSketchToImageWorkflow({
      presetId: "sketch2img-linecn-basic",
      prompt: "clean lineart guided portrait",
      negativePrompt: "blur",
      checkpointName: "epicrealism_naturalSinRC1VAE.safetensors",
      sourceImageName: "openlayer-sketch.png",
      steps: 12,
      cfg: 5,
      denoise: 0.6,
      controlStrength: 0.9,
      seed: 99
    });

    expect(result.workflow["10"].inputs.image).toBe("openlayer-sketch.png");
    expect(result.workflow["14"].inputs.strength).toBe(0.9);
  });

  it("injects source image, mask image, and denoise into inpaint-basic", async () => {
    const result = await buildInpaintWorkflow({
      presetId: "inpaint-basic",
      prompt: "repair the selected area",
      negativePrompt: "blur",
      checkpointName: "epicrealism_naturalSinRC1VAE.safetensors",
      sourceImageName: "openlayer-inpaint-source.png",
      maskImageName: "openlayer-inpaint-mask.png",
      steps: 16,
      cfg: 7,
      denoise: 0.75,
      seed: 2026
    });

    expect(result.preset.id).toBe("inpaint-basic");
    expect(result.workflow["4"].inputs.ckpt_name).toBe("epicrealism_naturalSinRC1VAE.safetensors");
    expect(result.workflow["10"].inputs.image).toBe("openlayer-inpaint-source.png");
    expect(result.workflow["12"].inputs.image).toBe("openlayer-inpaint-mask.png");
    expect(result.workflow["6"].inputs.text).toBe("repair the selected area");
    expect(result.workflow["7"].inputs.text).toBe("blur");
    expect(result.workflow["11"].class_type).toBe("InpaintModelConditioning");
    expect(result.workflow["3"].inputs.positive).toEqual(["11", 0]);
    expect(result.workflow["3"].inputs.negative).toEqual(["11", 1]);
    expect(result.workflow["3"].inputs.latent_image).toEqual(["11", 2]);
    expect(result.workflow["3"].inputs.denoise).toBe(0.75);
    expect(result.workflow["3"].inputs.seed).toBe(2026);
    expect(result.workflow["14"].class_type).toBe("ImageCompositeMasked");
    expect(result.workflow["14"].inputs.destination).toEqual(["10", 0]);
    expect(result.workflow["14"].inputs.source).toEqual(["8", 0]);
    expect(result.workflow["14"].inputs.mask).toEqual(["13", 0]);
    expect(result.workflow["9"].inputs.images).toEqual(["14", 0]);
  });

  it("injects Flux Fill inpaint embedded source, prompt, model, guidance, and seed", async () => {
    const result = await buildInpaintWorkflow({
      presetId: "inpaint-flux-fill-basic",
      prompt: "repair the moon surface",
      negativePrompt: "black square",
      checkpointName: "flux1-fill-dev.safetensors",
      sourceImageName: "openlayer-flux-source-mask.png",
      maskImageName: "openlayer-separate-mask-should-not-be-injected.png",
      steps: 18,
      cfg: 3.5,
      denoise: 0.8,
      seed: 4242,
      width: 640,
      height: 512
    });

    expect(result.preset.id).toBe("inpaint-flux-fill-basic");
    expect(result.workflow["31"].inputs.unet_name).toBe("flux1-fill-dev.safetensors");
    expect(result.workflow["34"].inputs.clip_name1).toBe("clip_l.safetensors");
    expect(result.workflow["34"].inputs.clip_name2).toBe("t5xxl_fp16.safetensors");
    expect(result.workflow["34"].inputs.type).toBe("flux");
    expect(result.workflow["17"].inputs.image).toBe("openlayer-flux-source-mask.png");
    expect(result.workflow["23"].inputs.text).toBe("repair the moon surface");
    expect(result.workflow["26"].inputs.guidance).toBe(3.5);
    expect(result.workflow["3"].inputs.steps).toBe(18);
    expect(result.workflow["3"].inputs.denoise).toBe(0.8);
    expect(result.workflow["3"].inputs.seed).toBe(4242);
    expect(result.workflow["38"].inputs.pixels).toEqual(["17", 0]);
    expect(result.workflow["38"].inputs.mask).toEqual(["17", 1]);
    expect(result.workflow["39"].class_type).toBe("DifferentialDiffusion");
    expect(result.workflow["46"].class_type).toBe("ConditioningZeroOut");
    expect(result.workflow["9"].inputs.images).toEqual(["8", 0]);
  });

  it("can inject the accepted Flux Fill T5 fallback when fp16 is unavailable", async () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");
    const t5Requirement = preset.requiredModels?.find((model) => model.modelName === "t5xxl_fp16.safetensors");

    expect(t5Requirement).toBeDefined();

    const result = await buildInpaintWorkflow({
      presetId: "inpaint-flux-fill-basic",
      prompt: "repair the selected area",
      negativePrompt: "",
      checkpointName: "flux1-fill-dev.safetensors",
      sourceImageName: "openlayer-flux-source-mask.png",
      maskImageName: "openlayer-flux-source-mask.png",
      steps: 12,
      cfg: 3.5,
      denoise: 0.7,
      seed: 5150,
      width: 512,
      height: 512,
      requiredModelSelections: {
        [createRequiredModelSelectionKey(t5Requirement!)]: "t5xxl_fp8_e4m3fn.safetensors"
      }
    });

    expect(result.workflow["34"].inputs.clip_name1).toBe("clip_l.safetensors");
    expect(result.workflow["34"].inputs.clip_name2).toBe("t5xxl_fp8_e4m3fn.safetensors");
  });

  it("injects Z_image_Turbo text-to-image settings into the diffusion stack workflow", async () => {
    const result = await buildTxt2ImgWorkflow({
      presetId: "txt2img-z-image-turbo",
      prompt: "surreal blue forest",
      negativePrompt: "muddy colors",
      checkpointName: "z_image_turbo_bf16.safetensors",
      width: 896,
      height: 1024,
      steps: 6,
      cfg: 1.5,
      seed: 77
    });

    expect(result.preset.id).toBe("txt2img-z-image-turbo");
    expect(result.workflow["20"].inputs.unet_name).toBe("z_image_turbo_bf16.safetensors");
    expect(result.workflow["6"].inputs.text).toBe("surreal blue forest");
    expect(result.workflow["7"].inputs.text).toBe("muddy colors");
    expect(result.workflow["5"].inputs.width).toBe(896);
    expect(result.workflow["5"].inputs.height).toBe(1024);
    expect(result.workflow["3"].inputs.steps).toBe(6);
    expect(result.workflow["3"].inputs.cfg).toBe(1.5);
    expect(result.workflow["3"].inputs.seed).toBe(77);
  });

  it("injects Z_image_Turbo image-to-image source and denoise", async () => {
    const result = await buildImg2ImgWorkflow({
      presetId: "img2img-z-image-turbo",
      prompt: "painterly reinterpretation",
      negativePrompt: "flat",
      checkpointName: "z_image_turbo_bf16.safetensors",
      sourceImageName: "openlayer-z-source.png",
      steps: 5,
      cfg: 1,
      denoise: 0.6,
      seed: 88
    });

    expect(result.preset.id).toBe("img2img-z-image-turbo");
    expect(result.workflow["20"].inputs.unet_name).toBe("z_image_turbo_bf16.safetensors");
    expect(result.workflow["10"].inputs.image).toBe("openlayer-z-source.png");
    expect(result.workflow["3"].inputs.latent_image).toEqual(["11", 0]);
    expect(result.workflow["3"].inputs.denoise).toBe(0.6);
  });
});
