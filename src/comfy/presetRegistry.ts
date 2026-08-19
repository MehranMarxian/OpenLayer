import {
  ComfyWorkflow,
  WorkflowInputTarget,
  WorkflowInjectionTargetList,
  WorkflowCapability,
  WorkflowModelLicenseGate,
  WorkflowPreset,
  WorkflowPresetDefinition,
  WorkflowNodeRequirement
} from "./types";
import { createOpenLayerError } from "../utils/errors";

/*
 * Download metadata for required models.
 *
 * Every `downloadUrl` below was verified with a live HEAD request, and every
 * `downloadSizeBytes` is the Content-Length that request returned. Where the
 * model is also installed on the development rig, the served Content-Length
 * matches the local file byte for byte — so these are the files that are known
 * to work, not merely files with the right name.
 *
 * Publisher repositories are preferred, except where the publisher's repo is
 * gated behind an access request. `black-forest-labs/FLUX.1-dev` and
 * `FLUX.1-Fill-dev` both answer 401 without a user token, so the Flux weights
 * point at Comfy-Org's public repackaging instead. That changes how the file is
 * fetched, not what it is licensed as, which is why they still carry a
 * licence gate.
 */

const FLUX1_DEV_LICENSE: WorkflowModelLicenseGate = {
  name: "FLUX.1 [dev] Non-Commercial License",
  url: "https://huggingface.co/black-forest-labs/FLUX.1-dev/blob/main/LICENSE.md",
  summary:
    "Black Forest Labs restricts these weights to non-commercial use. Read the licence before downloading them or publishing work made with them."
};

const FLUX2_DEV_LICENSE: WorkflowModelLicenseGate = {
  name: "FLUX.2 [dev] Non-Commercial License",
  url: "https://huggingface.co/black-forest-labs/FLUX.2-dev/blob/main/LICENSE.md",
  summary:
    "Black Forest Labs restricts these weights to non-commercial use. Read the licence before downloading them or publishing work made with them."
};

const COMFY_ORG_FLUX1_DEV_REPO = "https://huggingface.co/Comfy-Org/flux1-dev";
const COMFY_ORG_FLUX2_DEV_REPO = "https://huggingface.co/Comfy-Org/flux2-dev";
const CITY96_FLUX2_DEV_GGUF_REPO = "https://huggingface.co/city96/FLUX.2-dev-gguf";
const COMFY_ORG_Z_IMAGE_TURBO_REPO = "https://huggingface.co/Comfy-Org/z_image_turbo";
// Klein ships Apache-2.0 and ungated, unlike FLUX.1-dev and FLUX.2-dev, so
// there is deliberately no licenseGate on the stack below -- the setup pack can
// point straight at the file with no click-through.
const BFL_FLUX2_KLEIN_4B_FP8_REPO = "https://huggingface.co/black-forest-labs/FLUX.2-klein-4b-fp8";
const COMFY_ORG_KREA2_REPO = "https://huggingface.co/Comfy-Org/Krea-2";
const FLUX_TEXT_ENCODERS_REPO = "https://huggingface.co/comfyanonymous/flux_text_encoders";
const ALIBABA_PAI_ZIMAGE_FUN_CONTROLNET_REPO =
  "https://huggingface.co/alibaba-pai/Z-Image-Turbo-Fun-Controlnet-Union-2.1";

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

