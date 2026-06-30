import txt2imgBasicWorkflow from "../workflows/api/txt2img-basic.json";
import img2imgBasicWorkflow from "../workflows/api/img2img-basic.json";
import txt2imgFlux1DevFp8Workflow from "../workflows/api/txt2img-flux1-dev-fp8.json";
import txt2imgZImageTurboWorkflow from "../workflows/api/txt2img-z-image-turbo.json";
import img2imgZImageTurboWorkflow from "../workflows/api/img2img-z-image-turbo.json";
import promptFromLayerFlorence2Workflow from "../workflows/api/prompt-from-layer-florence2.json";
import sketch2imgLinecnBasicWorkflow from "../workflows/api/sketch2img-linecn-basic.json";
import inpaintBasicWorkflow from "../workflows/api/inpaint-basic.json";
import inpaintFluxFillBasicWorkflow from "../workflows/api/inpaint-flux-fill-basic.json";
import {
  BuildInpaintWorkflowOptions,
  BuildImageToImageWorkflowOptions,
  BuildPromptFromLayerWorkflowOptions,
  BuildSketchToImageWorkflowOptions,
  BuildWorkflowOptions,
  BuildWorkflowResult,
  ComfyWorkflow,
  WorkflowPreset,
  WorkflowPresetDefinition,
  WorkflowInjectionTargetList
} from "./types";
import { getPresetInputTarget, getWorkflowPreset, validateWorkflowForPreset } from "./presetRegistry";
import { createRequiredModelSelectionKey } from "./workflowModelRequirements";
import { applyFluxFillReferenceDefaults, FLUX_FILL_PRESET_ID } from "./fluxFillDefaults";
import { createOpenLayerError } from "../utils/errors";

const WORKFLOW_TEMPLATES: Partial<Record<WorkflowPreset, ComfyWorkflow>> = {
  "txt2img-basic": txt2imgBasicWorkflow as ComfyWorkflow,
  "img2img-basic": img2imgBasicWorkflow as ComfyWorkflow,
  "txt2img-flux1-dev-fp8": txt2imgFlux1DevFp8Workflow as ComfyWorkflow,
  "txt2img-z-image-turbo": txt2imgZImageTurboWorkflow as ComfyWorkflow,
  "img2img-z-image-turbo": img2imgZImageTurboWorkflow as ComfyWorkflow,
  "prompt-from-layer-florence2": promptFromLayerFlorence2Workflow as ComfyWorkflow,
  "sketch2img-linecn-basic": sketch2imgLinecnBasicWorkflow as ComfyWorkflow,
  "inpaint-basic": inpaintBasicWorkflow as ComfyWorkflow,
  "inpaint-flux-fill-basic": inpaintFluxFillBasicWorkflow as ComfyWorkflow
};

export async function buildTxt2ImgWorkflow(options: BuildWorkflowOptions): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "txt2img-basic");
  assertPresetMode(preset, "txt2img");
  assertPresetRunnable(preset);
  const workflow = await cloneWorkflowTemplate(preset);
  const seed = options.seed;

  // Injection targets are preset-specific. If users export a different ComfyUI
  // API workflow, update presetRegistry.ts instead of changing this builder.
  validateWorkflowForPreset(workflow, preset);

  if (options.checkpointName) {
    setPresetInput(workflow, preset, "checkpoint", options.checkpointName, true);
  }

  setPresetInput(workflow, preset, "positivePrompt", options.prompt, true);
  setPresetInput(workflow, preset, "negativePrompt", options.negativePrompt ?? "", true);
  setPresetInput(workflow, preset, "width", options.width, true);
  setPresetInput(workflow, preset, "height", options.height, true);
  setPresetInput(workflow, preset, "seed", seed, true);
  setPresetInput(workflow, preset, "steps", options.steps, true);
  setPresetInput(workflow, preset, "cfg", options.cfg, true);

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed,
    preset
  };
}

