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

  it("marks runnable Z_image_Turbo presets as ready when the full stack is available", () => {
    const preset = getWorkflowPreset("txt2img-z-image-turbo");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createZImageInventory()
    });

    expect(item.state).toBe("ready");
    expect(item.stateLabel).toBe("Ready");
    expect(item.canRun).toBe(true);
  });

  it("marks Flux1-dev fp8 text-to-image as ready when the checkpoint workflow is available", () => {
    const preset = getWorkflowPreset("txt2img-flux1-dev-fp8");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createInventory({
        checkpoints: ["flux1-dev-fp8.safetensors"]
      })
    });

    expect(item.state).toBe("ready");
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

  it("marks Flux Fill as ready when its full model stack is available", () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory()
    });

    expect(item.state).toBe("ready");
    expect(item.canRun).toBe(true);
    expect(item.detail).toContain("t5xxl_fp16.safetensors");
  });

  it("marks Flux Fill as ready with the accepted fp8 T5 fallback", () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory({
        clipModels: ["t5xxl_fp8_e4m3fn.safetensors", "clip_l.safetensors"]
      })
    });

    expect(item.state).toBe("ready");
    expect(item.canRun).toBe(true);
    expect(item.detail).toContain("t5xxl_fp8_e4m3fn.safetensors");
  });

  it("marks Flux Fill outpaint as ready when its full model stack is available", () => {
    const preset = getWorkflowPreset("outpaint-flux-fill-basic");
    const item = createWorkflowHealthItem(preset, {
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory()
    });

    expect(item.state).toBe("ready");
    expect(item.canRun).toBe(true);
    expect(item.detail).toContain("flux1-fill-dev.safetensors");
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
    delete availableNodes.LineartStandardPreprocessor;

    const item = createWorkflowHealthItem(preset, {
      availableNodes,
      availableModels: createInventory({
        controlNetModels: ["control_v11p_sd15_lineart_fp16.safetensors"]
      })
    });

    expect(item.state).toBe("missing-node");
    expect(item.summary).toContain("LineartStandardPreprocessor");
  });

  it("keeps enriched setup issues routed to missing-model and missing-node states", () => {
    const modelPreset = getWorkflowPreset("inpaint-flux-fill-basic");
    const modelItem = createWorkflowHealthItem(modelPreset, {
      availableNodes: createAvailableNodes(modelPreset),
      availableModels: createFluxFillInventory({
        checkpoints: ["ae.safetensors"],
        vaeModels: []
      })
    });
    const nodePreset = getWorkflowPreset("prompt-from-layer-florence2");
    const availableNodes = createAvailableNodes(nodePreset);
    delete availableNodes.Florence2ModelLoader;
    const nodeItem = createWorkflowHealthItem(nodePreset, {
      availableNodes,
      availableModels: createInventory({
        visionLanguageModels: ["Florence-2-base-PromptGen-v2.0"]
      })
    });

    expect(modelItem.state).toBe("missing-model");
    expect(nodeItem.state).toBe("missing-node");
  });

  it("reports an unauthored preset as missing workflow JSON before model or node details", () => {
    const preset = createUnauthoredPreset();
    const item = createWorkflowHealthItem(preset, {
      availableNodes: {},
      availableModels: createInventory()
    });

    // Nothing is available here: no nodes and no models. The point of the state
    // is that it wins anyway, because "the workflow does not exist yet" is a
    // more useful answer than a list of things to download for it.
    expect(item.state).toBe("missing-workflow");
    expect(item.stateLabel).toBe("Needs workflow JSON");
    expect(item.canRun).toBe(false);
  });

  it("counts an unauthored preset in the report summary", () => {
    const presets = [getWorkflowPreset("txt2img-basic"), createUnauthoredPreset()];
    const report = createWorkflowHealthReport(presets, {
      availableNodes: Object.assign({}, ...presets.map(createAvailableNodes)),
      availableModels: createInventory({
        checkpoints: ["epicrealism_naturalSinRC1VAE.safetensors"]
      })
    });

    expect(report.summary).toContain("need workflow JSON");
    expect(report.stateCounts["missing-workflow"]).toBe(1);
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
    // Every shipped preset now has an authored workflow. The missing-workflow
    // state is exercised on a fixture above rather than on whatever the registry
    // happens to contain, which is what tied these tests to two preset ids.
    expect(report.stateCounts["missing-workflow"]).toBe(0);
  });
});

/**
 * A preset whose workflow JSON has not been authored. The registry shipped two
 * of these (`txt2img-flux1-dev`, `img2img-flux1-dev`) until they were removed
 * for being unrunnable on the hardware this project targets; the `todo` status
 * itself is still supported, so it is covered here by construction.
 */
function createUnauthoredPreset(): WorkflowPresetDefinition {
  return {
    ...getWorkflowPreset("txt2img-basic"),
    id: "txt2img-basic",
    displayName: "Unauthored preset",
    status: "todo",
    workflowFile: "workflows/api/not-authored-yet.json",
    disabledReason: "No validated OpenLayer API workflow JSON exists yet for this preset."
  };
}

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
