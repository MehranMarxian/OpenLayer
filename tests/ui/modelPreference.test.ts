import { describe, expect, it } from "vitest";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";
import { keepsPreferredModel, listUpscaleModelOptions } from "../../src/ui/modelPreference";

const unetList = [
  "flux-2-klein-4b-fp8.safetensors",
  "qwen_image_2.1_int8_convrot.safetensors",
  "my-own-finetune.safetensors"
];

describe("keepsPreferredModel", () => {
  it("drops another preset's pinned model when the preset changes (the Edit Image bug)", () => {
    const qwen = getWorkflowPreset("edit-qwen-image-21");

    expect(keepsPreferredModel("flux-2-klein-4b-fp8.safetensors", unetList, qwen)).toBe(false);
  });

  it("keeps the preset's own model, and a custom file no preset pins", () => {
    const qwen = getWorkflowPreset("edit-qwen-image-21");

    expect(keepsPreferredModel("qwen_image_2.1_int8_convrot.safetensors", unetList, qwen)).toBe(true);
    expect(keepsPreferredModel("my-own-finetune.safetensors", unetList, qwen)).toBe(true);
  });

  it("never keeps a model that is not installed", () => {
    expect(keepsPreferredModel("gone.safetensors", unetList, getWorkflowPreset("edit-flux2-klein"))).toBe(false);
    expect(keepsPreferredModel("", unetList, getWorkflowPreset("edit-flux2-klein"))).toBe(false);
  });
});

describe("listUpscaleModelOptions", () => {
  // The UNETLoader list from Mehran's ComfyUI when the SeedVR2 picker showed
  // every diffusion model (trimmed; the real one is 29 files).
  const sharedUnetList = [
    "flux-2-klein-4b-fp8.safetensors",
    "qwen_3_4b.safetensors",
    "qwen_image_vae.safetensors",
    "sd3.5_large.safetensors",
    "seedvr2_3b_int8_convrot.safetensors"
  ];
  const seedvr2 = getWorkflowPreset("upscale-seedvr2-3b");

  it("offers SeedVR2 only its own file, not every diffusion model", () => {
    expect(listUpscaleModelOptions(sharedUnetList, seedvr2)).toEqual(["seedvr2_3b_int8_convrot.safetensors"]);
  });

  it("names the file SeedVR2 needs when it is not installed, instead of unrelated models", () => {
    expect(listUpscaleModelOptions(sharedUnetList.slice(0, 4), seedvr2)).toEqual(["seedvr2_3b_int8_convrot.safetensors"]);
    expect(listUpscaleModelOptions([], seedvr2)).toEqual(["seedvr2_3b_int8_convrot.safetensors"]);
  });

  it("leaves upscale-basic's list alone: its folder holds only upscale models", () => {
    const upscaleModels = ["4x-UltraSharp.pth", "RealESRGAN_x4plus.pth", "4x_NMKD-Siax_200k.pth"];

    expect(listUpscaleModelOptions(upscaleModels, getWorkflowPreset("upscale-basic"))).toEqual(upscaleModels);
  });

  it("never lists the SeedVR2 VAE, which sits in a different loader", () => {
    expect(listUpscaleModelOptions([...sharedUnetList, "seedvr2_ema_vae_fp16.safetensors"], seedvr2)).not.toContain(
      "seedvr2_ema_vae_fp16.safetensors"
    );
  });
});
