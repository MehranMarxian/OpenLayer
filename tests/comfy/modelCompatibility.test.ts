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

  it("warns when a Flux-style model is used with img2img-basic", () => {
    const preset = getWorkflowPreset("img2img-basic");
    const compatibility = getCheckpointCompatibility("flux1-dev-fp8.safetensors", preset);

    expect(compatibility.isExperimental).toBe(true);
    expect(compatibility.warning).toContain("Flux usually needs dedicated");
  });
});
