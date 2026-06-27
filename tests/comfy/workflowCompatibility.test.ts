import { describe, expect, it } from "vitest";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";
import { getWorkflowCapability } from "../../src/comfy/workflowCapabilities";
import {
  evaluateWorkflowCompatibility,
  WorkflowNodeAvailability
} from "../../src/comfy/workflowCompatibility";
import { ComfyModelInventory, WorkflowPresetDefinition } from "../../src/comfy/types";

describe("workflow compatibility", () => {
  it("treats SD1 and SDXL checkpoint workflows as ready when setup is present", () => {
    const txtPreset = getWorkflowPreset("txt2img-basic");
    const imgPreset = getWorkflowPreset("img2img-basic");

    const txtResult = evaluateWorkflowCompatibility(txtPreset, {
      selectedModelName: "sd_xl_base_1.0.safetensors",
      availableNodes: createAvailableNodes(txtPreset)
    });
    const imgResult = evaluateWorkflowCompatibility(imgPreset, {
      selectedModelName: "epicrealism_naturalSinRC1VAE.safetensors",
      availableNodes: createAvailableNodes(imgPreset),
      photoshopInputs: { "active-layer": true }
    });

    expect(txtResult.level).toBe("ready");
    expect(txtResult.canRun).toBe(true);
    expect(imgResult.level).toBe("ready");
    expect(imgResult.canRun).toBe(true);
  });

  it("keeps future Flux and Z_image_Turbo diffusion-stack presets setup-required", () => {
    const zImagePreset = getWorkflowPreset("txt2img-z-image-turbo");
    const fluxPreset = getWorkflowPreset("txt2img-flux1-dev");

    const zImageResult = evaluateWorkflowCompatibility(zImagePreset, {
      selectedModelName: "z_image_turbo_bf16.safetensors",
      availableNodes: createAvailableNodes(zImagePreset),
      availableModels: createInventory({
        diffusionModels: ["z_image_turbo_bf16.safetensors"],
        clipModels: ["qwen_3_4b.safetensors"],
        vaeModels: ["ae.safetensors"]
      })
    });
    const fluxResult = evaluateWorkflowCompatibility(fluxPreset, {
      selectedModelName: "flux1-dev.safetensors",
      availableNodes: createAvailableNodes(fluxPreset),
      availableModels: createInventory({
        diffusionModels: ["flux1-dev.safetensors"]
      })
    });

    expect(getWorkflowCapability(zImagePreset).loaderType).toBe("diffusion-model-stack");
    expect(zImageResult.level).toBe("setup-required");
    expect(zImageResult.canRun).toBe(false);
    expect(zImageResult.issues.some((issue) => issue.code === "WORKFLOW_NOT_RUNNABLE")).toBe(true);

    expect(getWorkflowCapability(fluxPreset).loaderType).toBe("diffusion-model-stack");
    expect(fluxResult.level).toBe("setup-required");
    expect(fluxResult.canRun).toBe(false);
    expect(fluxResult.issues.some((issue) => issue.code === "WORKFLOW_NOT_RUNNABLE")).toBe(true);
  });

  it("reports missing ComfyUI node classes without touching ComfyUI", () => {
    const preset = getWorkflowPreset("sketch2img-linecn-basic");
    const availableNodes = createAvailableNodes(preset);
    delete availableNodes.LineArtPreprocessor;

    const result = evaluateWorkflowCompatibility(preset, {
      selectedModelName: "epicrealism_naturalSinRC1VAE.safetensors",
      availableNodes,
      availableModels: createInventory({
        controlNetModels: ["control_v11p_sd15_lineart_fp16.safetensors"]
      }),
      photoshopInputs: { canvas: true }
    });

    expect(result.level).toBe("setup-required");
    expect(result.canRun).toBe(false);
    expect(result.issues.some((issue) => issue.code === "COMFY_NODE_MISSING")).toBe(true);
  });

  it("reports missing required model files", () => {
    const preset = getWorkflowPreset("sketch2img-linecn-basic");

    const result = evaluateWorkflowCompatibility(preset, {
      selectedModelName: "epicrealism_naturalSinRC1VAE.safetensors",
      availableNodes: createAvailableNodes(preset),
      availableModels: createInventory(),
      photoshopInputs: { canvas: true }
    });

    expect(result.level).toBe("setup-required");
    expect(result.canRun).toBe(false);
    expect(result.issues.some((issue) => issue.code === "MODEL_FILE_MISSING")).toBe(true);
    expect(result.recommendedAction).toContain("Missing LineArt ControlNet");
  });

  it("reports missing Photoshop inputs for selection workflows", () => {
    const preset = getWorkflowPreset("inpaint-basic");

    const result = evaluateWorkflowCompatibility(preset, {
      selectedModelName: "epicrealism_naturalSinRC1VAE.safetensors",
      availableNodes: createAvailableNodes(preset),
      photoshopInputs: { selection: true, "selection-mask": false }
    });

    expect(result.level).toBe("setup-required");
    expect(result.canRun).toBe(false);
    expect(result.issues.some((issue) => issue.code === "PHOTOSHOP_INPUT_MISSING")).toBe(true);
  });

  it("exposes UI control hints for the current tools", () => {
    const txtCapability = getWorkflowCapability(getWorkflowPreset("txt2img-basic"));
    const imgCapability = getWorkflowCapability(getWorkflowPreset("img2img-basic"));
    const sketchCapability = getWorkflowCapability(getWorkflowPreset("sketch2img-linecn-basic"));
    const inpaintCapability = getWorkflowCapability(getWorkflowPreset("inpaint-basic"));

    expect(txtCapability.controls).toEqual(["prompt", "negativePrompt", "width", "height", "steps", "cfg", "seed"]);
    expect(imgCapability.controls).toContain("denoise");
    expect(imgCapability.requiredPhotoshopInputs).toEqual([
      { anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }
    ]);
    expect(sketchCapability.controls).toContain("controlStrength");
    expect(inpaintCapability.requiredPhotoshopInputs).toEqual(["selection", "selection-mask"]);
    expect(inpaintCapability.output.kind).toBe("selection-patch");
    expect(inpaintCapability.uiHints.warning).toContain("experimental");
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
