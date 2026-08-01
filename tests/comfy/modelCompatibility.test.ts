import { describe, expect, it } from "vitest";
import { detectCheckpointFamily, getCheckpointCompatibility } from "../../src/comfy/modelCompatibility";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";

describe("model compatibility", () => {
  it("detects common model families from filenames", () => {
    expect(detectCheckpointFamily("epicrealism_naturalSinRC1VAE.safetensors")).toBe("sd1");
    expect(detectCheckpointFamily("sd_xl_base_1.0.safetensors")).toBe("sdxl");
    expect(detectCheckpointFamily("sd3.5_large.safetensors")).toBe("sd3");
    expect(detectCheckpointFamily("flux1-dev-fp8.safetensors")).toBe("flux");
    expect(detectCheckpointFamily("z_image_turbo_bf16.safetensors")).toBe("zImage");
  });

  it("keeps Flux.2 apart from Flux.1, whatever the filename spells it", () => {
    // Every one of these contains "flux", so the plain Flux test would claim
    // all of them without the more specific check running first. The families
    // are not interchangeable: Flux.1 runs on a plain KSampler and Flux.2 needs
    // the advanced sampler chain and a 128-channel latent, so a mis-detection
    // tells an artist a preset is compatible when its graph cannot run at all.
    expect(detectCheckpointFamily("flux2-dev-Q4_K_M.gguf")).toBe("flux2");
    expect(detectCheckpointFamily("flux2_dev_fp8mixed.safetensors")).toBe("flux2");
    expect(detectCheckpointFamily("FLUX.2-dev.safetensors")).toBe("flux2");
    expect(detectCheckpointFamily("flux-2-klein-4b-fp8.safetensors")).toBe("flux2");

    // And the Flux.1 names must not drift into the new family.
    expect(detectCheckpointFamily("flux1-dev.safetensors")).toBe("flux");
    expect(detectCheckpointFamily("flux1-fill-dev.safetensors")).toBe("flux");
  });

  it("warns when a Flux-style model is used with img2img-basic", () => {
    const preset = getWorkflowPreset("img2img-basic");
    const compatibility = getCheckpointCompatibility("flux1-dev-fp8.safetensors", preset);

    expect(compatibility.isExperimental).toBe(true);
    expect(compatibility.warning).toContain("Flux usually needs dedicated");
  });
});
