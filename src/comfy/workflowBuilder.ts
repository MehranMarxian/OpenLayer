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
import sketch2imgZimageFunControlnetFullWorkflow from "../workflows/api/sketch2img-zimage-fun-controlnet-full.json";
import inpaintBasicWorkflow from "../workflows/api/inpaint-basic.json";
import txt2imgFlux2KleinWorkflow from "../workflows/api/txt2img-flux2-klein.json";
import img2imgFlux2KleinWorkflow from "../workflows/api/img2img-flux2-klein.json";
import editFlux2KleinWorkflow from "../workflows/api/edit-flux2-klein.json";
import inpaintFluxFillBasicWorkflow from "../workflows/api/inpaint-flux-fill-basic.json";
import inpaintFluxFillCropStitchWorkflow from "../workflows/api/inpaint-flux-fill-cropstitch.json";
import inpaintFlux2KleinWorkflow from "../workflows/api/inpaint-flux2-klein.json";
import outpaintFluxFillBasicWorkflow from "../workflows/api/outpaint-flux-fill-basic.json";
import upscaleBasicWorkflow from "../workflows/api/upscale-basic.json";
import styleReferenceSd15Workflow from "../workflows/api/style-reference-sd15.json";
import multiReferenceFlux2KleinWorkflow from "../workflows/api/multi-reference-flux2-klein.json";
import txt2imgQwenImage21Workflow from "../workflows/api/txt2img-qwen-image-21.json";
import editQwenImage21Workflow from "../workflows/api/edit-qwen-image-21.json";
import multiReferenceQwenImage21Workflow from "../workflows/api/multi-reference-qwen-image-21.json";
import {
  BuildInpaintWorkflowOptions,
  BuildImageToImageWorkflowOptions,
  BuildMultiReferenceWorkflowOptions,
  BuildOutpaintWorkflowOptions,
  BuildPromptFromLayerWorkflowOptions,
  BuildSketchToImageWorkflowOptions,
  BuildStyleReferenceWorkflowOptions,
  BuildUnflattenWorkflowOptions,
  BuildRemoveBackgroundWorkflowOptions,
  BuildLayerMapsWorkflowOptions,
  BuildEnhancePromptWorkflowOptions,
  BuildUpscaleWorkflowOptions,
  BuildWorkflowOptions,
  BuildWorkflowResult,
  ComfyWorkflow,
  ComfyWorkflowNode,
  WorkflowLoraSelection,
  WorkflowPreset,
  WorkflowPresetDefinition,
  WorkflowEncoderImageSlots,
  WorkflowInjectionTargetList,
  WorkflowInputTarget,
  WorkflowTransparentOutput
} from "./types";
import { getPresetInputTarget, getWorkflowPreset, validateWorkflowForPreset } from "./presetRegistry";
import { createRequiredModelSelectionKey } from "./workflowModelRequirements";
import { applyFluxFillReferenceDefaults, isFluxFillPreset } from "./fluxFillDefaults";
import { presetUsesEmbeddedMaskAlpha } from "./fluxFillMaskBridge";
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
  "sketch2img-zimage-fun-controlnet-full": sketch2imgZimageFunControlnetFullWorkflow as ComfyWorkflow,
  "inpaint-basic": inpaintBasicWorkflow as ComfyWorkflow,
  "txt2img-flux2-klein": txt2imgFlux2KleinWorkflow as ComfyWorkflow,
  "img2img-flux2-klein": img2imgFlux2KleinWorkflow as ComfyWorkflow,
  "edit-flux2-klein": editFlux2KleinWorkflow as ComfyWorkflow,
  "inpaint-flux-fill-basic": inpaintFluxFillBasicWorkflow as ComfyWorkflow,
  "inpaint-flux-fill-cropstitch": inpaintFluxFillCropStitchWorkflow as ComfyWorkflow,
  "inpaint-flux2-klein": inpaintFlux2KleinWorkflow as ComfyWorkflow,
  "outpaint-flux-fill-basic": outpaintFluxFillBasicWorkflow as ComfyWorkflow,
  "upscale-basic": upscaleBasicWorkflow as ComfyWorkflow,
  "style-reference-sd15": styleReferenceSd15Workflow as ComfyWorkflow,
  "multi-reference-flux2-klein": multiReferenceFlux2KleinWorkflow as ComfyWorkflow,
  "txt2img-qwen-image-21": txt2imgQwenImage21Workflow as ComfyWorkflow,
  "edit-qwen-image-21": editQwenImage21Workflow as ComfyWorkflow,
  "multi-reference-qwen-image-21": multiReferenceQwenImage21Workflow as ComfyWorkflow
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

  const transparent = resolveTransparentOutput(preset, options.transparentBackground === true, true);
  const prompt = transparent?.promptWrapper
    ? `${transparent.promptWrapper.prefix}${options.prompt}${transparent.promptWrapper.suffix}`
    : options.prompt;

  setPresetInput(workflow, preset, "positivePrompt", prompt, true);
  setPresetInput(workflow, preset, "negativePrompt", options.negativePrompt ?? "");
  setPresetInput(workflow, preset, "width", options.width, true);
  setPresetInput(workflow, preset, "height", options.height, true);
  setPresetInput(workflow, preset, "seed", seed, true);
  setPresetInput(workflow, preset, "steps", options.steps, true);
  setPresetInput(workflow, preset, "cfg", options.cfg, true);

  applyLoraSelection(workflow, preset, options.lora);
  applyTransparentOutput(workflow, transparent);

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
  // Required only when the preset actually offers a denoise control. Every
  // image-to-image preset had one until edit-flux2-klein, where denoise 1 IS
  // the technique and there is deliberately nowhere to put the panel's slider.
  // Keying off the declared capability rather than relaxing the check for
  // everyone means a preset that offers the control but forgets to wire it
  // still fails loudly.
  setPresetInput(
    workflow,
    preset,
    "denoise",
    options.denoise,
    preset.capability?.controls.includes("denoise") ?? true
  );

  applyLoraSelection(workflow, preset, options.lora);

  if (options.referenceImageNames && options.referenceImageNames.length > 0) {
    if (preset.referenceChain?.kind !== "encoder-image-slots") {
      throw createOpenLayerError(
        "WORKFLOW_INVALID",
        `The ${preset.id} preset cannot take reference layers.`,
        "Choose Qwen-Image 2.1 (edit), or clear the reference list."
      );
    }

    // The source is slot 1 (already injected), so the chain grows from slot 2.
    // A selection edit's LoadImage carries the selection in its alpha; clones
    // for references take a fresh image name, so that never leaks into them.
    applyReferenceChain(workflow, preset, [options.sourceImageName, ...options.referenceImageNames]);
  }

  if (options.selectionEdit) {
    // A selection edit owns the output: its alpha is the feathered selection,
    // so the cut-out rewiring below must not also claim SaveImage.
    applySelectionEdit(workflow, preset, options.selectionEdit.strength);
  } else {
    // Not required: a cut-out edited by a preset without an alpha channel still
    // comes back as a correct, opaque edit.
    applyTransparentOutput(workflow, resolveTransparentOutput(preset, options.keepTransparency === true, false));
  }

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

