import {
  ComfyWorkflow,
  WorkflowInputTarget,
  WorkflowPreset,
  WorkflowPresetDefinition,
  WorkflowNodeRequirement
} from "./types";
import { createOpenLayerError } from "../utils/errors";

const CHECKPOINT_MODEL_SOURCE = {
  kind: "checkpoint",
  objectInfoNode: "CheckpointLoaderSimple",
  inputName: "ckpt_name",
  label: "Checkpoint"
} as const;

const DIFFUSION_MODEL_SOURCE = {
  kind: "diffusion-model-stack",
  objectInfoNode: "UNETLoader",
  inputName: "unet_name",
  label: "Diffusion model"
} as const;

const Z_IMAGE_TURBO_STACK = [
  {
    kind: "diffusion-model-stack",
    objectInfoNode: "UNETLoader",
    inputName: "unet_name",
    label: "Z_image_Turbo diffusion model",
    modelName: "z_image_turbo_bf16.safetensors",
    setupHint: "Install z_image_turbo_bf16.safetensors where ComfyUI's UNETLoader can find it."
  },
  {
    kind: "clip",
    objectInfoNode: "CLIPLoader",
    inputName: "clip_name",
    label: "Z_image_Turbo CLIP",
    modelName: "qwen_3_4b.safetensors",
    setupHint: "Install qwen_3_4b.safetensors where ComfyUI's CLIPLoader can find it."
  },
  {
    kind: "vae",
    objectInfoNode: "VAELoader",
    inputName: "vae_name",
    label: "Z_image_Turbo VAE",
    modelName: "ae.safetensors",
    setupHint: "Install ae.safetensors where ComfyUI's VAELoader can find it."
  }
] as const;

const FLUX1_DEV_STACK = [
  {
    kind: "diffusion-model-stack",
    objectInfoNode: "UNETLoader",
    inputName: "unet_name",
    label: "Flux diffusion model",
    modelName: "flux1-dev.safetensors",
    setupHint: "Install flux1-dev.safetensors where ComfyUI's UNETLoader can find it."
  }
] as const;

const TXT2IMG_BASIC_NODES = {
  checkpointLoader: "4",
  positivePrompt: "6",
  negativePrompt: "7",
  sampler: "3",
  latentImage: "5",
  saveImage: "9"
} as const;

const IMG2IMG_BASIC_NODES = {
  checkpointLoader: "4",
  loadImage: "10",
  positivePrompt: "6",
  negativePrompt: "7",
  vaeEncode: "11",
  sampler: "3",
  saveImage: "9"
} as const;

const SKETCH2IMG_LINECN_BASIC_NODES = {
  checkpointLoader: "4",
  loadImage: "10",
  positivePrompt: "6",
  negativePrompt: "7",
  vaeEncode: "11",
  lineArtPreprocessor: "12",
  controlNetLoader: "13",
  controlNetApply: "14",
  sampler: "3",
  saveImage: "9"
} as const;

const TXT2IMG_BASIC_INJECTIONS = {
  checkpoint: target(TXT2IMG_BASIC_NODES.checkpointLoader, "ckpt_name"),
  positivePrompt: target(TXT2IMG_BASIC_NODES.positivePrompt, "text"),
  negativePrompt: target(TXT2IMG_BASIC_NODES.negativePrompt, "text"),
  width: target(TXT2IMG_BASIC_NODES.latentImage, "width"),
  height: target(TXT2IMG_BASIC_NODES.latentImage, "height"),
  seed: target(TXT2IMG_BASIC_NODES.sampler, "seed"),
  steps: target(TXT2IMG_BASIC_NODES.sampler, "steps"),
  cfg: target(TXT2IMG_BASIC_NODES.sampler, "cfg")
} as const;

