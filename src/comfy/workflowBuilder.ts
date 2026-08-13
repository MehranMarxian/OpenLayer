import txt2imgBasicWorkflow from "../workflows/api/txt2img-basic.json";
import img2imgBasicWorkflow from "../workflows/api/img2img-basic.json";
import txt2imgFlux1DevFp8Workflow from "../workflows/api/txt2img-flux1-dev-fp8.json";
import txt2imgFlux2DevGgufWorkflow from "../workflows/api/txt2img-flux2-dev-gguf.json";
import txt2imgZImageTurboWorkflow from "../workflows/api/txt2img-z-image-turbo.json";
import img2imgZImageTurboWorkflow from "../workflows/api/img2img-z-image-turbo.json";
import txt2imgKrea2TurboWorkflow from "../workflows/api/txt2img-krea2-turbo.json";
import img2imgKrea2TurboWorkflow from "../workflows/api/img2img-krea2-turbo.json";
import promptFromLayerFlorence2Workflow from "../workflows/api/prompt-from-layer-florence2.json";
import sketch2imgLinecnBasicWorkflow from "../workflows/api/sketch2img-linecn-basic.json";
import sketch2imgScribbleBasicWorkflow from "../workflows/api/sketch2img-scribble-basic.json";
import sketch2imgDepthBasicWorkflow from "../workflows/api/sketch2img-depth-basic.json";
import sketch2imgZimageFunControlnetWorkflow from "../workflows/api/sketch2img-zimage-fun-controlnet.json";
import inpaintBasicWorkflow from "../workflows/api/inpaint-basic.json";
import inpaintFluxFillBasicWorkflow from "../workflows/api/inpaint-flux-fill-basic.json";
import outpaintFluxFillBasicWorkflow from "../workflows/api/outpaint-flux-fill-basic.json";
import upscaleBasicWorkflow from "../workflows/api/upscale-basic.json";
import {
  BuildInpaintWorkflowOptions,
  BuildImageToImageWorkflowOptions,
  BuildOutpaintWorkflowOptions,
  BuildPromptFromLayerWorkflowOptions,
  BuildSketchToImageWorkflowOptions,
  BuildUpscaleWorkflowOptions,
  BuildWorkflowOptions,
  BuildWorkflowResult,
  ComfyWorkflow,
  WorkflowLoraSelection,
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
  "txt2img-flux2-dev-gguf": txt2imgFlux2DevGgufWorkflow as ComfyWorkflow,
  "txt2img-z-image-turbo": txt2imgZImageTurboWorkflow as ComfyWorkflow,
  "img2img-z-image-turbo": img2imgZImageTurboWorkflow as ComfyWorkflow,
  "txt2img-krea2-turbo": txt2imgKrea2TurboWorkflow as ComfyWorkflow,
  "img2img-krea2-turbo": img2imgKrea2TurboWorkflow as ComfyWorkflow,
  "prompt-from-layer-florence2": promptFromLayerFlorence2Workflow as ComfyWorkflow,
  "sketch2img-linecn-basic": sketch2imgLinecnBasicWorkflow as ComfyWorkflow,
  "sketch2img-scribble-basic": sketch2imgScribbleBasicWorkflow as ComfyWorkflow,
  "sketch2img-depth-basic": sketch2imgDepthBasicWorkflow as ComfyWorkflow,
  "sketch2img-zimage-fun-controlnet": sketch2imgZimageFunControlnetWorkflow as ComfyWorkflow,
  "inpaint-basic": inpaintBasicWorkflow as ComfyWorkflow,
  "inpaint-flux-fill-basic": inpaintFluxFillBasicWorkflow as ComfyWorkflow,
  "outpaint-flux-fill-basic": outpaintFluxFillBasicWorkflow as ComfyWorkflow,
  "upscale-basic": upscaleBasicWorkflow as ComfyWorkflow
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
  setPresetInput(workflow, preset, "negativePrompt", options.negativePrompt ?? "");
  setPresetInput(workflow, preset, "width", options.width, true);
  setPresetInput(workflow, preset, "height", options.height, true);
  setPresetInput(workflow, preset, "seed", seed, true);
  setPresetInput(workflow, preset, "steps", options.steps, true);
  setPresetInput(workflow, preset, "cfg", options.cfg, true);

  applyLoraSelection(workflow, preset, options.lora);

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
  setPresetInput(workflow, preset, "negativePrompt", options.negativePrompt ?? "");
  setPresetInput(workflow, preset, "seed", seed, true);
  setPresetInput(workflow, preset, "steps", options.steps, true);
  setPresetInput(workflow, preset, "cfg", options.cfg, true);
  setPresetInput(workflow, preset, "denoise", options.denoise, true);

  applyLoraSelection(workflow, preset, options.lora);

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
  setPresetInput(workflow, preset, "negativePrompt", options.negativePrompt ?? "");
  setPresetInput(workflow, preset, "width", options.width, true);
  setPresetInput(workflow, preset, "height", options.height, true);
  setPresetInput(workflow, preset, "seed", seed, true);
  setPresetInput(workflow, preset, "steps", options.steps, true);
  setPresetInput(workflow, preset, "cfg", options.cfg, true);
  setPresetInput(workflow, preset, "denoise", options.denoise, true);
  setPresetInput(workflow, preset, "controlStrength", options.controlStrength, true);
  // Only presets with a minimumGenerationSize carry these targets; for every
  // other sketch preset the generation size already is the output size.
  setPresetInput(workflow, preset, "outputWidth", options.outputWidth ?? options.width);
  setPresetInput(workflow, preset, "outputHeight", options.outputHeight ?? options.height);

  applyLoraSelection(workflow, preset, options.lora);

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

export async function buildOutpaintWorkflow(
  options: BuildOutpaintWorkflowOptions
): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "outpaint-flux-fill-basic");
  assertPresetMode(preset, "outpaint");
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
  setPresetInput(workflow, preset, "seed", seed, true);
  setPresetInput(workflow, preset, "steps", options.steps, true);
  setPresetInput(workflow, preset, "cfg", options.cfg, true);
  setPresetInput(workflow, preset, "denoise", options.denoise, true);
  setPresetInput(workflow, preset, "outpaintLeft", options.left, true);
  setPresetInput(workflow, preset, "outpaintTop", options.top, true);
  setPresetInput(workflow, preset, "outpaintRight", options.right, true);
  setPresetInput(workflow, preset, "outpaintBottom", options.bottom, true);
  setPresetInput(workflow, preset, "outpaintFeathering", options.feathering, true);

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