export async function buildStyleReferenceWorkflow(
  options: BuildStyleReferenceWorkflowOptions
): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "style-reference-sd15");
  assertPresetMode(preset, "style-reference");
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
  setPresetInput(workflow, preset, "controlStrength", options.controlStrength, true);

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed,
    preset
  };
}

export async function buildMultiReferenceWorkflow(
  options: BuildMultiReferenceWorkflowOptions
): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "multi-reference-flux2-klein");
  assertPresetMode(preset, "multi-reference");
  assertPresetRunnable(preset);
  const workflow = await cloneWorkflowTemplate(preset);
  const seed = options.seed;

  validateWorkflowForPreset(workflow, preset);
  applyRequiredModelSelections(workflow, preset, options.requiredModelSelections);

  if (options.checkpointName) {
    setPresetInput(workflow, preset, "checkpoint", options.checkpointName, true);
  }

  // Reference 1 goes in through the ordinary single-source injection; the rest
  // are wired by applyReferenceChain, which reads the same list.
  setPresetInput(workflow, preset, "sourceImage", options.referenceImageNames[0] ?? "", true);
  setPresetInput(workflow, preset, "positivePrompt", options.prompt, true);
  setPresetInput(workflow, preset, "negativePrompt", options.negativePrompt ?? "");
  setPresetInput(workflow, preset, "seed", seed, true);
  setPresetInput(workflow, preset, "steps", options.steps, true);
  setPresetInput(workflow, preset, "cfg", options.cfg, true);

  // After the value injections, for the same ordering reason as the LoRA: this
  // rewires the sampler's conditioning inputs, and a later injection into them
  // would silently drop every reference past the first.
  applyReferenceChain(workflow, preset, options.referenceImageNames);
  applyLoraSelection(workflow, preset, options.lora);

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed,
    preset
  };
}

