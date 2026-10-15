import { describe, expect, it } from "vitest";
import { getWorkflowPreset, listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import { evaluateSetupRequirements } from "../../src/comfy/setupRequirements";
import { ComfyModelInventory } from "../../src/comfy/types";
import { DEFAULT_IMAGE_WORKFLOW, DEFAULT_WORKFLOW } from "../../src/ui/appConstants";
import { pickStarterDefault, StarterDefaultTool } from "../../src/ui/starterDefaults";

const INSTALLED: Partial<ComfyModelInventory> = {
  diffusionModels: ["flux-2-klein-4b-fp8.safetensors"],
  clipModels: ["qwen_3_4b.safetensors"],
  vaeModels: ["flux2-vae.safetensors"]
};

function pick(
  tool: StarterDefaultTool,
  overrides: { inventory?: Partial<ComfyModelInventory> | null; current?: string; chosen?: boolean } = {}
) {
  const oldDefault = tool === "Text to Image" ? DEFAULT_WORKFLOW : DEFAULT_IMAGE_WORKFLOW;
  const inventory = overrides.inventory === undefined ? INSTALLED : overrides.inventory;

  return pickStarterDefault({
    report: inventory
      ? evaluateSetupRequirements({ pluginVersion: "9.9.9", inventory })
      : evaluateSetupRequirements({ pluginVersion: "9.9.9" }),
    tool,
    current: overrides.current ?? oldDefault,
    oldDefault,
    chosen: overrides.chosen ?? false
  });
}

describe("pickStarterDefault", () => {
  it("opens Text to Image and Image to Image on Klein once the starter is installed", () => {
    expect(pick("Text to Image")).toBe("txt2img-flux2-klein");
    expect(pick("Image to Image")).toBe("img2img-flux2-klein");
  });

  it("picks presets that each tool's Workflow dropdown actually lists", () => {
    // The dropdowns are filled from the runnable presets of each kind; a Klein
    // id missing from them would make the switch a silent no-op.
    const runnable = new Set(listRunnableWorkflowPresets().map((preset) => preset.id));

    expect(runnable.has(pick("Text to Image") ?? "")).toBe(true);
    expect(runnable.has(pick("Image to Image") ?? "")).toBe(true);
    expect(getWorkflowPreset("txt2img-flux2-klein").kind).toBe(getWorkflowPreset(DEFAULT_WORKFLOW).kind);
    expect(getWorkflowPreset("img2img-flux2-klein").kind).toBe(getWorkflowPreset(DEFAULT_IMAGE_WORKFLOW).kind);
  });

  it("never replaces a workflow the artist picked, even the old default", () => {
    expect(pick("Text to Image", { chosen: true })).toBeNull();
    expect(pick("Image to Image", { chosen: true })).toBeNull();
  });

  it("only moves off the old default, so a stored choice of anything else stays", () => {
    // A saved workflow from before the chosen flag existed: anything but the
    // default was picked by hand.
    expect(pick("Text to Image", { current: "txt2img-z-image-turbo" })).toBeNull();
  });

  it("keeps the old default until every starter file is installed", () => {
    expect(pick("Text to Image", { inventory: { diffusionModels: INSTALLED.diffusionModels, clipModels: INSTALLED.clipModels } })).toBeNull();
    expect(pick("Text to Image", { inventory: {} })).toBeNull();
  });

  it("keeps the old default when ComfyUI was not checked", () => {
    expect(pick("Text to Image", { inventory: null })).toBeNull();
  });

  it("keeps the old default when a starter file is in the wrong folder", () => {
    expect(
      pick("Text to Image", { inventory: { ...INSTALLED, diffusionModels: [], checkpoints: INSTALLED.diffusionModels } })
    ).toBeNull();
  });
});
