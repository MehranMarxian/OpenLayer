import {
  WorkflowCapability,
  WorkflowControlId,
  WorkflowLoaderType,
  WorkflowPresetDefinition
} from "./types";

const MODE_LABELS: Record<WorkflowPresetDefinition["mode"], string> = {
  txt2img: "Text to Image",
  img2img: "Image to Image",
  sketch2img: "Sketch to Image",
  inpaint: "Inpaint"
};

const DEFAULT_CONTROLS: Record<WorkflowPresetDefinition["mode"], readonly WorkflowControlId[]> = {
  txt2img: ["prompt", "negativePrompt", "width", "height", "steps", "cfg", "seed"],
  img2img: ["prompt", "negativePrompt", "steps", "cfg", "denoise", "seed"],
  sketch2img: ["prompt", "negativePrompt", "steps", "cfg", "denoise", "seed", "controlStrength"],
  inpaint: ["prompt", "negativePrompt", "steps", "cfg", "denoise", "seed"]
};

export function getWorkflowCapability(preset: WorkflowPresetDefinition): WorkflowCapability {
  if (preset.capability) {
    return preset.capability;
  }

  const loaderType: WorkflowLoaderType =
    preset.modelSource.kind === "diffusion-model-stack" ? "diffusion-model-stack" : "checkpoint";

  return {
    toolType: preset.mode,
    loaderType,
    artistLabel: MODE_LABELS[preset.mode],
    technicalLabel: preset.label,
    requiredPhotoshopInputs: [],
    controls: DEFAULT_CONTROLS[preset.mode],
    output: {
      kind: preset.mode === "txt2img" ? "full-image" : "source-sized-image",
      size: preset.mode === "txt2img" ? "preset" : "source",
      importBehavior: "new-layer"
    },
    uiHints: {
      showModelSelector: true,
      modelSelectorLabel: preset.modelSource.label,
      primaryActionLabel: "Generate"
    }
  };
}
