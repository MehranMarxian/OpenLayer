import { describe, expect, it } from "vitest";
import {
  buildLcmLiveWorkflow,
  clampLiveDenoise,
  findLcmLoraName,
  LIVE_PAINTING_CFG,
  LIVE_PAINTING_SAVE_NODE_ID,
  LIVE_PAINTING_STEPS
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
});
