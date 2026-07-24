import { describe, expect, it } from "vitest";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";
import {
  createWorkflowDiagnosticMessage,
  createWorkflowReadinessSummary
} from "../../src/comfy/workflowDiagnostics";
import { ComfyModelInventory, WorkflowPresetDefinition } from "../../src/comfy/types";
import { WorkflowNodeAvailability } from "../../src/comfy/workflowCompatibility";

describe("workflow diagnostics", () => {
  it("creates artist-facing ready messages for stable checkpoint workflows", () => {
    const preset = getWorkflowPreset("txt2img-basic");
    const message = createWorkflowDiagnosticMessage(preset, {
      selectedModelName: "sd_xl_base_1.0.safetensors",
      availableNodes: createAvailableNodes(preset)
    });

    expect(message.isWarning).toBe(false);
    expect(message.summary).toContain("Text to Image is ready");
    expect(message.detail).toContain("Checkpoint: sd_xl_base_1.0.safetensors");
  });

  it("warns when a selected model family likely needs a dedicated workflow", () => {
    const preset = getWorkflowPreset("sketch2img-linecn-basic");
    const message = createWorkflowDiagnosticMessage(preset, {
      selectedModelName: "flux1-dev-fp8.safetensors",
      availableNodes: createAvailableNodes(preset),
      photoshopInputs: { canvas: true }
    });

    expect(message.isWarning).toBe(true);
    expect(message.summary).toContain("Sketch to Image is experimental");
    expect(message.detail).toContain("Flux may need a dedicated workflow");
  });

  it("explains missing ComfyUI setup as setup-required", () => {
    const preset = getWorkflowPreset("sketch2img-linecn-basic");
    const availableNodes = createAvailableNodes(preset);
    delete availableNodes.LineArtPreprocessor;

    const message = createWorkflowDiagnosticMessage(preset, {
      selectedModelName: "epicrealism_naturalSinRC1VAE.safetensors",
      availableNodes,
      photoshopInputs: { canvas: true }
    });

    expect(message.isWarning).toBe(true);
    expect(message.summary).toContain("needs setup");
    expect(message.detail).toContain("LineArtPreprocessor");
  });

  it("explains missing required model files", () => {
    const preset = getWorkflowPreset("sketch2img-linecn-basic");
    const message = createWorkflowDiagnosticMessage(preset, {
      selectedModelName: "epicrealism_naturalSinRC1VAE.safetensors",
      availableNodes: createAvailableNodes(preset),
      availableModels: createInventory(),
      photoshopInputs: { canvas: true }
    });

    expect(message.isWarning).toBe(true);
    expect(message.summary).toContain("needs setup");
    expect(message.detail).toContain("Missing LineArt ControlNet");
  });

  it("explains missing Photoshop inputs for source and mask workflows", () => {
    const imgMessage = createWorkflowDiagnosticMessage(getWorkflowPreset("img2img-basic"), {
      selectedModelName: "epicrealism_naturalSinRC1VAE.safetensors",
      photoshopInputs: { "active-layer": false, canvas: false }
    });
    const inpaintMessage = createWorkflowDiagnosticMessage(getWorkflowPreset("inpaint-basic"), {
      selectedModelName: "epicrealism_pureEvolutionV5-inpainting.safetensors",
      photoshopInputs: { selection: true, "selection-mask": false }
    });

    expect(imgMessage.detail).toContain("active layer or captured canvas");
    expect(inpaintMessage.detail).toContain("selection mask");
  });

  it("summarizes warning messages for Settings diagnostics", () => {
    const sketchPreset = getWorkflowPreset("sketch2img-linecn-basic");
    const summary = createWorkflowReadinessSummary([
      createWorkflowDiagnosticMessage(sketchPreset, {
        selectedModelName: "flux1-dev-fp8.safetensors",
        availableNodes: createAvailableNodes(sketchPreset),
        photoshopInputs: { canvas: true }
      })
    ]);

    expect(summary).toContain("Sketch to Image is experimental");
    expect(summary).toContain("Flux may need a dedicated workflow");
  });
});

function createAvailableNodes(preset: WorkflowPresetDefinition): WorkflowNodeAvailability {
  return Object.fromEntries(
    preset.requiredNodes.map((requirement) => [requirement.classType, requirement.requiredInputs])
  );
}

function createInventory(overrides: Partial<ComfyModelInventory> = {}): ComfyModelInventory {
  return {
    checkpoints: [],
    diffusionModels: [],
    clipModels: [],
    vaeModels: [],
    controlNetModels: [],
    visionLanguageModels: [],
    missingSources: [],
    ...overrides
  };
}
