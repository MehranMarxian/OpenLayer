import txt2imgBasicWorkflow from "../workflows/txt2img-basic.json";
import img2imgBasicWorkflow from "../workflows/img2img-basic.json";
import sketch2imgLinecnBasicWorkflow from "../workflows/sketch2img-linecn-basic.json";
import {
  BuildImageToImageWorkflowOptions,
  BuildSketchToImageWorkflowOptions,
  BuildWorkflowOptions,
  BuildWorkflowResult,
  ComfyWorkflow,
  WorkflowPreset,
  WorkflowPresetDefinition
} from "./types";
import { getPresetInputTarget, getWorkflowPreset, validateWorkflowForPreset } from "./presetRegistry";
import { createOpenLayerError } from "../utils/errors";

const WORKFLOW_TEMPLATES: Partial<Record<WorkflowPreset, ComfyWorkflow>> = {
  "txt2img-basic": txt2imgBasicWorkflow as ComfyWorkflow,
  "img2img-basic": img2imgBasicWorkflow as ComfyWorkflow,
  "sketch2img-linecn-basic": sketch2imgLinecnBasicWorkflow as ComfyWorkflow
};

export async function buildTxt2ImgWorkflow(options: BuildWorkflowOptions): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "txt2img-basic");
  assertPresetMode(preset, "txt2img");
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
  const workflow = await cloneWorkflowTemplate(preset);
  const seed = options.seed;

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
  setPresetInput(workflow, preset, "controlStrength", options.controlStrength, true);

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

  setInput(workflow, target.nodeId, target.inputName, value);
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
        `Export the working ComfyUI API workflow as src/workflows/sketch2img-linecn-basic.json. ${String(caughtError)}`
      );
    }

    throw createOpenLayerError(
      "WORKFLOW_FILE_MISSING",
      `The ${preset.id} workflow JSON is not installed.`,
      `Expected ${preset.workflowFile}. ${String(caughtError)}`
    );
  }
}