// UNETLoader's object_info does not enumerate .gguf files at all (verified live
// against ComfyUI-GGUF) -- a preset built on UnetLoaderGGUF must ask that loader
// for its own file list, or every .gguf model is invisible in the Model dropdown
// no matter where it's placed.
const DIFFUSION_MODEL_GGUF_SOURCE = {
  kind: "diffusion-model-stack",
  objectInfoNode: "UnetLoaderGGUF",
  inputName: "unet_name",
  label: "Diffusion model (GGUF)"
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

const FLUX2_KLEIN_4B_STACK = [
  {
    kind: "diffusion-model-stack",
    objectInfoNode: "UNETLoader",
    inputName: "unet_name",
    label: "FLUX.2 Klein 4B diffusion model",
    modelName: "flux-2-klein-4b-fp8.safetensors",
    setupHint: "Install flux-2-klein-4b-fp8.safetensors where ComfyUI's UNETLoader can find it.",
    downloadUrl: `${BFL_FLUX2_KLEIN_4B_FP8_REPO}/resolve/main/flux-2-klein-4b-fp8.safetensors`,
    sourcePageUrl: BFL_FLUX2_KLEIN_4B_FP8_REPO,
    downloadSizeBytes: 4070624520
  },
  {
    // Byte-identical to the Z_image_Turbo stack's encoder, and named identically
    // so the setup pack de-duplicates it and downloads 8 GB once rather than
    // twice. The URL points at the Z-Image repo for the same reason: one source
    // of truth for one file.
    kind: "clip",
    objectInfoNode: "CLIPLoader",
    inputName: "clip_name",
    label: "Qwen3 4B text encoder",
    modelName: "qwen_3_4b.safetensors",
    setupHint: "Install qwen_3_4b.safetensors where ComfyUI's CLIPLoader can find it.",
    downloadUrl: `${COMFY_ORG_Z_IMAGE_TURBO_REPO}/resolve/main/split_files/text_encoders/qwen_3_4b.safetensors`,
    sourcePageUrl: COMFY_ORG_Z_IMAGE_TURBO_REPO,
    downloadSizeBytes: 8044982048
  },
  {
    kind: "vae",
    objectInfoNode: "VAELoader",
    inputName: "vae_name",
    label: "Flux.2 VAE",
    modelName: "flux2-vae.safetensors",
    setupHint: "Install flux2-vae.safetensors in ComfyUI models/vae.",
    downloadUrl: `${COMFY_ORG_FLUX2_DEV_REPO}/resolve/main/split_files/vae/flux2-vae.safetensors`,
    sourcePageUrl: COMFY_ORG_FLUX2_DEV_REPO,
    downloadSizeBytes: 336211292
  }
] as const;

const Z_IMAGE_TURBO_STACK = [
  {
    kind: "diffusion-model-stack",
    objectInfoNode: "UNETLoader",
    inputName: "unet_name",
    label: "Z_image_Turbo diffusion model",
    modelName: "z_image_turbo_bf16.safetensors",
    setupHint: "Install z_image_turbo_bf16.safetensors where ComfyUI's UNETLoader can find it.",
    downloadUrl: `${COMFY_ORG_Z_IMAGE_TURBO_REPO}/resolve/main/split_files/diffusion_models/z_image_turbo_bf16.safetensors`,
    sourcePageUrl: COMFY_ORG_Z_IMAGE_TURBO_REPO,
    downloadSizeBytes: 12309866400
  },
  {
    kind: "clip",
    objectInfoNode: "CLIPLoader",
    inputName: "clip_name",
    label: "Z_image_Turbo CLIP",
    modelName: "qwen_3_4b.safetensors",
    setupHint: "Install qwen_3_4b.safetensors where ComfyUI's CLIPLoader can find it.",
    downloadUrl: `${COMFY_ORG_Z_IMAGE_TURBO_REPO}/resolve/main/split_files/text_encoders/qwen_3_4b.safetensors`,
    sourcePageUrl: COMFY_ORG_Z_IMAGE_TURBO_REPO,
    downloadSizeBytes: 8044982048
  },
  {
    // The same 335 MB autoencoder the Flux Fill stack loads. Comfy-Org
    // republishes it inside the Z-Image bundle, which is the only public
    // source: Black Forest Labs' own copy sits behind a gated repo.
    kind: "vae",
    objectInfoNode: "VAELoader",
    inputName: "vae_name",
    label: "Z_image_Turbo VAE",
    modelName: "ae.safetensors",
    setupHint: "Install ae.safetensors where ComfyUI's VAELoader can find it.",
    downloadUrl: `${COMFY_ORG_Z_IMAGE_TURBO_REPO}/resolve/main/split_files/vae/ae.safetensors`,
    sourcePageUrl: COMFY_ORG_Z_IMAGE_TURBO_REPO,
    downloadSizeBytes: 335304388
  }
] as const;

/**
 * ControlNet-as-model-patch weights for the Z_image_Turbo stack, applied
 * through the core `ModelPatchLoader` / `ZImageFunControlnet` pair rather than
 * the `ControlNetLoader` / `ControlNetApplyAdvanced` pair the SD 1.x sketch
 * presets use -- verified live against ComfyUI's /object_info, this node
 * patches the MODEL directly and has no CONTROL_NET output to apply to
 * conditioning.
 *
 * Two variants are shipped because they were tried against real artwork, not
 * only benchmarked: the lite weights won a synthetic single-prompt comparison
 * (holding a cat's silhouette where the full weights returned an unrelated
 * abstract sculpture at the same strength) but lost a hands-on comparison
 * against the full weights on actual sketches, at real cost -- 6.7 GB against
 * 2.0 GB and a slower patch. Neither result generalizes reliably enough to
 * drop the other, so both stay selectable rather than picking a winner.
 */
const Z_IMAGE_FUN_CONTROLNET_UNION_LITE_MODEL = {
  kind: "model-patch",
  objectInfoNode: "ModelPatchLoader",
  inputName: "name",
  label: "Z-Image Fun ControlNet Union patch (lite)",
  modelName: "Z-Image-Turbo-Fun-Controlnet-Union-2.1-lite-2602-8steps.safetensors",
  setupHint:
    "Install Z-Image-Turbo-Fun-Controlnet-Union-2.1-lite-2602-8steps.safetensors where ComfyUI's ModelPatchLoader can find it.",
  downloadUrl: `${ALIBABA_PAI_ZIMAGE_FUN_CONTROLNET_REPO}/resolve/main/Z-Image-Turbo-Fun-Controlnet-Union-2.1-lite-2602-8steps.safetensors`,
  sourcePageUrl: ALIBABA_PAI_ZIMAGE_FUN_CONTROLNET_REPO,
  downloadSizeBytes: 2016627488
} as const;

const Z_IMAGE_FUN_CONTROLNET_UNION_FULL_MODEL = {
  kind: "model-patch",
  objectInfoNode: "ModelPatchLoader",
  inputName: "name",
  label: "Z-Image Fun ControlNet Union patch (full)",
  modelName: "Z-Image-Turbo-Fun-Controlnet-Union-2.1.safetensors",
  setupHint: "Install Z-Image-Turbo-Fun-Controlnet-Union-2.1.safetensors where ComfyUI's ModelPatchLoader can find it.",
  downloadUrl: `${ALIBABA_PAI_ZIMAGE_FUN_CONTROLNET_REPO}/resolve/main/Z-Image-Turbo-Fun-Controlnet-Union-2.1.safetensors`,
  sourcePageUrl: ALIBABA_PAI_ZIMAGE_FUN_CONTROLNET_REPO,
  downloadSizeBytes: 6712485600
} as const;

const KREA2_TURBO_STACK = [
  {
    kind: "diffusion-model-stack",
    objectInfoNode: "UNETLoader",
    inputName: "unet_name",
    label: "Krea-2 Turbo diffusion model",
    modelName: "krea2_turbo_fp8_scaled.safetensors",
    setupHint: "Install krea2_turbo_fp8_scaled.safetensors where ComfyUI's UNETLoader can find it.",
    downloadUrl: `${COMFY_ORG_KREA2_REPO}/resolve/main/diffusion_models/krea2_turbo_fp8_scaled.safetensors`,
    sourcePageUrl: COMFY_ORG_KREA2_REPO,
    downloadSizeBytes: 13141730784
  },
  {
    kind: "clip",
    objectInfoNode: "CLIPLoader",
    inputName: "clip_name",
    label: "Krea-2 text encoder",
    modelName: "qwen3vl_4b_fp8_scaled.safetensors",
    setupHint: "Install qwen3vl_4b_fp8_scaled.safetensors in ComfyUI models/text_encoders.",
    downloadUrl: `${COMFY_ORG_KREA2_REPO}/resolve/main/text_encoders/qwen3vl_4b_fp8_scaled.safetensors`,
    sourcePageUrl: COMFY_ORG_KREA2_REPO,
    downloadSizeBytes: 5242467968
  },
  {
    kind: "vae",
    objectInfoNode: "VAELoader",
    inputName: "vae_name",
    label: "Qwen image VAE",
    modelName: "qwen_image_vae.safetensors",
    setupHint: "Install qwen_image_vae.safetensors where ComfyUI's VAELoader can find it.",
    downloadUrl: `${COMFY_ORG_KREA2_REPO}/resolve/main/vae/qwen_image_vae.safetensors`,
    sourcePageUrl: COMFY_ORG_KREA2_REPO,
    downloadSizeBytes: 253806246
  }
] as const;

const FLUX2_DEV_GGUF_STACK = [
  {
    // A Q4_K_M quantisation, so the loader is ComfyUI-GGUF's rather than the
    // core UNETLoader -- core does not enumerate .gguf at all, which makes an
    // unquantised-looking setup report the file as simply absent.
    kind: "diffusion-model-stack",
    objectInfoNode: "UnetLoaderGGUF",
    inputName: "unet_name",
    label: "Flux.2 dev diffusion model (GGUF)",
    modelName: "flux2-dev-Q4_K_M.gguf",
    setupHint:
      "Install flux2-dev-Q4_K_M.gguf in ComfyUI models/diffusion_models. It needs the ComfyUI-GGUF custom nodes, which also require the gguf Python package.",
    downloadUrl: `${CITY96_FLUX2_DEV_GGUF_REPO}/resolve/main/flux2-dev-Q4_K_M.gguf`,
    sourcePageUrl: CITY96_FLUX2_DEV_GGUF_REPO,
    downloadSizeBytes: 20082414560,
    licenseGate: FLUX2_DEV_LICENSE
  },
  {
    // Flux.2 dev uses a Mistral-3 encoder, NOT the Qwen encoders the Klein
    // variant reuses and not Flux.1's T5/CLIP pair. Pointing this at a Qwen
    // file loads and then fails, so the name is pinned.
    kind: "clip",
    objectInfoNode: "CLIPLoader",
    inputName: "clip_name",
    label: "Flux.2 text encoder (Mistral-3)",
    modelName: "mistral_3_small_flux2_fp8.safetensors",
    setupHint:
      "Install mistral_3_small_flux2_fp8.safetensors in ComfyUI models/text_encoders. Flux.2 dev will not run on the Qwen encoders used by Z_image_Turbo or Krea-2.",
    downloadUrl: `${COMFY_ORG_FLUX2_DEV_REPO}/resolve/main/split_files/text_encoders/mistral_3_small_flux2_fp8.safetensors`,
    sourcePageUrl: COMFY_ORG_FLUX2_DEV_REPO,
    downloadSizeBytes: 18034640095,
    licenseGate: FLUX2_DEV_LICENSE
  },
  {
    // Not interchangeable with Flux.1's ae.safetensors: Flux.2 latents are 128
    // channels at a 16x downscale against Flux.1's 16 channels at 8x. The
    // generic filename hides which family it belongs to.
    kind: "vae",
    objectInfoNode: "VAELoader",
    inputName: "vae_name",
    label: "Flux.2 VAE",
    modelName: "full_encoder_small_decoder.safetensors",
    setupHint:
      "Install full_encoder_small_decoder.safetensors in ComfyUI models/vae. Flux.1's ae.safetensors will not decode Flux.2 latents.",
    downloadUrl:
      "https://huggingface.co/black-forest-labs/FLUX.2-small-decoder/resolve/main/full_encoder_small_decoder.safetensors",
    sourcePageUrl: "https://huggingface.co/black-forest-labs/FLUX.2-small-decoder",
    downloadSizeBytes: 249519092
  }
] as const;

const FLUX1_DEV_FP8_CHECKPOINT = {
  // An all-in-one checkpoint: UNET, both text encoders, and the VAE in one
  // file. A UNET-only "flux1-dev-fp8" from elsewhere will load and then fail
  // for want of CLIP, which is why the URL and size are pinned here.
  kind: "checkpoint",
  objectInfoNode: "CheckpointLoaderSimple",
  inputName: "ckpt_name",
  label: "Flux1-dev fp8 checkpoint",
  modelName: "flux1-dev-fp8.safetensors",
  setupHint: "Install flux1-dev-fp8.safetensors where ComfyUI's CheckpointLoaderSimple can find it.",
  downloadUrl: `${COMFY_ORG_FLUX1_DEV_REPO}/resolve/main/flux1-dev-fp8.safetensors`,
  sourcePageUrl: "https://huggingface.co/black-forest-labs/FLUX.1-dev",
  downloadSizeBytes: 17246524772,
  licenseGate: FLUX1_DEV_LICENSE
} as const;

const FLORENCE2_PROMPTGEN_MODEL = {
  kind: "vision-language",
  objectInfoNode: "Florence2ModelLoader",
  inputName: "model",
  label: "Florence-2 PromptGen model",
  modelName: "Florence-2-base-PromptGen-v2.0",
  setupHint:
    "Clone the whole Florence-2-base-PromptGen-v2.0 repository into ComfyUI models/LLM. Florence2ModelLoader loads a model directory, not a single file.",
  downloadUrl: "https://huggingface.co/MiaoshouAI/Florence-2-base-PromptGen-v2.0",
  sourcePageUrl: "https://huggingface.co/MiaoshouAI/Florence-2-base-PromptGen-v2.0",
  downloadLayout: "repo-folder"
} as const;

const UPSCALE_BASIC_MODEL = {
  kind: "upscale",
  objectInfoNode: "UpscaleModelLoader",
  inputName: "model_name",
  label: "Upscale model",
  modelName: "4x-UltraSharp.pth",
  acceptedModelNames: ["RealESRGAN_x4plus.pth"],
  setupHint: "Install 4x-UltraSharp.pth or RealESRGAN_x4plus.pth where ComfyUI's UpscaleModelLoader can find it.",
  downloadUrl: "https://huggingface.co/Kim2091/UltraSharp/resolve/main/4x-UltraSharp.pth",
  sourcePageUrl: "https://huggingface.co/Kim2091/UltraSharp",
  downloadSizeBytes: 66961958
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
  latentImage: "5",
  lineArtPreprocessor: "12",
  controlNetLoader: "13",
  controlNetApply: "14",
  sampler: "3",
  saveImage: "9"
} as const;

// Same graph shape as the LineArt preset -- only the preprocessor and the
// ControlNet it feeds differ -- so the node ids deliberately match.
const SKETCH2IMG_SCRIBBLE_BASIC_NODES = {
  checkpointLoader: "4",
  loadImage: "10",
  positivePrompt: "6",
  negativePrompt: "7",
  latentImage: "5",
  scribblePreprocessor: "12",
  controlNetLoader: "13",
  controlNetApply: "14",
  sampler: "3",
  saveImage: "9"
} as const;

// Third variant of the same graph. Depth differs from LineArt and Scribble in
// what it preserves: those two hold the drawn *stroke*, while depth holds the
// scene's geometry, which is what matters when a generated image has to sit in
// an existing Photoshop composite at the right perspective.
const SKETCH2IMG_DEPTH_BASIC_NODES = {
  checkpointLoader: "4",
  loadImage: "10",
  positivePrompt: "6",
  negativePrompt: "7",
  latentImage: "5",
  depthPreprocessor: "12",
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

// Same Flux Fill stack as above with lquesada's crop-and-stitch pair wrapped
// around the sampler chain. Ids 31/39/34/32/17/23/26/46/38/3/8/9 are kept
// identical to inpaint-flux-fill-basic on purpose: fluxFillDefaults.ts pins
// the guidance, sampler and Differential Diffusion nodes by literal id, so a
// renumbered graph would silently stop receiving the reference defaults.
const INPAINT_FLUX_FILL_CROPSTITCH_NODES = {
  diffusionModelLoader: "31",
  differentialDiffusion: "39",
  dualClipLoader: "34",
  vaeLoader: "32",
  loadImage: "17",
  inpaintCrop: "50",
  positivePrompt: "23",
  fluxGuidance: "26",
  negativeConditioning: "46",
  inpaintConditioning: "38",
  sampler: "3",
  decode: "8",
  inpaintStitch: "51",
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

const FLUX2_DEV_GGUF_TXT2IMG_NODES = {
  diffusionModelLoader: "12",
  clipLoader: "38",
  vaeLoader: "10",
  positivePrompt: "6",
  fluxGuidance: "26",
  guider: "22",
  noise: "25",
  samplerSelect: "16",
  scheduler: "48",
  latentImage: "47",
  sampler: "13",
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

// Klein is distilled: 4 steps at cfg 1 with er_sde/simple and an AuraFlow shift
// of 3. Those numbers are the whole reason this preset exists -- they are what
// makes Flux.2 usable interactively rather than as a batch job -- and they are
// pinned in the shipped JSON rather than left to the panel's defaults.
const FLUX2_KLEIN_TXT2IMG_NODES = {
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

const FLUX2_KLEIN_IMG2IMG_NODES = {
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

// The edit paradigm, and the reason it is a separate preset rather than a
// denoise setting on img2img. Image-to-image encodes the source AS the starting
// latent and samples at denoise < 1, which is a single dial between "keeps the
// source, ignores you" and "obeys you, discards the source" -- measured on this
// very model, denoise 0.7 preserved a photograph faithfully and ignored a plain
// style instruction outright. Here the latent starts EMPTY at denoise 1 and the
// source is supplied as *conditioning* through ReferenceLatent on both
// branches, so the model is free to follow the instruction while still being
// told what the scene is.
const FLUX2_KLEIN_EDIT_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  modelSampling: "23",
  loadImage: "10",
  referenceScale: "12",
  samplingSize: "13",
  originalSize: "16",
  vaeEncode: "11",
  positivePrompt: "6",
  negativePrompt: "7",
  referenceIntoPositive: "14",
  referenceIntoNegative: "15",
  latentImage: "5",
  sampler: "3",
  decode: "8",
  outputScale: "17",
  saveImage: "9"
} as const;

// Outpaint without a fill model. ImagePadForOutpaint supplies the grown canvas
// AND a mask of the new border, the crop node consumes that mask, and the
// stitch composites only the new area back -- so the artist's pixels return
// bit-for-bit. Keeping ImagePadForOutpaint rather than the crop node's own
// extend_for_outpainting is what lets the panel's existing pixel controls drive
// this preset unchanged; the crop node's extend inputs are ratios.
const FLUX2_KLEIN_OUTPAINT_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  modelSampling: "23",
  loadImage: "10",
  imagePad: "44",
  inpaintCrop: "50",
  samplingSize: "13",
  vaeEncode: "11",
  positivePrompt: "6",
  negativePrompt: "7",
  referenceIntoPositive: "14",
  referenceIntoNegative: "15",
  latentImage: "5",
  sampler: "3",
  decode: "8",
  inpaintStitch: "51",
  saveImage: "9"
} as const;

const SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  modelPatchLoader: "25",
  loadImage: "10",
  lineArtPreprocessor: "30",
  controlnetApply: "26",
  modelSampling: "23",
  latentImage: "5",
  positivePrompt: "6",
  negativePrompt: "7",
  sampler: "3",
  decode: "8",
  outputScale: "40",
  saveImage: "9"
} as const;

const KREA2_TURBO_TXT2IMG_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  latentImage: "5",
  positivePrompt: "6",
  negativePrompt: "7",
  sampler: "3",
  decode: "8",
  saveImage: "9"
} as const;

/**
 * Where an optional LoRA goes in the Krea-2 Turbo graph.
 *
 * Both text encodes are listed, not just the positive one. At CFG 1 the
 * negative encode contributes nothing to the image, but leaving it reading the
 * bare CLIP would mean two different text encoders in one graph -- harmless
 * today and a confusing bug the moment this preset is used at a CFG above 1.
 *
 * Node id 23 is the next free id after the loaders (20-22); the shipped
 * workflow stops at 22, and applyLoraSelection refuses to overwrite an
 * occupied id rather than trusting this comment to stay true.
 */
/**
 * A checkpoint loader is its own CLIP source: CheckpointLoaderSimple outputs
 * MODEL on slot 0 and CLIP on slot 1, where a diffusion-model stack has two
 * separate loaders. Both shapes splice the same way, which is why the insertion
 * declares a slot rather than assuming one.
 */
const TXT2IMG_BASIC_LORA_INSERTION = {
  nodeId: "10",
  familyTokens: ["sd15", "sd1.5", "sd_1.5"],
  modelSource: { nodeId: TXT2IMG_BASIC_NODES.checkpointLoader, slot: 0 },
  clipSource: { nodeId: TXT2IMG_BASIC_NODES.checkpointLoader, slot: 1 },
  modelConsumers: [{ nodeId: TXT2IMG_BASIC_NODES.sampler, inputName: "model" }],
  clipConsumers: [
    { nodeId: TXT2IMG_BASIC_NODES.positivePrompt, inputName: "clip" },
    { nodeId: TXT2IMG_BASIC_NODES.negativePrompt, inputName: "clip" }
  ]
} as const;

const FLUX1_DEV_FP8_TXT2IMG_LORA_INSERTION = {
  nodeId: "36",
  familyTokens: ["flux"],
  modelSource: { nodeId: FLUX1_DEV_FP8_TXT2IMG_NODES.checkpointLoader, slot: 0 },
  clipSource: { nodeId: FLUX1_DEV_FP8_TXT2IMG_NODES.checkpointLoader, slot: 1 },
  modelConsumers: [{ nodeId: FLUX1_DEV_FP8_TXT2IMG_NODES.sampler, inputName: "model" }],
  clipConsumers: [
    { nodeId: FLUX1_DEV_FP8_TXT2IMG_NODES.positivePrompt, inputName: "clip" },
    { nodeId: FLUX1_DEV_FP8_TXT2IMG_NODES.negativePrompt, inputName: "clip" }
  ]
} as const;

/**
 * The model consumer here is ModelSamplingAuraFlow, not the sampler. A LoRA has
 * to be applied *before* the sampling-mode wrapper, so the wrapper is what gets
 * rewired -- pointing the sampler at the LoRA instead would silently bypass
 * ModelSamplingAuraFlow and change how the model is sampled.
 */
const Z_IMAGE_TURBO_TXT2IMG_LORA_INSERTION = {
  nodeId: "24",
  familyTokens: ["z-image", "zimage", "z_image"],
  modelSource: { nodeId: Z_IMAGE_TURBO_TXT2IMG_NODES.diffusionModelLoader, slot: 0 },
  clipSource: { nodeId: Z_IMAGE_TURBO_TXT2IMG_NODES.clipLoader, slot: 0 },
  modelConsumers: [{ nodeId: Z_IMAGE_TURBO_TXT2IMG_NODES.modelSampling, inputName: "model" }],
  clipConsumers: [
    { nodeId: Z_IMAGE_TURBO_TXT2IMG_NODES.positivePrompt, inputName: "clip" },
    { nodeId: Z_IMAGE_TURBO_TXT2IMG_NODES.negativePrompt, inputName: "clip" }
  ]
} as const;

/**
 * Only one clip consumer, because Flux.2 is guidance-distilled and the
 * reference graph has no negative conditioning node at all. The model consumer
 * is BasicGuider rather than a KSampler, this preset being built on the
 * advanced sampler chain.
 */
const FLUX2_DEV_GGUF_TXT2IMG_LORA_INSERTION = {
  nodeId: "49",
  familyTokens: ["flux2", "flux-2", "flux_2"],
  modelSource: { nodeId: FLUX2_DEV_GGUF_TXT2IMG_NODES.diffusionModelLoader, slot: 0 },
  clipSource: { nodeId: FLUX2_DEV_GGUF_TXT2IMG_NODES.clipLoader, slot: 0 },
  modelConsumers: [{ nodeId: FLUX2_DEV_GGUF_TXT2IMG_NODES.guider, inputName: "model" }],
  clipConsumers: [{ nodeId: FLUX2_DEV_GGUF_TXT2IMG_NODES.positivePrompt, inputName: "clip" }]
} as const;

const IMG2IMG_BASIC_LORA_INSERTION = {
  nodeId: "12",
  familyTokens: ["sd15", "sd1.5", "sd_1.5"],
  modelSource: { nodeId: IMG2IMG_BASIC_NODES.checkpointLoader, slot: 0 },
  clipSource: { nodeId: IMG2IMG_BASIC_NODES.checkpointLoader, slot: 1 },
  modelConsumers: [{ nodeId: IMG2IMG_BASIC_NODES.sampler, inputName: "model" }],
  clipConsumers: [
    { nodeId: IMG2IMG_BASIC_NODES.positivePrompt, inputName: "clip" },
    { nodeId: IMG2IMG_BASIC_NODES.negativePrompt, inputName: "clip" }
  ]
} as const;



/** Same wrapper caveat as the txt2img Z-Image preset: rewire modelSampling. */
const Z_IMAGE_TURBO_IMG2IMG_LORA_INSERTION = {
  nodeId: "24",
  familyTokens: ["z-image", "zimage", "z_image"],
  modelSource: { nodeId: Z_IMAGE_TURBO_IMG2IMG_NODES.diffusionModelLoader, slot: 0 },
  clipSource: { nodeId: Z_IMAGE_TURBO_IMG2IMG_NODES.clipLoader, slot: 0 },
  modelConsumers: [{ nodeId: Z_IMAGE_TURBO_IMG2IMG_NODES.modelSampling, inputName: "model" }],
  clipConsumers: [
    { nodeId: Z_IMAGE_TURBO_IMG2IMG_NODES.positivePrompt, inputName: "clip" },
    { nodeId: Z_IMAGE_TURBO_IMG2IMG_NODES.negativePrompt, inputName: "clip" }
  ]
} as const;

/**
 * The three sketch presets share one graph shape by design, so they share this
 * wiring too -- only the preprocessor and ControlNet differ between them, and
 * neither touches the model or CLIP path.
 */
function createSketchLoraInsertion(nodes: {
  readonly checkpointLoader: string;
  readonly sampler: string;
  readonly positivePrompt: string;
  readonly negativePrompt: string;
}) {
  return {
    nodeId: "15",
    familyTokens: ["sd15", "sd1.5", "sd_1.5"],
    modelSource: { nodeId: nodes.checkpointLoader, slot: 0 },
    clipSource: { nodeId: nodes.checkpointLoader, slot: 1 },
    modelConsumers: [{ nodeId: nodes.sampler, inputName: "model" }],
    clipConsumers: [
      { nodeId: nodes.positivePrompt, inputName: "clip" },
      { nodeId: nodes.negativePrompt, inputName: "clip" }
    ]
  } as const;
}

const KREA2_TURBO_TXT2IMG_LORA_INSERTION = {
  nodeId: "23",
  familyTokens: ["krea2", "krea-2", "krea_2"],
  modelSource: { nodeId: KREA2_TURBO_TXT2IMG_NODES.diffusionModelLoader, slot: 0 },
  clipSource: { nodeId: KREA2_TURBO_TXT2IMG_NODES.clipLoader, slot: 0 },
  modelConsumers: [{ nodeId: KREA2_TURBO_TXT2IMG_NODES.sampler, inputName: "model" }],
  clipConsumers: [
    { nodeId: KREA2_TURBO_TXT2IMG_NODES.positivePrompt, inputName: "clip" },
    { nodeId: KREA2_TURBO_TXT2IMG_NODES.negativePrompt, inputName: "clip" }
  ]
} as const;

const KREA2_TURBO_IMG2IMG_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  loadImage: "10",
  vaeEncode: "11",
  positivePrompt: "6",
  negativePrompt: "7",
  sampler: "3",
  decode: "8",
  saveImage: "9"
} as const;
const KREA2_TURBO_IMG2IMG_LORA_INSERTION = {
  nodeId: "23",
  familyTokens: ["krea2", "krea-2", "krea_2"],
  modelSource: { nodeId: KREA2_TURBO_IMG2IMG_NODES.diffusionModelLoader, slot: 0 },
  clipSource: { nodeId: KREA2_TURBO_IMG2IMG_NODES.clipLoader, slot: 0 },
  modelConsumers: [{ nodeId: KREA2_TURBO_IMG2IMG_NODES.sampler, inputName: "model" }],
  clipConsumers: [
    { nodeId: KREA2_TURBO_IMG2IMG_NODES.positivePrompt, inputName: "clip" },
    { nodeId: KREA2_TURBO_IMG2IMG_NODES.negativePrompt, inputName: "clip" }
  ]
} as const;

const PROMPT_FROM_LAYER_FLORENCE2_NODES = {
  modelLoader: "39",
  loadImage: "42",
  florenceRun: "38",
  // Florence2Run is not an OUTPUT_NODE, so the graph needs one or ComfyUI
  // refuses to queue it and no caption ever reaches history. PreviewAny is
  // core (comfy_extras.nodes_preview_any) and publishes the same
  // {"ui": {"text": [...]}} shape the pysssss ShowText node did.
  textPreview: "41"
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
  width: target(SKETCH2IMG_LINECN_BASIC_NODES.latentImage, "width"),
  height: target(SKETCH2IMG_LINECN_BASIC_NODES.latentImage, "height"),
  seed: target(SKETCH2IMG_LINECN_BASIC_NODES.sampler, "seed"),
  steps: target(SKETCH2IMG_LINECN_BASIC_NODES.sampler, "steps"),
  cfg: target(SKETCH2IMG_LINECN_BASIC_NODES.sampler, "cfg"),
  denoise: target(SKETCH2IMG_LINECN_BASIC_NODES.sampler, "denoise"),
  controlStrength: target(SKETCH2IMG_LINECN_BASIC_NODES.controlNetApply, "strength")
} as const;

const SKETCH2IMG_SCRIBBLE_BASIC_INJECTIONS = {
  checkpoint: target(SKETCH2IMG_SCRIBBLE_BASIC_NODES.checkpointLoader, "ckpt_name"),
  sourceImage: target(SKETCH2IMG_SCRIBBLE_BASIC_NODES.loadImage, "image"),
  positivePrompt: target(SKETCH2IMG_SCRIBBLE_BASIC_NODES.positivePrompt, "text"),
  negativePrompt: target(SKETCH2IMG_SCRIBBLE_BASIC_NODES.negativePrompt, "text"),
  width: target(SKETCH2IMG_SCRIBBLE_BASIC_NODES.latentImage, "width"),
  height: target(SKETCH2IMG_SCRIBBLE_BASIC_NODES.latentImage, "height"),
  seed: target(SKETCH2IMG_SCRIBBLE_BASIC_NODES.sampler, "seed"),
  steps: target(SKETCH2IMG_SCRIBBLE_BASIC_NODES.sampler, "steps"),
  cfg: target(SKETCH2IMG_SCRIBBLE_BASIC_NODES.sampler, "cfg"),
  denoise: target(SKETCH2IMG_SCRIBBLE_BASIC_NODES.sampler, "denoise"),
  controlStrength: target(SKETCH2IMG_SCRIBBLE_BASIC_NODES.controlNetApply, "strength")
} as const;

const SKETCH2IMG_DEPTH_BASIC_INJECTIONS = {
  checkpoint: target(SKETCH2IMG_DEPTH_BASIC_NODES.checkpointLoader, "ckpt_name"),
  sourceImage: target(SKETCH2IMG_DEPTH_BASIC_NODES.loadImage, "image"),
  positivePrompt: target(SKETCH2IMG_DEPTH_BASIC_NODES.positivePrompt, "text"),
  negativePrompt: target(SKETCH2IMG_DEPTH_BASIC_NODES.negativePrompt, "text"),
  width: target(SKETCH2IMG_DEPTH_BASIC_NODES.latentImage, "width"),
  height: target(SKETCH2IMG_DEPTH_BASIC_NODES.latentImage, "height"),
  seed: target(SKETCH2IMG_DEPTH_BASIC_NODES.sampler, "seed"),
  steps: target(SKETCH2IMG_DEPTH_BASIC_NODES.sampler, "steps"),
  cfg: target(SKETCH2IMG_DEPTH_BASIC_NODES.sampler, "cfg"),
  denoise: target(SKETCH2IMG_DEPTH_BASIC_NODES.sampler, "denoise"),
  controlStrength: target(SKETCH2IMG_DEPTH_BASIC_NODES.controlNetApply, "strength")
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

const INPAINT_FLUX_FILL_CROPSTITCH_INJECTIONS = {
  checkpoint: target(INPAINT_FLUX_FILL_CROPSTITCH_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(INPAINT_FLUX_FILL_CROPSTITCH_NODES.loadImage, "image"),
  positivePrompt: target(INPAINT_FLUX_FILL_CROPSTITCH_NODES.positivePrompt, "text"),
  seed: target(INPAINT_FLUX_FILL_CROPSTITCH_NODES.sampler, "seed"),
  steps: target(INPAINT_FLUX_FILL_CROPSTITCH_NODES.sampler, "steps"),
  cfg: target(INPAINT_FLUX_FILL_CROPSTITCH_NODES.fluxGuidance, "guidance"),
  denoise: target(INPAINT_FLUX_FILL_CROPSTITCH_NODES.sampler, "denoise")
  // Deliberately no width/height injection. The panel's source dimensions
  // describe the captured selection context, and the sampling resolution here
  // is InpaintCropImproved's target size, which is a property of the technique
  // rather than something the artist picks per generation.
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

const FLUX2_DEV_GGUF_TXT2IMG_INJECTIONS = {
  checkpoint: target(FLUX2_DEV_GGUF_TXT2IMG_NODES.diffusionModelLoader, "unet_name"),
  positivePrompt: target(FLUX2_DEV_GGUF_TXT2IMG_NODES.positivePrompt, "text"),
  // Width and height go to TWO nodes. The latent node allocates the tensor and
  // the scheduler derives its shift from the same dimensions, so a size set on
  // only one of them silently produces a schedule for a different image than
  // the one being generated. This is the first preset to use the array form of
  // an injection target; normalizeTargets has always supported it.
  width: [
    target(FLUX2_DEV_GGUF_TXT2IMG_NODES.latentImage, "width"),
    target(FLUX2_DEV_GGUF_TXT2IMG_NODES.scheduler, "width")
  ],
  height: [
    target(FLUX2_DEV_GGUF_TXT2IMG_NODES.latentImage, "height"),
    target(FLUX2_DEV_GGUF_TXT2IMG_NODES.scheduler, "height")
  ],
  seed: target(FLUX2_DEV_GGUF_TXT2IMG_NODES.noise, "noise_seed"),
  steps: target(FLUX2_DEV_GGUF_TXT2IMG_NODES.scheduler, "steps"),
  // Same remap as txt2img-flux1-dev-fp8: there is no KSampler and therefore no
  // cfg widget, so the panel's CFG control drives FluxGuidance instead.
  cfg: target(FLUX2_DEV_GGUF_TXT2IMG_NODES.fluxGuidance, "guidance")
} as const;

const FLUX2_KLEIN_TXT2IMG_INJECTIONS = {
  checkpoint: target(FLUX2_KLEIN_TXT2IMG_NODES.diffusionModelLoader, "unet_name"),
  positivePrompt: target(FLUX2_KLEIN_TXT2IMG_NODES.positivePrompt, "text"),
  negativePrompt: target(FLUX2_KLEIN_TXT2IMG_NODES.negativePrompt, "text"),
  width: target(FLUX2_KLEIN_TXT2IMG_NODES.latentImage, "width"),
  height: target(FLUX2_KLEIN_TXT2IMG_NODES.latentImage, "height"),
  seed: target(FLUX2_KLEIN_TXT2IMG_NODES.sampler, "seed"),
  steps: target(FLUX2_KLEIN_TXT2IMG_NODES.sampler, "steps"),
  cfg: target(FLUX2_KLEIN_TXT2IMG_NODES.sampler, "cfg")
} as const;

const FLUX2_KLEIN_IMG2IMG_INJECTIONS = {
  checkpoint: target(FLUX2_KLEIN_IMG2IMG_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(FLUX2_KLEIN_IMG2IMG_NODES.loadImage, "image"),
  positivePrompt: target(FLUX2_KLEIN_IMG2IMG_NODES.positivePrompt, "text"),
  negativePrompt: target(FLUX2_KLEIN_IMG2IMG_NODES.negativePrompt, "text"),
  seed: target(FLUX2_KLEIN_IMG2IMG_NODES.sampler, "seed"),
  steps: target(FLUX2_KLEIN_IMG2IMG_NODES.sampler, "steps"),
  cfg: target(FLUX2_KLEIN_IMG2IMG_NODES.sampler, "cfg"),
  denoise: target(FLUX2_KLEIN_IMG2IMG_NODES.sampler, "denoise")
} as const;

const FLUX2_KLEIN_EDIT_INJECTIONS = {
  checkpoint: target(FLUX2_KLEIN_EDIT_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(FLUX2_KLEIN_EDIT_NODES.loadImage, "image"),
  positivePrompt: target(FLUX2_KLEIN_EDIT_NODES.positivePrompt, "text"),
  negativePrompt: target(FLUX2_KLEIN_EDIT_NODES.negativePrompt, "text"),
  seed: target(FLUX2_KLEIN_EDIT_NODES.sampler, "seed"),
  steps: target(FLUX2_KLEIN_EDIT_NODES.sampler, "steps"),
  cfg: target(FLUX2_KLEIN_EDIT_NODES.sampler, "cfg")
  // Deliberately no denoise target. Denoise 1 is not a default here, it is the
  // technique; injecting the panel's slider would quietly turn this back into
  // the image-to-image preset that sits next to it.
} as const;

const FLUX2_KLEIN_OUTPAINT_INJECTIONS = {
  checkpoint: target(FLUX2_KLEIN_OUTPAINT_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(FLUX2_KLEIN_OUTPAINT_NODES.loadImage, "image"),
  positivePrompt: target(FLUX2_KLEIN_OUTPAINT_NODES.positivePrompt, "text"),
  seed: target(FLUX2_KLEIN_OUTPAINT_NODES.sampler, "seed"),
  steps: target(FLUX2_KLEIN_OUTPAINT_NODES.sampler, "steps"),
  cfg: target(FLUX2_KLEIN_OUTPAINT_NODES.sampler, "cfg"),
  outpaintLeft: target(FLUX2_KLEIN_OUTPAINT_NODES.imagePad, "left"),
  outpaintTop: target(FLUX2_KLEIN_OUTPAINT_NODES.imagePad, "top"),
  outpaintRight: target(FLUX2_KLEIN_OUTPAINT_NODES.imagePad, "right"),
  outpaintBottom: target(FLUX2_KLEIN_OUTPAINT_NODES.imagePad, "bottom"),
  outpaintFeathering: target(FLUX2_KLEIN_OUTPAINT_NODES.imagePad, "feathering")
  // No denoise target, same as edit-flux2-klein: denoise 1 is the technique.
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

const SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_INJECTIONS = {
  checkpoint: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.loadImage, "image"),
  positivePrompt: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.positivePrompt, "text"),
  negativePrompt: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.negativePrompt, "text"),
  width: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.latentImage, "width"),
  height: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.latentImage, "height"),
  seed: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.sampler, "seed"),
  steps: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.sampler, "steps"),
  cfg: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.sampler, "cfg"),
  denoise: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.sampler, "denoise"),
  controlStrength: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.controlnetApply, "strength"),
  // width/height above are the *generation* size, floored to minimumGenerationSize.
  // These two are the captured canvas size the finished image is scaled back to,
  // which is why they cannot share an injection name with width/height.
  outputWidth: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.outputScale, "width"),
  outputHeight: target(SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.outputScale, "height")
} as const;