export async function buildImg2ImgWorkflow(
  options: BuildImageToImageWorkflowOptions
): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "img2img-basic");
  assertPresetMode(preset, "img2img");
  assertPresetRunnable(preset);
  const workflow = await cloneWorkflowTemplate(preset);
  const seed = options.seed;

  // Injection targets are preset-specific. If users export a different ComfyUI
  // API workflow, update presetRegistry.ts instead of changing this builder.
  validateWorkflowForPreset(workflow, preset);

  if (options.checkpointName) {
    setPresetInput(workflow, preset, "checkpoint", options.checkpointName, true);
  }

  setPresetInput(workflow, preset, "sourceImage", options.sourceImageName, true);
  setPresetInput(workflow, preset, "positivePrompt", options.prompt, true);
  setPresetInput(workflow, preset, "negativePrompt", options.negativePrompt ?? "", true);
  setPresetInput(workflow, preset, "seed", seed, true);
  setPresetInput(workflow, preset, "steps", options.steps, true);
  setPresetInput(workflow, preset, "cfg", options.cfg, true);
  setPresetInput(workflow, preset, "denoise", options.denoise, true);

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed,
    preset
  };
}

export async function buildSketchToImageWorkflow(
  options: BuildSketchToImageWorkflowOptions
): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "sketch2img-linecn-basic");
  assertPresetMode(preset, "sketch2img");
  assertPresetRunnable(preset);
  const workflow = await cloneWorkflowTemplate(preset);
  const seed = options.seed;

  validateWorkflowForPreset(workflow, preset);
  applyRequiredModelSelections(workflow, preset, options.requiredModelSelections);

  if (options.checkpointName) {
    setPresetInput(workflow, preset, "checkpoint", options.checkpointName, true);
  }

  setPresetInput(workflow, preset, "sourceImage", options.sourceImageName, true);
  setPresetInput(workflow, preset, "positivePrompt", options.prompt, true);
  setPresetInput(workflow, preset, "negativePrompt", options.negativePrompt ?? "", true);
  setPresetInput(workflow, preset, "seed", seed, true);
  setPresetInput(workflow, preset, "steps", options.steps, true);
  setPresetInput(workflow, preset, "cfg", options.cfg, true);
  setPresetInput(workflow, preset, "denoise", options.denoise, true);
  setPresetInput(workflow, preset, "controlStrength", options.controlStrength, true);

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed,
    preset
  };
}

export async function buildInpaintWorkflow(
  options: BuildInpaintWorkflowOptions
): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "inpaint-basic");
  assertPresetMode(preset, "inpaint");
  assertPresetRunnable(preset);
  const workflow = await cloneWorkflowTemplate(preset);
  const seed = options.seed;

  validateWorkflowForPreset(workflow, preset);
  applyRequiredModelSelections(workflow, preset, options.requiredModelSelections);

  if (options.checkpointName) {
    setPresetInput(workflow, preset, "checkpoint", options.checkpointName, true);
  }

  setPresetInput(workflow, preset, "sourceImage", options.sourceImageName, true);
  setPresetInput(workflow, preset, "maskImage", options.maskImageName, preset.id !== "inpaint-flux-fill-basic");
  setPresetInput(workflow, preset, "positivePrompt", options.prompt, true);
  setPresetInput(workflow, preset, "negativePrompt", options.negativePrompt ?? "");
  setPresetInput(workflow, preset, "seed", seed, true);

  if (preset.id === FLUX_FILL_PRESET_ID) {
    applyFluxFillReferenceDefaults(workflow);
  } else {
    setPresetInput(workflow, preset, "steps", options.steps, true);
    setPresetInput(workflow, preset, "cfg", options.cfg, true);
    setPresetInput(workflow, preset, "denoise", options.denoise, true);
  }

  setPresetInput(workflow, preset, "width", options.width);
  setPresetInput(workflow, preset, "height", options.height);

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed,
    preset
  };
}

export async function buildPromptFromLayerWorkflow(
  options: BuildPromptFromLayerWorkflowOptions
): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "prompt-from-layer-florence2");
  assertPresetMode(preset, "prompt");
  assertPresetRunnable(preset);
  const workflow = await cloneWorkflowTemplate(preset);
  const seed = options.seed;

  validateWorkflowForPreset(workflow, preset);

  setPresetInput(workflow, preset, "sourceImage", options.sourceImageName, true);
  setPresetInput(workflow, preset, "task", options.task || "detailed_caption", true);
  setPresetInput(workflow, preset, "numBeams", options.numBeams, true);
  setPresetInput(workflow, preset, "seed", seed, true);

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed,
    preset
  };
}