export async function buildUpscaleWorkflow(options: BuildUpscaleWorkflowOptions): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "upscale-basic");
  assertPresetMode(preset, "upscale");
  assertPresetRunnable(preset);
  const workflow = await cloneWorkflowTemplate(preset);

  validateWorkflowForPreset(workflow, preset);

  setPresetInput(workflow, preset, "sourceImage", options.sourceImageName, true);
  setPresetInput(workflow, preset, "checkpoint", options.modelName, true);

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed: 0,
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

/**
 * Splices a `LoraLoader` between a preset's model/CLIP loaders and everything
 * downstream of them.
 *
 * This is the one place a workflow's topology changes at build time, for the
 * reason spelled out on `WorkflowLoraInsertion`: core `LoraLoader` has no "off"
 * value, so an optional LoRA cannot be a permanently wired node whose value is
 * merely injected. No selection leaves the graph exactly as shipped.
 *
 * Order matters. This must run after the value injections, because rewiring an
 * input that a later `setPresetInput` overwrites would silently drop the LoRA
 * out of the chain while still loading it -- an image that looks untouched with
 * no error to explain why.
 */
function applyLoraSelection(
  workflow: ComfyWorkflow,
  preset: WorkflowPresetDefinition,
  lora: WorkflowLoraSelection | undefined
) {
  if (!lora?.loraName) {
    return;
  }

  const insertion = preset.loraInsertion;

  if (!insertion) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `The ${preset.id} preset does not support a LoRA.`,
      `Add a loraInsertion entry for ${preset.id} in src/comfy/presetRegistry.ts, or clear the LoRA selection.`
    );
  }

  // A collision would overwrite a real node and produce a graph that still
  // validates, because validateWorkflowForPreset only checks that required
  // nodes are present -- so it has to be caught here or not at all.
  if (workflow[insertion.nodeId]) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `The ${preset.id} workflow already uses node ${insertion.nodeId}.`,
      `Give ${preset.id}'s loraInsertion an unused nodeId in src/comfy/presetRegistry.ts.`
    );
  }

  workflow[insertion.nodeId] = {
    class_type: "LoraLoader",
    inputs: {
      lora_name: lora.loraName,
      strength_model: lora.strengthModel,
      strength_clip: lora.strengthClip,
      model: [insertion.modelSource.nodeId, insertion.modelSource.slot],
      clip: [insertion.clipSource.nodeId, insertion.clipSource.slot]
    },
    _meta: { title: "Apply LoRA" }
  };

  for (const consumer of insertion.modelConsumers) {
    setInput(workflow, consumer.nodeId, consumer.inputName, [insertion.nodeId, 0]);
  }

  for (const consumer of insertion.clipConsumers) {
    setInput(workflow, consumer.nodeId, consumer.inputName, [insertion.nodeId, 1]);
  }
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
