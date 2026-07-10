import {
  ComfyWorkflow,
  WorkflowInputTarget,
  WorkflowInjectionTargetList,
  WorkflowCapability,
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

const FLORENCE_MODEL_SOURCE = {
  kind: "vision-language",
  objectInfoNode: "Florence2ModelLoader",
  inputName: "model",
  label: "Florence model"
} as const;

const UPSCALE_MODEL_SOURCE = {
  kind: "upscale",
  objectInfoNode: "UpscaleModelLoader",
  inputName: "model_name",
  label: "Upscale model"
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

const FLUX1_DEV_FP8_CHECKPOINT = {
  kind: "checkpoint",
  objectInfoNode: "CheckpointLoaderSimple",
  inputName: "ckpt_name",
  label: "Flux1-dev fp8 checkpoint",
  modelName: "flux1-dev-fp8.safetensors",
  setupHint: "Install flux1-dev-fp8.safetensors where ComfyUI's CheckpointLoaderSimple can find it."
} as const;

const FLORENCE2_PROMPTGEN_MODEL = {
  kind: "vision-language",
  objectInfoNode: "Florence2ModelLoader",
  inputName: "model",
  label: "Florence-2 PromptGen model",
  modelName: "Florence-2-base-PromptGen-v2.0",
  setupHint: "Install Florence-2-base-PromptGen-v2.0 where ComfyUI's Florence2ModelLoader can find it."
} as const;

const UPSCALE_BASIC_MODEL = {
  kind: "upscale",
  objectInfoNode: "UpscaleModelLoader",
  inputName: "model_name",
  label: "Upscale model",
  modelName: "4x-UltraSharp.pth",
  acceptedModelNames: ["RealESRGAN_x4plus.pth"],
  setupHint: "Install 4x-UltraSharp.pth or RealESRGAN_x4plus.pth where ComfyUI's UpscaleModelLoader can find it."
} as const;

const TXT2IMG_BASIC_NODES = {
  checkpointLoader: "4",
  positivePrompt: "6",
  negativePrompt: "7",
  sampler: "3",
  latentImage: "5",
  saveImage: "9"
} as const;

const FLUX1_DEV_FP8_TXT2IMG_NODES = {
  checkpointLoader: "30",
  positivePrompt: "6",
  negativePrompt: "33",
  fluxGuidance: "35",
  latentImage: "27",
  sampler: "31",
  decode: "8",
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

const INPAINT_BASIC_NODES = {
  checkpointLoader: "4",
  loadImage: "10",
  loadMaskImage: "12",
  imageToMask: "13",
  positivePrompt: "6",
  negativePrompt: "7",
  inpaintConditioning: "11",
  sampler: "3",
  compositeMasked: "14",
  saveImage: "9"
} as const;

const INPAINT_FLUX_FILL_BASIC_NODES = {
  diffusionModelLoader: "31",
  differentialDiffusion: "39",
  dualClipLoader: "34",
  vaeLoader: "32",
  loadImage: "17",
  positivePrompt: "23",
  fluxGuidance: "26",
  negativeConditioning: "46",
  inpaintConditioning: "38",
  sampler: "3",
  decode: "8",
  saveImage: "9"
} as const;

const OUTPAINT_FLUX_FILL_BASIC_NODES = {
  diffusionModelLoader: "31",
  differentialDiffusion: "39",
  dualClipLoader: "34",
  vaeLoader: "32",
  loadImage: "17",
  imagePad: "44",
  positivePrompt: "23",
  fluxGuidance: "26",
  negativeConditioning: "46",
  outpaintConditioning: "38",
  sampler: "3",
  decode: "8",
  saveImage: "9"
} as const;

const Z_IMAGE_TURBO_TXT2IMG_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  modelSampling: "23",
  latentImage: "5",
  positivePrompt: "6",
  negativePrompt: "7",
  sampler: "3",
  decode: "8",
  saveImage: "9"
} as const;

const Z_IMAGE_TURBO_IMG2IMG_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  modelSampling: "23",
  loadImage: "10",
  vaeEncode: "11",
  positivePrompt: "6",
  negativePrompt: "7",
  sampler: "3",
  decode: "8",
  saveImage: "9"
} as const;

const PROMPT_FROM_LAYER_FLORENCE2_NODES = {
  modelLoader: "39",
  loadImage: "42",
  florenceRun: "38",
  showText: "45"
} as const;

const UPSCALE_BASIC_NODES = {
  loadImage: "10",
  upscaleModelLoader: "11",
  imageUpscale: "12",
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

const FLUX1_DEV_FP8_TXT2IMG_INJECTIONS = {
  checkpoint: target(FLUX1_DEV_FP8_TXT2IMG_NODES.checkpointLoader, "ckpt_name"),
  positivePrompt: target(FLUX1_DEV_FP8_TXT2IMG_NODES.positivePrompt, "text"),
  negativePrompt: target(FLUX1_DEV_FP8_TXT2IMG_NODES.negativePrompt, "text"),
  width: target(FLUX1_DEV_FP8_TXT2IMG_NODES.latentImage, "width"),
  height: target(FLUX1_DEV_FP8_TXT2IMG_NODES.latentImage, "height"),
  seed: target(FLUX1_DEV_FP8_TXT2IMG_NODES.sampler, "seed"),
  steps: target(FLUX1_DEV_FP8_TXT2IMG_NODES.sampler, "steps"),
  cfg: target(FLUX1_DEV_FP8_TXT2IMG_NODES.fluxGuidance, "guidance")
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

const INPAINT_BASIC_INJECTIONS = {
  checkpoint: target(INPAINT_BASIC_NODES.checkpointLoader, "ckpt_name"),
  sourceImage: target(INPAINT_BASIC_NODES.loadImage, "image"),
  maskImage: target(INPAINT_BASIC_NODES.loadMaskImage, "image"),
  positivePrompt: target(INPAINT_BASIC_NODES.positivePrompt, "text"),
  negativePrompt: target(INPAINT_BASIC_NODES.negativePrompt, "text"),
  seed: target(INPAINT_BASIC_NODES.sampler, "seed"),
  steps: target(INPAINT_BASIC_NODES.sampler, "steps"),
  cfg: target(INPAINT_BASIC_NODES.sampler, "cfg"),
  denoise: target(INPAINT_BASIC_NODES.sampler, "denoise")
} as const;

const INPAINT_FLUX_FILL_BASIC_INJECTIONS = {
  checkpoint: target(INPAINT_FLUX_FILL_BASIC_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(INPAINT_FLUX_FILL_BASIC_NODES.loadImage, "image"),
  positivePrompt: target(INPAINT_FLUX_FILL_BASIC_NODES.positivePrompt, "text"),
  seed: target(INPAINT_FLUX_FILL_BASIC_NODES.sampler, "seed"),
  steps: target(INPAINT_FLUX_FILL_BASIC_NODES.sampler, "steps"),
  cfg: target(INPAINT_FLUX_FILL_BASIC_NODES.fluxGuidance, "guidance"),
  denoise: target(INPAINT_FLUX_FILL_BASIC_NODES.sampler, "denoise")
} as const;

const OUTPAINT_FLUX_FILL_BASIC_INJECTIONS = {
  checkpoint: target(OUTPAINT_FLUX_FILL_BASIC_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(OUTPAINT_FLUX_FILL_BASIC_NODES.loadImage, "image"),
  positivePrompt: target(OUTPAINT_FLUX_FILL_BASIC_NODES.positivePrompt, "text"),
  seed: target(OUTPAINT_FLUX_FILL_BASIC_NODES.sampler, "seed"),
  steps: target(OUTPAINT_FLUX_FILL_BASIC_NODES.sampler, "steps"),
  cfg: target(OUTPAINT_FLUX_FILL_BASIC_NODES.fluxGuidance, "guidance"),
  denoise: target(OUTPAINT_FLUX_FILL_BASIC_NODES.sampler, "denoise"),
  outpaintLeft: target(OUTPAINT_FLUX_FILL_BASIC_NODES.imagePad, "left"),
  outpaintTop: target(OUTPAINT_FLUX_FILL_BASIC_NODES.imagePad, "top"),
  outpaintRight: target(OUTPAINT_FLUX_FILL_BASIC_NODES.imagePad, "right"),
  outpaintBottom: target(OUTPAINT_FLUX_FILL_BASIC_NODES.imagePad, "bottom"),
  outpaintFeathering: target(OUTPAINT_FLUX_FILL_BASIC_NODES.imagePad, "feathering")
} as const;

const Z_IMAGE_TURBO_TXT2IMG_INJECTIONS = {
  checkpoint: target(Z_IMAGE_TURBO_TXT2IMG_NODES.diffusionModelLoader, "unet_name"),
  positivePrompt: target(Z_IMAGE_TURBO_TXT2IMG_NODES.positivePrompt, "text"),
  negativePrompt: target(Z_IMAGE_TURBO_TXT2IMG_NODES.negativePrompt, "text"),
  width: target(Z_IMAGE_TURBO_TXT2IMG_NODES.latentImage, "width"),
  height: target(Z_IMAGE_TURBO_TXT2IMG_NODES.latentImage, "height"),
  seed: target(Z_IMAGE_TURBO_TXT2IMG_NODES.sampler, "seed"),
  steps: target(Z_IMAGE_TURBO_TXT2IMG_NODES.sampler, "steps"),
  cfg: target(Z_IMAGE_TURBO_TXT2IMG_NODES.sampler, "cfg")
} as const;

const Z_IMAGE_TURBO_IMG2IMG_INJECTIONS = {
  checkpoint: target(Z_IMAGE_TURBO_IMG2IMG_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(Z_IMAGE_TURBO_IMG2IMG_NODES.loadImage, "image"),
  positivePrompt: target(Z_IMAGE_TURBO_IMG2IMG_NODES.positivePrompt, "text"),
  negativePrompt: target(Z_IMAGE_TURBO_IMG2IMG_NODES.negativePrompt, "text"),
  seed: target(Z_IMAGE_TURBO_IMG2IMG_NODES.sampler, "seed"),
  steps: target(Z_IMAGE_TURBO_IMG2IMG_NODES.sampler, "steps"),
  cfg: target(Z_IMAGE_TURBO_IMG2IMG_NODES.sampler, "cfg"),
  denoise: target(Z_IMAGE_TURBO_IMG2IMG_NODES.sampler, "denoise")
} as const;

const PROMPT_FROM_LAYER_FLORENCE2_INJECTIONS = {
  sourceImage: target(PROMPT_FROM_LAYER_FLORENCE2_NODES.loadImage, "image"),
  task: target(PROMPT_FROM_LAYER_FLORENCE2_NODES.florenceRun, "task"),
  numBeams: target(PROMPT_FROM_LAYER_FLORENCE2_NODES.florenceRun, "num_beams"),
  seed: target(PROMPT_FROM_LAYER_FLORENCE2_NODES.florenceRun, "seed")
} as const;

const UPSCALE_BASIC_INJECTIONS = {
  sourceImage: target(UPSCALE_BASIC_NODES.loadImage, "image"),
  checkpoint: target(UPSCALE_BASIC_NODES.upscaleModelLoader, "model_name")
} as const;

const FLUX_FILL_STACK = [
  {
    kind: "diffusion-model-stack",
    objectInfoNode: "UNETLoader",
    inputName: "unet_name",
    label: "Flux Fill diffusion model",
    modelName: "flux1-fill-dev.safetensors",
    setupHint: "Install flux1-fill-dev.safetensors where ComfyUI's UNETLoader can find it."
  },
  // The working Flux Fill reference maps CLIP-L to clip_name1 and T5 to
  // clip_name2 on DualCLIPLoader. Keep this metadata in sync with
  // workflows/api/inpaint-flux-fill-basic.json if a local export changes it.
  {
    kind: "clip",
    objectInfoNode: "DualCLIPLoader",
    inputName: "clip_name1",
    label: "Flux CLIP-L",
    modelName: "clip_l.safetensors",
    setupHint: "Install clip_l.safetensors in ComfyUI models/text_encoders."
  },
  {
    kind: "clip",
    objectInfoNode: "DualCLIPLoader",
    inputName: "clip_name2",
    label: "Flux text encoder",
    modelName: "t5xxl_fp16.safetensors",
    acceptedModelNames: ["t5xxl_fp8_e4m3fn.safetensors"],
    setupHint:
      "Install t5xxl_fp16.safetensors in ComfyUI models/text_encoders. t5xxl_fp8_e4m3fn.safetensors is accepted as a local fallback when available."
  },
  {
    kind: "vae",
    objectInfoNode: "VAELoader",
    inputName: "vae_name",
    label: "Flux VAE",
    modelName: "ae.safetensors",
    setupHint: "Install ae.safetensors where ComfyUI's VAELoader can find it."
  }
] as const;

const TXT2IMG_BASIC_CAPABILITY: WorkflowCapability = {
  toolType: "txt2img",
  loaderType: "checkpoint",
  artistLabel: "Text to Image",
  technicalLabel: "txt2img-basic",
  requiredPhotoshopInputs: [],
  controls: ["prompt", "negativePrompt", "width", "height", "steps", "cfg", "seed"],
  output: {
    kind: "full-image",
    size: "preset",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Checkpoint",
    primaryActionLabel: "Generate"
  }
};

const FLUX1_DEV_FP8_TXT2IMG_CAPABILITY: WorkflowCapability = {
  toolType: "txt2img",
  loaderType: "checkpoint",
  artistLabel: "Text to Image",
  technicalLabel: "txt2img-flux1-dev-fp8",
  requiredPhotoshopInputs: [],
  controls: ["prompt", "negativePrompt", "width", "height", "steps", "guidance", "seed"],
  output: {
    kind: "full-image",
    size: "preset",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Flux checkpoint",
    primaryActionLabel: "Generate",
    experimentalNote:
      "Flux1-dev fp8 uses a checkpoint-style ComfyUI graph. The UI CFG value controls Flux guidance while sampler CFG stays 1."
  }
};

const IMG2IMG_BASIC_CAPABILITY: WorkflowCapability = {
  toolType: "img2img",
  loaderType: "checkpoint",
  artistLabel: "Image to Image",
  technicalLabel: "img2img-basic",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "denoise", "seed"],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Checkpoint",
    primaryActionLabel: "Generate Image to Image"
  }
};

const SKETCH2IMG_LINECN_BASIC_CAPABILITY: WorkflowCapability = {
  toolType: "sketch2img",
  loaderType: "checkpoint",
  artistLabel: "Sketch to Image",
  technicalLabel: "sketch2img-linecn-basic",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "denoise", "seed", "controlStrength"],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Checkpoint",
    primaryActionLabel: "Generate Sketch to Image",
    experimentalNote: "Starter SD 1.x LineArt ControlNet workflow."
  }
};

const INPAINT_BASIC_CAPABILITY: WorkflowCapability = {
  toolType: "inpaint",
  loaderType: "checkpoint",
  artistLabel: "Inpaint",
  technicalLabel: "inpaint-basic",
  requiredPhotoshopInputs: ["selection", "selection-mask"],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "denoise", "seed", "contextPadding"],
  output: {
    kind: "selection-patch",
    size: "selection-context",
    importBehavior: "aligned-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Checkpoint",
    primaryActionLabel: "Generate Inpaint",
    warning: "Inpaint/Repaint Selection is experimental until Photoshop alignment and output quality are confirmed."
  }
};

const INPAINT_FLUX_FILL_BASIC_CAPABILITY: WorkflowCapability = {
  toolType: "inpaint",
  loaderType: "diffusion-model-stack",
  artistLabel: "Inpaint",
  technicalLabel: "inpaint-flux-fill-basic",
  requiredPhotoshopInputs: ["selection", "selection-mask"],
  controls: ["prompt", "negativePrompt", "steps", "guidance", "denoise", "seed", "contextPadding", "maskBlur"],
  output: {
    kind: "selection-patch",
    size: "selection-context",
    importBehavior: "aligned-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Flux Fill model",
    primaryActionLabel: "Generate Inpaint",
    warning: "Flux Fill is experimental and may require guidance, denoise, mask blur, and context-size tuning."
  }
};

const OUTPAINT_FLUX_FILL_BASIC_CAPABILITY: WorkflowCapability = {
  toolType: "outpaint",
  loaderType: "diffusion-model-stack",
  artistLabel: "Outpaint",
  technicalLabel: "outpaint-flux-fill-basic",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: [
    "prompt",
    "steps",
    "guidance",
    "denoise",
    "seed",
    "outpaintLeft",
    "outpaintTop",
    "outpaintRight",
    "outpaintBottom",
    "outpaintFeathering"
  ],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Flux Fill model",
    primaryActionLabel: "Generate Outpaint",
    warning: "Outpaint is experimental and uses Flux Fill with ImagePadForOutpaint."
  }
};