export async function buildUnflattenWorkflow(
  options: BuildUnflattenWorkflowOptions
): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "unflatten-qwen-layered");
  assertPresetMode(preset, "unflatten");
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
  setPresetInput(workflow, preset, "seed", seed, true);
  setPresetInput(workflow, preset, "steps", options.steps, true);
  setPresetInput(workflow, preset, "cfg", options.cfg, true);
  // Required, unlike most injections: a graph that silently kept the template's
  // layer count would return a different number of plates than the panel asked
  // for, and the import maps results to layers positionally.
  setPresetInput(workflow, preset, "layerCount", options.layerCount, true);

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
  // Presets that read the mask from the source PNG's alpha channel have no
  // separate mask target to inject into. Every Flux Fill preset does this, and
  // so does inpaint-flux2-klein.
  setPresetInput(workflow, preset, "maskImage", options.maskImageName, !presetUsesEmbeddedMaskAlpha(preset.id));
  setPresetInput(workflow, preset, "positivePrompt", options.prompt, true);
  setPresetInput(workflow, preset, "negativePrompt", options.negativePrompt ?? "");
  setPresetInput(workflow, preset, "seed", seed, true);

  if (isFluxFillPreset(preset.id)) {
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

/**
 * Seed is 0 and stays 0: there is no sampler in this graph. BiRefNet is
 * deterministic, so the same layer produces the same matte every time, and
 * offering a seed would imply a variation that does not exist.
 */
export async function buildRemoveBackgroundWorkflow(
  options: BuildRemoveBackgroundWorkflowOptions
): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "remove-background-birefnet");
  assertPresetMode(preset, "remove-background");
  assertPresetRunnable(preset);
  const workflow = await cloneWorkflowTemplate(preset);

  validateWorkflowForPreset(workflow, preset);

  setPresetInput(workflow, preset, "sourceImage", options.sourceImageName, true);
  setPresetInput(workflow, preset, "checkpoint", options.modelName, true);

  if (preset.placementAnchor) {
    anchorSavedImage(workflow, preset.placementAnchor, "anchor");
  }

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed: 0,
    preset
  };
}

/**
 * Depth, line art and normal passes. Seed is 0 and stays 0 for the same reason
 * as Remove Background: there is no sampler in any of these graphs, and every
 * one of these preprocessors is deterministic, so the same layer returns the
 * same map every time.
 *
 * `resolution` is set here rather than left at the template's default. It is
 * the SHORT side the preprocessor works at -- not the output size, which the
 * graph's ImageScale pins to the source -- so it acts purely as a detail dial.
 * Deriving it from the source's own short side means a small layer is not
 * upsampled into invented detail and a large one is not read through a 512px
 * keyhole, and the clamp keeps a 6000px document from asking for a pass that
 * costs minutes for detail no one will see. Rounded to the node's 64px step.
 */