const KREA2_TURBO_TXT2IMG_INJECTIONS = {
  checkpoint: target(KREA2_TURBO_TXT2IMG_NODES.diffusionModelLoader, "unet_name"),
  positivePrompt: target(KREA2_TURBO_TXT2IMG_NODES.positivePrompt, "text"),
  negativePrompt: target(KREA2_TURBO_TXT2IMG_NODES.negativePrompt, "text"),
  width: target(KREA2_TURBO_TXT2IMG_NODES.latentImage, "width"),
  height: target(KREA2_TURBO_TXT2IMG_NODES.latentImage, "height"),
  seed: target(KREA2_TURBO_TXT2IMG_NODES.sampler, "seed"),
  steps: target(KREA2_TURBO_TXT2IMG_NODES.sampler, "steps"),
  cfg: target(KREA2_TURBO_TXT2IMG_NODES.sampler, "cfg")
} as const;

const KREA2_TURBO_IMG2IMG_INJECTIONS = {
  checkpoint: target(KREA2_TURBO_IMG2IMG_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(KREA2_TURBO_IMG2IMG_NODES.loadImage, "image"),
  positivePrompt: target(KREA2_TURBO_IMG2IMG_NODES.positivePrompt, "text"),
  negativePrompt: target(KREA2_TURBO_IMG2IMG_NODES.negativePrompt, "text"),
  seed: target(KREA2_TURBO_IMG2IMG_NODES.sampler, "seed"),
  steps: target(KREA2_TURBO_IMG2IMG_NODES.sampler, "steps"),
  cfg: target(KREA2_TURBO_IMG2IMG_NODES.sampler, "cfg"),
  denoise: target(KREA2_TURBO_IMG2IMG_NODES.sampler, "denoise")
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
    setupHint: "Install flux1-fill-dev.safetensors where ComfyUI's UNETLoader can find it.",
    downloadUrl: `${COMFY_ORG_FLUX1_DEV_REPO}/resolve/main/split_files/diffusion_models/flux1-fill-dev.safetensors`,
    sourcePageUrl: "https://huggingface.co/black-forest-labs/FLUX.1-Fill-dev",
    downloadSizeBytes: 23804922408,
    licenseGate: FLUX1_DEV_LICENSE
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
    setupHint: "Install clip_l.safetensors in ComfyUI models/text_encoders.",
    downloadUrl: `${FLUX_TEXT_ENCODERS_REPO}/resolve/main/clip_l.safetensors`,
    sourcePageUrl: FLUX_TEXT_ENCODERS_REPO,
    downloadSizeBytes: 246144152
  },
  {
    kind: "clip",
    objectInfoNode: "DualCLIPLoader",
    inputName: "clip_name2",
    label: "Flux text encoder",
    modelName: "t5xxl_fp16.safetensors",
    acceptedModelNames: ["t5xxl_fp8_e4m3fn.safetensors"],
    setupHint:
      "Install t5xxl_fp16.safetensors in ComfyUI models/text_encoders. t5xxl_fp8_e4m3fn.safetensors is accepted as a local fallback when available.",
    downloadUrl: `${FLUX_TEXT_ENCODERS_REPO}/resolve/main/t5xxl_fp16.safetensors`,
    sourcePageUrl: FLUX_TEXT_ENCODERS_REPO,
    downloadSizeBytes: 9787841024
  },
  {
    // Same file as the Z_image_Turbo stack's VAE entry, so the setup pack
    // de-duplicates it and downloads 335 MB once rather than twice.
    kind: "vae",
    objectInfoNode: "VAELoader",
    inputName: "vae_name",
    label: "Flux VAE",
    modelName: "ae.safetensors",
    setupHint: "Install ae.safetensors where ComfyUI's VAELoader can find it.",
    downloadUrl: `${COMFY_ORG_Z_IMAGE_TURBO_REPO}/resolve/main/split_files/vae/ae.safetensors`,
    sourcePageUrl: COMFY_ORG_Z_IMAGE_TURBO_REPO,
    downloadSizeBytes: 335304388
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

const SKETCH2IMG_SCRIBBLE_BASIC_CAPABILITY: WorkflowCapability = {
  toolType: "sketch2img",
  loaderType: "checkpoint",
  artistLabel: "Sketch to Image",
  technicalLabel: "sketch2img-scribble-basic",
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
    experimentalNote: "Starter SD 1.x Scribble ControlNet workflow."
  }
};

const SKETCH2IMG_DEPTH_BASIC_CAPABILITY: WorkflowCapability = {
  toolType: "sketch2img",
  loaderType: "checkpoint",
  artistLabel: "Sketch to Image",
  technicalLabel: "sketch2img-depth-basic",
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
    experimentalNote: "Starter SD 1.x Depth ControlNet workflow."
  }
};

const SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_CAPABILITY: WorkflowCapability = {
  toolType: "sketch2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Sketch to Image",
  technicalLabel: "sketch2img-zimage-fun-controlnet",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "denoise", "seed", "controlStrength"],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Diffusion model",
    primaryActionLabel: "Generate Sketch to Image",
    experimentalNote:
      "Z-Image Fun ControlNet reads your sketch through one modern ControlNet rather than the SD 1.x LineArt, Scribble, or Depth stack. It handles pencil on toned paper as happily as clean ink, and works from dark lines on a light background. Control strength 1.0 is the default and is what holds your drawing; lower it toward 0.6 to let the model stray further from the lines. This is the lite patch (2.0 GB, faster) and it suits bold, sparse line art best -- for shaded or densely drawn work try the Full preset, which renders more photographically."
  }
};

const SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_FULL_CAPABILITY: WorkflowCapability = {
  toolType: "sketch2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Sketch to Image",
  technicalLabel: "sketch2img-zimage-fun-controlnet-full",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "denoise", "seed", "controlStrength"],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Diffusion model",
    primaryActionLabel: "Generate Sketch to Image",
    experimentalNote:
      "The full Z-Image Fun ControlNet Union patch (6.7 GB, slower than the Lite preset). Best on detailed drawings -- shaded pencil, dense linework -- where it renders more photographically than Lite. Control strength defaults to 0.6 here rather than Lite's 1.0 because these weights control far more strongly; push it much past 0.75 and your pencil lines start appearing on the finished face. For sparse, bold outline drawings try the Lite preset instead, which handles them better than this one does at any strength."
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
    primaryActionLabel: "Generate Inpaint"
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
    primaryActionLabel: "Generate Inpaint"
  }
};

const INPAINT_FLUX_FILL_CROPSTITCH_CAPABILITY: WorkflowCapability = {
  toolType: "inpaint",
  loaderType: "diffusion-model-stack",
  artistLabel: "Inpaint",
  technicalLabel: "inpaint-flux-fill-cropstitch",
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
    experimentalNote:
      "Needs the comfyui-inpaint-cropandstitch node pack. It crops to your mask plus 50% context, samples that at 1024px, and stitches the patch back with a 32px blended seam -- so a small mask on a big document is sampled at the resolution Flux Fill was trained for instead of at whatever size the selection happened to be. Prefer the plain Flux Fill preset when the masked area already fills most of the captured context."
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
    primaryActionLabel: "Generate Outpaint"
  }
};

const FLUX2_DEV_GGUF_TXT2IMG_CAPABILITY: WorkflowCapability = {
  toolType: "txt2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Text to Image",
  technicalLabel: "txt2img-flux2-dev-gguf",
  requiredPhotoshopInputs: [],
  // No negativePrompt: Flux.2 is guidance-distilled and the reference graph has
  // no negative conditioning node at all, so the control is hidden rather than
  // wired to something that would quietly do nothing.
  controls: ["prompt", "width", "height", "steps", "guidance", "seed"],
  output: {
    kind: "full-image",
    size: "preset",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Flux.2 model",
    primaryActionLabel: "Generate",
    hiddenControls: ["negativePrompt"],
    experimentalNote:
      "Flux.2 dev is a very large stack: an 18.7 GB quantised model plus a 16.8 GB text encoder. On a 12 GB card ComfyUI streams most of it from system RAM, so expect minutes per image rather than seconds."
  }
};

