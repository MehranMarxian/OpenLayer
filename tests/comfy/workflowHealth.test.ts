import { describe, expect, it } from "vitest";
import { getWorkflowPreset, listWorkflowPresets } from "../../src/comfy/presetRegistry";
import {
  createWorkflowHealthItem,
  createWorkflowHealthReport
} from "../../src/comfy/workflowHealth";
import { ComfyModelInventory, WorkflowPresetDefinition } from "../../src/comfy/types";
import { WorkflowNodeAvailability } from "../../src/comfy/workflowCompatibility";

describe("workflow health", () => {
  it("marks stable SD checkpoint workflows as ready when required nodes are present", () => {
    const preset = getWorkflowPreset("txt2img-basic");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createInventory({
        checkpoints: ["epicrealism_naturalSinRC1VAE.safetensors"]
      })
    });

    expect(item.state).toBe("ready");
    expect(item.stateLabel).toBe("Ready");
    expect(item.canRun).toBe(true);
  });

  it("marks runnable experimental Z_image_Turbo presets as experimental when the full stack is available", () => {
    const preset = getWorkflowPreset("txt2img-z-image-turbo");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createZImageInventory()
    });

    expect(item.state).toBe("experimental");
    expect(item.stateLabel).toBe("Experimental");
    expect(item.canRun).toBe(true);
  });

  it("reports missing diffusion-model-stack files for Z_image_Turbo presets", () => {
    const preset = getWorkflowPreset("img2img-z-image-turbo");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createInventory({
        diffusionModels: ["z_image_turbo_bf16.safetensors"],
        vaeModels: ["ae.safetensors"]
      })
    });

    expect(item.state).toBe("missing-model");
    expect(item.summary).toContain("qwen_3_4b.safetensors");
  });

  it("reports missing ComfyUI node classes", () => {
    const preset = getWorkflowPreset("sketch2img-linecn-basic");
    const availableNodes = createAvailableNodes(preset);
    delete availableNodes.LineArtPreprocessor;

    const item = createWorkflowHealthItem(preset, {
      availableNodes,
      availableModels: createInventory({
        controlNetModels: ["control_v11p_sd15_lineart_fp16.safetensors"]
      })
    });

    expect(item.state).toBe("missing-node");
    expect(item.summary).toContain("LineArtPreprocessor");
  });

  it("reports future Flux presets as missing workflow JSON before model or node details", () => {
    const preset = getWorkflowPreset("txt2img-flux1-dev");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createInventory()
    });

    expect(item.state).toBe("missing-workflow");
    expect(item.stateLabel).toBe("Missing workflow JSON");
    expect(item.canRun).toBe(false);
  });

  it("creates a compact report for every registered preset", () => {
    const presets = listWorkflowPresets();
    const availableNodes = Object.assign({}, ...presets.map(createAvailableNodes));
    const report = createWorkflowHealthReport(presets, {
      availableNodes,
      availableModels: createInventory({
        checkpoints: ["epicrealism_naturalSinRC1VAE.safetensors"],
        controlNetModels: ["control_v11p_sd15_lineart_fp16.safetensors"],
        diffusionModels: ["z_image_turbo_bf16.safetensors"],
        clipModels: ["qwen_3_4b.safetensors"],
        vaeModels: ["ae.safetensors"]
      })
    });

    expect(report.items).toHaveLength(presets.length);
    expect(report.summary).toContain("workflow presets");
    expect(report.summary).toContain("need workflow JSON");
    expect(report.stateCounts["missing-workflow"]).toBeGreaterThan(0);
    expect(report.items.some((item) => item.state === "missing-workflow")).toBe(true);
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
    missingSources: [],
    ...overrides
  };
}

function createZImageInventory() {
  return createInventory({
    diffusionModels: ["z_image_turbo_bf16.safetensors"],
    clipModels: ["qwen_3_4b.safetensors"],
    vaeModels: ["ae.safetensors"]
  });
}