const LAYER_MAP_MIN_DETAIL = 512;
const LAYER_MAP_MAX_DETAIL = 1536;

export function resolveLayerMapDetail(sourceWidth: number, sourceHeight: number): number {
  const shortSide = Math.min(sourceWidth, sourceHeight);
  const clamped = Math.min(Math.max(shortSide, LAYER_MAP_MIN_DETAIL), LAYER_MAP_MAX_DETAIL);

  return Math.round(clamped / 64) * 64;
}

/**
 * The prompt expander. Seed is 0 and stays 0 because the node has none:
 * SuperPrompt-v1 decodes greedily, and the same draft with the same
 * instruction was measured returning a byte-identical expansion twice.
 *
 * 128 tokens by default rather than the node's 4096 ceiling. This is a 248M
 * model; given a long budget it keeps going after it has run out of things to
 * say and starts padding with stock phrasing, so the cap is a quality setting
 * as much as a length one.
 */
const DEFAULT_ENHANCE_PROMPT_INSTRUCTION = "Expand the following prompt to add more detail";
const DEFAULT_ENHANCE_PROMPT_MAX_TOKENS = 128;

export async function buildEnhancePromptWorkflow(
  options: BuildEnhancePromptWorkflowOptions
): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "enhance-prompt-superprompt");
  assertPresetMode(preset, "enhance-prompt");
  assertPresetRunnable(preset);
  const workflow = await cloneWorkflowTemplate(preset);

  validateWorkflowForPreset(workflow, preset);

  setPresetInput(workflow, preset, "positivePrompt", options.draftPrompt, true);
  setPresetInput(workflow, preset, "task", options.instruction ?? DEFAULT_ENHANCE_PROMPT_INSTRUCTION, true);
  setPresetInput(workflow, preset, "numBeams", options.maxNewTokens ?? DEFAULT_ENHANCE_PROMPT_MAX_TOKENS, true);

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed: 0,
    preset
  };
}

export async function buildLayerMapsWorkflow(
  options: BuildLayerMapsWorkflowOptions
): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset(options.presetId ?? "layer-maps-depth");
  assertPresetMode(preset, "layer-maps");
  assertPresetRunnable(preset);
  const workflow = await cloneWorkflowTemplate(preset);

  validateWorkflowForPreset(workflow, preset);

  setPresetInput(workflow, preset, "sourceImage", options.sourceImageName, true);
  setPresetInput(workflow, preset, "width", options.sourceWidth, true);
  setPresetInput(workflow, preset, "height", options.sourceHeight, true);

  // Only the depth preset offers a choice of weights. Line art and normals
  // have no `checkpoint` injection target at all, so asking for one would
  // throw rather than quietly do nothing.
  if (options.modelName && preset.injections.checkpoint) {
    setPresetInput(workflow, preset, "checkpoint", options.modelName, true);
  }

  const detail = resolveLayerMapDetail(options.sourceWidth, options.sourceHeight);

  for (const requirement of preset.requiredNodes) {
    if (requirement.requiredInputs.includes("resolution")) {
      const node = workflow[requirement.id];

      if (node) {
        node.inputs.resolution = detail;
      }
    }
  }

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed: 0,
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

/**
 * Returns the preset's transparency rewiring when it was asked for, or null.
 *
 * `required` separates the two callers. Text to Image only offers the option on
 * presets that have it, so a request anywhere else is a bug and fails loudly;
 * an edit asks whenever the captured layer happens to be a cut-out, and a
 * preset without an alpha channel simply returns an opaque edit.
 */
function resolveTransparentOutput(preset: WorkflowPresetDefinition, requested: boolean, required: boolean) {
  if (!requested) {
    return null;
  }

  if (!preset.transparentOutput) {
    if (required) {
      throw createOpenLayerError(
        "WORKFLOW_INVALID",
        `The ${preset.id} preset cannot return a transparent background.`,
        `Turn Transparent Background off, or choose a preset with a transparentOutput entry in src/comfy/presetRegistry.ts.`
      );
    }

    return null;
  }

  return preset.transparentOutput;
}

