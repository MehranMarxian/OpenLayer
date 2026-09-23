import { describe, expect, it } from "vitest";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";
import { keepsPreferredModel } from "../../src/ui/modelPreference";

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
