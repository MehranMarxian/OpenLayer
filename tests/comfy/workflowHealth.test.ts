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

  it("marks Flux1-dev fp8 text-to-image as experimental when the checkpoint workflow is available", () => {
    const preset = getWorkflowPreset("txt2img-flux1-dev-fp8");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createInventory({
        checkpoints: ["flux1-dev-fp8.safetensors"]
      })
    });

    expect(item.state).toBe("experimental");
    expect(item.canRun).toBe(true);
    expect(item.detail).toContain("flux1-dev-fp8.safetensors");
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

  it("marks Flux Fill as experimental when its full model stack is available", () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory()
    });

    expect(item.state).toBe("experimental");
    expect(item.canRun).toBe(true);
    expect(item.detail).toContain("t5xxl_fp16.safetensors");
  });

  it("marks Flux Fill as experimental with the accepted fp8 T5 fallback", () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory({
        clipModels: ["t5xxl_fp8_e4m3fn.safetensors", "clip_l.safetensors"]
      })
    });

    expect(item.state).toBe("experimental");
    expect(item.canRun).toBe(true);
    expect(item.detail).toContain("t5xxl_fp8_e4m3fn.safetensors");
  });

  it("reports missing Flux Fill T5 alternatives as model setup", () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory({
        clipModels: ["clip_l.safetensors"]
      })
    });

    expect(item.state).toBe("missing-model");
    expect(item.summary).toContain("t5xxl_fp16.safetensors");
    expect(item.summary).toContain("t5xxl_fp8_e4m3fn.safetensors");
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
        checkpoints: ["epicrealism_naturalSinRC1VAE.safetensors", "flux1-dev-fp8.safetensors"],
        controlNetModels: ["control_v11p_sd15_lineart_fp16.safetensors"],
        diffusionModels: ["z_image_turbo_bf16.safetensors"],
        clipModels: ["qwen_3_4b.safetensors"],
        vaeModels: ["ae.safetensors"],
        visionLanguageModels: ["Florence-2-base-PromptGen-v2.0"]
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
    visionLanguageModels: [],
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

function createFluxFillInventory(overrides: Partial<ComfyModelInventory> = {}) {
  return createInventory({
    diffusionModels: ["flux1-fill-dev.safetensors"],
    clipModels: ["t5xxl_fp16.safetensors", "clip_l.safetensors"],
    vaeModels: ["ae.safetensors"],
    ...overrides
  });
}