/**
 * Points SaveImage past the alpha-dropping step, back at the node that still
 * carries the decode's alpha. Runs after the value injections for the same
 * reason the LoRA splice does: nothing later may overwrite the rewired input.
 */
function applyTransparentOutput(workflow: ComfyWorkflow, transparent: WorkflowTransparentOutput | null) {
  if (!transparent) {
    return;
  }

  requireNodeId(workflow, transparent.rgbaSource);
  setInput(workflow, transparent.saveImage.nodeId, transparent.saveImage.inputName, [transparent.rgbaSource, 0]);
  anchorSavedImage(workflow, transparent.saveImage, "anchor");
}

/**
 * Makes Photoshop see a transparent result's whole canvas, not just its
 * visible pixels.
 *
 * A placed layer's bounds are the box around its non-transparent pixels, and
 * the import aligns that box to the captured position. For a result that is
 * transparent at its edges -- a cutout, a cut-out edit, a feathered selection
 * edit -- the box is smaller than the canvas, so the layer landed shifted by
 * the transparent margin (a selection edit arrived up and to the left of its
 * selection, seen in Photoshop 2026-09-23). Giving the top-left and
 * bottom-right pixels 1% alpha (about 2.5/255, invisible) makes the box the
 * whole canvas again, and the existing alignment puts it exactly back.
 *
 * All core nodes: split off the alpha (as its inverse, SplitImageWithAlpha's
 * convention), multiply it by a mask that is 1 everywhere and 0.99 at the two
 * corners, and rejoin.
 */
function anchorSavedImage(workflow: ComfyWorkflow, saveTarget: WorkflowInputTarget, prefix: string) {
  const save = workflow[saveTarget.nodeId];

  if (!save) {
    throw createOpenLayerError("WORKFLOW_INVALID", `Workflow node ${saveTarget.nodeId} was not found.`);
  }

  const rgba = save.inputs[saveTarget.inputName];
  const id = (name: string) => `${prefix}${name}`;
  const ids = ["split", "size", "full", "dot", "tl", "tlimg", "rot", "br", "corners", "alpha", "join"].map(id);

  for (const nodeId of ids) {
    if (workflow[nodeId]) {
      throw createOpenLayerError("WORKFLOW_INVALID", `The workflow already uses node ${nodeId}.`);
    }
  }

  const node = (class_type: string, inputs: Record<string, unknown>, title: string): ComfyWorkflowNode => ({
    class_type,
    inputs,
    _meta: { title }
  });

  workflow[id("split")] = node("SplitImageWithAlpha", { image: rgba }, "Anchor: Split Alpha");
  workflow[id("size")] = node("GetImageSize", { image: [id("split"), 0] }, "Anchor: Canvas Size");
  workflow[id("full")] = node(
    "SolidMask",
    { value: 1, width: [id("size"), 0], height: [id("size"), 1] },
    "Anchor: Canvas Of Ones"
  );
  workflow[id("dot")] = node("SolidMask", { value: 0.99, width: 1, height: 1 }, "Anchor: One Pixel");
  workflow[id("tl")] = node(
    "MaskComposite",
    { destination: [id("full"), 0], source: [id("dot"), 0], x: 0, y: 0, operation: "multiply" },
    "Anchor: Top-Left"
  );
  workflow[id("tlimg")] = node("MaskToImage", { mask: [id("tl"), 0] }, "Anchor: As Image");
  workflow[id("rot")] = node("ImageRotate", { image: [id("tlimg"), 0], rotation: "180 degrees" }, "Anchor: Rotate To Bottom-Right");
  workflow[id("br")] = node("ImageToMask", { image: [id("rot"), 0], channel: "red" }, "Anchor: Bottom-Right");
  workflow[id("corners")] = node(
    "MaskComposite",
    { destination: [id("tl"), 0], source: [id("br"), 0], x: 0, y: 0, operation: "multiply" },
    "Anchor: Both Corners"
  );
  workflow[id("alpha")] = node(
    "MaskComposite",
    { destination: [id("split"), 1], source: [id("corners"), 0], x: 0, y: 0, operation: "multiply" },
    "Anchor: Apply To Alpha"
  );
  workflow[id("join")] = node(
    "JoinImageWithAlpha",
    { image: [id("split"), 0], alpha: [id("alpha"), 0] },
    "Anchor: Rejoin"
  );

  setInput(workflow, saveTarget.nodeId, saveTarget.inputName, [id("join"), 0]);
}

