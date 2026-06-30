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

  it("treats Z_image_Turbo as experimental-runnable when its stack is present and keeps future Flux setup-required", () => {
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
    expect(zImageResult.level).toBe("experimental");
    expect(zImageResult.canRun).toBe(true);
    expect(zImageResult.issues.some((issue) => issue.code === "WORKFLOW_EXPERIMENTAL")).toBe(true);

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

  it("accepts the preferred Flux Fill T5 encoder when the model stack is present", () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");

    const result = evaluateWorkflowCompatibility(preset, {
      selectedModelName: "flux1-fill-dev.safetensors",
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory({
        clipModels: ["t5xxl_fp16.safetensors", "clip_l.safetensors"]
      }),
      photoshopInputs: { selection: true, "selection-mask": true }
    });

    expect(result.level).toBe("experimental");
    expect(result.canRun).toBe(true);
    expect(result.issues.some((issue) => issue.code === "MODEL_FILE_MISSING")).toBe(false);
  });

  it("accepts the common Flux Fill fp8 T5 fallback when fp16 is missing", () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");

    const result = evaluateWorkflowCompatibility(preset, {
      selectedModelName: "flux1-fill-dev.safetensors",
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory({
        clipModels: ["t5xxl_fp8_e4m3fn.safetensors", "clip_l.safetensors"]
      }),
      photoshopInputs: { selection: true, "selection-mask": true }
    });

    expect(result.level).toBe("experimental");
    expect(result.canRun).toBe(true);
    expect(result.issues.some((issue) => issue.code === "MODEL_FILE_MISSING")).toBe(false);
  });

  it("reports both accepted Flux Fill T5 names when neither is installed", () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");

    const result = evaluateWorkflowCompatibility(preset, {
      selectedModelName: "flux1-fill-dev.safetensors",
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory({
        clipModels: ["clip_l.safetensors"]
      }),
      photoshopInputs: { selection: true, "selection-mask": true }
    });

    expect(result.level).toBe("setup-required");
    expect(result.canRun).toBe(false);
    expect(result.recommendedAction).toContain("t5xxl_fp16.safetensors");
    expect(result.recommendedAction).toContain("t5xxl_fp8_e4m3fn.safetensors");
  });

  it("reports missing Photoshop mask input for Flux Fill before generation", () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");

    const result = evaluateWorkflowCompatibility(preset, {
      selectedModelName: "flux1-fill-dev.safetensors",
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory(),
      photoshopInputs: { selection: true, "selection-mask": false }
    });

    expect(result.level).toBe("setup-required");
    expect(result.canRun).toBe(false);
    expect(result.issues.some((issue) => issue.code === "PHOTOSHOP_INPUT_MISSING")).toBe(true);
  });

  it("allows Flux Fill outpaint from either an active layer or canvas source", () => {
    const preset = getWorkflowPreset("outpaint-flux-fill-basic");

    const fromCanvas = evaluateWorkflowCompatibility(preset, {
      selectedModelName: "flux1-fill-dev.safetensors",
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory(),
      photoshopInputs: { canvas: true }
    });
    const missingSource = evaluateWorkflowCompatibility(preset, {
      selectedModelName: "flux1-fill-dev.safetensors",
      availableNodes: createAvailableNodes(preset),
      availableModels: createFluxFillInventory(),
      photoshopInputs: {}
    });

    expect(fromCanvas.level).toBe("experimental");
    expect(fromCanvas.canRun).toBe(true);
    expect(missingSource.level).toBe("setup-required");
    expect(missingSource.issues.some((issue) => issue.code === "PHOTOSHOP_INPUT_MISSING")).toBe(true);
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
    const outpaintCapability = getWorkflowCapability(getWorkflowPreset("outpaint-flux-fill-basic"));

    expect(txtCapability.controls).toEqual(["prompt", "negativePrompt", "width", "height", "steps", "cfg", "seed"]);
    expect(imgCapability.controls).toContain("denoise");
    expect(imgCapability.requiredPhotoshopInputs).toEqual([
      { anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }
    ]);
    expect(sketchCapability.controls).toContain("controlStrength");
    expect(inpaintCapability.requiredPhotoshopInputs).toEqual(["selection", "selection-mask"]);
    expect(inpaintCapability.output.kind).toBe("selection-patch");
    expect(inpaintCapability.uiHints.warning).toContain("experimental");
    expect(outpaintCapability.controls).toContain("outpaintLeft");
    expect(outpaintCapability.controls).toContain("outpaintFeathering");
    expect(outpaintCapability.requiredPhotoshopInputs).toEqual([
      { anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }
    ]);
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

function createFluxFillInventory(overrides: Partial<ComfyModelInventory> = {}) {
  return createInventory({
    diffusionModels: ["flux1-fill-dev.safetensors"],
    clipModels: ["t5xxl_fp16.safetensors", "clip_l.safetensors"],
    vaeModels: ["ae.safetensors"],
    ...overrides
  });
}
