import { describe, expect, it } from "vitest";
import { evaluateSetupRequirements } from "../../src/comfy/setupRequirements";
import { rankPresetsByVramOutlook } from "../../src/comfy/presetFootprint";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";

const PLUGIN_VERSION = "0.20.0";
const TWELVE_GB = 12 * 1024 ** 3;

function unflattenModels() {
  const report = evaluateSetupRequirements({ pluginVersion: PLUGIN_VERSION });

  return report.models.filter((model) => model.usedByPresets.includes("unflatten-qwen-layered"));
}

describe("Unflatten setup requirements", () => {
  it("lists all three models in the folders their loaders actually read", () => {
    const byName = new Map(unflattenModels().map((model) => [model.modelName, model]));

    expect(byName.size).toBe(3);
    // The wrong-folder mistake is this project's most common setup failure and
    // it fails silently, as "model not found".
    expect(byName.get("qwen_image_layered_fp8mixed.safetensors")?.targetFolder).toBe("diffusion_models");
    expect(byName.get("qwen_2.5_vl_7b_fp8_scaled.safetensors")?.targetFolder).toBe("text_encoders");
    expect(byName.get("qwen_image_layered_vae.safetensors")?.targetFolder).toBe("vae");
  });

  it("carries real sizes, so the download total is not a guess", () => {
    const byName = new Map(unflattenModels().map((model) => [model.modelName, model.sizeBytes]));

    // Content-Length observed against the live URLs; a missing size would let
    // the preset be rated "Comfortable" on a technicality.
    expect(byName.get("qwen_image_layered_fp8mixed.safetensors")).toBe(20533591821);
    expect(byName.get("qwen_2.5_vl_7b_fp8_scaled.safetensors")).toBe(9384670680);
    expect(byName.get("qwen_image_layered_vae.safetensors")).toBe(253816616);
  });

  it("warns about the layered VAE in the entry itself", () => {
    const vae = unflattenModels().find((model) => model.modelName === "qwen_image_layered_vae.safetensors");

    // qwen_image_vae.safetensors is Krea-2's and sits in the same folder. The
    // names differ by one word and the wrong one loads far enough to fail
    // confusingly rather than obviously, so the hint has to say so where
    // someone is actually reading it.
    expect(vae?.setupHint).toContain("not qwen_image_vae.safetensors");
  });

  it("does not send anyone to the layered repo for the text encoder", () => {
    const encoder = unflattenModels().find((model) => model.modelName === "qwen_2.5_vl_7b_fp8_scaled.safetensors");

    // The layered repository has no text_encoders folder at all, which is what
    // sends people looking in the wrong place.
    expect(encoder?.downloadUrl).toContain("Qwen-Image_ComfyUI");
    expect(encoder?.downloadUrl).not.toContain("Qwen-Image-Layered");
  });

  it("rates the preset honestly against 12 GB rather than optimistically", () => {
    const outlook = rankPresetsByVramOutlook({
      pluginVersion: PLUGIN_VERSION,
      vramTotalBytes: TWELVE_GB
    }).find((entry) => entry.presetId === "unflatten-qwen-layered");

    // 19.1 GB resident against 12 GB of VRAM. "Will offload" is the honest
    // answer and it means slower, not broken -- which is what the note says.
    expect(outlook?.expectation).toBe("offloads");
    expect(outlook?.expectationLabel).toBe("Will offload");
    expect(outlook?.confidence).toBe("complete");
    expect(outlook?.unknownSizeCount).toBe(0);
  });

  it("shares no file with any other preset, which is what makes it a 28.1 GB addition", () => {
    const outlook = rankPresetsByVramOutlook({
      pluginVersion: PLUGIN_VERSION,
      vramTotalBytes: TWELVE_GB
    }).find((entry) => entry.presetId === "unflatten-qwen-layered");

    // Not the largest preset TOTAL -- the Flux Fill stack is heavier at 38.4 GB
    // -- but the largest addition, because every byte of that stack is already
    // shared with other presets and none of these three are. Someone who has
    // everything else installed still downloads all 28.1 GB for this one.
    expect(outlook?.formattedTotal).toBe("28.1 GB");

    for (const model of unflattenModels()) {
      expect(model.usedByPresets).toEqual(["unflatten-qwen-layered"]);
    }
  });

  it("keeps the preset's own models and its registry stack in step", () => {
    const preset = getWorkflowPreset("unflatten-qwen-layered");

    expect(preset.requiredModels?.map((model) => model.modelName).sort()).toEqual(
      preset.modelStack?.map((model) => model.modelName).sort()
    );
  });
});