const Z_IMAGE_TURBO_TXT2IMG_CAPABILITY: WorkflowCapability = {
  toolType: "txt2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Text to Image",
  technicalLabel: "txt2img-z-image-turbo",
  requiredPhotoshopInputs: [],
  controls: ["prompt", "negativePrompt", "width", "height", "steps", "guidance", "seed"],
  output: {
    kind: "full-image",
    size: "preset",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Z_image_Turbo model",
    primaryActionLabel: "Generate",
    warning: "Z_image_Turbo needs a validated diffusion-model-stack workflow before generation is enabled."
  }
};

const Z_IMAGE_TURBO_IMG2IMG_CAPABILITY: WorkflowCapability = {
  toolType: "img2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Image to Image",
  technicalLabel: "img2img-z-image-turbo",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["prompt", "negativePrompt", "steps", "guidance", "denoise", "seed"],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Z_image_Turbo model",
    primaryActionLabel: "Generate Image to Image",
    warning: "Z_image_Turbo Image to Image needs a validated source-image workflow before generation is enabled."
  }
};

const PROMPT_FROM_LAYER_FLORENCE2_CAPABILITY: WorkflowCapability = {
  toolType: "prompt",
  loaderType: "vision-language",
  artistLabel: "Prompt from Layer",
  technicalLabel: "prompt-from-layer-florence2",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["task", "numBeams", "seed"],
  output: {
    kind: "prompt-text",
    size: "none",
    importBehavior: "none"
  },
  uiHints: {
    showModelSelector: false,
    modelSelectorLabel: "Florence model",
    primaryActionLabel: "Generate Text from Layer",
    experimentalNote: "Prompt from Layer uses a Florence-2 PromptGen custom-node workflow and returns text, not an image."
  }
};

