import { describe, expect, it } from "vitest";
import {
  buildKrea2RefineWorkflow,
  buildLcmLiveWorkflow,
  clampLiveDenoise,
  clampRefineDenoise,
  findKrea2RefineGap,
  findLcmLoraName,
  LIVE_PAINTING_CFG,
  LIVE_PAINTING_SAVE_NODE_ID,
  LIVE_PAINTING_STEPS,
  LIVE_REFINE_SAVE_NODE_ID
} from "../../src/comfy/livePainting";

describe("livePainting", () => {
  it("finds the SD 1.5 LCM LoRA from Windows-style lora paths", () => {
    expect(
      findLcmLoraName([
        "add_detail.safetensors",
        "lcm\\SD1.5\\pytorch_lora_weights.safetensors",
        "flux_realism_lora.safetensors"
      ])
    ).toBe("lcm\\SD1.5\\pytorch_lora_weights.safetensors");
  });

  it("prefers the SD 1.5 LCM variant over other LCM LoRAs", () => {
    expect(
      findLcmLoraName([
        "lcm\\SDXL\\lcm-lora-sdxl.safetensors",
        "lcm-lora-sdv1-5.safetensors"
      ])
    ).toBe("lcm-lora-sdv1-5.safetensors");
  });

  it("falls back to any LCM LoRA and returns null when none exist", () => {
    expect(findLcmLoraName(["lcm-lora-sdxl.safetensors"])).toBe("lcm-lora-sdxl.safetensors");
    expect(findLcmLoraName(["add_detail.safetensors"])).toBeNull();
    expect(findLcmLoraName([])).toBeNull();
  });

  it("builds the LCM live workflow with the turbo sampler and injected inputs", () => {
    const workflow = buildLcmLiveWorkflow({
      checkpointName: "epicrealism_naturalSinRC1VAE.safetensors",
      loraName: "lcm\\SD1.5\\pytorch_lora_weights.safetensors",
      prompt: "a cozy cottage at golden hour",
      sourceImageName: "openlayer-live-1.png",
      seed: 4242,
      denoise: 0.6
    });

    expect(workflow["4"].inputs.ckpt_name).toBe("epicrealism_naturalSinRC1VAE.safetensors");
    expect(workflow["15"].class_type).toBe("LoraLoader");
    expect(workflow["15"].inputs.lora_name).toBe("lcm\\SD1.5\\pytorch_lora_weights.safetensors");
    expect(workflow["15"].inputs.model).toEqual(["4", 0]);
    expect(workflow["6"].inputs.text).toBe("a cozy cottage at golden hour");
    expect(workflow["6"].inputs.clip).toEqual(["15", 1]);
    expect(workflow["10"].inputs.image).toBe("openlayer-live-1.png");
    expect(workflow["3"].inputs.model).toEqual(["15", 0]);
    expect(workflow["3"].inputs.latent_image).toEqual(["11", 0]);
    expect(workflow["3"].inputs.sampler_name).toBe("lcm");
    expect(workflow["3"].inputs.scheduler).toBe("sgm_uniform");
    expect(workflow["3"].inputs.steps).toBe(LIVE_PAINTING_STEPS);
    expect(workflow["3"].inputs.cfg).toBe(LIVE_PAINTING_CFG);
    expect(workflow["3"].inputs.seed).toBe(4242);
    expect(workflow["3"].inputs.denoise).toBe(0.6);
    expect(workflow[LIVE_PAINTING_SAVE_NODE_ID].class_type).toBe("SaveImage");
    expect(workflow[LIVE_PAINTING_SAVE_NODE_ID].inputs.images).toEqual(["8", 0]);
  });

  it("clamps live denoise into a usable range", () => {
    expect(clampLiveDenoise(0.6)).toBe(0.6);
    expect(clampLiveDenoise(0.05)).toBe(0.2);
    expect(clampLiveDenoise(1.4)).toBe(0.95);
    expect(clampLiveDenoise(Number.NaN)).toBe(0.6);
  });

  it("builds the Krea2 refine graph with the expected image pipeline wiring", () => {
    const workflow = buildKrea2RefineWorkflow({
      prompt: "a luminous forest city",
      sourceImageName: "openlayer-refine-source.png",
      seed: 9876,
      denoise: 0.45
    });

    expect(workflow["11"].inputs.pixels).toEqual(["10", 0]);
    expect(workflow["11"].inputs.vae).toEqual(["22", 0]);
    expect(workflow["3"].inputs.latent_image).toEqual(["11", 0]);
    expect(workflow["8"].inputs.samples).toEqual(["3", 0]);
    expect(workflow[LIVE_REFINE_SAVE_NODE_ID].inputs.images).toEqual(["8", 0]);
  });

  it("injects Krea2 refine prompt, seed, denoise, and source image inputs", () => {
    const workflow = buildKrea2RefineWorkflow({
      prompt: "a luminous forest city",
      sourceImageName: "openlayer-refine-source.png",
      seed: 9876,
      denoise: 0.45
    });

    expect(workflow["10"].inputs.image).toBe("openlayer-refine-source.png");
    expect(workflow["6"].inputs.text).toBe("a luminous forest city");
    expect(workflow["7"].inputs.text).toBe("");
    expect(workflow["3"].inputs.seed).toBe(9876);
    expect(workflow["3"].inputs.denoise).toBe(0.45);
    expect(workflow[LIVE_REFINE_SAVE_NODE_ID].inputs.filename_prefix).toBe("OpenLayer_LiveRefine");
  });

  it("clamps Krea2 refine denoise into the supported range", () => {
    expect(clampRefineDenoise(0.45)).toBe(0.45);
    expect(clampRefineDenoise(0.05)).toBe(0.2);
    expect(clampRefineDenoise(1.4)).toBe(0.9);
    expect(clampRefineDenoise(Number.NaN)).toBe(0.45);

    expect(
      buildKrea2RefineWorkflow({
        prompt: "test",
        sourceImageName: "source.png",
        seed: 1,
        denoise: 2
      })["3"].inputs.denoise
    ).toBe(0.9);
  });

  it("accepts a complete Krea2 refine model inventory", () => {
    expect(
      findKrea2RefineGap({
        diffusionModels: ["krea2_turbo_fp8_scaled.safetensors"],
        clipModels: ["qwen3vl_4b_fp8_scaled.safetensors"],
        vaeModels: ["qwen_image_vae.safetensors"]
      })
    ).toBeNull();
  });

  it("names a missing Krea2 refine model", () => {
    const gap = findKrea2RefineGap({
      diffusionModels: ["krea2_turbo_fp8_scaled.safetensors"],
      clipModels: [],
      vaeModels: ["qwen_image_vae.safetensors"]
    });

    expect(gap).toContain("qwen3vl_4b_fp8_scaled.safetensors");
  });
});