/**
 * Rewires an edit graph to edit only the selection carried in the source's
 * alpha. Every added node is core ComfyUI (ColorTransfer since 0.37). The
 * shape is the one measured in the v0.36 spike: build a frame that is the
 * original inside the selection and the edit outside it, batch it before the
 * edit, let ColorTransfer compute its transform from that frame alone
 * (`target_frame` 0) and apply it to both, keep the corrected edit, and save
 * it with a feathered copy of the selection as its alpha.
 */
function applySelectionEdit(workflow: ComfyWorkflow, preset: WorkflowPresetDefinition, strength: number) {
  const edit = preset.selectionEdit;

  if (!edit) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `The ${preset.id} preset cannot edit just a selection.`,
      "Choose Qwen-Image 2.1 (edit), or capture a layer or the canvas instead of a selection."
    );
  }

  requireNodeId(workflow, edit.loadImage);
  requireNodeId(workflow, edit.editedImage);

  const id = (name: string) => `${edit.generatedNodeIdPrefix}${name}`;
  const ids = ["ring", "batch", "match", "pick", "maskimg", "blur", "feather", "invert", "rgba"].map(id);

  for (const nodeId of ids) {
    if (workflow[nodeId]) {
      throw createOpenLayerError(
        "WORKFLOW_INVALID",
        `The ${preset.id} workflow already uses node ${nodeId}.`,
        `Give ${preset.id}'s selectionEdit an unused generatedNodeIdPrefix in src/comfy/presetRegistry.ts.`
      );
    }
  }

  const source: [string, number] = [edit.loadImage, 0];
  const selection: [string, number] = [edit.loadImage, 1];
  const edited: [string, number] = [edit.editedImage, 0];
  const node = (class_type: string, inputs: Record<string, unknown>, title: string): ComfyWorkflowNode => ({
    class_type,
    inputs,
    _meta: { title }
  });

  // The alpha of this upload is the selection, not transparency: the encoder
  // must see the plain crop.
  setInput(workflow, edit.encoderImage.nodeId, edit.encoderImage.inputName, source);

  workflow[id("ring")] = node(
    "ImageCompositeMasked",
    { destination: edited, source, x: 0, y: 0, resize_source: false, mask: selection },
    "Selection Edit: Ring-Only Frame"
  );
  workflow[id("batch")] = node("ImageBatch", { image1: [id("ring"), 0], image2: edited }, "Selection Edit: Batch");
  workflow[id("match")] = node(
    "ColorTransfer",
    {
      image_target: [id("batch"), 0],
      image_ref: source,
      method: "reinhard_lab",
      source_stats: "target_frame",
      "source_stats.target_index": 0,
      strength
    },
    "Selection Edit: Match Colour From The Ring"
  );
  workflow[id("pick")] = node(
    "ImageFromBatch",
    { image: [id("match"), 0], batch_index: 1, length: 1 },
    "Selection Edit: Corrected Edit"
  );
  workflow[id("maskimg")] = node("MaskToImage", { mask: selection }, "Selection Edit: Selection As Image");
  workflow[id("blur")] = node(
    "ImageBlur",
    { image: [id("maskimg"), 0], blur_radius: 31, sigma: 10 },
    "Selection Edit: Feather"
  );
  workflow[id("feather")] = node("ImageToMask", { image: [id("blur"), 0], channel: "red" }, "Selection Edit: Feathered Selection");
  // JoinImageWithAlpha stores 1 - mask as alpha (LoadImage's convention), so
  // the feathered selection is inverted first to come out as the alpha.
  workflow[id("invert")] = node("InvertMask", { mask: [id("feather"), 0] }, "Selection Edit: Invert For Alpha");
  workflow[id("rgba")] = node(
    "JoinImageWithAlpha",
    { image: [id("pick"), 0], alpha: [id("invert"), 0] },
    "Selection Edit: Edit With Feathered Alpha"
  );

  setInput(workflow, edit.saveImage.nodeId, edit.saveImage.inputName, [id("rgba"), 0]);
  anchorSavedImage(workflow, edit.saveImage, "anchor");
}