const UPSCALE_BASIC_CAPABILITY: WorkflowCapability = {
  toolType: "upscale",
  loaderType: "upscale",
  artistLabel: "Upscale",
  technicalLabel: "upscale-basic",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: [],
  output: {
    kind: "upscaled-image",
    size: "upscaled",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Upscale model",
    primaryActionLabel: "Generate Upscale",
    experimentalNote: "Pixel/model upscale only. No prompt or generative enhancement is used."
  }
};

const FLUX1_DEV_TXT2IMG_CAPABILITY: WorkflowCapability = {
  toolType: "txt2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Text to Image",
  technicalLabel: "txt2img-flux1-dev",
  requiredPhotoshopInputs: [],
  controls: ["prompt", "negativePrompt", "width", "height", "steps", "guidance", "seed"],
  output: {
    kind: "full-image",
    size: "preset",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Flux model",
    primaryActionLabel: "Generate",
    warning: "Flux needs a validated diffusion-model-stack workflow before generation is enabled."
  }
};

const FLUX1_DEV_IMG2IMG_CAPABILITY: WorkflowCapability = {
  toolType: "img2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Image to Image",
  technicalLabel: "img2img-flux1-dev",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["prompt", "negativePrompt", "steps", "guidance", "denoise", "seed"],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Flux model",
    primaryActionLabel: "Generate Image to Image",
    warning: "Flux Image to Image needs a validated source-image workflow before generation is enabled."
  }
};