const FLUX2_KLEIN_TXT2IMG_CAPABILITY: WorkflowCapability = {
  toolType: "txt2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Text to Image",
  technicalLabel: "txt2img-flux2-klein",
  requiredPhotoshopInputs: [],
  controls: ["prompt", "negativePrompt", "width", "height", "steps", "cfg", "seed"],
  output: {
    kind: "full-image",
    size: "preset",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Klein model",
    primaryActionLabel: "Generate",
    experimentalNote:
      "FLUX.2 Klein 4B, distilled: 4 steps at CFG 1. This is the answer to \"why does Flux.2 Dev feel slow\" -- Dev wants 20 steps through a 20 GB model, Klein wants 4 through a 4 GB one. Raising steps or CFG will not improve it; the model is distilled for this operating point and drifts away from it."
  }
};

const FLUX2_KLEIN_IMG2IMG_CAPABILITY: WorkflowCapability = {
  toolType: "img2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Image to Image",
  technicalLabel: "img2img-flux2-klein",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "denoise", "seed"],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Klein model",
    primaryActionLabel: "Generate Image to Image"
  }
};

const FLUX2_KLEIN_EDIT_CAPABILITY: WorkflowCapability = {
  toolType: "img2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Image to Image",
  technicalLabel: "edit-flux2-klein",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "seed"],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Klein model",
    primaryActionLabel: "Generate Edit",
    hiddenControls: ["denoise"],
    experimentalNote:
      "Instruction editing, not image-to-image. Write what you want CHANGED -- \"make the jacket red\", \"remove the parked car\", \"turn the sky to dusk\" -- rather than describing the whole picture. The rest of the frame is held by reference conditioning rather than by a low denoise, so it stays put far better than the image-to-image preset while still obeying the instruction. Denoise is hidden because it is fixed at 1; that is the technique, not a default."
  }
};

const FLUX2_KLEIN_OUTPAINT_CAPABILITY: WorkflowCapability = {
  toolType: "outpaint",
  loaderType: "diffusion-model-stack",
  artistLabel: "Outpaint",
  technicalLabel: "outpaint-flux2-klein",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: [
    "prompt",
    "steps",
    "cfg",
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
    modelSelectorLabel: "Klein model",
    primaryActionLabel: "Generate Outpaint",
    hiddenControls: ["denoise"],
    experimentalNote:
      "Klein outpainting in four steps, using the comfyui-inpaint-cropandstitch pack rather than a Fill model. Your existing pixels are composited back untouched -- only the new border is generated -- so the feathering slider controls the join, not how much of your image survives. Describe the WIDER scene you want revealed rather than what is already there. Denoise is fixed at 1."
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
    primaryActionLabel: "Generate"
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
    primaryActionLabel: "Generate Image to Image"
  }
};

const KREA2_TURBO_TXT2IMG_CAPABILITY: WorkflowCapability = {
  toolType: "txt2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Text to Image",
  technicalLabel: "txt2img-krea2-turbo",
  requiredPhotoshopInputs: [],
  controls: ["prompt", "negativePrompt", "width", "height", "steps", "cfg", "seed"],
  output: {
    kind: "full-image",
    size: "preset",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Krea-2 model",
    primaryActionLabel: "Generate",
    experimentalNote:
      "Krea-2 Turbo follows the official ComfyUI template: 8 steps at CFG 1 with the euler/simple sampler. The negative prompt has no effect at CFG 1."
  }
};

const KREA2_TURBO_IMG2IMG_CAPABILITY: WorkflowCapability = {
  toolType: "img2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Image to Image",
  technicalLabel: "img2img-krea2-turbo",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "denoise", "seed"],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Krea-2 model",
    primaryActionLabel: "Generate Image to Image",
    experimentalNote:
      "Krea-2 Turbo Image to Image runs 8 steps at CFG 1. Use denoise around 0.6-0.8 to balance the source against the prompt."
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