const IMG2IMG_BASIC_INJECTIONS = {
  checkpoint: target(IMG2IMG_BASIC_NODES.checkpointLoader, "ckpt_name"),
  sourceImage: target(IMG2IMG_BASIC_NODES.loadImage, "image"),
  positivePrompt: target(IMG2IMG_BASIC_NODES.positivePrompt, "text"),
  negativePrompt: target(IMG2IMG_BASIC_NODES.negativePrompt, "text"),
  seed: target(IMG2IMG_BASIC_NODES.sampler, "seed"),
  steps: target(IMG2IMG_BASIC_NODES.sampler, "steps"),
  cfg: target(IMG2IMG_BASIC_NODES.sampler, "cfg"),
  denoise: target(IMG2IMG_BASIC_NODES.sampler, "denoise")
} as const;

const SKETCH2IMG_LINECN_BASIC_INJECTIONS = {
  checkpoint: target(SKETCH2IMG_LINECN_BASIC_NODES.checkpointLoader, "ckpt_name"),
  sourceImage: target(SKETCH2IMG_LINECN_BASIC_NODES.loadImage, "image"),
  positivePrompt: target(SKETCH2IMG_LINECN_BASIC_NODES.positivePrompt, "text"),
  negativePrompt: target(SKETCH2IMG_LINECN_BASIC_NODES.negativePrompt, "text"),
  seed: target(SKETCH2IMG_LINECN_BASIC_NODES.sampler, "seed"),
  steps: target(SKETCH2IMG_LINECN_BASIC_NODES.sampler, "steps"),
  cfg: target(SKETCH2IMG_LINECN_BASIC_NODES.sampler, "cfg"),
  denoise: target(SKETCH2IMG_LINECN_BASIC_NODES.sampler, "denoise"),
  controlStrength: target(SKETCH2IMG_LINECN_BASIC_NODES.controlNetApply, "strength")
} as const;