function requireNodeId(workflow: ComfyWorkflow, nodeId: string) {
  if (!workflow[nodeId]) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `Workflow node ${nodeId} was not found.`,
      "Update presetRegistry.ts to match the exported ComfyUI workflow."
    );
  }
}

/**
 * Grows the shipped single reference slot into a chain, one link per captured
 * layer, and points the sampler at the end of it.
 *
 * The shipped graph already contains reference 1 wired end to end, and its
 * filename arrives through the ordinary `sourceImage` injection, so this only
 * has work to do from reference 2 onwards. Each additional reference clones
 * slot 1's `LoadImage -> ImageScaleToTotalPixels -> VAEEncode` triple -- cloning
 * rather than building from scratch keeps the megapixel normalisation and the
 * VAE edge identical to the validated graph without restating them here -- and
 * adds a `ReferenceLatent` to each conditioning branch.
 *
 * Reference 1 stays the size source: `GetImageSize` reads its scaled image, so
 * nothing here touches the latent dimensions.
 */
function applyReferenceChain(
  workflow: ComfyWorkflow,
  preset: WorkflowPresetDefinition,
  referenceImageNames: readonly string[]
) {
  const chain = preset.referenceChain;

  if (!chain) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `The ${preset.id} preset does not support multiple references.`,
      `Add a referenceChain entry for ${preset.id} in src/comfy/presetRegistry.ts.`
    );
  }

  if (referenceImageNames.length === 0) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      "Multi-reference composition needs at least one reference layer.",
      "Capture a layer into the reference list before composing."
    );
  }

  if (referenceImageNames.length > chain.maximumReferences) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `Multi-reference composition accepts at most ${chain.maximumReferences} references, but ${referenceImageNames.length} were supplied.`,
      "Remove a reference from the list, or raise maximumReferences in src/comfy/presetRegistry.ts."
    );
  }

  if (chain.kind === "encoder-image-slots") {
    applyEncoderImageSlots(workflow, preset, chain, referenceImageNames);
    return;
  }

  const templates = {
    load: requireNode(workflow, chain.loadImage, preset),
    scale: requireNode(workflow, chain.scale, preset),
    encode: requireNode(workflow, chain.encode, preset)
  };

  let positiveTail = chain.referenceIntoPositive;
  let negativeTail = chain.referenceIntoNegative;

  for (let index = 1; index < referenceImageNames.length; index += 1) {
    const slot = index + 1;
    const ids = {
      load: `${chain.generatedNodeIdPrefix}${slot}load`,
      scale: `${chain.generatedNodeIdPrefix}${slot}scale`,
      encode: `${chain.generatedNodeIdPrefix}${slot}encode`,
      positive: `${chain.generatedNodeIdPrefix}${slot}pos`,
      negative: `${chain.generatedNodeIdPrefix}${slot}neg`
    };

    for (const id of Object.values(ids)) {
      // A collision would overwrite a real node and still pass validation,
      // which only checks that the required nodes are present.
      if (workflow[id]) {
        throw createOpenLayerError(
          "WORKFLOW_INVALID",
          `The ${preset.id} workflow already uses node ${id}.`,
          `Give ${preset.id}'s referenceChain an unused generatedNodeIdPrefix in src/comfy/presetRegistry.ts.`
        );
      }
    }

    workflow[ids.load] = cloneNode(templates.load, `Load Reference ${slot}`);
    workflow[ids.load].inputs.image = referenceImageNames[index];

    workflow[ids.scale] = cloneNode(templates.scale, `Normalise Reference ${slot} To 1 MP`);
    workflow[ids.scale].inputs.image = [ids.load, 0];

    workflow[ids.encode] = cloneNode(templates.encode, `Encode Reference ${slot}`);
    workflow[ids.encode].inputs.pixels = [ids.scale, 0];

    workflow[ids.positive] = {
      class_type: "ReferenceLatent",
      inputs: {
        conditioning: [positiveTail, 0],
        latent: [ids.encode, 0]
      },
      _meta: { title: `Reference ${slot} Into Positive` }
    };

    workflow[ids.negative] = {
      class_type: "ReferenceLatent",
      inputs: {
        conditioning: [negativeTail, 0],
        latent: [ids.encode, 0]
      },
      _meta: { title: `Reference ${slot} Into Negative` }
    };

    positiveTail = ids.positive;
    negativeTail = ids.negative;
  }

  setInput(workflow, chain.positiveConsumer.nodeId, chain.positiveConsumer.inputName, [positiveTail, 0]);
  setInput(workflow, chain.negativeConsumer.nodeId, chain.negativeConsumer.inputName, [negativeTail, 0]);
}