export const WORKFLOW_PRESETS: WorkflowPresetDefinition[] = [
  {
    id: "txt2img-basic",
    label: "txt2img-basic",
    displayName: "Standard checkpoint",
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
    loraInsertion: TXT2IMG_BASIC_LORA_INSERTION,
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
    displayName: "Flux1-dev fp8",
    mode: "txt2img",
    description: "Experimental Flux1-dev fp8 text-to-image workflow using a checkpoint-style ComfyUI graph.",
    workflowFile: "workflows/api/txt2img-flux1-dev-fp8.json",
    sourceWorkflowFile: "workflows/source/txt2img-flux1-dev-fp8.workflow.json",
    status: "stable",
    recommendedSettings: { steps: 20, cfg: 3.5 },
    supportedModelFamilies: ["flux"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "zImage", "unknown"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    capability: FLUX1_DEV_FP8_TXT2IMG_CAPABILITY,
    requiredModels: [FLUX1_DEV_FP8_CHECKPOINT],
    injections: FLUX1_DEV_FP8_TXT2IMG_INJECTIONS,
    loraInsertion: FLUX1_DEV_FP8_TXT2IMG_LORA_INSERTION,
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
    displayName: "Standard checkpoint",
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
    loraInsertion: IMG2IMG_BASIC_LORA_INSERTION,
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
    displayName: "Florence-2 PromptGen",
    mode: "prompt",
    description: "Experimental Florence-2 PromptGen workflow that describes a captured Photoshop layer or canvas.",
    workflowFile: "workflows/api/prompt-from-layer-florence2.json",
    sourceWorkflowFile: "workflows/source/prompt-from-layer-florence2.workflow.json",
    status: "stable",
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "zImage"],
    modelSource: FLORENCE_MODEL_SOURCE,
    capability: PROMPT_FROM_LAYER_FLORENCE2_CAPABILITY,
    requiredModels: [FLORENCE2_PROMPTGEN_MODEL],
    injections: PROMPT_FROM_LAYER_FLORENCE2_INJECTIONS,
    compatibilityNote:
      "prompt-from-layer-florence2 needs only comfyui-florence2. The caption is published by core ComfyUI's PreviewAny node, so it returns text from ComfyUI history instead of an image.",
    requiredNodes: [
      {
        id: PROMPT_FROM_LAYER_FLORENCE2_NODES.modelLoader,
        classType: "Florence2ModelLoader",
        requiredInputs: ["model", "precision"]
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
        id: PROMPT_FROM_LAYER_FLORENCE2_NODES.textPreview,
        classType: "PreviewAny",
        requiredInputs: ["source"]
      }
    ]
  },
  {
    id: "upscale-basic",
    label: "upscale-basic",
    displayName: "Standard upscaler",
    mode: "upscale",
    description: "Experimental pixel upscale through ComfyUI UpscaleModelLoader and ImageUpscaleWithModel.",
    workflowFile: "workflows/api/upscale-basic.json",
    sourceWorkflowFile: "workflows/source/upscale-basic.workflow.json",
    status: "stable",
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
    displayName: "LineArt ControlNet",
    mode: "sketch2img",
    description: "Experimental SD 1.x LineArt ControlNet sketch guidance workflow.",
    workflowFile: "workflows/api/sketch2img-linecn-basic.json",
    sourceWorkflowFile: "workflows/source/sketch2img-linecn-basic.workflow.json",
    status: "stable",
    recommendedSettings: { steps: 20, cfg: 7 },
    supportedModelFamilies: ["sd1"],
    experimentalModelFamilies: ["sdxl", "sd3", "flux", "zImage"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    capability: SKETCH2IMG_LINECN_BASIC_CAPABILITY,
    injections: SKETCH2IMG_LINECN_BASIC_INJECTIONS,
    loraInsertion: createSketchLoraInsertion(SKETCH2IMG_LINECN_BASIC_NODES),
    compatibilityNote:
      "sketch2img-linecn-basic generates from an empty latent at the sketch size while the SD 1.5 LineArt ControlNet guides structure, so colors render fully instead of inheriting the white sketch paper. Keep denoise at 1 for a full render, or lower it only when blending with a colored source. It uses the AnyLine detector rather than the standard Lineart preprocessor, which returns a blank control image -- and so silently degrades to plain text-to-image -- for light-on-dark art or solid filled shapes.",
    requiredModels: [
      {
        kind: "controlnet",
        objectInfoNode: "ControlNetLoader",
        inputName: "control_net_name",
        label: "LineArt ControlNet",
        modelName: "control_v11p_sd15_lineart_fp16.safetensors",
        setupHint: "Install an SD 1.5 LineArt ControlNet model in ComfyUI's controlnet models folder.",
        downloadUrl:
          "https://huggingface.co/comfyanonymous/ControlNet-v1-1_fp16_safetensors/resolve/main/control_v11p_sd15_lineart_fp16.safetensors",
        sourcePageUrl: "https://huggingface.co/comfyanonymous/ControlNet-v1-1_fp16_safetensors",
        downloadSizeBytes: 722601100
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
        id: SKETCH2IMG_LINECN_BASIC_NODES.latentImage,
        classType: "EmptyLatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: SKETCH2IMG_LINECN_BASIC_NODES.lineArtPreprocessor,
        classType: "AnyLineArtPreprocessor_aux",
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
    id: "sketch2img-scribble-basic",
    label: "sketch2img-scribble-basic",
    displayName: "Scribble ControlNet",
    mode: "sketch2img",
    description: "Experimental SD 1.x Scribble ControlNet sketch guidance workflow.",
    workflowFile: "workflows/api/sketch2img-scribble-basic.json",
    sourceWorkflowFile: "workflows/source/sketch2img-scribble-basic.workflow.json",
    status: "stable",
    recommendedSettings: { steps: 20, cfg: 7 },
    supportedModelFamilies: ["sd1"],
    experimentalModelFamilies: ["sdxl", "sd3", "flux", "zImage"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    capability: SKETCH2IMG_SCRIBBLE_BASIC_CAPABILITY,
    injections: SKETCH2IMG_SCRIBBLE_BASIC_INJECTIONS,
    loraInsertion: createSketchLoraInsertion(SKETCH2IMG_SCRIBBLE_BASIC_NODES),
    compatibilityNote:
      "sketch2img-scribble-basic suits loose, gestural strokes: it keeps the sketch's broad shapes and lets the model invent the detail, where the LineArt preset holds the drawn line. Pick Scribble for a rough thumbnail, LineArt for clean inked art. It uses the PiDiNet edge detector rather than the plain Scribble preprocessor, which returns a blank control image -- and so silently degrades to plain text-to-image -- for light-on-dark art or solid filled shapes.",
    requiredModels: [
      {
        kind: "controlnet",
        objectInfoNode: "ControlNetLoader",
        inputName: "control_net_name",
        label: "Scribble ControlNet",
        modelName: "control_v11p_sd15_scribble_fp16.safetensors",
        setupHint: "Install an SD 1.5 Scribble ControlNet model in ComfyUI's controlnet models folder.",
        downloadUrl:
          "https://huggingface.co/comfyanonymous/ControlNet-v1-1_fp16_safetensors/resolve/main/control_v11p_sd15_scribble_fp16.safetensors",
        sourcePageUrl: "https://huggingface.co/comfyanonymous/ControlNet-v1-1_fp16_safetensors",
        downloadSizeBytes: 722601100
      }
    ],
    requiredNodes: [
      {
        id: SKETCH2IMG_SCRIBBLE_BASIC_NODES.checkpointLoader,
        classType: "CheckpointLoaderSimple",
        requiredInputs: ["ckpt_name"]
      },
      {
        id: SKETCH2IMG_SCRIBBLE_BASIC_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: SKETCH2IMG_SCRIBBLE_BASIC_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: SKETCH2IMG_SCRIBBLE_BASIC_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: SKETCH2IMG_SCRIBBLE_BASIC_NODES.latentImage,
        classType: "EmptyLatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: SKETCH2IMG_SCRIBBLE_BASIC_NODES.scribblePreprocessor,
        classType: "Scribble_PiDiNet_Preprocessor",
        requiredInputs: ["image"]
      },
      {
        id: SKETCH2IMG_SCRIBBLE_BASIC_NODES.controlNetLoader,
        classType: "ControlNetLoader",
        requiredInputs: ["control_net_name"]
      },
      {
        id: SKETCH2IMG_SCRIBBLE_BASIC_NODES.controlNetApply,
        classType: "ControlNetApplyAdvanced",
        requiredInputs: ["positive", "negative", "control_net", "image", "strength", "start_percent", "end_percent"]
      },
      {
        id: SKETCH2IMG_SCRIBBLE_BASIC_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["seed", "steps", "cfg", "denoise", "model", "positive", "negative", "latent_image"]
      },
      {
        id: SKETCH2IMG_SCRIBBLE_BASIC_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ]
  },
  {
    id: "sketch2img-depth-basic",
    label: "sketch2img-depth-basic",
    displayName: "Depth ControlNet",
    mode: "sketch2img",
    description: "SD 1.x sketch-to-image workflow that conditions on the source layer's depth rather than its lines.",
    workflowFile: "workflows/api/sketch2img-depth-basic.json",
    sourceWorkflowFile: "workflows/source/sketch2img-depth-basic.workflow.json",
    status: "stable",
    recommendedSettings: { steps: 20, cfg: 7 },
    supportedModelFamilies: ["sd1"],
    experimentalModelFamilies: ["sdxl", "sd3", "flux", "zImage"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    capability: SKETCH2IMG_DEPTH_BASIC_CAPABILITY,
    injections: SKETCH2IMG_DEPTH_BASIC_INJECTIONS,
    loraInsertion: createSketchLoraInsertion(SKETCH2IMG_DEPTH_BASIC_NODES),
    compatibilityNote:
      "sketch2img-depth-basic conditions on estimated scene depth, so it holds perspective and the relative distance of forms while leaving surface detail free -- the preset to reach for when a generated element has to sit inside an existing composite at the right camera angle. LineArt and Scribble hold the drawn stroke instead, and neither carries depth. It works from any shaded image, not only a line drawing, and a flat drawing with no tonal variation gives the estimator little to read. DepthAnythingV2Preprocessor downloads its own estimator weights on first run, the same way the LineArt and Scribble preprocessors do, so the first generation after install is slower than later ones.",
    requiredModels: [
      {
        kind: "controlnet",
        objectInfoNode: "ControlNetLoader",
        inputName: "control_net_name",
        label: "Depth ControlNet",
        modelName: "control_v11f1p_sd15_depth_fp16.safetensors",
        setupHint: "Install an SD 1.5 Depth ControlNet model in ComfyUI's controlnet models folder.",
        downloadUrl:
          "https://huggingface.co/comfyanonymous/ControlNet-v1-1_fp16_safetensors/resolve/main/control_v11f1p_sd15_depth_fp16.safetensors",
        sourcePageUrl: "https://huggingface.co/comfyanonymous/ControlNet-v1-1_fp16_safetensors",
        downloadSizeBytes: 722601100
      }
    ],
    requiredNodes: [
      {
        id: SKETCH2IMG_DEPTH_BASIC_NODES.checkpointLoader,
        classType: "CheckpointLoaderSimple",
        requiredInputs: ["ckpt_name"]
      },
      {
        id: SKETCH2IMG_DEPTH_BASIC_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: SKETCH2IMG_DEPTH_BASIC_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: SKETCH2IMG_DEPTH_BASIC_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: SKETCH2IMG_DEPTH_BASIC_NODES.latentImage,
        classType: "EmptyLatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: SKETCH2IMG_DEPTH_BASIC_NODES.depthPreprocessor,
        // Only `image` is required; ckpt_name and resolution are optional inputs
        // that the workflow pins explicitly so a run is reproducible rather than
        // dependent on whatever default the node pack ships that week.
        classType: "DepthAnythingV2Preprocessor",
        requiredInputs: ["image"]
      },
      {
        id: SKETCH2IMG_DEPTH_BASIC_NODES.controlNetLoader,
        classType: "ControlNetLoader",
        requiredInputs: ["control_net_name"]
      },
      {
        id: SKETCH2IMG_DEPTH_BASIC_NODES.controlNetApply,
        classType: "ControlNetApplyAdvanced",
        requiredInputs: ["positive", "negative", "control_net", "image", "strength", "start_percent", "end_percent"]
      },
      {
        id: SKETCH2IMG_DEPTH_BASIC_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["seed", "steps", "cfg", "denoise", "model", "positive", "negative", "latent_image"]
      },
      {
        id: SKETCH2IMG_DEPTH_BASIC_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ]
  },
  {
    id: "sketch2img-zimage-fun-controlnet",
    label: "sketch2img-zimage-fun-controlnet",
    displayName: "Z-Image Fun ControlNet Union (Lite)",
    mode: "sketch2img",
    description:
      "Sketch guidance for the Z_image_Turbo diffusion model stack using Alibaba-PAI's Z-Image Fun ControlNet Union 2.1 lite model patch.",
    workflowFile: "workflows/api/sketch2img-zimage-fun-controlnet.json",
    sourceWorkflowFile: "workflows/source/sketch2img-zimage-fun-controlnet.workflow.json",
    status: "stable",
    recommendedSettings: { steps: 8, cfg: 1, controlStrength: 1 },
    // Z_image_Turbo is a 1024-native model. Measured on a 447px canvas: at 448
    // the result is the ControlNet's line map over a maze-like texture, at 768
    // it is bare glowing lines on black, and at 1024 the same seed renders a
    // clean portrait. The floor is not cosmetic -- below it nothing usable
    // comes out at all.
    minimumGenerationSize: 1024,
    supportedModelFamilies: ["zImage"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_CAPABILITY,
    modelStack: [...Z_IMAGE_TURBO_STACK, Z_IMAGE_FUN_CONTROLNET_UNION_LITE_MODEL],
    requiredModels: [...Z_IMAGE_TURBO_STACK, Z_IMAGE_FUN_CONTROLNET_UNION_LITE_MODEL],
    injections: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_INJECTIONS,
    compatibilityNote:
      "sketch2img-zimage-fun-controlnet reads the sketch through ZImageFunControlnet, which patches the Z_image_Turbo model directly rather than steering conditioning the way ControlNetApplyAdvanced does. Apply it before ModelSamplingAuraFlow, the same ordering the optional LoRA insertion would use, since ModelSamplingAuraFlow must be the last wrapper before the sampler. The sketch goes through AnyLineArtPreprocessor_aux first, the same detector sketch2img-linecn-basic uses, because these weights want a real control map -- light lines on a genuinely black field -- and not a photograph of a drawing. Simply inverting the captured layer is not good enough and was the first thing tried: it only produces a black field when the paper is near-white, so a pencil drawing on toned paper inverts to a mid-grey field covering the whole canvas, the ControlNet reads that field as content, and the model reproduces the inverted sketch as glowing lines on a dark ground at every strength that controls anything at all. Plain Canny fails the opposite way, finding almost no edges in faint pencil at its default thresholds and double-tracing thick brush strokes into ribbons. The preprocessor normalises both cases, which is why it earns the dependency on comfyui_controlnet_aux that the rest of this graph would not otherwise need. The lite-2602-8steps weights were picked over the full 2.1 union on a synthetic benchmark: at strength 1.0, a cat outline plus a prompt for an unrelated subject returned a bronze cat in the drawn pose from the lite weights against an unrelated abstract sculpture from the full weights, and lite is distilled for this preset's 8-step, cfg 1 operating point where the undistilled full weights want more of both, and 2.0 GB against 6.7 GB. That benchmark did not settle it, and the follow-up measurements show why neither preset replaces the other: on a dense pencil portrait the full weights render more photographically than these do, while on a sparse bold outline these hold the drawing where the full weights flatten it into a filled sticker at every strength tried. Reach for this preset on bold sparse line art and for sketch2img-zimage-fun-controlnet-full on shaded or densely drawn work. Finally, this preset renders at a floor of 1024 on the long edge and scales the finished image back down to the captured canvas, because Z_image_Turbo is a 1024-native model and does not degrade gracefully below that: on a 447px document the same seed gives the ControlNet's own line map over a maze-like texture at 448, bare glowing lines on black at 768, and a clean portrait at 1024. Generating small and scaling up afterwards would not fix it, since the artefact is in what the model samples, not in the pixels it is resized to.",
    requiredNodes: [
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.modelPatchLoader,
        classType: "ModelPatchLoader",
        requiredInputs: ["name"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.lineArtPreprocessor,
        classType: "AnyLineArtPreprocessor_aux",
        requiredInputs: ["image"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.controlnetApply,
        classType: "ZImageFunControlnet",
        requiredInputs: ["model", "model_patch", "vae", "strength"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.modelSampling,
        classType: "ModelSamplingAuraFlow",
        requiredInputs: ["model", "shift"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.latentImage,
        classType: "EmptySD3LatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["seed", "steps", "cfg", "denoise", "model", "positive", "negative", "latent_image"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.outputScale,
        classType: "ImageScale",
        requiredInputs: ["image", "upscale_method", "width", "height", "crop"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ]
  },
  {
    id: "sketch2img-zimage-fun-controlnet-full",
    label: "sketch2img-zimage-fun-controlnet-full",
    displayName: "Z-Image Fun ControlNet Union (Full)",
    mode: "sketch2img",
    description:
      "Sketch guidance for the Z_image_Turbo diffusion model stack using Alibaba-PAI's full Z-Image Fun ControlNet Union 2.1 model patch.",
    workflowFile: "workflows/api/sketch2img-zimage-fun-controlnet-full.json",
    sourceWorkflowFile: "workflows/source/sketch2img-zimage-fun-controlnet-full.workflow.json",
    status: "stable",
    // 0.6, not the lite preset's 1.0. These weights patch 15 layer blocks
    // against lite's 3, so the same number is roughly five times the control:
    // measured on a pencil portrait at a fixed seed, 1.0 traces the drawn
    // graphite across the rendered face, 0.75 leaves faint line bleed on the
    // neck, and 0.6 renders cleanly while still holding the pose. Below about
    // 0.45 the drawing stops being followed at all.
    recommendedSettings: { steps: 8, cfg: 1, controlStrength: 0.6 },
    // Same 1024 floor as the lite preset -- it comes from Z_image_Turbo itself,
    // not from which ControlNet patch is loaded on top of it.
    minimumGenerationSize: 1024,
    supportedModelFamilies: ["zImage"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_FULL_CAPABILITY,
    modelStack: [...Z_IMAGE_TURBO_STACK, Z_IMAGE_FUN_CONTROLNET_UNION_FULL_MODEL],
    requiredModels: [...Z_IMAGE_TURBO_STACK, Z_IMAGE_FUN_CONTROLNET_UNION_FULL_MODEL],
    // Same graph shape as sketch2img-zimage-fun-controlnet node for node -- the
    // two workflow JSON files differ only in which file ModelPatchLoader names
    // -- so this preset reuses that preset's node-id map and injection targets
    // rather than restating an identical mapping under a new name.
    injections: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_INJECTIONS,
    compatibilityNote:
      "sketch2img-zimage-fun-controlnet-full is sketch2img-zimage-fun-controlnet's sibling, same graph, same AnyLineArtPreprocessor_aux control map, same 1024 generation floor, differing only in which Z-Image Fun ControlNet Union weights ModelPatchLoader loads and in control strength. The two are genuinely complementary rather than one being better, and the measurements say where each belongs. On a dense pencil portrait the full weights render far more photographically than lite, but only below about 0.75 strength: at a fixed seed, 1.0 traced the drawn graphite across the finished face, 0.75 left faint line bleed along the neck, 0.6 was clean while still holding the pose, and 0.45 and below stopped following the drawing at all. That is why this preset defaults to 0.6 where lite defaults to 1.0 -- these weights patch 15 layer blocks against lite's 3, so an identical number is roughly five times the control, and shipping lite's 1.0 here 'for parity' was an unmeasured guess that produced exactly the traced-pencil artefact described above. On a sparse, bold outline drawing the ranking inverts and no strength rescues it: 0.6, 0.85 and 1.0 all flattened a thick brush outline of a cat into a filled white sticker over an unrelated photograph, where the lite weights at 1.0 render the same sketch as a plausible cat. Reach for this preset on shaded or densely drawn work and for the lite preset on bold sparse line art. Alibaba-PAI's model card also says these undistilled weights want more steps and cfg than the 8-step, cfg 1 point lite was distilled for, so raising both in Advanced settings is the first thing to try if a result looks under-rendered.",
    requiredNodes: [
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.modelPatchLoader,
        classType: "ModelPatchLoader",
        requiredInputs: ["name"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.lineArtPreprocessor,
        classType: "AnyLineArtPreprocessor_aux",
        requiredInputs: ["image"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.controlnetApply,
        classType: "ZImageFunControlnet",
        requiredInputs: ["model", "model_patch", "vae", "strength"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.modelSampling,
        classType: "ModelSamplingAuraFlow",
        requiredInputs: ["model", "shift"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.latentImage,
        classType: "EmptySD3LatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["seed", "steps", "cfg", "denoise", "model", "positive", "negative", "latent_image"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.outputScale,
        classType: "ImageScale",
        requiredInputs: ["image", "upscale_method", "width", "height", "crop"]
      },
      {
        id: SKETCH2IMG_ZIMAGE_FUN_CONTROLNET_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ]
  },
  {
    id: "inpaint-basic",
    label: "inpaint-basic",
    displayName: "Standard checkpoint",
    mode: "inpaint",
    description: "Experimental SD 1.x inpainting workflow using a Photoshop selection source and mask.",
    workflowFile: "workflows/api/inpaint-basic.json",
    sourceWorkflowFile: "workflows/source/inpaint-basic.workflow.json",
    status: "stable",
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
      "inpaint-basic is an SD 1.x workflow using LoadImage, ImageToMask, and InpaintModelConditioning. Start with an SD 1.x inpaint checkpoint."
  },
  {
    id: "inpaint-flux-fill-basic",
    label: "inpaint-flux-fill-basic",
    displayName: "Flux Fill",
    mode: "inpaint",
    description: "Experimental Flux Fill inpainting workflow using a diffusion model stack.",
    workflowFile: "workflows/api/inpaint-flux-fill-basic.json",
    sourceWorkflowFile: "workflows/source/inpaint-flux-fill-basic.workflow.json",
    status: "stable",
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
      "inpaint-flux-fill-basic follows the Flux Fill reference graph: UNETLoader, DifferentialDiffusion, DualCLIPLoader, FluxGuidance, InpaintModelConditioning, KSampler, VAEDecode, and SaveImage. OpenLayer embeds the Photoshop mask into the uploaded PNG alpha channel for the LoadImage mask output. T5 prefers t5xxl_fp16.safetensors and accepts t5xxl_fp8_e4m3fn.safetensors as a fallback."
  },
  {
    id: "inpaint-flux-fill-cropstitch",
    label: "inpaint-flux-fill-cropstitch",
    displayName: "Flux Fill (crop & stitch)",
    mode: "inpaint",
    description:
      "Flux Fill inpainting that crops to the mask plus context, samples at 1024px, and stitches the patch back with a blended seam.",
    workflowFile: "workflows/api/inpaint-flux-fill-cropstitch.json",
    status: "stable",
    recommendedSettings: { steps: 20, cfg: 30 },
    supportedModelFamilies: ["flux"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "zImage", "unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: INPAINT_FLUX_FILL_CROPSTITCH_CAPABILITY,
    modelStack: [...FLUX_FILL_STACK],
    requiredModels: [...FLUX_FILL_STACK],
    injections: INPAINT_FLUX_FILL_CROPSTITCH_INJECTIONS,
    requiredNodes: [
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.differentialDiffusion,
        classType: "DifferentialDiffusion",
        requiredInputs: ["model"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.dualClipLoader,
        classType: "DualCLIPLoader",
        requiredInputs: ["clip_name1", "clip_name2", "type"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.inpaintCrop,
        classType: "InpaintCropImproved",
        requiredInputs: [
          "image",
          "mask",
          "context_from_mask_extend_factor",
          "output_resize_to_target_size",
          "output_target_width",
          "output_target_height",
          "mask_blend_pixels"
        ]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.fluxGuidance,
        classType: "FluxGuidance",
        requiredInputs: ["conditioning", "guidance"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.negativeConditioning,
        classType: "ConditioningZeroOut",
        requiredInputs: ["conditioning"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.inpaintConditioning,
        classType: "InpaintModelConditioning",
        requiredInputs: ["positive", "negative", "vae", "pixels", "mask", "noise_mask"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.inpaintStitch,
        classType: "InpaintStitchImproved",
        requiredInputs: ["stitcher", "inpainted_image"]
      },
      {
        id: INPAINT_FLUX_FILL_CROPSTITCH_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ],
    compatibilityNote:
      "inpaint-flux-fill-cropstitch is inpaint-flux-fill-basic with InpaintCropImproved and InpaintStitchImproved from lquesada's comfyui-inpaint-cropandstitch wrapped around the sampler chain. The crop node takes the LoadImage image and mask, so OpenLayer still uploads one PNG carrying the Photoshop mask in its alpha channel, and the stitch node returns an image the same size as that upload -- which is what keeps the aligned Photoshop import valid."
  },
  {
    id: "outpaint-flux-fill-basic",
    label: "outpaint-flux-fill-basic",
    displayName: "Flux Fill",
    mode: "outpaint",
    description: "Experimental Flux Fill outpainting workflow using ImagePadForOutpaint.",
    workflowFile: "workflows/api/outpaint-flux-fill-basic.json",
    sourceWorkflowFile: "workflows/source/outpaint-flux-fill-basic.workflow.json",
    status: "stable",
    recommendedSettings: { steps: 20, cfg: 10 },
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
      "outpaint-flux-fill-basic follows the attached Flux Fill outpaint graph: ImagePadForOutpaint creates the padded image and mask, then Flux Fill generates the expanded result. T5 prefers t5xxl_fp16.safetensors and accepts t5xxl_fp8_e4m3fn.safetensors as a fallback."
  },
  {
    id: "txt2img-flux2-klein",
    label: "txt2img-flux2-klein",
    displayName: "FLUX.2 Klein",
    mode: "txt2img",
    description: "Fast text-to-image preset for the distilled FLUX.2 Klein 4B diffusion model stack.",
    workflowFile: "workflows/api/txt2img-flux2-klein.json",
    status: "stable",
    recommendedSettings: { steps: 4, cfg: 1 },
    supportedModelFamilies: ["flux2"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: FLUX2_KLEIN_TXT2IMG_CAPABILITY,
    modelStack: [...FLUX2_KLEIN_4B_STACK],
    requiredModels: [...FLUX2_KLEIN_4B_STACK],
    injections: FLUX2_KLEIN_TXT2IMG_INJECTIONS,
    requiredNodes: [
      {
        id: FLUX2_KLEIN_TXT2IMG_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: FLUX2_KLEIN_TXT2IMG_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: FLUX2_KLEIN_TXT2IMG_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: FLUX2_KLEIN_TXT2IMG_NODES.modelSampling,
        classType: "ModelSamplingAuraFlow",
        requiredInputs: ["model", "shift"]
      },
      {
        id: FLUX2_KLEIN_TXT2IMG_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: FLUX2_KLEIN_TXT2IMG_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: FLUX2_KLEIN_TXT2IMG_NODES.latentImage,
        classType: "EmptyFlux2LatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: FLUX2_KLEIN_TXT2IMG_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: FLUX2_KLEIN_TXT2IMG_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: FLUX2_KLEIN_TXT2IMG_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ],
    compatibilityNote:
      "FLUX.2 Klein 4B is a diffusion model stack, not a checkpoint: UNETLoader, CLIPLoader with type flux2, and VAELoader. It shares qwen_3_4b.safetensors with the Z_image_Turbo stack, so a user who already has that preset downloads only the 4 GB model and the 336 MB Flux.2 VAE. The latent is EmptyFlux2LatentImage rather than EmptySD3LatentImage -- Flux.2's latent geometry differs, and the SD3 node produces a tensor the sampler silently mis-shapes. Sampler settings are the distilled operating point: 4 steps, CFG 1, er_sde, simple, with ModelSamplingAuraFlow shift 3. Klein is Apache-2.0 and ungated, unlike FLUX.1-dev and FLUX.2-dev."
  },
  {
    id: "img2img-flux2-klein",
    label: "img2img-flux2-klein",
    displayName: "FLUX.2 Klein",
    mode: "img2img",
    description: "Fast image-to-image preset for the distilled FLUX.2 Klein 4B diffusion model stack.",
    workflowFile: "workflows/api/img2img-flux2-klein.json",
    status: "stable",
    recommendedSettings: { steps: 4, cfg: 1 },
    supportedModelFamilies: ["flux2"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: FLUX2_KLEIN_IMG2IMG_CAPABILITY,
    modelStack: [...FLUX2_KLEIN_4B_STACK],
    requiredModels: [...FLUX2_KLEIN_4B_STACK],
    injections: FLUX2_KLEIN_IMG2IMG_INJECTIONS,
    requiredNodes: [
      {
        id: FLUX2_KLEIN_IMG2IMG_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: FLUX2_KLEIN_IMG2IMG_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: FLUX2_KLEIN_IMG2IMG_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: FLUX2_KLEIN_IMG2IMG_NODES.modelSampling,
        classType: "ModelSamplingAuraFlow",
        requiredInputs: ["model", "shift"]
      },
      {
        id: FLUX2_KLEIN_IMG2IMG_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: FLUX2_KLEIN_IMG2IMG_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: FLUX2_KLEIN_IMG2IMG_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: FLUX2_KLEIN_IMG2IMG_NODES.vaeEncode,
        classType: "VAEEncode",
        requiredInputs: ["pixels", "vae"]
      },
      {
        id: FLUX2_KLEIN_IMG2IMG_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: FLUX2_KLEIN_IMG2IMG_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: FLUX2_KLEIN_IMG2IMG_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ],
    compatibilityNote:
      "FLUX.2 Klein 4B is a diffusion model stack, not a checkpoint: UNETLoader, CLIPLoader with type flux2, and VAELoader. It shares qwen_3_4b.safetensors with the Z_image_Turbo stack, so a user who already has that preset downloads only the 4 GB model and the 336 MB Flux.2 VAE. The latent is EmptyFlux2LatentImage rather than EmptySD3LatentImage -- Flux.2's latent geometry differs, and the SD3 node produces a tensor the sampler silently mis-shapes. Sampler settings are the distilled operating point: 4 steps, CFG 1, er_sde, simple, with ModelSamplingAuraFlow shift 3. Klein is Apache-2.0 and ungated, unlike FLUX.1-dev and FLUX.2-dev. This preset re-encodes the captured layer with VAEEncode and samples at a denoise below 1, which is the ordinary image-to-image trade: low denoise preserves the source but barely listens to the prompt, high denoise obeys the prompt but discards the source."
  },
  {
    // Deliberately not named img2img-*: it sits in the Image to Image tool and
    // shares its inputs, but it is a different technique with a different
    // contract, and calling it img2img-flux2-klein-edit would read as a variant
    // of the preset it exists to replace.
    id: "edit-flux2-klein",
    label: "edit-flux2-klein",
    displayName: "FLUX.2 Klein (edit)",
    mode: "img2img",
    description: "Instruction editing with FLUX.2 Klein: reference conditioning on both branches at denoise 1, so the frame holds while the instruction lands.",
    workflowFile: "workflows/api/edit-flux2-klein.json",
    status: "stable",
    recommendedSettings: { steps: 4, cfg: 1 },
    supportedModelFamilies: ["flux2"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: FLUX2_KLEIN_EDIT_CAPABILITY,
    modelStack: [...FLUX2_KLEIN_4B_STACK],
    requiredModels: [...FLUX2_KLEIN_4B_STACK],
    injections: FLUX2_KLEIN_EDIT_INJECTIONS,
    requiredNodes: [
      {
        id: FLUX2_KLEIN_EDIT_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.modelSampling,
        classType: "ModelSamplingAuraFlow",
        requiredInputs: ["model", "shift"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.referenceScale,
        classType: "ImageScaleToTotalPixels",
        requiredInputs: ["image", "upscale_method", "megapixels"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.samplingSize,
        classType: "GetImageSize",
        requiredInputs: ["image"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.originalSize,
        classType: "GetImageSize",
        requiredInputs: ["image"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.vaeEncode,
        classType: "VAEEncode",
        requiredInputs: ["pixels", "vae"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        // `latent` is an OPTIONAL input on ReferenceLatent. Listing it here is
        // what makes the setup check verify the link exists, and reading only
        // ComfyUI's `required` bucket is what used to make that a false alarm.
        id: FLUX2_KLEIN_EDIT_NODES.referenceIntoPositive,
        classType: "ReferenceLatent",
        requiredInputs: ["conditioning", "latent"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.referenceIntoNegative,
        classType: "ReferenceLatent",
        requiredInputs: ["conditioning", "latent"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.latentImage,
        classType: "EmptyFlux2LatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.outputScale,
        classType: "ImageScale",
        requiredInputs: ["image", "upscale_method", "width", "height", "crop"]
      },
      {
        id: FLUX2_KLEIN_EDIT_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ],
    compatibilityNote:
      "edit-flux2-klein is FLUX.2 Klein driven as an instruction editor. The captured layer is normalised to roughly 1 megapixel, encoded once, and fed to ReferenceLatent on BOTH the positive and the negative conditioning; the sampler starts from an EmptyFlux2LatentImage of that size at denoise 1. Wiring the reference into the positive branch only loses most of the preservation, which is why two ReferenceLatent nodes appear rather than one. The decoded result is scaled back to the captured layer's exact pixel size so the preset's source-sized output contract holds whatever the 1 MP normalisation chose. Every node is core ComfyUI. Note that ReferenceLatent declares `latent` as an optional input, so a setup check that reads only ComfyUI's `required` bucket reports this graph as missing setup on a machine where it runs perfectly."
  },
  {
    id: "outpaint-flux2-klein",
    label: "outpaint-flux2-klein",
    displayName: "FLUX.2 Klein",
    mode: "outpaint",
    description: "Fast Klein outpainting: pad the canvas, generate only the new border, composite the original back untouched.",
    workflowFile: "workflows/api/outpaint-flux2-klein.json",
    status: "stable",
    recommendedSettings: { steps: 4, cfg: 1 },
    supportedModelFamilies: ["flux2"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: FLUX2_KLEIN_OUTPAINT_CAPABILITY,
    modelStack: [...FLUX2_KLEIN_4B_STACK],
    requiredModels: [...FLUX2_KLEIN_4B_STACK],
    injections: FLUX2_KLEIN_OUTPAINT_INJECTIONS,
    requiredNodes: [
      { id: FLUX2_KLEIN_OUTPAINT_NODES.diffusionModelLoader, classType: "UNETLoader", requiredInputs: ["unet_name", "weight_dtype"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.clipLoader, classType: "CLIPLoader", requiredInputs: ["clip_name", "type"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.vaeLoader, classType: "VAELoader", requiredInputs: ["vae_name"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.modelSampling, classType: "ModelSamplingAuraFlow", requiredInputs: ["model", "shift"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.loadImage, classType: "LoadImage", requiredInputs: ["image"] },
      {
        id: FLUX2_KLEIN_OUTPAINT_NODES.imagePad,
        classType: "ImagePadForOutpaint",
        requiredInputs: ["image", "left", "top", "right", "bottom", "feathering"]
      },
      {
        id: FLUX2_KLEIN_OUTPAINT_NODES.inpaintCrop,
        classType: "InpaintCropImproved",
        requiredInputs: ["image", "mask", "mask_fill_holes", "mask_blend_pixels", "output_resize_to_target_size"]
      },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.samplingSize, classType: "GetImageSize", requiredInputs: ["image"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.vaeEncode, classType: "VAEEncode", requiredInputs: ["pixels", "vae"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.positivePrompt, classType: "CLIPTextEncode", requiredInputs: ["text", "clip"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.negativePrompt, classType: "CLIPTextEncode", requiredInputs: ["text", "clip"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.referenceIntoPositive, classType: "ReferenceLatent", requiredInputs: ["conditioning", "latent"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.referenceIntoNegative, classType: "ReferenceLatent", requiredInputs: ["conditioning", "latent"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.latentImage, classType: "EmptyFlux2LatentImage", requiredInputs: ["width", "height", "batch_size"] },
      {
        id: FLUX2_KLEIN_OUTPAINT_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.decode, classType: "VAEDecode", requiredInputs: ["samples", "vae"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.inpaintStitch, classType: "InpaintStitchImproved", requiredInputs: ["stitcher", "inpainted_image"] },
      { id: FLUX2_KLEIN_OUTPAINT_NODES.saveImage, classType: "SaveImage", requiredInputs: ["images"] }
    ],
    compatibilityNote:
      "outpaint-flux2-klein grows the canvas with core ImagePadForOutpaint, which emits both the padded image and a mask of the new border, then routes that pair through lquesada's InpaintCropImproved / InpaintStitchImproved so only the border is generated and the artist's pixels are composited back unchanged -- measured at a mean pixel difference of 0.00 across the original interior. ImagePadForOutpaint is kept rather than the crop node's own extend_for_outpainting because the panel's Outpaint controls are pixel counts while those inputs are ratios; this way the existing controls drive the preset unchanged. mask_fill_holes must stay false: the mask is a frame, and filling its hole would mark the whole original image as repaintable. Needs the comfyui-inpaint-cropandstitch pack; outpaint-flux-fill-basic does not, and remains the fallback."
  },
  {
    id: "txt2img-z-image-turbo",
    label: "txt2img-z-image-turbo",
    displayName: "Z_image_Turbo",
    mode: "txt2img",
    description: "Experimental text-to-image preset for the Z_image_Turbo diffusion model stack.",
    workflowFile: "workflows/api/txt2img-z-image-turbo.json",
    sourceWorkflowFile: "workflows/source/txt2img-z-image-turbo.workflow.json",
    status: "stable",
    recommendedSettings: { steps: 8, cfg: 1 },
    supportedModelFamilies: ["zImage"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: Z_IMAGE_TURBO_TXT2IMG_CAPABILITY,
    modelStack: [...Z_IMAGE_TURBO_STACK],
    requiredModels: [...Z_IMAGE_TURBO_STACK],
    injections: Z_IMAGE_TURBO_TXT2IMG_INJECTIONS,
    loraInsertion: Z_IMAGE_TURBO_TXT2IMG_LORA_INSERTION,
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
    displayName: "Z_image_Turbo",
    mode: "img2img",
    description: "Experimental image-to-image preset for the Z_image_Turbo diffusion model stack.",
    workflowFile: "workflows/api/img2img-z-image-turbo.json",
    sourceWorkflowFile: "workflows/source/img2img-z-image-turbo.workflow.json",
    status: "stable",
    recommendedSettings: { steps: 8, cfg: 1 },
    supportedModelFamilies: ["zImage"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: Z_IMAGE_TURBO_IMG2IMG_CAPABILITY,
    modelStack: [...Z_IMAGE_TURBO_STACK],
    requiredModels: [...Z_IMAGE_TURBO_STACK],
    injections: Z_IMAGE_TURBO_IMG2IMG_INJECTIONS,
    loraInsertion: Z_IMAGE_TURBO_IMG2IMG_LORA_INSERTION,
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
    id: "txt2img-krea2-turbo",
    label: "txt2img-krea2-turbo",
    displayName: "Krea-2 Turbo",
    mode: "txt2img",
    description: "Experimental text-to-image preset for the Krea-2 Turbo diffusion model stack.",
    workflowFile: "workflows/api/txt2img-krea2-turbo.json",
    status: "stable",
    recommendedSettings: { steps: 8, cfg: 1 },
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "zImage"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: KREA2_TURBO_TXT2IMG_CAPABILITY,
    modelStack: [...KREA2_TURBO_STACK],
    requiredModels: [...KREA2_TURBO_STACK],
    injections: KREA2_TURBO_TXT2IMG_INJECTIONS,
    loraInsertion: KREA2_TURBO_TXT2IMG_LORA_INSERTION,
    requiredNodes: [
      {
        id: KREA2_TURBO_TXT2IMG_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: KREA2_TURBO_TXT2IMG_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: KREA2_TURBO_TXT2IMG_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: KREA2_TURBO_TXT2IMG_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: KREA2_TURBO_TXT2IMG_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: KREA2_TURBO_TXT2IMG_NODES.latentImage,
        classType: "EmptyLatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: KREA2_TURBO_TXT2IMG_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: KREA2_TURBO_TXT2IMG_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: KREA2_TURBO_TXT2IMG_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ],
    compatibilityNote:
      "txt2img-krea2-turbo follows the official ComfyUI Krea-2 Turbo template: UNETLoader with krea2_turbo_fp8_scaled, CLIPLoader with the qwen3vl text encoder in krea2 mode, the Qwen image VAE, and an 8-step CFG 1 euler/simple sampler."
  },
  {
    id: "txt2img-flux2-dev-gguf",
    label: "txt2img-flux2-dev-gguf",
    displayName: "Flux.2 dev (GGUF)",
    mode: "txt2img",
    description:
      "Experimental Flux.2 dev text-to-image preset using a GGUF-quantised diffusion model and the Mistral-3 text encoder.",
    workflowFile: "workflows/api/txt2img-flux2-dev-gguf.json",
    status: "experimental",
    recommendedSettings: { steps: 20, cfg: 4 },
    supportedModelFamilies: ["flux2"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_GGUF_SOURCE,
    capability: FLUX2_DEV_GGUF_TXT2IMG_CAPABILITY,
    modelStack: [...FLUX2_DEV_GGUF_STACK],
    requiredModels: [...FLUX2_DEV_GGUF_STACK],
    injections: FLUX2_DEV_GGUF_TXT2IMG_INJECTIONS,
    loraInsertion: FLUX2_DEV_GGUF_TXT2IMG_LORA_INSERTION,
    requiredNodes: [
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.diffusionModelLoader,
        classType: "UnetLoaderGGUF",
        // Only unet_name. The core UNETLoader's weight_dtype does not exist
        // here, because a GGUF file carries its own quantisation.
        requiredInputs: ["unet_name"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.fluxGuidance,
        classType: "FluxGuidance",
        requiredInputs: ["conditioning", "guidance"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.guider,
        classType: "BasicGuider",
        requiredInputs: ["model", "conditioning"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.noise,
        classType: "RandomNoise",
        requiredInputs: ["noise_seed"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.samplerSelect,
        classType: "KSamplerSelect",
        requiredInputs: ["sampler_name"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.scheduler,
        classType: "Flux2Scheduler",
        requiredInputs: ["steps", "width", "height"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.latentImage,
        classType: "EmptyFlux2LatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.sampler,
        classType: "SamplerCustomAdvanced",
        requiredInputs: ["noise", "guider", "sampler", "sigmas", "latent_image"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: FLUX2_DEV_GGUF_TXT2IMG_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ],
    compatibilityNote:
      "txt2img-flux2-dev-gguf follows the Flux.2 dev template that ships with ComfyUI, and is the first OpenLayer preset built on the advanced sampler chain rather than KSampler: RandomNoise, KSamplerSelect, Flux2Scheduler and BasicGuider feed SamplerCustomAdvanced. There is no negative prompt, because the reference graph has none. Width and height are written to both EmptyFlux2LatentImage and Flux2Scheduler, which derives its shift from the same dimensions. The diffusion model loads through ComfyUI-GGUF, which needs the gguf Python package installed in ComfyUI's environment or it registers no nodes at all."
  },
  {
    id: "img2img-krea2-turbo",
    label: "img2img-krea2-turbo",
    displayName: "Krea-2 Turbo",
    mode: "img2img",
    description: "Experimental image-to-image preset for the Krea-2 Turbo diffusion model stack.",
    workflowFile: "workflows/api/img2img-krea2-turbo.json",
    status: "stable",
    recommendedSettings: { steps: 8, cfg: 1 },
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "zImage"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: KREA2_TURBO_IMG2IMG_CAPABILITY,
    modelStack: [...KREA2_TURBO_STACK],
    requiredModels: [...KREA2_TURBO_STACK],
    injections: KREA2_TURBO_IMG2IMG_INJECTIONS,
    loraInsertion: KREA2_TURBO_IMG2IMG_LORA_INSERTION,
    requiredNodes: [
      {
        id: KREA2_TURBO_IMG2IMG_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: KREA2_TURBO_IMG2IMG_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: KREA2_TURBO_IMG2IMG_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: KREA2_TURBO_IMG2IMG_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: KREA2_TURBO_IMG2IMG_NODES.vaeEncode,
        classType: "VAEEncode",
        requiredInputs: ["pixels", "vae"]
      },
      {
        id: KREA2_TURBO_IMG2IMG_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: KREA2_TURBO_IMG2IMG_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: KREA2_TURBO_IMG2IMG_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: KREA2_TURBO_IMG2IMG_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: KREA2_TURBO_IMG2IMG_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ],
    compatibilityNote:
      "img2img-krea2-turbo uses the Krea-2 Turbo stack plus PNG source upload and VAE encoding. Denoise balances the captured source against the prompt."
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

/**
 * ComfyUI node classes that publish text into a history entry's `outputs`.
 * Both shapes seen here return `{"ui": {"text": [...]}}`; `PreviewAny` is core,
 * `ShowText|pysssss` is the comfyui-custom-scripts node OpenLayer used to
 * require and is still accepted so hand-edited workflows keep working.
 */
const TEXT_OUTPUT_NODE_CLASS_TYPES = ["PreviewAny", "ShowText|pysssss"] as const;

export function getPresetTextOutputNodeId(preset: WorkflowPresetDefinition): string | undefined {
  return preset.requiredNodes.find((node) =>
    TEXT_OUTPUT_NODE_CLASS_TYPES.some((classType) => node.classType === classType)
  )?.id;
}

export type RecommendedPresetSettings = {
  steps: number;
  cfg: number;
  /**
   * Absent unless the preset declares one. Deliberately not defaulted: a preset
   * with no opinion must leave the panel's control-strength box alone rather
   * than resetting whatever the artist last dialled in.
   */
  controlStrength?: number;
};

const FALLBACK_RECOMMENDED_PRESET_SETTINGS = {
  steps: 20,
  cfg: 7
} as const;

export function getRecommendedPresetSettings(presetId: string): RecommendedPresetSettings {
  const preset = WORKFLOW_PRESETS.find((candidate) => candidate.id === presetId);

  return {
    steps: preset?.recommendedSettings?.steps ?? FALLBACK_RECOMMENDED_PRESET_SETTINGS.steps,
    cfg: preset?.recommendedSettings?.cfg ?? FALLBACK_RECOMMENDED_PRESET_SETTINGS.cfg,
    controlStrength: preset?.recommendedSettings?.controlStrength
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