export const WORKFLOW_PRESETS: WorkflowPresetDefinition[] = [
  {
    id: "txt2img-basic",
    label: "txt2img-basic",
    mode: "txt2img",
    description: "Basic local text-to-image generation through ComfyUI.",
    workflowFile: "workflows/api/txt2img-basic.json",
    sourceWorkflowFile: "workflows/source/txt2img-basic.workflow.json",
    status: "stable",
    supportedModelFamilies: ["sd1", "sdxl", "unknown"],
    experimentalModelFamilies: ["sd3", "flux", "zImage"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    injections: TXT2IMG_BASIC_INJECTIONS,
    compatibilityNote: "txt2img-basic uses the standard CheckpointLoaderSimple SD/SDXL workflow.",
    requiredNodes: [
      {
        id: TXT2IMG_BASIC_NODES.checkpointLoader,
        classType: "CheckpointLoaderSimple",
        requiredInputs: ["ckpt_name"]
      },
      {
        id: TXT2IMG_BASIC_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: TXT2IMG_BASIC_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: TXT2IMG_BASIC_NODES.latentImage,
        classType: "EmptyLatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: TXT2IMG_BASIC_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["seed", "steps", "cfg", "denoise", "model", "positive", "negative", "latent_image"]
      },
      {
        id: TXT2IMG_BASIC_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ]
  },
  {
    id: "img2img-basic",
    label: "img2img-basic",
    mode: "img2img",
    description: "Basic local image-to-image generation using an uploaded source image.",
    workflowFile: "workflows/api/img2img-basic.json",
    sourceWorkflowFile: "workflows/source/img2img-basic.workflow.json",
    status: "stable",
    supportedModelFamilies: ["sd1", "sdxl", "unknown"],
    experimentalModelFamilies: ["sd3", "flux", "zImage"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    injections: IMG2IMG_BASIC_INJECTIONS,
    compatibilityNote: "img2img-basic uses the standard CheckpointLoaderSimple, LoadImage, and VAEEncode SD/SDXL workflow.",
    requiredNodes: [
      {
        id: IMG2IMG_BASIC_NODES.checkpointLoader,
        classType: "CheckpointLoaderSimple",
        requiredInputs: ["ckpt_name"]
      },
      {
        id: IMG2IMG_BASIC_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: IMG2IMG_BASIC_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: IMG2IMG_BASIC_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: IMG2IMG_BASIC_NODES.vaeEncode,
        classType: "VAEEncode",
        requiredInputs: ["pixels", "vae"]
      },
      {
        id: IMG2IMG_BASIC_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["seed", "steps", "cfg", "denoise", "model", "positive", "negative", "latent_image"]
      },
      {
        id: IMG2IMG_BASIC_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ]
  },
  {
    id: "sketch2img-linecn-basic",
    label: "sketch2img-linecn-basic",
    mode: "sketch2img",
    description: "Experimental SD 1.x LineArt ControlNet sketch guidance workflow.",
    workflowFile: "workflows/api/sketch2img-linecn-basic.json",
    sourceWorkflowFile: "workflows/source/sketch2img-linecn-basic.workflow.json",
    status: "experimental",
    supportedModelFamilies: ["sd1"],
    experimentalModelFamilies: ["sdxl", "sd3", "flux", "zImage"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    injections: SKETCH2IMG_LINECN_BASIC_INJECTIONS,
    compatibilityNote:
      "sketch2img-linecn-basic is a starter SD 1.x LineArt ControlNet workflow. Use an SD 1.x checkpoint and an SD 1.5 LineArt ControlNet model.",
    requiredModels: [
      {
        kind: "controlnet",
        objectInfoNode: "ControlNetLoader",
        inputName: "control_net_name",
        label: "LineArt ControlNet",
        modelName: "control_v11p_sd15_lineart_fp16.safetensors",
        setupHint: "Install an SD 1.5 LineArt ControlNet model in ComfyUI's controlnet models folder."
      }
    ],
    requiredNodes: [
      {
        id: SKETCH2IMG_LINECN_BASIC_NODES.checkpointLoader,
        classType: "CheckpointLoaderSimple",
        requiredInputs: ["ckpt_name"]
      },
      {
        id: SKETCH2IMG_LINECN_BASIC_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: SKETCH2IMG_LINECN_BASIC_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: SKETCH2IMG_LINECN_BASIC_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: SKETCH2IMG_LINECN_BASIC_NODES.vaeEncode,
        classType: "VAEEncode",
        requiredInputs: ["pixels", "vae"]
      },
      {
        id: SKETCH2IMG_LINECN_BASIC_NODES.lineArtPreprocessor,
        classType: "LineArtPreprocessor",
        requiredInputs: ["image"]
      },
      {
        id: SKETCH2IMG_LINECN_BASIC_NODES.controlNetLoader,
        classType: "ControlNetLoader",
        requiredInputs: ["control_net_name"]
      },
      {
        id: SKETCH2IMG_LINECN_BASIC_NODES.controlNetApply,
        classType: "ControlNetApplyAdvanced",
        requiredInputs: ["positive", "negative", "control_net", "image", "strength", "start_percent", "end_percent"]
      },
      {
        id: SKETCH2IMG_LINECN_BASIC_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["seed", "steps", "cfg", "denoise", "model", "positive", "negative", "latent_image"]
      },
      {
        id: SKETCH2IMG_LINECN_BASIC_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ]
  },
  {
    id: "inpaint-basic",
    label: "inpaint-basic",
    mode: "inpaint",
    description: "Future selection-aware inpainting workflow using a source image and mask.",
    workflowFile: "workflows/api/inpaint-basic.json",
    sourceWorkflowFile: "workflows/source/inpaint-basic.workflow.json",
    status: "todo",
    supportedModelFamilies: ["sd1", "sdxl"],
    experimentalModelFamilies: ["sd3", "flux", "zImage", "unknown"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    injections: {},
    requiredNodes: [],
    compatibilityNote:
      "inpaint-basic is a placeholder for mask-based Photoshop selection workflows. Selection capture is available, but generation needs a validated ComfyUI API workflow JSON.",
    disabledReason:
      "No validated OpenLayer API workflow JSON exists yet for inpaint-basic. Capture Selection is available now; generation is intentionally disabled until mask mapping is verified."
  },
  {
    id: "txt2img-z-image-turbo",
    label: "txt2img-z-image-turbo",
    mode: "txt2img",
    description: "Future text-to-image preset for the Z_image_Turbo diffusion model stack.",
    workflowFile: "workflows/api/txt2img-z-image-turbo.json",
    sourceWorkflowFile: "workflows/source/txt2img-z-image-turbo.workflow.json",
    status: "todo",
    supportedModelFamilies: ["zImage"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    modelStack: [...Z_IMAGE_TURBO_STACK],
    injections: {},
    requiredNodes: [
      {
        id: "todo-unet-loader",
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: "todo-clip-loader",
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: "todo-vae-loader",
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: "todo-lumina2-encode",
        classType: "CLIPTextEncodeLumina2",
        requiredInputs: ["system_prompt", "user_prompt", "clip"]
      }
    ],
    compatibilityNote:
      "Z_image_Turbo is a diffusion model stack, not a checkpoint. It needs a dedicated validated API workflow before generation is enabled.",
    disabledReason: "No validated OpenLayer API workflow JSON exists yet for Z_image_Turbo."
  },
  {
    id: "img2img-z-image-turbo",
    label: "img2img-z-image-turbo",
    mode: "img2img",
    description: "Future image-to-image preset for the Z_image_Turbo diffusion model stack.",
    workflowFile: "workflows/api/img2img-z-image-turbo.json",
    sourceWorkflowFile: "workflows/source/img2img-z-image-turbo.workflow.json",
    status: "todo",
    supportedModelFamilies: ["zImage"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    modelStack: [...Z_IMAGE_TURBO_STACK],
    injections: {},
    requiredNodes: [
      {
        id: "todo-unet-loader",
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: "todo-clip-loader",
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: "todo-vae-loader",
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: "todo-lumina2-encode",
        classType: "CLIPTextEncodeLumina2",
        requiredInputs: ["system_prompt", "user_prompt", "clip"]
      }
    ],
    compatibilityNote:
      "Z_image_Turbo image-to-image needs a dedicated source-image workflow. It should not use img2img-basic.",
    disabledReason: "No validated OpenLayer API workflow JSON exists yet for Z_image_Turbo Image to Image."
  },
  {
    id: "txt2img-flux1-dev",
    label: "txt2img-flux1-dev",
    mode: "txt2img",
    description: "Future text-to-image preset for Flux.1-dev style diffusion model stacks.",
    workflowFile: "workflows/api/txt2img-flux1-dev.json",
    sourceWorkflowFile: "workflows/source/txt2img-flux1-dev.workflow.json",
    status: "todo",
    supportedModelFamilies: ["flux"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    modelStack: [...FLUX1_DEV_STACK],
    injections: {},
    requiredNodes: [
      {
        id: "todo-unet-loader",
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: "todo-dual-clip-loader",
        classType: "DualCLIPLoader",
        requiredInputs: ["clip_name1", "clip_name2", "type"]
      },
      {
        id: "todo-flux-encode",
        classType: "CLIPTextEncodeFlux",
        requiredInputs: ["clip", "clip_l", "t5xxl", "guidance"]
      }
    ],
    compatibilityNote:
      "Flux needs dedicated UNET, CLIP/T5, VAE, and conditioning workflow nodes before generation is enabled.",
    disabledReason: "No validated OpenLayer API workflow JSON exists yet for Flux.1-dev."
  },
  {
    id: "img2img-flux1-dev",
    label: "img2img-flux1-dev",
    mode: "img2img",
    description: "Future image-to-image preset for Flux.1-dev style diffusion model stacks.",
    workflowFile: "workflows/api/img2img-flux1-dev.json",
    sourceWorkflowFile: "workflows/source/img2img-flux1-dev.workflow.json",
    status: "todo",
    supportedModelFamilies: ["flux"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    modelStack: [...FLUX1_DEV_STACK],
    injections: {},
    requiredNodes: [
      {
        id: "todo-unet-loader",
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: "todo-dual-clip-loader",
        classType: "DualCLIPLoader",
        requiredInputs: ["clip_name1", "clip_name2", "type"]
      },
      {
        id: "todo-flux-encode",
        classType: "CLIPTextEncodeFlux",
        requiredInputs: ["clip", "clip_l", "t5xxl", "guidance"]
      }
    ],
    compatibilityNote:
      "Flux Image to Image needs a dedicated source-image workflow. It should not use img2img-basic.",
    disabledReason: "No validated OpenLayer API workflow JSON exists yet for Flux.1-dev Image to Image."
  }
];

export function listWorkflowPresets(mode?: WorkflowPresetDefinition["mode"]) {
  return mode ? WORKFLOW_PRESETS.filter((preset) => preset.mode === mode) : WORKFLOW_PRESETS;
}

export function listRunnableWorkflowPresets(mode?: WorkflowPresetDefinition["mode"]) {
  return listWorkflowPresets(mode).filter((preset) => preset.status !== "todo");
}

export function getWorkflowPreset(presetId: string): WorkflowPresetDefinition {
  const preset = WORKFLOW_PRESETS.find((candidate) => candidate.id === presetId);

  if (!preset) {
    throw createOpenLayerError(
      "WORKFLOW_PRESET_UNSUPPORTED",
      `Unsupported workflow preset: ${presetId || "none selected"}.`
    );
  }

  return preset;
}

export function isWorkflowPreset(presetId: string): presetId is WorkflowPreset {
  return WORKFLOW_PRESETS.some((preset) => preset.id === presetId);
}

export function getPresetInputTarget(
  preset: WorkflowPresetDefinition,
  inputName: keyof WorkflowPresetDefinition["injections"],
  options: { required?: boolean } = {}
): WorkflowInputTarget | null {
  const target = preset.injections[inputName];

  if (!target && options.required) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `The ${preset.id} preset is missing the "${inputName}" workflow injection target.`,
      "Update presetRegistry.ts after exporting the matching ComfyUI API workflow."
    );
  }

  return target ?? null;
}

export function validateWorkflowForPreset(workflow: ComfyWorkflow, preset: WorkflowPresetDefinition) {
  const problems: string[] = [];

  for (const requirement of preset.requiredNodes) {
    validateRequiredNode(workflow, requirement, problems);
  }

  if (problems.length > 0) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `The ${preset.id} workflow does not match the expected starter workflow.`,
      [
        ...problems,
        `Remap ${preset.id} in src/comfy/presetRegistry.ts after exporting the matching ComfyUI API workflow.`
      ].join(" ")
    );
  }
}

function target(nodeId: string, inputName: string): WorkflowInputTarget {
  return {
    nodeId,
    inputName
  };
}

function validateRequiredNode(
  workflow: ComfyWorkflow,
  requirement: WorkflowNodeRequirement,
  problems: string[]
) {
  const node = workflow[requirement.id];

  if (!node) {
    problems.push(`Missing node ${requirement.id} (${requirement.classType}).`);
    return;
  }

  if (node.class_type !== requirement.classType) {
    problems.push(
      `Node ${requirement.id} should be ${requirement.classType}, but found ${node.class_type || "unknown"}.`
    );
  }

  for (const inputName of requirement.requiredInputs) {
    if (!Object.prototype.hasOwnProperty.call(node.inputs, inputName)) {
      problems.push(
        `Node ${requirement.id} (${requirement.classType}) is missing input "${inputName}".`
      );
    }
  }
}