export const WORKFLOW_PRESETS: WorkflowPresetDefinition[] = [
  {
    id: "txt2img-basic",
    label: "txt2img-basic",
    mode: "txt2img",
    description: "Basic local text-to-image generation through ComfyUI.",
    workflowFile: "workflows/api/txt2img-basic.json",
    sourceWorkflowFile: "workflows/source/txt2img-basic.workflow.json",
    status: "stable",
    recommendedSettings: { steps: 20, cfg: 7 },
    supportedModelFamilies: ["sd1", "sdxl", "unknown"],
    experimentalModelFamilies: ["sd3", "flux", "zImage"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    capability: TXT2IMG_BASIC_CAPABILITY,
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
    id: "txt2img-flux1-dev-fp8",
    label: "txt2img-flux1-dev-fp8",
    mode: "txt2img",
    description: "Experimental Flux1-dev fp8 text-to-image workflow using a checkpoint-style ComfyUI graph.",
    workflowFile: "workflows/api/txt2img-flux1-dev-fp8.json",
    sourceWorkflowFile: "workflows/source/txt2img-flux1-dev-fp8.workflow.json",
    status: "experimental",
    recommendedSettings: { steps: 20, cfg: 3.5 },
    supportedModelFamilies: ["flux"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "zImage", "unknown"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    capability: FLUX1_DEV_FP8_TXT2IMG_CAPABILITY,
    requiredModels: [FLUX1_DEV_FP8_CHECKPOINT],
    injections: FLUX1_DEV_FP8_TXT2IMG_INJECTIONS,
    compatibilityNote:
      "txt2img-flux1-dev-fp8 follows the attached CheckpointLoaderSimple Flux workflow. KSampler CFG stays 1; OpenLayer maps the UI CFG control to FluxGuidance.",
    requiredNodes: [
      {
        id: FLUX1_DEV_FP8_TXT2IMG_NODES.checkpointLoader,
        classType: "CheckpointLoaderSimple",
        requiredInputs: ["ckpt_name"]
      },
      {
        id: FLUX1_DEV_FP8_TXT2IMG_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: FLUX1_DEV_FP8_TXT2IMG_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: FLUX1_DEV_FP8_TXT2IMG_NODES.fluxGuidance,
        classType: "FluxGuidance",
        requiredInputs: ["conditioning", "guidance"]
      },
      {
        id: FLUX1_DEV_FP8_TXT2IMG_NODES.latentImage,
        classType: "EmptySD3LatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: FLUX1_DEV_FP8_TXT2IMG_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: FLUX1_DEV_FP8_TXT2IMG_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: FLUX1_DEV_FP8_TXT2IMG_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
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
    recommendedSettings: { steps: 20, cfg: 7 },
    supportedModelFamilies: ["sd1", "sdxl", "unknown"],
    experimentalModelFamilies: ["sd3", "flux", "zImage"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    capability: IMG2IMG_BASIC_CAPABILITY,
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
    id: "prompt-from-layer-florence2",
    label: "prompt-from-layer-florence2",
    mode: "prompt",
    description: "Experimental Florence-2 PromptGen workflow that describes a captured Photoshop layer or canvas.",
    workflowFile: "workflows/api/prompt-from-layer-florence2.json",
    sourceWorkflowFile: "workflows/source/prompt-from-layer-florence2.workflow.json",
    status: "experimental",
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "zImage"],
    modelSource: FLORENCE_MODEL_SOURCE,
    capability: PROMPT_FROM_LAYER_FLORENCE2_CAPABILITY,
    requiredModels: [FLORENCE2_PROMPTGEN_MODEL],
    injections: PROMPT_FROM_LAYER_FLORENCE2_INJECTIONS,
    compatibilityNote:
      "prompt-from-layer-florence2 uses comfyui-florence2 plus ShowText from comfyui-custom-scripts. It returns text from ComfyUI history instead of an image.",
    requiredNodes: [
      {
        id: PROMPT_FROM_LAYER_FLORENCE2_NODES.modelLoader,
        classType: "Florence2ModelLoader",
        requiredInputs: ["model", "precision", "attention"]
      },
      {
        id: PROMPT_FROM_LAYER_FLORENCE2_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: PROMPT_FROM_LAYER_FLORENCE2_NODES.florenceRun,
        classType: "Florence2Run",
        requiredInputs: ["image", "florence2_model", "text_input", "task", "fill_mask"]
      },
      {
        id: PROMPT_FROM_LAYER_FLORENCE2_NODES.showText,
        classType: "ShowText|pysssss",
        requiredInputs: ["text"]
      }
    ]
  },
  {
    id: "upscale-basic",
    label: "upscale-basic",
    mode: "upscale",
    description: "Experimental pixel upscale through ComfyUI UpscaleModelLoader and ImageUpscaleWithModel.",
    workflowFile: "workflows/api/upscale-basic.json",
    sourceWorkflowFile: "workflows/source/upscale-basic.workflow.json",
    status: "experimental",
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "zImage"],
    modelSource: UPSCALE_MODEL_SOURCE,
    capability: UPSCALE_BASIC_CAPABILITY,
    requiredModels: [UPSCALE_BASIC_MODEL],
    injections: UPSCALE_BASIC_INJECTIONS,
    compatibilityNote:
      "upscale-basic uses ComfyUI's pixel/model upscale path. It does not use prompts, checkpoints, or diffusion sampling.",
    requiredNodes: [
      {
        id: UPSCALE_BASIC_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: UPSCALE_BASIC_NODES.upscaleModelLoader,
        classType: "UpscaleModelLoader",
        requiredInputs: ["model_name"]
      },
      {
        id: UPSCALE_BASIC_NODES.imageUpscale,
        classType: "ImageUpscaleWithModel",
        requiredInputs: ["upscale_model", "image"]
      },
      {
        id: UPSCALE_BASIC_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
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
    recommendedSettings: { steps: 16, cfg: 7 },
    supportedModelFamilies: ["sd1"],
    experimentalModelFamilies: ["sdxl", "sd3", "flux", "zImage"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    capability: SKETCH2IMG_LINECN_BASIC_CAPABILITY,
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
    description: "Experimental SD 1.x inpainting workflow using a Photoshop selection source and mask.",
    workflowFile: "workflows/api/inpaint-basic.json",
    sourceWorkflowFile: "workflows/source/inpaint-basic.workflow.json",
    status: "experimental",
    recommendedSettings: { steps: 16, cfg: 7 },
    supportedModelFamilies: ["sd1"],
    experimentalModelFamilies: ["sdxl", "sd3", "flux", "zImage", "unknown"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    capability: INPAINT_BASIC_CAPABILITY,
    injections: INPAINT_BASIC_INJECTIONS,
    requiredNodes: [
      {
        id: INPAINT_BASIC_NODES.checkpointLoader,
        classType: "CheckpointLoaderSimple",
        requiredInputs: ["ckpt_name"]
      },
      {
        id: INPAINT_BASIC_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: INPAINT_BASIC_NODES.loadMaskImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: INPAINT_BASIC_NODES.imageToMask,
        classType: "ImageToMask",
        requiredInputs: ["image", "channel"]
      },
      {
        id: INPAINT_BASIC_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: INPAINT_BASIC_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: INPAINT_BASIC_NODES.inpaintConditioning,
        classType: "InpaintModelConditioning",
        requiredInputs: ["positive", "negative", "vae", "pixels", "mask", "noise_mask"]
      },
      {
        id: INPAINT_BASIC_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["seed", "steps", "cfg", "denoise", "model", "positive", "negative", "latent_image"]
      },
      {
        id: INPAINT_BASIC_NODES.compositeMasked,
        classType: "ImageCompositeMasked",
        requiredInputs: ["destination", "source", "x", "y", "resize_source"]
      },
      {
        id: INPAINT_BASIC_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ],
    compatibilityNote:
      "inpaint-basic is an experimental SD 1.x workflow using LoadImage, ImageToMask, and InpaintModelConditioning. Start with an SD 1.x inpaint checkpoint."
  },
  {
    id: "inpaint-flux-fill-basic",
    label: "inpaint-flux-fill-basic",
    mode: "inpaint",
    description: "Experimental Flux Fill inpainting workflow using a diffusion model stack.",
    workflowFile: "workflows/api/inpaint-flux-fill-basic.json",
    status: "experimental",
    recommendedSettings: { steps: 20, cfg: 30 },
    supportedModelFamilies: ["flux"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "zImage", "unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: INPAINT_FLUX_FILL_BASIC_CAPABILITY,
    modelStack: [...FLUX_FILL_STACK],
    requiredModels: [...FLUX_FILL_STACK],
    injections: INPAINT_FLUX_FILL_BASIC_INJECTIONS,
    requiredNodes: [
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.differentialDiffusion,
        classType: "DifferentialDiffusion",
        requiredInputs: ["model"]
      },
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.dualClipLoader,
        classType: "DualCLIPLoader",
        requiredInputs: ["clip_name1", "clip_name2", "type"]
      },
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.fluxGuidance,
        classType: "FluxGuidance",
        requiredInputs: ["conditioning", "guidance"]
      },
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.negativeConditioning,
        classType: "ConditioningZeroOut",
        requiredInputs: ["conditioning"]
      },
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.inpaintConditioning,
        classType: "InpaintModelConditioning",
        requiredInputs: ["positive", "negative", "vae", "pixels", "mask", "noise_mask"]
      },
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: INPAINT_FLUX_FILL_BASIC_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ],
    compatibilityNote:
      "inpaint-flux-fill-basic is experimental and follows the Flux Fill reference graph: UNETLoader, DifferentialDiffusion, DualCLIPLoader, FluxGuidance, InpaintModelConditioning, KSampler, VAEDecode, and SaveImage. OpenLayer embeds the Photoshop mask into the uploaded PNG alpha channel for the LoadImage mask output. T5 prefers t5xxl_fp16.safetensors and accepts t5xxl_fp8_e4m3fn.safetensors as a fallback."
  },
  {
    id: "outpaint-flux-fill-basic",
    label: "outpaint-flux-fill-basic",
    mode: "outpaint",
    description: "Experimental Flux Fill outpainting workflow using ImagePadForOutpaint.",
    workflowFile: "workflows/api/outpaint-flux-fill-basic.json",
    sourceWorkflowFile: "workflows/source/outpaint-flux-fill-basic.workflow.json",
    status: "experimental",
    recommendedSettings: { steps: 20, cfg: 30 },
    supportedModelFamilies: ["flux"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "zImage", "unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: OUTPAINT_FLUX_FILL_BASIC_CAPABILITY,
    modelStack: [...FLUX_FILL_STACK],
    requiredModels: [...FLUX_FILL_STACK],
    injections: OUTPAINT_FLUX_FILL_BASIC_INJECTIONS,
    requiredNodes: [
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.differentialDiffusion,
        classType: "DifferentialDiffusion",
        requiredInputs: ["model"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.dualClipLoader,
        classType: "DualCLIPLoader",
        requiredInputs: ["clip_name1", "clip_name2", "type"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.imagePad,
        classType: "ImagePadForOutpaint",
        requiredInputs: ["image", "left", "top", "right", "bottom", "feathering"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.fluxGuidance,
        classType: "FluxGuidance",
        requiredInputs: ["conditioning", "guidance"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.negativeConditioning,
        classType: "ConditioningZeroOut",
        requiredInputs: ["conditioning"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.outpaintConditioning,
        classType: "InpaintModelConditioning",
        requiredInputs: ["positive", "negative", "vae", "pixels", "mask", "noise_mask"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: OUTPAINT_FLUX_FILL_BASIC_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ],
    compatibilityNote:
      "outpaint-flux-fill-basic is experimental and follows the attached Flux Fill outpaint graph: ImagePadForOutpaint creates the padded image and mask, then Flux Fill generates the expanded result. T5 prefers t5xxl_fp16.safetensors and accepts t5xxl_fp8_e4m3fn.safetensors as a fallback."
  },
  {
    id: "txt2img-z-image-turbo",
    label: "txt2img-z-image-turbo",
    mode: "txt2img",
    description: "Experimental text-to-image preset for the Z_image_Turbo diffusion model stack.",
    workflowFile: "workflows/api/txt2img-z-image-turbo.json",
    sourceWorkflowFile: "workflows/source/txt2img-z-image-turbo.workflow.json",
    status: "experimental",
    recommendedSettings: { steps: 8, cfg: 1 },
    supportedModelFamilies: ["zImage"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: Z_IMAGE_TURBO_TXT2IMG_CAPABILITY,
    modelStack: [...Z_IMAGE_TURBO_STACK],
    requiredModels: [...Z_IMAGE_TURBO_STACK],
    injections: Z_IMAGE_TURBO_TXT2IMG_INJECTIONS,
    requiredNodes: [
      {
        id: Z_IMAGE_TURBO_TXT2IMG_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: Z_IMAGE_TURBO_TXT2IMG_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: Z_IMAGE_TURBO_TXT2IMG_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: Z_IMAGE_TURBO_TXT2IMG_NODES.modelSampling,
        classType: "ModelSamplingAuraFlow",
        requiredInputs: ["model", "shift"]
      },
      {
        id: Z_IMAGE_TURBO_TXT2IMG_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: Z_IMAGE_TURBO_TXT2IMG_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: Z_IMAGE_TURBO_TXT2IMG_NODES.latentImage,
        classType: "EmptySD3LatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: Z_IMAGE_TURBO_TXT2IMG_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: Z_IMAGE_TURBO_TXT2IMG_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: Z_IMAGE_TURBO_TXT2IMG_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ],
    compatibilityNote:
      "Z_image_Turbo is a diffusion model stack, not a checkpoint. OpenLayer loads it through UNETLoader, CLIPLoader, and VAELoader."
  },
  {
    id: "img2img-z-image-turbo",
    label: "img2img-z-image-turbo",
    mode: "img2img",
    description: "Experimental image-to-image preset for the Z_image_Turbo diffusion model stack.",
    workflowFile: "workflows/api/img2img-z-image-turbo.json",
    sourceWorkflowFile: "workflows/source/img2img-z-image-turbo.workflow.json",
    status: "experimental",
    recommendedSettings: { steps: 8, cfg: 1 },
    supportedModelFamilies: ["zImage"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: Z_IMAGE_TURBO_IMG2IMG_CAPABILITY,
    modelStack: [...Z_IMAGE_TURBO_STACK],
    requiredModels: [...Z_IMAGE_TURBO_STACK],
    injections: Z_IMAGE_TURBO_IMG2IMG_INJECTIONS,
    requiredNodes: [
      {
        id: Z_IMAGE_TURBO_IMG2IMG_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: Z_IMAGE_TURBO_IMG2IMG_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: Z_IMAGE_TURBO_IMG2IMG_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: Z_IMAGE_TURBO_IMG2IMG_NODES.modelSampling,
        classType: "ModelSamplingAuraFlow",
        requiredInputs: ["model", "shift"]
      },
      {
        id: Z_IMAGE_TURBO_IMG2IMG_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: Z_IMAGE_TURBO_IMG2IMG_NODES.vaeEncode,
        classType: "VAEEncode",
        requiredInputs: ["pixels", "vae"]
      },
      {
        id: Z_IMAGE_TURBO_IMG2IMG_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: Z_IMAGE_TURBO_IMG2IMG_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: Z_IMAGE_TURBO_IMG2IMG_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: Z_IMAGE_TURBO_IMG2IMG_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: Z_IMAGE_TURBO_IMG2IMG_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ],
    compatibilityNote:
      "Z_image_Turbo image-to-image uses a diffusion-model stack plus PNG source upload and VAE encoding."
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
    capability: FLUX1_DEV_TXT2IMG_CAPABILITY,
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
    capability: FLUX1_DEV_IMG2IMG_CAPABILITY,
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

export type RecommendedPresetSettings = {
  steps: number;
  cfg: number;
};

const FALLBACK_RECOMMENDED_PRESET_SETTINGS: RecommendedPresetSettings = {
  steps: 20,
  cfg: 7
};

export function getRecommendedPresetSettings(presetId: string): RecommendedPresetSettings {
  const preset = WORKFLOW_PRESETS.find((candidate) => candidate.id === presetId);

  return {
    steps: preset?.recommendedSettings?.steps ?? FALLBACK_RECOMMENDED_PRESET_SETTINGS.steps,
    cfg: preset?.recommendedSettings?.cfg ?? FALLBACK_RECOMMENDED_PRESET_SETTINGS.cfg
  };
}

export function getPresetInputTarget(
  preset: WorkflowPresetDefinition,
  inputName: keyof WorkflowPresetDefinition["injections"],
  options: { required?: boolean } = {}
): WorkflowInjectionTargetList | null {
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
