import { ComfyWorkflow } from "./types";

export const LIVE_PAINTING_SAVE_NODE_ID = "9";
export const LIVE_PAINTING_STEPS = 5;
export const LIVE_PAINTING_CFG = 1.5;

export type BuildLcmLiveWorkflowOptions = {
  checkpointName: string;
  loraName: string;
  prompt: string;
  sourceImageName: string;
  seed: number;
  denoise: number;
};

// The live loop needs the fastest dependable local engine. SD 1.5 plus the
// LCM LoRA samples in ~5 steps at CFG 1.5, which measured ~0.5-0.7s warm at
// 512px on the reference test machine.
export function buildLcmLiveWorkflow(options: BuildLcmLiveWorkflowOptions): ComfyWorkflow {
  return {
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: options.checkpointName }
    },
    "15": {
      class_type: "LoraLoader",
      inputs: {
        lora_name: options.loraName,
        strength_model: 1,
        strength_clip: 1,
        model: ["4", 0],
        clip: ["4", 1]
      }
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: options.prompt, clip: ["15", 1] }
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: "", clip: ["15", 1] }
    },
    "10": {
      class_type: "LoadImage",
      inputs: { image: options.sourceImageName }
    },
    "11": {
      class_type: "VAEEncode",
      inputs: { pixels: ["10", 0], vae: ["4", 2] }
    },
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: options.seed,
        steps: LIVE_PAINTING_STEPS,
        cfg: LIVE_PAINTING_CFG,
        sampler_name: "lcm",
        scheduler: "sgm_uniform",
        denoise: options.denoise,
        model: ["15", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["11", 0]
      }
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] }
    },
    [LIVE_PAINTING_SAVE_NODE_ID]: {
      class_type: "SaveImage",
      inputs: { filename_prefix: "OpenLayer_Live", images: ["8", 0] }
    }
  };
}

export function findLcmLoraName(loraNames: readonly string[]): string | null {
  const lcmNames = loraNames.filter((name) => /lcm/i.test(name));

  if (lcmNames.length === 0) {
    return null;
  }

  const sd15Match = lcmNames.find((name) => /sd.?v?1[._-]?5|pytorch_lora_weights/i.test(name));

  return sd15Match ?? lcmNames[0];
}

export function clampLiveDenoise(value: number) {
  if (!Number.isFinite(value)) {
    return 0.6;
  }

  return Math.min(0.95, Math.max(0.2, Math.round(value * 100) / 100));
}
