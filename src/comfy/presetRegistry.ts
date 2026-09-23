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

// Stricter than the FLUX dev licences above: "non-commercial" is defined as
// research or evaluation purposes only, so personal client work is out too.
// Every earlier Qwen image release OpenLayer touches (Qwen-Image-Layered, the
// Krea-2 encoder) is Apache-2.0; 2.1 is the first that is not. The whole
// Comfy-Org repackaging carries this licence, VAE and text encoder included,
// which is why all three files in QWEN_IMAGE_21_STACK are gated -- unlike
// Flux.2, whose VAE is published separately and ungated.
const QWEN_IMAGE_21_LICENSE: WorkflowModelLicenseGate = {
  name: "Qwen Research License Agreement",
  url: "https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE",
  summary:
    "Qwen restricts these weights to research and evaluation use; commercial use needs a separate licence from Qwen. Read the licence before downloading them or publishing work made with them."
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
const COMFY_ORG_QWEN_IMAGE_LAYERED_REPO = "https://huggingface.co/Comfy-Org/Qwen-Image-Layered_ComfyUI";
const COMFY_ORG_QWEN_IMAGE_REPO = "https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI";
const COMFY_ORG_QWEN_IMAGE_21_REPO = "https://huggingface.co/Comfy-Org/Qwen-Image-2.1";
const FLUX_TEXT_ENCODERS_REPO = "https://huggingface.co/comfyanonymous/flux_text_encoders";
const ALIBABA_PAI_ZIMAGE_FUN_CONTROLNET_REPO =
  "https://huggingface.co/alibaba-pai/Z-Image-Turbo-Fun-Controlnet-Union-2.1";
// Apache-2.0, ungated, no licenseGate needed -- both files verified by live HEAD
// request against h94/IP-Adapter and installed byte-for-byte on the dev rig.
const H94_IP_ADAPTER_REPO = "https://huggingface.co/h94/IP-Adapter";

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

const BACKGROUND_REMOVAL_MODEL_SOURCE = {
  kind: "background-removal",
  objectInfoNode: "LoadBackgroundRemovalModel",
  inputName: "bg_removal_name",
  label: "Background removal model"
} as const;

/**
 * Depth Anything V2's four sizes, read from the preprocessor's own input enum
 * rather than a models folder. The list is hard-coded inside the node, so all
 * four appear in the picker whether or not their weights have been downloaded
 * yet -- selecting one that is missing downloads it on first run.
 *
 * The default is deliberately **vitb, not the node's own vitl default**, for
 * two independent reasons found separately.
 *
 * Measured: vitl collapses on wide scenes. On a generated terrace photograph
 * with distant mountains it returned p1=223 p50=232 p99=251 -- the entire scene
 * squeezed into a near-white band by a single outlier pixel, visually a blank
 * page with one black dot. vitb on the identical source gave p1=78 p50=123
 * p99=237 and a clean, readable depth pass. On a close-up still life vitl
 * recovered (spread 129) and vitb was still better (spread 151), so this is not
 * a broken file -- it is vitl normalising against an extreme far point that a
 * landscape always has and a close-up does not.
 *
 * Licensing lands in the same place: Depth Anything V2 Large is CC-BY-NC, while
 * vitb and vits are Apache-2.0. Defaulting to a non-commercial checkpoint in a
 * tool artists use for paid work would be the wrong default even if it were the
 * better estimator, and it is not.
 */
const DEPTH_MAP_MODEL_SOURCE = {
  kind: "layer-map",
  objectInfoNode: "DepthAnythingV2Preprocessor",
  inputName: "ckpt_name",
  label: "Depth model"
} as const;

/**
 * Line art and normals each load exactly one annotator, chosen by the node
 * rather than by the artist -- `LineArtPreprocessor` and
 * `BAE-NormalMapPreprocessor` expose no weights enum at all, only a detail
 * `resolution`. `modelSource` is a required field on every preset, so these two
 * point at their own preprocessor honestly instead of borrowing the depth
 * preset's checkpoint list, which would advertise a choice that does not exist.
 *
 * Nothing reads it: both capabilities set `showModelSelector: false`, and
 * `getModelNamesForPreset` is only called to fill a selector that is never
 * rendered. It is here to be true, not to be used.
 */
/**
 * SuperPrompt loads one fixed set of weights and offers no enum, so like the
 * line-art and normal annotators this exists to be true rather than to be read:
 * the capability sets `showModelSelector: false` and nothing fills a selector.
 */
const PROMPT_EXPANDER_MODEL_SOURCE = {
  kind: "prompt-expander",
  objectInfoNode: "Superprompt",
  inputName: "max_new_tokens",
  label: "Prompt expander"
} as const;

const LINEART_ANNOTATOR_SOURCE = {
  kind: "layer-map",
  objectInfoNode: "LineArtPreprocessor",
  inputName: "resolution",
  label: "Line art annotator"
} as const;

const NORMAL_ANNOTATOR_SOURCE = {
  kind: "layer-map",
  objectInfoNode: "BAE-NormalMapPreprocessor",
  inputName: "resolution",
  label: "Normal annotator"
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

const QWEN_IMAGE_LAYERED_STACK = [
  {
    kind: "diffusion-model-stack",
    objectInfoNode: "UNETLoader",
    inputName: "unet_name",
    label: "Qwen-Image-Layered diffusion model",
    modelName: "qwen_image_layered_fp8mixed.safetensors",
    setupHint: "Install qwen_image_layered_fp8mixed.safetensors where ComfyUI's UNETLoader can find it.",
    downloadUrl: `${COMFY_ORG_QWEN_IMAGE_LAYERED_REPO}/resolve/main/split_files/diffusion_models/qwen_image_layered_fp8mixed.safetensors`,
    sourcePageUrl: COMFY_ORG_QWEN_IMAGE_LAYERED_REPO,
    downloadSizeBytes: 20533591821
  },
  {
    // NOT in the layered repository. That repo has no text_encoders folder at
    // all, which is what sends people to the wrong file; the encoder lives with
    // the base Qwen-Image release instead.
    kind: "clip",
    objectInfoNode: "CLIPLoader",
    inputName: "clip_name",
    label: "Qwen2.5-VL 7B text encoder",
    modelName: "qwen_2.5_vl_7b_fp8_scaled.safetensors",
    setupHint: "Install qwen_2.5_vl_7b_fp8_scaled.safetensors where ComfyUI's CLIPLoader can find it.",
    downloadUrl: `${COMFY_ORG_QWEN_IMAGE_REPO}/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors`,
    sourcePageUrl: COMFY_ORG_QWEN_IMAGE_REPO,
    downloadSizeBytes: 9384670680
  },
  {
    // Not qwen_image_vae.safetensors, which is Krea-2's and sits in the same
    // folder. The names differ by one word and the wrong one loads far enough
    // to fail confusingly rather than obviously.
    kind: "vae",
    objectInfoNode: "VAELoader",
    inputName: "vae_name",
    label: "Qwen-Image-Layered VAE",
    modelName: "qwen_image_layered_vae.safetensors",
    setupHint: "Install qwen_image_layered_vae.safetensors in ComfyUI models/vae. This is the layered VAE, not qwen_image_vae.safetensors.",
    downloadUrl: `${COMFY_ORG_QWEN_IMAGE_LAYERED_REPO}/resolve/main/split_files/vae/qwen_image_layered_vae.safetensors`,
    sourcePageUrl: COMFY_ORG_QWEN_IMAGE_LAYERED_REPO,
    downloadSizeBytes: 253816616
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

/**
 * Qwen-Image 2.1: one model for text-to-image, instruction editing and
 * multi-image composition. All three files come from Comfy-Org's public
 * repackaging (verified 200 without a token, sizes by HEAD on 2026-09-23) and
 * run on a 12 GB card -- measured on the dev rig's 4070 Ti at 14-22 s per
 * 1 MP image.
 *
 * The text encoder is deliberately w4a8, not the int8_convrot file the
 * official template names: both are in the same repo, w4a8 is 3 GB smaller,
 * and it produced every measured result. Its VAE is four-channel, so every
 * decode is RGBA -- see the SplitImageWithAlpha note on the node maps below.
 */
const QWEN_IMAGE_21_STACK = [
  {
    kind: "diffusion-model-stack",
    objectInfoNode: "UNETLoader",
    inputName: "unet_name",
    label: "Qwen-Image 2.1 diffusion model",
    modelName: "qwen_image_2.1_int8_convrot.safetensors",
    setupHint: "Install qwen_image_2.1_int8_convrot.safetensors in ComfyUI models/diffusion_models. Needs ComfyUI 0.37.0 or newer.",
    downloadUrl: `${COMFY_ORG_QWEN_IMAGE_21_REPO}/resolve/main/diffusion_models/qwen_image_2.1_int8_convrot.safetensors`,
    sourcePageUrl: COMFY_ORG_QWEN_IMAGE_21_REPO,
    downloadSizeBytes: 7256783064,
    licenseGate: QWEN_IMAGE_21_LICENSE
  },
  {
    kind: "clip",
    objectInfoNode: "CLIPLoader",
    inputName: "clip_name",
    label: "Qwen-Image 2.1 text encoder (Qwen3-VL 8B)",
    modelName: "qwen3vl_8b_w4a8.safetensors",
    // No acceptedModelNames, although qwen3vl_8b_int8_convrot and
    // qwen3vl_8b_fp8_scaled both load here: only the sketch builder substitutes
    // an accepted name into the graph, so on the text-to-image and edit paths
    // an alternative would report "installed" and then fail inside ComfyUI.
    setupHint:
      "Install qwen3vl_8b_w4a8.safetensors in ComfyUI models/text_encoders. Krea-2's qwen3vl_4b encoder is a different model and will not work here.",
    downloadUrl: `${COMFY_ORG_QWEN_IMAGE_21_REPO}/resolve/main/text_encoders/qwen3vl_8b_w4a8.safetensors`,
    sourcePageUrl: COMFY_ORG_QWEN_IMAGE_21_REPO,
    downloadSizeBytes: 6312105364,
    licenseGate: QWEN_IMAGE_21_LICENSE
  },
  {
    kind: "vae",
    objectInfoNode: "VAELoader",
    inputName: "vae_name",
    label: "Qwen-Image 2.1 VAE",
    modelName: "qwen_image_2.1_vae_bf16.safetensors",
    setupHint:
      "Install qwen_image_2.1_vae_bf16.safetensors in ComfyUI models/vae. Not qwen_image_vae.safetensors (Krea-2) or qwen_image_layered_vae.safetensors (Unflatten).",
    downloadUrl: `${COMFY_ORG_QWEN_IMAGE_21_REPO}/resolve/main/vae/qwen_image_2.1_vae_bf16.safetensors`,
    sourcePageUrl: COMFY_ORG_QWEN_IMAGE_21_REPO,
    downloadSizeBytes: 675509688,
    licenseGate: QWEN_IMAGE_21_LICENSE
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

const REMOVE_BACKGROUND_BIREFNET_MODEL = {
  kind: "background-removal",
  objectInfoNode: "LoadBackgroundRemovalModel",
  inputName: "bg_removal_name",
  label: "Background removal model",
  modelName: "birefnet.safetensors",
  // The 885 MB `lucida.safetensors` sits beside it in the same repository and
  // loads through the same node, so it is accepted rather than reported as the
  // wrong file for anyone who already has it.
  acceptedModelNames: ["lucida.safetensors"],
  setupHint: "Install birefnet.safetensors in ComfyUI's models/background_removal/ folder.",
  downloadUrl:
    "https://huggingface.co/Comfy-Org/BiRefNet/resolve/main/background_removal/birefnet.safetensors",
  sourcePageUrl: "https://huggingface.co/Comfy-Org/BiRefNet",
  downloadSizeBytes: 444473596
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

// The Klein inpaint graph. Same 4B stack the Klein text-to-image and edit
// presets load, wrapped in the crop-and-stitch pair rather than a Fill-specific
// conditioning node -- FLUX.2 Klein has no Fill variant, and it does not need
// one: SetLatentNoiseMask on the encoded crop is enough.
const INPAINT_FLUX2_KLEIN_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  modelSampling: "23",
  loadImage: "10",
  inpaintCrop: "50",
  vaeEncode: "11",
  setLatentNoiseMask: "30",
  positivePrompt: "6",
  negativePrompt: "7",
  referenceIntoPositive: "14",
  referenceIntoNegative: "15",
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
const FLUX2_KLEIN_MULTI_REFERENCE_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  modelSampling: "23",
  loadImage: "30",
  referenceScale: "40",
  vaeEncode: "50",
  positivePrompt: "6",
  negativePrompt: "7",
  referenceIntoPositive: "60",
  referenceIntoNegative: "70",
  canvasSize: "13",
  latentImage: "5",
  sampler: "3",
  decode: "8",
  saveImage: "9"
} as const;

const UNFLATTEN_QWEN_LAYERED_NODES = {
  loadImage: "1",
  sourceScale: "2",
  canvasSize: "3",
  diffusionModelLoader: "4",
  clipLoader: "5",
  vaeLoader: "6",
  modelSampling: "7",
  positivePrompt: "8",
  negativePrompt: "9",
  vaeEncode: "10",
  referenceIntoPositive: "11",
  referenceIntoNegative: "12",
  layeredLatent: "13",
  sampler: "14",
  cutToBatch: "15",
  decode: "16",
  saveImage: "17"
} as const;

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

/**
 * Qwen-Image 2.1's VAE is four-channel, so every decode is RGBA -- including
 * ordinary opaque pictures, which come back with alpha 248-252 on roughly a
 * tenth of their pixels. Imported as-is, that is a faintly see-through layer.
 * `dropAlpha` (SplitImageWithAlpha, output 0) turns it into a true RGB PNG
 * before SaveImage. The transparent-background option rewires SaveImage past
 * it, straight to `decode`, rather than shipping a second graph.
 *
 * Positive and negative prompts are two inputs on ONE node,
 * TextEncodeQwenImage21, and its third output is the latent the sampler starts
 * from when there is a reference: sized from image_1, because sampling at any
 * other size shifts the edit.
 */
const QWEN_IMAGE_21_TXT2IMG_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  textEncode: "6",
  latentImage: "5",
  sampler: "3",
  decode: "8",
  dropAlpha: "30",
  saveImage: "9"
} as const;

const QWEN_IMAGE_21_EDIT_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  loadImage: "10",
  // LoadImage splits a PNG into RGB and an inverted mask; this rejoins them so
  // a cut-out layer reaches the encoder with its transparency intact.
  keepAlpha: "11",
  originalSize: "16",
  textEncode: "6",
  sampler: "3",
  decode: "8",
  outputScale: "17",
  dropAlpha: "30",
  saveImage: "9"
} as const;

const QWEN_IMAGE_21_MULTI_REFERENCE_NODES = {
  diffusionModelLoader: "20",
  clipLoader: "21",
  vaeLoader: "22",
  loadImage: "30",
  keepAlpha: "31",
  textEncode: "6",
  sampler: "3",
  decode: "8",
  dropAlpha: "40",
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

// Node ids match src/workflows/api/remove-background-birefnet.json exactly.
// The graph was hand-built and verified against a live ComfyUI 0.30.0 before
// any of this file was written: two real sources, 2.2s each on a 4070 Ti, RGB
// bit-identical to the input.
const REMOVE_BACKGROUND_BIREFNET_NODES = {
  loadImage: "10",
  backgroundRemovalLoader: "11",
  removeBackground: "12",
  invertMask: "14",
  joinAlpha: "13",
  saveImage: "9"
} as const;

const UPSCALE_BASIC_NODES = {
  loadImage: "10",
  upscaleModelLoader: "11",
  imageUpscale: "12",
  saveImage: "9"
} as const;

/**
 * Node ids match src/workflows/api/layer-maps-*.json exactly. All three graphs
 * were hand-built and run against a live ComfyUI 0.30.0 before this was
 * written: a generated terrace photograph through each preset, warm timings of
 * 3.0s (depth), 0.7s (line art) and 2.1s (normal) on a 4070 Ti.
 *
 * Every one of them ends in ImageScale, and that node is the whole reason these
 * maps are usable as layers. `resolution` on a controlnet_aux preprocessor sets
 * the SHORT side and rescales the output to match, so it never returns the
 * source's own dimensions: measured, a 768x512 source at resolution 768 came
 * back 1152x768. A map that is not pixel-for-pixel its source does not sit over
 * it, which is the same upscale-on-import softness that cost Unflatten its
 * first release. ImageScale pins width and height to the captured source and
 * leaves `resolution` free to act as what it actually is -- a detail dial.
 */
/**
 * Node ids match src/workflows/api/enhance-prompt-superprompt.json exactly.
 * Verified against a live ComfyUI 0.30.0 before this was written: the same
 * draft returned the same expansion twice, so the "no seed" reading of the node
 * is confirmed rather than assumed, and a warm run took under a second.
 *
 * `Superprompt.prompt` is declared `forceInput`, so it has no widget and cannot
 * be written to directly -- the graph needs an upstream STRING node to inject
 * into. That is what node 20 is for, and it is why the panel's prompt targets
 * `promptFeed` rather than the expander itself.
 */
const ENHANCE_PROMPT_SUPERPROMPT_NODES = {
  promptFeed: "20",
  expander: "21",
  // Superprompt is not an OUTPUT_NODE, so without this the graph never queues
  // and no text reaches history -- the same shape Prompt from Layer needs.
  textPreview: "22"
} as const;

const LAYER_MAPS_DEPTH_NODES = {
  loadImage: "10",
  preprocessor: "11",
  scaleToSource: "12",
  saveImage: "9"
} as const;

const LAYER_MAPS_LINEART_NODES = {
  loadImage: "10",
  preprocessor: "11",
  // Line-art preprocessors are built for ControlNet, which wants WHITE lines on
  // BLACK. Measured on a real photograph, the raw output was 98.7% near-black.
  // An artist inking or colouring over the result wants the opposite, so this
  // graph inverts before it ever reaches Photoshop: the same run came back
  // 98.8% near-white with black lines. Core node, no dependency.
  invert: "13",
  scaleToSource: "12",
  saveImage: "9"
} as const;

const LAYER_MAPS_NORMAL_NODES = {
  loadImage: "10",
  preprocessor: "11",
  scaleToSource: "12",
  saveImage: "9"
} as const;

// Node ids match src/workflows/api/style-reference-sd15.json exactly -- this
// preset's graph was hand-built and verified against a live ComfyUI (a real
// cat-on-a-chair generation absorbed a vaporwave reference's palette without
// copying its content) rather than exported from the ComfyUI editor, so there
// is no separate "source of truth" to drift from.
const STYLE_REFERENCE_SD15_NODES = {
  checkpointLoader: "4",
  loadImage: "10",
  clipVisionLoader: "12",
  ipAdapterModelLoader: "13",
  ipAdapterApply: "14",
  positivePrompt: "6",
  negativePrompt: "7",
  latentImage: "5",
  sampler: "3",
  decode: "8",
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

const INPAINT_FLUX2_KLEIN_INJECTIONS = {
  checkpoint: target(INPAINT_FLUX2_KLEIN_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(INPAINT_FLUX2_KLEIN_NODES.loadImage, "image"),
  positivePrompt: target(INPAINT_FLUX2_KLEIN_NODES.positivePrompt, "text"),
  negativePrompt: target(INPAINT_FLUX2_KLEIN_NODES.negativePrompt, "text"),
  seed: target(INPAINT_FLUX2_KLEIN_NODES.sampler, "seed"),
  steps: target(INPAINT_FLUX2_KLEIN_NODES.sampler, "steps"),
  cfg: target(INPAINT_FLUX2_KLEIN_NODES.sampler, "cfg"),
  denoise: target(INPAINT_FLUX2_KLEIN_NODES.sampler, "denoise")
  // No maskImage target on purpose: the mask arrives in the source PNG's alpha
  // channel, the same single upload Flux Fill uses. No width/height either --
  // the sampling size is InpaintCropImproved's 1024 target, a property of the
  // technique rather than something the artist picks per generation.
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

const FLUX2_KLEIN_MULTI_REFERENCE_INJECTIONS = {
  checkpoint: target(FLUX2_KLEIN_MULTI_REFERENCE_NODES.diffusionModelLoader, "unet_name"),
  // Reference 1 only. References 2..n do not exist in the shipped graph -- the
  // builder clones this node for each of them, so they are wired rather than
  // injected. See applyReferenceChain in workflowBuilder.ts.
  sourceImage: target(FLUX2_KLEIN_MULTI_REFERENCE_NODES.loadImage, "image"),
  positivePrompt: target(FLUX2_KLEIN_MULTI_REFERENCE_NODES.positivePrompt, "text"),
  negativePrompt: target(FLUX2_KLEIN_MULTI_REFERENCE_NODES.negativePrompt, "text"),
  seed: target(FLUX2_KLEIN_MULTI_REFERENCE_NODES.sampler, "seed"),
  steps: target(FLUX2_KLEIN_MULTI_REFERENCE_NODES.sampler, "steps"),
  cfg: target(FLUX2_KLEIN_MULTI_REFERENCE_NODES.sampler, "cfg")
  // No denoise and no width/height, for the same reason as edit-flux2-klein:
  // denoise 1 is the technique, and the canvas comes from reference 1.
} as const;

const UNFLATTEN_QWEN_LAYERED_INJECTIONS = {
  checkpoint: target(UNFLATTEN_QWEN_LAYERED_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(UNFLATTEN_QWEN_LAYERED_NODES.loadImage, "image"),
  positivePrompt: target(UNFLATTEN_QWEN_LAYERED_NODES.positivePrompt, "text"),
  negativePrompt: target(UNFLATTEN_QWEN_LAYERED_NODES.negativePrompt, "text"),
  seed: target(UNFLATTEN_QWEN_LAYERED_NODES.sampler, "seed"),
  steps: target(UNFLATTEN_QWEN_LAYERED_NODES.sampler, "steps"),
  cfg: target(UNFLATTEN_QWEN_LAYERED_NODES.sampler, "cfg"),
  // New to this project. Everything else here injects into a node class that
  // already had a home; this one drives how many plates come back.
  layerCount: target(UNFLATTEN_QWEN_LAYERED_NODES.layeredLatent, "layers")
  // No width/height: the latent is sized from GetImageSize on the scaled
  // source, so the output always matches what was captured. No denoise: the
  // graph decomposes an existing picture rather than re-sampling it.
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

const QWEN_IMAGE_21_TXT2IMG_INJECTIONS = {
  checkpoint: target(QWEN_IMAGE_21_TXT2IMG_NODES.diffusionModelLoader, "unet_name"),
  positivePrompt: target(QWEN_IMAGE_21_TXT2IMG_NODES.textEncode, "prompt"),
  negativePrompt: target(QWEN_IMAGE_21_TXT2IMG_NODES.textEncode, "negative_prompt"),
  width: target(QWEN_IMAGE_21_TXT2IMG_NODES.latentImage, "width"),
  height: target(QWEN_IMAGE_21_TXT2IMG_NODES.latentImage, "height"),
  seed: target(QWEN_IMAGE_21_TXT2IMG_NODES.sampler, "seed"),
  steps: target(QWEN_IMAGE_21_TXT2IMG_NODES.sampler, "steps"),
  cfg: target(QWEN_IMAGE_21_TXT2IMG_NODES.sampler, "cfg")
} as const;

const QWEN_IMAGE_21_EDIT_INJECTIONS = {
  checkpoint: target(QWEN_IMAGE_21_EDIT_NODES.diffusionModelLoader, "unet_name"),
  sourceImage: target(QWEN_IMAGE_21_EDIT_NODES.loadImage, "image"),
  positivePrompt: target(QWEN_IMAGE_21_EDIT_NODES.textEncode, "prompt"),
  negativePrompt: target(QWEN_IMAGE_21_EDIT_NODES.textEncode, "negative_prompt"),
  seed: target(QWEN_IMAGE_21_EDIT_NODES.sampler, "seed"),
  steps: target(QWEN_IMAGE_21_EDIT_NODES.sampler, "steps"),
  cfg: target(QWEN_IMAGE_21_EDIT_NODES.sampler, "cfg")
  // No denoise, as with edit-flux2-klein: the sampler starts from the
  // encoder's empty latent at denoise 1, and that is the technique.
} as const;

const QWEN_IMAGE_21_MULTI_REFERENCE_INJECTIONS = {
  checkpoint: target(QWEN_IMAGE_21_MULTI_REFERENCE_NODES.diffusionModelLoader, "unet_name"),
  // Reference 1 only; references 2..n are wired into images.image_2 onwards
  // by applyEncoderImageSlots in workflowBuilder.ts.
  sourceImage: target(QWEN_IMAGE_21_MULTI_REFERENCE_NODES.loadImage, "image"),
  positivePrompt: target(QWEN_IMAGE_21_MULTI_REFERENCE_NODES.textEncode, "prompt"),
  negativePrompt: target(QWEN_IMAGE_21_MULTI_REFERENCE_NODES.textEncode, "negative_prompt"),
  seed: target(QWEN_IMAGE_21_MULTI_REFERENCE_NODES.sampler, "seed"),
  steps: target(QWEN_IMAGE_21_MULTI_REFERENCE_NODES.sampler, "steps"),
  cfg: target(QWEN_IMAGE_21_MULTI_REFERENCE_NODES.sampler, "cfg")
} as const;

// `width`/`height` target ImageScale rather than any latent: they are the
// captured source's own dimensions, pinning the map to the pixels it describes.
// `checkpoint` is the estimator size on the depth preset only -- line art and
// normals each load exactly one annotator and have nothing to choose.
const LAYER_MAPS_DEPTH_INJECTIONS = {
  sourceImage: target(LAYER_MAPS_DEPTH_NODES.loadImage, "image"),
  checkpoint: target(LAYER_MAPS_DEPTH_NODES.preprocessor, "ckpt_name"),
  width: target(LAYER_MAPS_DEPTH_NODES.scaleToSource, "width"),
  height: target(LAYER_MAPS_DEPTH_NODES.scaleToSource, "height")
} as const;

const LAYER_MAPS_LINEART_INJECTIONS = {
  sourceImage: target(LAYER_MAPS_LINEART_NODES.loadImage, "image"),
  width: target(LAYER_MAPS_LINEART_NODES.scaleToSource, "width"),
  height: target(LAYER_MAPS_LINEART_NODES.scaleToSource, "height")
} as const;

const LAYER_MAPS_NORMAL_INJECTIONS = {
  sourceImage: target(LAYER_MAPS_NORMAL_NODES.loadImage, "image"),
  width: target(LAYER_MAPS_NORMAL_NODES.scaleToSource, "width"),
  height: target(LAYER_MAPS_NORMAL_NODES.scaleToSource, "height")
} as const;

const ENHANCE_PROMPT_SUPERPROMPT_INJECTIONS = {
  positivePrompt: target(ENHANCE_PROMPT_SUPERPROMPT_NODES.promptFeed, "string"),
  task: target(ENHANCE_PROMPT_SUPERPROMPT_NODES.expander, "instruction_prompt"),
  numBeams: target(ENHANCE_PROMPT_SUPERPROMPT_NODES.expander, "max_new_tokens")
} as const;

const PROMPT_FROM_LAYER_FLORENCE2_INJECTIONS = {
  sourceImage: target(PROMPT_FROM_LAYER_FLORENCE2_NODES.loadImage, "image"),
  task: target(PROMPT_FROM_LAYER_FLORENCE2_NODES.florenceRun, "task"),
  numBeams: target(PROMPT_FROM_LAYER_FLORENCE2_NODES.florenceRun, "num_beams"),
  seed: target(PROMPT_FROM_LAYER_FLORENCE2_NODES.florenceRun, "seed")
} as const;

const REMOVE_BACKGROUND_BIREFNET_INJECTIONS = {
  sourceImage: target(REMOVE_BACKGROUND_BIREFNET_NODES.loadImage, "image"),
  checkpoint: target(REMOVE_BACKGROUND_BIREFNET_NODES.backgroundRemovalLoader, "bg_removal_name")
} as const;

const UPSCALE_BASIC_INJECTIONS = {
  sourceImage: target(UPSCALE_BASIC_NODES.loadImage, "image"),
  checkpoint: target(UPSCALE_BASIC_NODES.upscaleModelLoader, "model_name")
} as const;

const STYLE_REFERENCE_SD15_INJECTIONS = {
  checkpoint: target(STYLE_REFERENCE_SD15_NODES.checkpointLoader, "ckpt_name"),
  sourceImage: target(STYLE_REFERENCE_SD15_NODES.loadImage, "image"),
  positivePrompt: target(STYLE_REFERENCE_SD15_NODES.positivePrompt, "text"),
  negativePrompt: target(STYLE_REFERENCE_SD15_NODES.negativePrompt, "text"),
  width: target(STYLE_REFERENCE_SD15_NODES.latentImage, "width"),
  height: target(STYLE_REFERENCE_SD15_NODES.latentImage, "height"),
  seed: target(STYLE_REFERENCE_SD15_NODES.sampler, "seed"),
  steps: target(STYLE_REFERENCE_SD15_NODES.sampler, "steps"),
  cfg: target(STYLE_REFERENCE_SD15_NODES.sampler, "cfg"),
  controlStrength: target(STYLE_REFERENCE_SD15_NODES.ipAdapterApply, "weight")
} as const;

// IPAdapter Plus SD1.5 -- the style/mood adapter itself plus the CLIP vision
// encoder it reads the reference image through. Both Apache-2.0, ungated,
// verified by live HEAD request and installed byte-for-byte on the dev rig
// (98,183,288 bytes and 2,528,373,448 bytes respectively).
const STYLE_REFERENCE_SD15_REQUIRED_MODELS = [
  {
    kind: "ip-adapter",
    objectInfoNode: "IPAdapterModelLoader",
    inputName: "ipadapter_file",
    label: "IPAdapter model",
    modelName: "ip-adapter-plus_sd15.safetensors",
    setupHint: "Install ip-adapter-plus_sd15.safetensors in ComfyUI's models/ipadapter folder.",
    downloadUrl: `${H94_IP_ADAPTER_REPO}/resolve/main/models/ip-adapter-plus_sd15.safetensors`,
    sourcePageUrl: H94_IP_ADAPTER_REPO,
    downloadSizeBytes: 98183288
  },
  {
    kind: "clip-vision",
    objectInfoNode: "CLIPVisionLoader",
    inputName: "clip_name",
    label: "CLIP vision encoder",
    modelName: "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors",
    setupHint: "Install the CLIP-ViT-H image encoder in ComfyUI's models/clip_vision folder.",
    downloadUrl: `${H94_IP_ADAPTER_REPO}/resolve/main/models/image_encoder/model.safetensors`,
    sourcePageUrl: H94_IP_ADAPTER_REPO,
    downloadSizeBytes: 2528373448
  }
] as const;

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

const INPAINT_FLUX2_KLEIN_CAPABILITY: WorkflowCapability = {
  toolType: "inpaint",
  loaderType: "diffusion-model-stack",
  artistLabel: "Inpaint",
  technicalLabel: "inpaint-flux2-klein",
  requiredPhotoshopInputs: ["selection", "selection-mask"],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "denoise", "seed", "contextPadding", "maskBlur"],
  output: {
    kind: "selection-patch",
    size: "selection-context",
    importBehavior: "aligned-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Klein model",
    primaryActionLabel: "Generate Inpaint",
    experimentalNote:
      "Needs the comfyui-inpaint-cropandstitch node pack, the same one the Flux Fill crop & stitch preset uses. Reuses the FLUX.2 Klein 4B stack already installed for Text to Image, so it costs no extra download. Four steps, and the mask travels in the source PNG's alpha channel."
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
    screenHint:
      "Write what should change, not the whole picture: \"make the jacket red\", \"remove the parked car\". The rest of the layer stays put.",
    experimentalNote:
      "Instruction editing, not image-to-image. Write what you want CHANGED -- \"make the jacket red\", \"remove the parked car\", \"turn the sky to dusk\" -- rather than describing the whole picture. The rest of the frame is held by reference conditioning rather than by a low denoise, so it stays put far better than the image-to-image preset while still obeying the instruction. Denoise is hidden because it is fixed at 1; that is the technique, not a default."
  }
};

const FLUX2_KLEIN_MULTI_REFERENCE_CAPABILITY: WorkflowCapability = {
  toolType: "multi-reference",
  loaderType: "diffusion-model-stack",
  artistLabel: "Multi-Reference Composition",
  technicalLabel: "multi-reference-flux2-klein",
  // Deliberately empty. Every other captured-source preset names one Photoshop
  // input it needs; this one needs a list the artist builds by hand, so the
  // readiness check lives in the panel rather than in a single-input rule.
  requiredPhotoshopInputs: [],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "seed"],
  output: {
    kind: "full-image",
    size: "first-reference",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Klein model",
    primaryActionLabel: "Compose",
    hiddenControls: ["denoise", "width", "height"],
    screenHint:
      "Clothing, props, setting and lighting carry across from your layers. Faces do not: a person in a reference comes back as a plausible stranger, so this cannot place a specific person in a picture.",
    experimentalNote:
      "Composes one picture out of several layers. Clothing, props, setting and lighting all carry across; faces do not -- a person in a reference comes back as a plausible stranger rather than themselves, so this cannot place a specific person. Reference 1 sets the output size. Order matters: if an object behind the subjects comes out duplicated or stretched, move it earlier in the list."
  }
};

const QWEN_IMAGE_21_MULTI_REFERENCE_CAPABILITY: WorkflowCapability = {
  toolType: "multi-reference",
  loaderType: "diffusion-model-stack",
  artistLabel: "Multi-Reference Composition",
  technicalLabel: "multi-reference-qwen-image-21",
  requiredPhotoshopInputs: [],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "seed"],
  output: {
    kind: "full-image",
    size: "first-reference",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Qwen-Image 2.1 model",
    primaryActionLabel: "Compose",
    hiddenControls: ["denoise", "width", "height"],
    screenHint:
      "Name your layers in the prompt as <image1>, <image2> and so on, in list order; reference 1 is the scene. About 30 seconds per reference. Research licence: research and evaluation use only.",
    experimentalNote:
      "Research licence: Qwen allows these weights for research and evaluation only, not commercial work. Name the layers in the prompt as <image1>, <image2> and so on, in list order -- for example \"put the teapot from <image2> on the table in <image1>\". Reference 1 is the scene and sets the output size. Transparent layers keep their cut-out edges. Each reference adds about 30 seconds on a 12 GB card, so six take about three minutes."
  }
};

const UNFLATTEN_QWEN_LAYERED_CAPABILITY: WorkflowCapability = {
  toolType: "unflatten",
  loaderType: "diffusion-model-stack",
  artistLabel: "Unflatten",
  technicalLabel: "unflatten-qwen-layered",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["prompt", "layerCount", "steps", "seed"],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Layered model",
    primaryActionLabel: "Unflatten",
    hiddenControls: ["denoise", "width", "height", "negativePrompt", "cfg"],
    experimentalNote:
      "Splits a flat layer into separate layers with transparency. It needs a picture with something standing in front of something else -- a subject on visible ground. A close-up that fills the frame has no front and back to find, and comes back unseparated. Four layers is the measured best setting: two fuses distinct objects into one plate, and more than four returns blank layers. Resolution is fixed at 640 because 1024 separates worse and takes three times as long."
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

const QWEN_IMAGE_21_TXT2IMG_CAPABILITY: WorkflowCapability = {
  toolType: "txt2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Text to Image",
  technicalLabel: "txt2img-qwen-image-21",
  requiredPhotoshopInputs: [],
  controls: ["prompt", "negativePrompt", "width", "height", "steps", "cfg", "seed"],
  output: {
    kind: "full-image",
    size: "preset",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Qwen-Image 2.1 model",
    primaryActionLabel: "Generate",
    experimentalNote:
      "Research licence: Qwen allows these weights for research and evaluation only, not commercial work. Strong at lettering -- put the exact words in quotes. Native up to 2048 x 2048 (about 90 s on a 12 GB card; 1024 x 1024 takes about 20 s). Runs 25 steps at CFG 1, so the negative prompt has no effect."
  }
};

const QWEN_IMAGE_21_EDIT_CAPABILITY: WorkflowCapability = {
  toolType: "img2img",
  loaderType: "diffusion-model-stack",
  artistLabel: "Image to Image",
  technicalLabel: "edit-qwen-image-21",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: ["prompt", "negativePrompt", "steps", "cfg", "seed"],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Qwen-Image 2.1 model",
    primaryActionLabel: "Generate Edit",
    hiddenControls: ["denoise"],
    screenHint:
      "Write what should change: \"make it a rainy evening\", \"change the sign to read OPEN\". Capture Selection edits only the selected area. A cut-out layer comes back as a cut-out. Research licence: research and evaluation use only.",
    experimentalNote:
      "Research licence: Qwen allows these weights for research and evaluation only, not commercial work. Write what you want CHANGED -- \"change the sign to read OPEN\", \"make it a rainy evening\", \"replace the cart with a bicycle\". Objects stay where they are, but the whole picture is repainted and can come back slightly darker, so compare before you keep it. About 25 s per edit at CFG 1; the negative prompt has no effect."
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

const STYLE_REFERENCE_SD15_CAPABILITY: WorkflowCapability = {
  toolType: "style-reference",
  loaderType: "checkpoint",
  artistLabel: "Style Reference",
  technicalLabel: "style-reference-sd15",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "a reference layer or captured canvas" }],
  controls: ["prompt", "negativePrompt", "width", "height", "steps", "cfg", "seed", "controlStrength"],
  output: {
    kind: "full-image",
    size: "preset",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Checkpoint",
    primaryActionLabel: "Generate Style Reference",
    experimentalNote:
      "IPAdapter Plus borrows the captured layer's palette and mood and applies it on top of the prompt. Measured scope: a photographic reference tints and lights the result convincingly, a flat illustration transfers almost nothing. This does not restyle the captured layer -- it generates a new image, and output size is your own choice, the same as Text to Image."
  }
};

const REMOVE_BACKGROUND_BIREFNET_CAPABILITY: WorkflowCapability = {
  toolType: "remove-background",
  loaderType: "background-removal",
  artistLabel: "Remove Background",
  technicalLabel: "remove-background-birefnet",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: [],
  output: {
    kind: "cutout-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Background removal model",
    primaryActionLabel: "Remove Background"
  }
};

const ENHANCE_PROMPT_SUPERPROMPT_CAPABILITY: WorkflowCapability = {
  toolType: "enhance-prompt",
  loaderType: "prompt-expander",
  artistLabel: "Enhance Prompt",
  technicalLabel: "enhance-prompt-superprompt",
  // The only preset in the registry that reads nothing from Photoshop: its
  // input is the text already in a prompt box.
  requiredPhotoshopInputs: [],
  controls: [],
  output: {
    kind: "prompt-text",
    size: "none",
    importBehavior: "none"
  },
  uiHints: {
    showModelSelector: false,
    modelSelectorLabel: "Prompt expander",
    primaryActionLabel: "Enhance Prompt",
    experimentalNote:
      "Expands a short prompt into a longer, more descriptive one. It runs entirely locally and has no seed, so the same draft always returns the same expansion. It is a 248M-parameter model: it embellishes what you wrote, it does not reason about it, and it sometimes reaches for stock phrasing."
  }
};

const LAYER_MAPS_DEPTH_CAPABILITY: WorkflowCapability = {
  toolType: "layer-maps",
  loaderType: "layer-map",
  artistLabel: "Depth map",
  technicalLabel: "layer-maps-depth",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: [],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: true,
    modelSelectorLabel: "Depth model",
    primaryActionLabel: "Generate Depth Map",
    experimentalNote:
      "Near is bright, far is dark, and the scale is relative to this image alone -- two layers' depth maps are not comparable to each other. Useful for fog, depth-of-field, displacement and relighting comps. The estimator downloads its own weights on first run, so the first map is slower than later ones."
  }
};

const LAYER_MAPS_LINEART_CAPABILITY: WorkflowCapability = {
  toolType: "layer-maps",
  loaderType: "layer-map",
  artistLabel: "Line art",
  technicalLabel: "layer-maps-lineart",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: [],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: false,
    modelSelectorLabel: "Line art model",
    primaryActionLabel: "Generate Line Art",
    experimentalNote:
      "Black lines on white, ready to ink or colour over -- set the layer to Multiply to work under it. This traces what is already in the picture; it does not invent detail, and a soft or low-contrast source gives a soft tracing. The annotator downloads its own weights on first run."
  }
};

const LAYER_MAPS_NORMAL_CAPABILITY: WorkflowCapability = {
  toolType: "layer-maps",
  loaderType: "layer-map",
  artistLabel: "Normal map",
  technicalLabel: "layer-maps-normal",
  requiredPhotoshopInputs: [{ anyOf: ["active-layer", "canvas"], label: "an active layer or captured canvas" }],
  controls: [],
  output: {
    kind: "source-sized-image",
    size: "source",
    importBehavior: "new-layer"
  },
  uiHints: {
    showModelSelector: false,
    modelSelectorLabel: "Normal model",
    primaryActionLabel: "Generate Normal Map",
    experimentalNote:
      "A tangent-space surface-normal pass: RGB encodes which way each surface faces, so it drives relighting and texture work rather than being looked at directly. Estimated from a single photograph, not measured, so it reads large forms well and fine surface detail loosely. The annotator downloads its own weights on first run."
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
    id: "enhance-prompt-superprompt",
    label: "enhance-prompt-superprompt",
    displayName: "SuperPrompt v1",
    mode: "enhance-prompt",
    description: "Expands a short prompt into a longer, more descriptive one, entirely locally.",
    workflowFile: "workflows/api/enhance-prompt-superprompt.json",
    sourceWorkflowFile: "workflows/source/enhance-prompt-superprompt.workflow.json",
    status: "stable",
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "flux2", "zImage"],
    modelSource: PROMPT_EXPANDER_MODEL_SOURCE,
    capability: ENHANCE_PROMPT_SUPERPROMPT_CAPABILITY,
    injections: ENHANCE_PROMPT_SUPERPROMPT_INJECTIONS,
    compatibilityNote:
      "Needs ComfyUI-KJNodes, which is the only reason that package is required at all -- OpenLayer uses exactly one class from it. The expander downloads its own ~308 MB SuperPrompt-v1 weights on first run rather than through Setup, so the first enhancement is slow and later ones take about a second. No checkpoint, prompt encoder or sampler is involved, so it does not care which image models you have.",
    requiredNodes: [
      {
        id: ENHANCE_PROMPT_SUPERPROMPT_NODES.promptFeed,
        classType: "StringConstantMultiline",
        requiredInputs: ["string"]
      },
      {
        id: ENHANCE_PROMPT_SUPERPROMPT_NODES.expander,
        classType: "Superprompt",
        requiredInputs: ["instruction_prompt", "prompt", "max_new_tokens"]
      },
      {
        id: ENHANCE_PROMPT_SUPERPROMPT_NODES.textPreview,
        classType: "PreviewAny",
        requiredInputs: ["source"]
      }
    ]
  },
  {
    id: "layer-maps-depth",
    label: "layer-maps-depth",
    displayName: "Depth (Depth Anything V2)",
    mode: "layer-maps",
    description: "Estimates a depth pass from a layer and returns it at the layer's own size.",
    workflowFile: "workflows/api/layer-maps-depth.json",
    sourceWorkflowFile: "workflows/source/layer-maps-depth.workflow.json",
    status: "stable",
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "flux2", "zImage"],
    modelSource: DEPTH_MAP_MODEL_SOURCE,
    capability: LAYER_MAPS_DEPTH_CAPABILITY,
    injections: LAYER_MAPS_DEPTH_INJECTIONS,
    compatibilityNote:
      "Needs only comfyui_controlnet_aux, the same package the Sketch to Image depth preset already uses. No checkpoint, prompt or diffusion sampling is involved, so it does not care which image model you have. The estimator weights are downloaded by the preprocessor itself on first run rather than through Setup. The default is the Base checkpoint, not Large: Large was measured collapsing a wide landscape into a near-white band with no readable depth at all, and it is also the one size of the four under a non-commercial licence.",
    requiredNodes: [
      {
        id: LAYER_MAPS_DEPTH_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: LAYER_MAPS_DEPTH_NODES.preprocessor,
        classType: "DepthAnythingV2Preprocessor",
        requiredInputs: ["image", "ckpt_name", "resolution"]
      },
      {
        // Pins the map to its source's exact pixel dimensions. Without it the
        // preprocessor returns whatever its short-side `resolution` implies and
        // the map no longer sits over the layer it describes.
        id: LAYER_MAPS_DEPTH_NODES.scaleToSource,
        classType: "ImageScale",
        requiredInputs: ["image", "width", "height", "upscale_method", "crop"]
      },
      {
        id: LAYER_MAPS_DEPTH_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ]
  },
  {
    id: "layer-maps-lineart",
    label: "layer-maps-lineart",
    displayName: "Line art",
    mode: "layer-maps",
    description: "Traces a layer into black lines on white, at the layer's own size.",
    workflowFile: "workflows/api/layer-maps-lineart.json",
    sourceWorkflowFile: "workflows/source/layer-maps-lineart.workflow.json",
    status: "stable",
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "flux2", "zImage"],
    modelSource: LINEART_ANNOTATOR_SOURCE,
    capability: LAYER_MAPS_LINEART_CAPABILITY,
    injections: LAYER_MAPS_LINEART_INJECTIONS,
    compatibilityNote:
      "Needs only comfyui_controlnet_aux, the same package the Sketch to Image line-art preset already uses. The graph inverts the preprocessor's output before saving: line-art annotators are built for ControlNet and return white lines on black, which is the wrong way round for anyone meaning to ink or colour over the result.",
    requiredNodes: [
      {
        id: LAYER_MAPS_LINEART_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: LAYER_MAPS_LINEART_NODES.preprocessor,
        classType: "LineArtPreprocessor",
        requiredInputs: ["image", "coarse", "resolution"]
      },
      {
        id: LAYER_MAPS_LINEART_NODES.invert,
        classType: "ImageInvert",
        requiredInputs: ["image"]
      },
      {
        id: LAYER_MAPS_LINEART_NODES.scaleToSource,
        classType: "ImageScale",
        requiredInputs: ["image", "width", "height", "upscale_method", "crop"]
      },
      {
        id: LAYER_MAPS_LINEART_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ]
  },
  {
    id: "layer-maps-normal",
    label: "layer-maps-normal",
    displayName: "Normal map (BAE)",
    mode: "layer-maps",
    description: "Estimates a tangent-space normal pass from a layer, at the layer's own size.",
    workflowFile: "workflows/api/layer-maps-normal.json",
    sourceWorkflowFile: "workflows/source/layer-maps-normal.workflow.json",
    status: "stable",
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "flux2", "zImage"],
    modelSource: NORMAL_ANNOTATOR_SOURCE,
    capability: LAYER_MAPS_NORMAL_CAPABILITY,
    injections: LAYER_MAPS_NORMAL_INJECTIONS,
    compatibilityNote:
      "Needs only comfyui_controlnet_aux, the same package the Sketch to Image presets already use. No checkpoint, prompt or diffusion sampling is involved. The BAE annotator downloads its own weights on first run rather than through Setup.",
    requiredNodes: [
      {
        id: LAYER_MAPS_NORMAL_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: LAYER_MAPS_NORMAL_NODES.preprocessor,
        classType: "BAE-NormalMapPreprocessor",
        requiredInputs: ["image", "resolution"]
      },
      {
        id: LAYER_MAPS_NORMAL_NODES.scaleToSource,
        classType: "ImageScale",
        requiredInputs: ["image", "width", "height", "upscale_method", "crop"]
      },
      {
        id: LAYER_MAPS_NORMAL_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ]
  },
  {
    id: "remove-background-birefnet",
    label: "remove-background-birefnet",
    displayName: "BiRefNet",
    mode: "remove-background",
    description: "Cuts the subject out of a layer with BiRefNet and returns it with real alpha.",
    workflowFile: "workflows/api/remove-background-birefnet.json",
    sourceWorkflowFile: "workflows/source/remove-background-birefnet.workflow.json",
    status: "stable",
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "flux2", "zImage"],
    modelSource: BACKGROUND_REMOVAL_MODEL_SOURCE,
    capability: REMOVE_BACKGROUND_BIREFNET_CAPABILITY,
    requiredModels: [REMOVE_BACKGROUND_BIREFNET_MODEL],
    injections: REMOVE_BACKGROUND_BIREFNET_INJECTIONS,
    // The cutout is transparent around the subject, so without anchors it
    // imports aligned by the subject's box instead of by the captured layer.
    placementAnchor: target(REMOVE_BACKGROUND_BIREFNET_NODES.saveImage, "images"),
    compatibilityNote:
      "Uses ComfyUI's own background-removal nodes. No checkpoint, prompt, or diffusion sampling is involved, so it does not care which image model you have.",
    requiredNodes: [
      {
        id: REMOVE_BACKGROUND_BIREFNET_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: REMOVE_BACKGROUND_BIREFNET_NODES.backgroundRemovalLoader,
        classType: "LoadBackgroundRemovalModel",
        requiredInputs: ["bg_removal_name"]
      },
      {
        id: REMOVE_BACKGROUND_BIREFNET_NODES.removeBackground,
        classType: "RemoveBackground",
        requiredInputs: ["bg_removal_model", "image"]
      },
      {
        // RemoveBackground returns the BACKGROUND, not the subject: run against
        // a photograph of a fisherman, its mask came back with the man at 0 and
        // the lake at 255, so joining it as alpha erased everything except the
        // background. Verified by rendering the raw mask before trusting it.
        id: REMOVE_BACKGROUND_BIREFNET_NODES.invertMask,
        classType: "InvertMask",
        requiredInputs: ["mask"]
      },
      {
        // The whole reason this is worth shipping: the RGB handed to SaveImage
        // is the artist's own uploaded pixels, untouched, with only an alpha
        // channel added. Measured at a mean absolute difference of 0.0 against
        // the source. Nothing is re-rendered, so nothing is degraded.
        id: REMOVE_BACKGROUND_BIREFNET_NODES.joinAlpha,
        classType: "JoinImageWithAlpha",
        requiredInputs: ["image", "alpha"]
      },
      {
        id: REMOVE_BACKGROUND_BIREFNET_NODES.saveImage,
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
    // The first inpaint preset in the registry that is not Flux Fill. FLUX.2
    // Klein has no Fill checkpoint and needs none: encode the crop, mark the
    // masked latent with SetLatentNoiseMask, and hand the whole crop back to
    // the model as ReferenceLatent conditioning on both branches -- the same
    // conditioning shape edit-flux2-klein uses, which is why the frame holds.
    //
    // The crop-and-stitch wrapper is not an optional refinement here, it is
    // what makes the preset work. Measured on the shared ComfyUI instance:
    // sampling the whole captured context, a small mask asked to *add*
    // something produced the surrounding context again and ignored the prompt
    // in five of six runs across both Klein and Krea2-Turbo. Cropping to the
    // mask plus 50% and sampling that at 1024 fixed it in three of three. A
    // plain non-crop variant was built and deliberately not shipped.
    id: "inpaint-flux2-klein",
    label: "inpaint-flux2-klein",
    displayName: "FLUX.2 Klein (crop & stitch)",
    mode: "inpaint",
    description:
      "FLUX.2 Klein inpainting that crops to the mask plus context, samples at 1024px in four steps, and stitches the patch back with a blended seam.",
    workflowFile: "workflows/api/inpaint-flux2-klein.json",
    sourceWorkflowFile: "workflows/source/inpaint-flux2-klein.workflow.json",
    status: "experimental",
    recommendedSettings: { steps: 4, cfg: 1 },
    supportedModelFamilies: ["flux2"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: INPAINT_FLUX2_KLEIN_CAPABILITY,
    modelStack: [...FLUX2_KLEIN_4B_STACK],
    requiredModels: [...FLUX2_KLEIN_4B_STACK],
    injections: INPAINT_FLUX2_KLEIN_INJECTIONS,
    requiredNodes: [
      {
        id: INPAINT_FLUX2_KLEIN_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.modelSampling,
        classType: "ModelSamplingAuraFlow",
        requiredInputs: ["model", "shift"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.inpaintCrop,
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
        id: INPAINT_FLUX2_KLEIN_NODES.vaeEncode,
        classType: "VAEEncode",
        requiredInputs: ["pixels", "vae"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.setLatentNoiseMask,
        classType: "SetLatentNoiseMask",
        requiredInputs: ["samples", "mask"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.referenceIntoPositive,
        classType: "ReferenceLatent",
        requiredInputs: ["conditioning"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.referenceIntoNegative,
        classType: "ReferenceLatent",
        requiredInputs: ["conditioning"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.inpaintStitch,
        classType: "InpaintStitchImproved",
        requiredInputs: ["stitcher", "inpainted_image"]
      },
      {
        id: INPAINT_FLUX2_KLEIN_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ],
    compatibilityNote:
      "inpaint-flux2-klein reuses the FLUX.2 Klein 4B stack already installed for Text to Image and Image to Image, so it costs no extra download; its only extra requirement is lquesada's comfyui-inpaint-cropandstitch, shared with inpaint-flux-fill-cropstitch. OpenLayer uploads one PNG with the Photoshop mask in its alpha channel, exactly as the Flux Fill presets do, and InpaintCropImproved takes both the image and the mask from that single LoadImage. The stitched output is the size of the uploaded context, which is what keeps the aligned Photoshop import valid -- a 1024px result means SaveImage is reading the VAEDecode rather than the stitcher. ReferenceLatent declares latent as an optional input, so a setup check reading only ComfyUI's required bucket reports this graph as missing setup on a machine where it runs. Sampler settings are Klein's distilled operating point: 4 steps, CFG 1, er_sde, simple, ModelSamplingAuraFlow shift 3."
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
    id: "multi-reference-flux2-klein",
    label: "multi-reference-flux2-klein",
    displayName: "FLUX.2 Klein (composition)",
    mode: "multi-reference",
    description:
      "Composes several captured layers into one picture by chaining a ReferenceLatent per layer onto both conditioning branches. Carries wardrobe, props and setting; does not carry faces.",
    workflowFile: "workflows/api/multi-reference-flux2-klein.json",
    status: "experimental",
    recommendedSettings: { steps: 4, cfg: 1 },
    supportedModelFamilies: ["flux2"],
    experimentalModelFamilies: ["unknown"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: FLUX2_KLEIN_MULTI_REFERENCE_CAPABILITY,
    modelStack: [...FLUX2_KLEIN_4B_STACK],
    requiredModels: [...FLUX2_KLEIN_4B_STACK],
    injections: FLUX2_KLEIN_MULTI_REFERENCE_INJECTIONS,
    referenceChain: {
      kind: "reference-latent",
      loadImage: FLUX2_KLEIN_MULTI_REFERENCE_NODES.loadImage,
      scale: FLUX2_KLEIN_MULTI_REFERENCE_NODES.referenceScale,
      encode: FLUX2_KLEIN_MULTI_REFERENCE_NODES.vaeEncode,
      referenceIntoPositive: FLUX2_KLEIN_MULTI_REFERENCE_NODES.referenceIntoPositive,
      referenceIntoNegative: FLUX2_KLEIN_MULTI_REFERENCE_NODES.referenceIntoNegative,
      positiveConsumer: target(FLUX2_KLEIN_MULTI_REFERENCE_NODES.sampler, "positive"),
      negativeConsumer: target(FLUX2_KLEIN_MULTI_REFERENCE_NODES.sampler, "negative"),
      // Every shipped id in this graph is numeric, so a "ref" prefix cannot
      // collide with one however many references are added.
      generatedNodeIdPrefix: "ref",
      maximumReferences: 8
    },
    requiredNodes: [
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.modelSampling,
        classType: "ModelSamplingAuraFlow",
        requiredInputs: ["model", "shift"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.referenceScale,
        classType: "ImageScaleToTotalPixels",
        requiredInputs: ["image", "upscale_method", "megapixels"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.vaeEncode,
        classType: "VAEEncode",
        requiredInputs: ["pixels", "vae"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.canvasSize,
        classType: "GetImageSize",
        requiredInputs: ["image"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.referenceIntoPositive,
        classType: "ReferenceLatent",
        requiredInputs: ["conditioning"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.referenceIntoNegative,
        classType: "ReferenceLatent",
        requiredInputs: ["conditioning"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.latentImage,
        classType: "EmptyFlux2LatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["seed", "steps", "cfg", "sampler_name", "scheduler", "denoise"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: FLUX2_KLEIN_MULTI_REFERENCE_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images"]
      }
    ],
    compatibilityNote:
      "Same Klein 4B stack as the other Flux.2 Klein presets, so it downloads nothing extra for anyone who already has them, and every node is core ComfyUI -- ReferenceLatent, ImageScaleToTotalPixels and GetImageSize all ship with ComfyUI itself. The graph is the one validated in docs/multi-reference-gate-findings.md: each reference is normalised to 1 MP, VAE-encoded, and chained onto BOTH conditioning branches, sampled at denoise 1 from an empty latent sized by reference 1. Gate testing across 48 live runs found no reference count at which identity degrades, so the maximumReferences of 8 is a sanity bound and not a quality cliff. It also found the limits worth stating plainly: faces are not carried, and a wide thin object that must sit behind the subjects can duplicate unless it is moved earlier in the chain.",
  },
  {
    id: "multi-reference-qwen-image-21",
    // The panel's workflow dropdowns show `label`, so the licence goes here.
    label: "multi-reference-qwen-image-21 (research licence)",
    displayName: "Qwen-Image 2.1 (composition, research licence)",
    mode: "multi-reference",
    description:
      "Composes several captured layers with Qwen-Image 2.1: each layer is a numbered image input on one encoder, addressed in the prompt by number. Transparent layers keep their alpha. Research-licensed weights.",
    workflowFile: "workflows/api/multi-reference-qwen-image-21.json",
    sourceWorkflowFile: "workflows/source/multi-reference-qwen-image-21.workflow.json",
    status: "experimental",
    recommendedSettings: { steps: 25, cfg: 1 },
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "flux2", "zImage"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: QWEN_IMAGE_21_MULTI_REFERENCE_CAPABILITY,
    modelStack: [...QWEN_IMAGE_21_STACK],
    requiredModels: [...QWEN_IMAGE_21_STACK],
    injections: QWEN_IMAGE_21_MULTI_REFERENCE_INJECTIONS,
    referenceChain: {
      kind: "encoder-image-slots",
      loadImage: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.loadImage,
      keepAlpha: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.keepAlpha,
      encoder: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.textEncode,
      inputPrefix: "images.image_",
      // Every shipped id is numeric, as in the Klein graph.
      generatedNodeIdPrefix: "ref",
      maximumReferences: 6
    },
    requiredNodes: [
      {
        id: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.keepAlpha,
        classType: "JoinImageWithAlpha",
        requiredInputs: ["image", "alpha"]
      },
      {
        // See txt2img-qwen-image-21 on why `images` is never listed.
        id: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.textEncode,
        classType: "TextEncodeQwenImage21",
        requiredInputs: ["clip", "vae", "prompt", "negative_prompt", "resolution"]
      },
      {
        id: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.dropAlpha,
        classType: "SplitImageWithAlpha",
        requiredInputs: ["image"]
      },
      {
        id: QWEN_IMAGE_21_MULTI_REFERENCE_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ],
    compatibilityNote:
      "multi-reference-qwen-image-21 is the official Qwen-Image 2.1 image-edit template with more than one image, flattened out of its subgraph. Every reference is a LoadImage rejoined with its own alpha and plugged into the next numbered image input of TextEncodeQwenImage21; the encoder resizes each to about 1 megapixel, encodes it as a reference latent, and sizes the sampling latent from image_1. Measured on a 12 GB 4070 Ti: 1 reference 23 s, 2 references 54 s, 3 references 82 s, with a scene, a person and a transparent product composed correctly in one run. The ceiling of 6 is a time bound, not a quality cliff; the encoder accepts sixteen. Research-licensed weights; see txt2img-qwen-image-21."
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
      "edit-flux2-klein is FLUX.2 Klein driven as an instruction editor. The captured layer is normalised to roughly 1 megapixel, encoded once, and fed to ReferenceLatent on BOTH the positive and the negative conditioning; the sampler starts from an EmptyFlux2LatentImage of that size at denoise 1. Wiring the reference into the positive branch only loses most of the preservation, which is why two ReferenceLatent nodes appear rather than one. The decoded result is scaled back to the captured layer's exact pixel size so the preset's source-sized output contract holds whatever the 1 MP normalisation chose. Every node is core ComfyUI. Note that ReferenceLatent declares its latent as an optional input, so a setup check that reads only ComfyUI's required bucket reports this graph as missing setup on a machine where it runs perfectly."
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
    id: "txt2img-qwen-image-21",
    // The panel's workflow dropdowns show `label`, so the licence goes here.
    label: "txt2img-qwen-image-21 (research licence)",
    displayName: "Qwen-Image 2.1 (research licence)",
    mode: "txt2img",
    description:
      "Text to image with Qwen-Image 2.1: strong lettering and native 2K. Research-licensed weights, gated behind their licence.",
    workflowFile: "workflows/api/txt2img-qwen-image-21.json",
    sourceWorkflowFile: "workflows/source/txt2img-qwen-image-21.workflow.json",
    status: "experimental",
    recommendedSettings: { steps: 25, cfg: 1 },
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "flux2", "zImage"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: QWEN_IMAGE_21_TXT2IMG_CAPABILITY,
    modelStack: [...QWEN_IMAGE_21_STACK],
    requiredModels: [...QWEN_IMAGE_21_STACK],
    injections: QWEN_IMAGE_21_TXT2IMG_INJECTIONS,
    // The wrapper is the Comfy template's own documented phrasing. Measured with
    // it: a studio teapot came back 69% fully clear with a clean handle hole and
    // a soft contact shadow, straight from the model with no matting step.
    transparentOutput: {
      saveImage: target(QWEN_IMAGE_21_TXT2IMG_NODES.saveImage, "images"),
      rgbaSource: QWEN_IMAGE_21_TXT2IMG_NODES.decode,
      promptWrapper: {
        prefix: "This is an RGBA format image with transparency. ",
        suffix: " The image has an alpha channel and a transparent background."
      }
    },
    requiredNodes: [
      {
        id: QWEN_IMAGE_21_TXT2IMG_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: QWEN_IMAGE_21_TXT2IMG_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: QWEN_IMAGE_21_TXT2IMG_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        // Never list `images` or `images.image_1` here. /object_info declares
        // only the autogrow parent `images`, the API graph carries only the
        // dotted child, and this list is checked against both.
        id: QWEN_IMAGE_21_TXT2IMG_NODES.textEncode,
        classType: "TextEncodeQwenImage21",
        requiredInputs: ["clip", "prompt", "negative_prompt", "resolution"]
      },
      {
        id: QWEN_IMAGE_21_TXT2IMG_NODES.latentImage,
        classType: "EmptyLatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: QWEN_IMAGE_21_TXT2IMG_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: QWEN_IMAGE_21_TXT2IMG_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: QWEN_IMAGE_21_TXT2IMG_NODES.dropAlpha,
        classType: "SplitImageWithAlpha",
        requiredInputs: ["image"]
      },
      {
        id: QWEN_IMAGE_21_TXT2IMG_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ],
    compatibilityNote:
      "txt2img-qwen-image-21 follows the official ComfyUI Qwen-Image 2.1 template, flattened out of its subgraph so OpenLayer can address each node: UNETLoader with the int8_convrot diffusion model, CLIPLoader in qwen_image mode with the Qwen3-VL 8B w4a8 encoder, the 2.1 VAE, TextEncodeQwenImage21 for both prompts, and a 25-step CFG 1 euler/simple KSampler. The VAE decodes RGBA, so the graph ends in SplitImageWithAlpha to hand Photoshop a genuinely opaque layer. Every node is core ComfyUI, first shipped in ComfyUI 0.37.0. The weights are under the Qwen Research License (research and evaluation only), so all three files are licence-gated and never downloaded automatically."
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
  },
  {
    id: "edit-qwen-image-21",
    // The panel's workflow dropdowns show `label`, so the licence goes here.
    label: "edit-qwen-image-21 (research licence)",
    displayName: "Qwen-Image 2.1 (edit, research licence)",
    mode: "img2img",
    description:
      "Instruction editing with Qwen-Image 2.1: the layer goes in as image_1 and the instruction is applied at denoise 1. A cut-out layer comes back as a cut-out. Research-licensed weights.",
    workflowFile: "workflows/api/edit-qwen-image-21.json",
    sourceWorkflowFile: "workflows/source/edit-qwen-image-21.workflow.json",
    status: "experimental",
    recommendedSettings: { steps: 25, cfg: 1 },
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "flux2", "zImage"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: QWEN_IMAGE_21_EDIT_CAPABILITY,
    modelStack: [...QWEN_IMAGE_21_STACK],
    requiredModels: [...QWEN_IMAGE_21_STACK],
    injections: QWEN_IMAGE_21_EDIT_INJECTIONS,
    // Taken only when the captured layer is a cut-out. The source-size restore
    // (ImageScale) sits before the alpha drop, so it is the RGBA source here.
    transparentOutput: {
      saveImage: target(QWEN_IMAGE_21_EDIT_NODES.saveImage, "images"),
      rgbaSource: QWEN_IMAGE_21_EDIT_NODES.outputScale
    },
    selectionEdit: {
      loadImage: QWEN_IMAGE_21_EDIT_NODES.loadImage,
      encoderImage: target(QWEN_IMAGE_21_EDIT_NODES.textEncode, "images.image_1"),
      editedImage: QWEN_IMAGE_21_EDIT_NODES.dropAlpha,
      saveImage: target(QWEN_IMAGE_21_EDIT_NODES.saveImage, "images"),
      generatedNodeIdPrefix: "sel"
    },
    requiredNodes: [
      {
        id: QWEN_IMAGE_21_EDIT_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: QWEN_IMAGE_21_EDIT_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: QWEN_IMAGE_21_EDIT_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: QWEN_IMAGE_21_EDIT_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: QWEN_IMAGE_21_EDIT_NODES.keepAlpha,
        classType: "JoinImageWithAlpha",
        requiredInputs: ["image", "alpha"]
      },
      {
        id: QWEN_IMAGE_21_EDIT_NODES.originalSize,
        classType: "GetImageSize",
        requiredInputs: ["image"]
      },
      {
        // `vae` is optional on this node and is what turns image_1 into a
        // reference latent; without it the model only "sees" the picture
        // through the text encoder. See the txt2img entry on `images`.
        id: QWEN_IMAGE_21_EDIT_NODES.textEncode,
        classType: "TextEncodeQwenImage21",
        requiredInputs: ["clip", "vae", "prompt", "negative_prompt", "resolution"]
      },
      {
        id: QWEN_IMAGE_21_EDIT_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "sampler_name", "scheduler", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: QWEN_IMAGE_21_EDIT_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: QWEN_IMAGE_21_EDIT_NODES.outputScale,
        classType: "ImageScale",
        requiredInputs: ["image", "upscale_method", "width", "height", "crop"]
      },
      {
        id: QWEN_IMAGE_21_EDIT_NODES.dropAlpha,
        classType: "SplitImageWithAlpha",
        requiredInputs: ["image"]
      },
      {
        id: QWEN_IMAGE_21_EDIT_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ],
    compatibilityNote:
      "edit-qwen-image-21 is the official Qwen-Image 2.1 image-edit template flattened out of its subgraph. The captured layer is rejoined with its own alpha and passed as image_1 to TextEncodeQwenImage21, which resizes it to about 1 megapixel on a 32-pixel grid, encodes it as a reference latent, and returns the empty latent the sampler starts from -- sampling at any other size shifts the edit. The result is scaled back to the captured layer's exact pixel size. Measured on real photographs: objects stay within a pixel of where they were, but the whole frame is repainted and untouched areas come back 6-12 levels darker, so this is a whole-layer edit. Research-licensed weights; see txt2img-qwen-image-21."
  },
  {
    id: "style-reference-sd15",
    label: "style-reference-sd15",
    displayName: "IPAdapter Plus (SD1.5)",
    mode: "style-reference",
    description: "Match a captured layer's mood, color, and visual language onto a new prompt-driven image.",
    workflowFile: "workflows/api/style-reference-sd15.json",
    sourceWorkflowFile: "workflows/source/style-reference-sd15.workflow.json",
    status: "experimental",
    recommendedSettings: { steps: 20, cfg: 7, controlStrength: 1 },
    supportedModelFamilies: ["sd1"],
    experimentalModelFamilies: ["sdxl", "sd3", "flux", "flux2", "zImage", "unknown"],
    modelSource: CHECKPOINT_MODEL_SOURCE,
    capability: STYLE_REFERENCE_SD15_CAPABILITY,
    injections: STYLE_REFERENCE_SD15_INJECTIONS,
    requiredModels: [...STYLE_REFERENCE_SD15_REQUIRED_MODELS],
    compatibilityNote:
      "style-reference-sd15 uses IPAdapter Plus's \"style transfer\" weight mode on an SD 1.5 checkpoint. Verified against a live ComfyUI: a vaporwave-sunset reference produced its magenta/cyan/orange palette on an unrelated cat-and-chair prompt without copying the reference's content.",
    requiredNodes: [
      {
        id: STYLE_REFERENCE_SD15_NODES.checkpointLoader,
        classType: "CheckpointLoaderSimple",
        requiredInputs: ["ckpt_name"]
      },
      {
        id: STYLE_REFERENCE_SD15_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: STYLE_REFERENCE_SD15_NODES.clipVisionLoader,
        classType: "CLIPVisionLoader",
        requiredInputs: ["clip_name"]
      },
      {
        id: STYLE_REFERENCE_SD15_NODES.ipAdapterModelLoader,
        classType: "IPAdapterModelLoader",
        requiredInputs: ["ipadapter_file"]
      },
      {
        id: STYLE_REFERENCE_SD15_NODES.ipAdapterApply,
        classType: "IPAdapterAdvanced",
        requiredInputs: ["model", "ipadapter", "image", "weight", "weight_type"]
      },
      {
        id: STYLE_REFERENCE_SD15_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: STYLE_REFERENCE_SD15_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: STYLE_REFERENCE_SD15_NODES.latentImage,
        classType: "EmptyLatentImage",
        requiredInputs: ["width", "height", "batch_size"]
      },
      {
        id: STYLE_REFERENCE_SD15_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: STYLE_REFERENCE_SD15_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: STYLE_REFERENCE_SD15_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ]
  },
  {
    id: "unflatten-qwen-layered",
    label: "unflatten-qwen-layered",
    displayName: "Qwen-Image-Layered",
    mode: "unflatten",
    description:
      "Splits a flat captured layer into separate layers with real transparency, in stacking order. Needs a subject standing on visible ground; a frame-filling close-up comes back unseparated.",
    workflowFile: "workflows/api/unflatten-qwen-layered.json",
    sourceWorkflowFile: "workflows/source/unflatten-qwen-layered.workflow.json",
    status: "experimental",
    recommendedSettings: { steps: 20, cfg: 2.5 },
    supportedModelFamilies: ["unknown"],
    experimentalModelFamilies: ["sd1", "sdxl", "sd3", "flux", "flux2", "zImage"],
    modelSource: DIFFUSION_MODEL_SOURCE,
    capability: UNFLATTEN_QWEN_LAYERED_CAPABILITY,
    modelStack: [...QWEN_IMAGE_LAYERED_STACK],
    requiredModels: [...QWEN_IMAGE_LAYERED_STACK],
    injections: UNFLATTEN_QWEN_LAYERED_INJECTIONS,
    compatibilityNote:
      "unflatten-qwen-layered returns layers + 1 images: index 0 is the flattened composite, and the layers run back-to-front from index 1. Measured on a live ComfyUI over 20 runs -- see docs/unflatten-gate-findings.md. 640px with 4 layers is the measured optimum; 1024 separates roughly half as well and costs 3.5x the time, which is why the graph fixes largest_size at 640.",
    requiredNodes: [
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.loadImage,
        classType: "LoadImage",
        requiredInputs: ["image"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.sourceScale,
        classType: "ImageScaleToMaxDimension",
        requiredInputs: ["image", "upscale_method", "largest_size"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.canvasSize,
        classType: "GetImageSize",
        requiredInputs: ["image"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.diffusionModelLoader,
        classType: "UNETLoader",
        requiredInputs: ["unet_name", "weight_dtype"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.clipLoader,
        classType: "CLIPLoader",
        requiredInputs: ["clip_name", "type"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.vaeLoader,
        classType: "VAELoader",
        requiredInputs: ["vae_name"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.modelSampling,
        classType: "ModelSamplingAuraFlow",
        requiredInputs: ["model", "shift"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.positivePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.negativePrompt,
        classType: "CLIPTextEncode",
        requiredInputs: ["text", "clip"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.vaeEncode,
        classType: "VAEEncode",
        requiredInputs: ["pixels", "vae"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.referenceIntoPositive,
        classType: "ReferenceLatent",
        requiredInputs: ["conditioning", "latent"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.referenceIntoNegative,
        classType: "ReferenceLatent",
        requiredInputs: ["conditioning", "latent"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.layeredLatent,
        classType: "EmptyQwenImageLayeredLatentImage",
        requiredInputs: ["width", "height", "layers", "batch_size"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.sampler,
        classType: "KSampler",
        requiredInputs: ["model", "seed", "steps", "cfg", "positive", "negative", "latent_image", "denoise"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.cutToBatch,
        classType: "LatentCutToBatch",
        requiredInputs: ["samples", "dim", "slice_size"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.decode,
        classType: "VAEDecode",
        requiredInputs: ["samples", "vae"]
      },
      {
        id: UNFLATTEN_QWEN_LAYERED_NODES.saveImage,
        classType: "SaveImage",
        requiredInputs: ["images", "filename_prefix"]
      }
    ]
  }
];

export function listWorkflowPresets(mode?: WorkflowPresetDefinition["mode"]) {
  return mode ? WORKFLOW_PRESETS.filter((preset) => preset.mode === mode) : WORKFLOW_PRESETS;
}

/**
 * The Image to Image screen has two modes since v0.36. Instruction editing
 * (`edit-*`) samples at denoise 1 with the layer as conditioning, so it offers
 * no denoise control; every other image-to-image preset is driven by one. That
 * declared control -- not the preset id -- is what decides which mode lists a
 * preset, so a new edit preset lands in Edit Image by declaring itself.
 */
export function isInstructionEditPreset(preset: WorkflowPresetDefinition) {
  return preset.mode === "img2img" && !(preset.capability?.controls.includes("denoise") ?? true);
}

export function listImageScreenPresets(mode: "transform" | "edit") {
  return listRunnableWorkflowPresets("img2img").filter((preset) => isInstructionEditPreset(preset) === (mode === "edit"));
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