async function cloneWorkflowTemplate(preset: WorkflowPresetDefinition): Promise<ComfyWorkflow> {
  const workflow = WORKFLOW_TEMPLATES[preset.id];

  if (workflow) {
    return cloneWorkflow(workflow);
  }

  return cloneWorkflow(await loadWorkflowFromFile(preset));
}

function cloneWorkflow(workflow: ComfyWorkflow): ComfyWorkflow {
  return JSON.parse(JSON.stringify(workflow)) as ComfyWorkflow;
}

function setPresetInput(
  workflow: ComfyWorkflow,
  preset: WorkflowPresetDefinition,
  inputName: Parameters<typeof getPresetInputTarget>[1],
  value: unknown,
  required = false
) {
  const target = getPresetInputTarget(preset, inputName, { required });

  if (!target) {
    return;
  }

  const targets = normalizeTargets(target);

  for (const currentTarget of targets) {
    setInput(workflow, currentTarget.nodeId, currentTarget.inputName, value);
  }
}

function normalizeTargets(target: WorkflowInjectionTargetList) {
  return Array.isArray(target) ? target : [target];
}

function applyRequiredModelSelections(
  workflow: ComfyWorkflow,
  preset: WorkflowPresetDefinition,
  modelSelections: Record<string, string> | undefined
) {
  if (!modelSelections) {
    return;
  }

  for (const requiredModel of preset.requiredModels ?? []) {
    const selectedModelName = modelSelections[createRequiredModelSelectionKey(requiredModel)];

    if (!selectedModelName) {
      continue;
    }

    const node = Object.values(workflow).find(
      (candidate) =>
        candidate.class_type === requiredModel.objectInfoNode &&
        Object.prototype.hasOwnProperty.call(candidate.inputs, requiredModel.inputName)
    );

    if (node) {
      node.inputs[requiredModel.inputName] = selectedModelName;
    }
  }
}

function setInput(workflow: ComfyWorkflow, nodeId: string, inputName: string, value: unknown) {
  const node = workflow[nodeId];

  if (!node) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `Workflow node ${nodeId} was not found.`,
      "Update presetRegistry.ts to match the exported ComfyUI workflow."
    );
  }

  node.inputs[inputName] = value;
}

function assertPresetMode(preset: WorkflowPresetDefinition, mode: WorkflowPresetDefinition["mode"]) {
  if (preset.mode !== mode) {
    throw createOpenLayerError(
      "WORKFLOW_PRESET_UNSUPPORTED",
      `The ${preset.id} preset cannot be used for ${mode}.`
    );
  }
}

function assertPresetRunnable(preset: WorkflowPresetDefinition) {
  if (preset.status !== "todo") {
    return;
  }

  throw createOpenLayerError(
    "WORKFLOW_PRESET_UNSUPPORTED",
    `${preset.label} is not runnable yet.`,
    preset.disabledReason ??
      "This preset is registered for future workflow compatibility work, but it does not have a validated OpenLayer API workflow JSON yet."
  );
}

async function loadWorkflowFromFile(preset: WorkflowPresetDefinition): Promise<ComfyWorkflow> {
  try {
    const response = await fetch(preset.workflowFile);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as ComfyWorkflow;
  } catch (caughtError) {
    if (preset.id === "sketch2img-linecn-basic") {
      throw createOpenLayerError(
        "WORKFLOW_FILE_MISSING",
        "LINECN workflow JSON required.",
        `Export the working ComfyUI API workflow as src/workflows/api/sketch2img-linecn-basic.json. ${String(caughtError)}`
      );
    }

    if (preset.id === "inpaint-basic") {
      throw createOpenLayerError(
        "WORKFLOW_FILE_MISSING",
        "Inpaint workflow JSON required.",
        `Expected the validated ComfyUI API workflow at src/workflows/api/inpaint-basic.json. ${String(caughtError)}`
      );
    }

    throw createOpenLayerError(
      "WORKFLOW_FILE_MISSING",
      `The ${preset.id} workflow JSON is not installed.`,
      `Expected ${preset.workflowFile}. ${String(caughtError)}`
    );
  }
}