/**
 * The Qwen-Image 2.1 shape: no conditioning chain, just numbered image inputs
 * on one encoder. Slot 1 ships wired; each further reference clones slot 1's
 * `LoadImage -> JoinImageWithAlpha` pair and plugs it into the next slot, so a
 * transparent layer reaches the encoder with its alpha exactly as reference 1
 * does. Nothing downstream changes -- the encoder already feeds the sampler.
 */
function applyEncoderImageSlots(
  workflow: ComfyWorkflow,
  preset: WorkflowPresetDefinition,
  slots: WorkflowEncoderImageSlots,
  referenceImageNames: readonly string[]
) {
  const templates = {
    load: requireNode(workflow, slots.loadImage, preset),
    keepAlpha: requireNode(workflow, slots.keepAlpha, preset)
  };
  requireNode(workflow, slots.encoder, preset);

  for (let index = 1; index < referenceImageNames.length; index += 1) {
    const slot = index + 1;
    const ids = {
      load: `${slots.generatedNodeIdPrefix}${slot}load`,
      keepAlpha: `${slots.generatedNodeIdPrefix}${slot}alpha`
    };

    for (const id of Object.values(ids)) {
      if (workflow[id]) {
        throw createOpenLayerError(
          "WORKFLOW_INVALID",
          `The ${preset.id} workflow already uses node ${id}.`,
          `Give ${preset.id}'s referenceChain an unused generatedNodeIdPrefix in src/comfy/presetRegistry.ts.`
        );
      }
    }

    workflow[ids.load] = cloneNode(templates.load, `Load Reference ${slot}`);
    workflow[ids.load].inputs.image = referenceImageNames[index];

    workflow[ids.keepAlpha] = cloneNode(templates.keepAlpha, `Keep Reference ${slot} Transparency`);
    workflow[ids.keepAlpha].inputs.image = [ids.load, 0];
    workflow[ids.keepAlpha].inputs.alpha = [ids.load, 1];

    setInput(workflow, slots.encoder, `${slots.inputPrefix}${slot}`, [ids.keepAlpha, 0]);
  }
}

function requireNode(workflow: ComfyWorkflow, nodeId: string, preset: WorkflowPresetDefinition) {
  const node = workflow[nodeId];

  if (!node) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `Workflow node ${nodeId} was not found.`,
      `Update ${preset.id}'s referenceChain in presetRegistry.ts to match the exported ComfyUI workflow.`
    );
  }

  return node;
}

function cloneNode(node: ComfyWorkflowNode, title: string): ComfyWorkflowNode {
  return {
    class_type: node.class_type,
    inputs: JSON.parse(JSON.stringify(node.inputs)) as Record<string, unknown>,
    _meta: { title }
  };
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
