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
import {
  BuildInpaintWorkflowOptions,
  BuildImageToImageWorkflowOptions,
  BuildMultiReferenceWorkflowOptions,
  BuildOutpaintWorkflowOptions,
  BuildPromptFromLayerWorkflowOptions,
  BuildSketchToImageWorkflowOptions,
  BuildStyleReferenceWorkflowOptions,
  BuildUnflattenWorkflowOptions,
  BuildUpscaleWorkflowOptions,
  BuildWorkflowOptions,
  BuildWorkflowResult,
  ComfyWorkflow,
  ComfyWorkflowNode,
  WorkflowLoraSelection,
  WorkflowPreset,
  WorkflowPresetDefinition,
  WorkflowInjectionTargetList
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
  "multi-reference-flux2-klein": multiReferenceFlux2KleinWorkflow as ComfyWorkflow
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
