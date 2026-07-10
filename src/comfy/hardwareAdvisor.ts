import { detectCheckpointFamily } from "./modelCompatibility";
import {
  ComfyHardwareDevice,
  ComfyModelInventory,
  ComfySystemStats,
  ModelFamily,
  WorkflowPresetDefinition
} from "./types";

export type HardwareTier = "unknown" | "low" | "medium" | "high" | "workstation";

export type HardwareRecommendation = {
  task: string;
  recommendation: string;
  reason: string;
};

export type ModelFamilySummary = {
  family: ModelFamily;
  label: string;
  count: number;
  examples: string[];
};

export type HardwareRecommendationReport = {
  tier: HardwareTier;
  tierLabel: string;
  deviceName: string;
  deviceType: string;
  vramTotalLabel: string;
  vramFreeLabel: string;
  summary: string;
  detectedFamilies: ModelFamilySummary[];
  zImageTurboMessage: string;
  recommendations: HardwareRecommendation[];
};

const FAMILY_LABELS: Record<ModelFamily, string> = {
  sd1: "SD 1.x",
  sdxl: "SDXL",
  sd3: "SD3 / SD3.5",
  flux: "Flux",
  zImage: "Z_image_Turbo",
  unknown: "Unknown"
};

export function createHardwareRecommendationReport(
  systemStats: ComfySystemStats,
  inventory: ComfyModelInventory,
  presets: WorkflowPresetDefinition[]
): HardwareRecommendationReport {
  const primaryDevice = choosePrimaryDevice(systemStats.devices);
  const vramTotalBytes = primaryDevice?.vramTotalBytes ?? primaryDevice?.torchVramTotalBytes;
  const vramFreeBytes = primaryDevice?.vramFreeBytes ?? primaryDevice?.torchVramFreeBytes;
  const tier = getHardwareTier(vramTotalBytes);
  const detectedFamilies = summarizeDetectedFamilies(inventory);
  const zImageTurboMessage = getZImageTurboMessage(inventory);

  return {
    tier,
    tierLabel: getHardwareTierLabel(tier),
    deviceName: primaryDevice?.name ?? "No GPU reported by ComfyUI",
    deviceType: primaryDevice?.type ?? "unknown",
    vramTotalLabel: formatBytes(vramTotalBytes),
    vramFreeLabel: formatBytes(vramFreeBytes),
    summary: getTierSummary(tier),
    detectedFamilies,
    zImageTurboMessage,
    recommendations: createRecommendations(tier, inventory, presets)
  };
}

export function formatHardwareReport(report: HardwareRecommendationReport) {
  const familyText = report.detectedFamilies.length > 0
    ? report.detectedFamilies
      .map((family) => `${family.label}: ${family.count}`)
      .join(", ")
    : "No model families detected yet";

  const recommendationText = report.recommendations
    .map((item) => `${item.task}: ${item.recommendation}`)
    .join(" ");

  return [
    `${report.deviceName} (${report.deviceType})`,
    `VRAM: ${report.vramTotalLabel} total, ${report.vramFreeLabel} free.`,
    `${report.tierLabel}: ${report.summary}`,
    `Detected models: ${familyText}.`,
    report.zImageTurboMessage,
    recommendationText
  ].join(" ");
}

export function getHardwareTier(vramTotalBytes?: number): HardwareTier {
  if (!vramTotalBytes) {
    return "unknown";
  }

  const vramGb = bytesToGb(vramTotalBytes);

  if (vramGb < 8) {
    return "low";
  }

  if (vramGb < 12) {
    return "medium";
  }

  if (vramGb < 24) {
    return "high";
  }

  return "workstation";
}

function createRecommendations(
  tier: HardwareTier,
  inventory: ComfyModelInventory,
  presets: WorkflowPresetDefinition[]
): HardwareRecommendation[] {
  const hasSdxl = hasFamily(inventory, "sdxl");
  const hasSd1 = hasFamily(inventory, "sd1");
  const hasFlux = hasFamily(inventory, "flux");
  const hasZImageTurbo = hasZImageTurboStack(inventory);
  const hasSketchPreset = presets.some((preset) => preset.id === "sketch2img-linecn-basic");

  return [
    {
      task: "Text to Image",
      recommendation: chooseTextToImageRecommendation(tier, hasSd1, hasSdxl, hasFlux, hasZImageTurbo),
      reason: "Balances model size, quality, and current OpenLayer workflow support."
    },
    {
      task: "Image to Image",
      recommendation: chooseImageToImageRecommendation(tier, hasSd1, hasSdxl),
      reason: "img2img-basic currently uses the SD/SDXL CheckpointLoaderSimple workflow."
    },
    {
      task: "Sketch to Image",
      recommendation: hasSketchPreset
        ? "Use sketch2img-linecn-basic with an SD 1.x checkpoint for now."
        : "Install the LINECN starter preset before using Sketch to Image.",
      reason: "The current LINECN workflow is intentionally SD 1.x-first for reliability."
    },
    {
      task: "Future Realtime Preview",
      recommendation: chooseRealtimeRecommendation(tier, hasFlux, hasZImageTurbo),
      reason: "Realtime tools need the fastest stable local model stack available."
    }
  ];
}

function chooseTextToImageRecommendation(
  tier: HardwareTier,
  hasSd1: boolean,
  hasSdxl: boolean,
  hasFlux: boolean,
  hasZImageTurbo: boolean
) {
  if (tier === "low") {
    return hasSd1 ? "Use SD 1.x at 512px for the safest speed." : "Install an SD 1.x checkpoint first.";
  }

  if (tier === "medium") {
    return hasSdxl ? "Use SDXL carefully; SD 1.x stays fastest." : "Use SD 1.x until an SDXL checkpoint is installed.";
  }

  if (tier === "high") {
    if (hasZImageTurbo) {
      return "Use SDXL now; Z_image_Turbo is detected for future fast presets.";
    }

    return hasSdxl ? "Use SDXL as the main quality preset." : "Install SDXL for stronger quality.";
  }

  if (tier === "workstation") {
    if (hasFlux || hasZImageTurbo) {
      return "Use SDXL now; Flux and Z_image_Turbo are good candidates for future dedicated presets.";
    }

    return "Use SDXL now; heavier Flux or SD3.5 workflows should be added as dedicated presets.";
  }

  return hasSdxl ? "Use SDXL if it runs well; SD 1.x is the safe fallback." : "Start with SD 1.x or SDXL once detected.";
}

function chooseImageToImageRecommendation(tier: HardwareTier, hasSd1: boolean, hasSdxl: boolean) {
  if (tier === "low") {
    return hasSd1 ? "Use SD 1.x with lower resolution and modest denoise." : "Install an SD 1.x checkpoint first.";
  }

  if (tier === "medium") {
    return hasSdxl ? "Use SDXL cautiously; SD 1.x is faster for iteration." : "Use SD 1.x for reliable edits.";
  }

  return hasSdxl ? "Use SDXL for quality edits; SD 1.x remains fastest." : "Use SD 1.x, then add SDXL for quality.";
}

function chooseRealtimeRecommendation(tier: HardwareTier, hasFlux: boolean, hasZImageTurbo: boolean) {
  if (tier === "low") {
    return "Keep realtime as a future lightweight SD 1.x/LCM-style feature.";
  }

  if (hasZImageTurbo) {
    return "Z_image_Turbo is detected and should be investigated first for future realtime presets.";
  }

  if (hasFlux) {
    return "Flux is detected, but realtime needs a dedicated fast workflow before enabling.";
  }

  return tier === "workstation"
    ? "Look for a fast diffusion stack before enabling realtime."
    : "Use regular generation workflows until a fast local model stack is detected.";
}

function summarizeDetectedFamilies(inventory: ComfyModelInventory): ModelFamilySummary[] {
  const familyMap = new Map<ModelFamily, string[]>();
  const modelNames = [
    ...inventory.checkpoints,
    ...inventory.diffusionModels,
    ...inventory.clipModels,
    ...inventory.vaeModels
  ];

  for (const modelName of modelNames) {
    const family = detectModelFamily(modelName);
    const existing = familyMap.get(family) ?? [];
    existing.push(modelName);
    familyMap.set(family, existing);
  }

  return [...familyMap.entries()]
    .filter(([family]) => family !== "unknown")
    .map(([family, names]) => ({
      family,
      label: FAMILY_LABELS[family],
      count: names.length,
      examples: names.slice(0, 2)
    }));
}

function getZImageTurboMessage(inventory: ComfyModelInventory) {
  const hasModel = inventory.diffusionModels.some(isZImageTurboName);
  const hasClip = inventory.clipModels.some((name) => name.toLowerCase().includes("qwen_3_4b"));
  const hasVae = inventory.vaeModels.some((name) => name.toLowerCase().includes("ae.safetensors"));

  if (hasModel && hasClip && hasVae) {
    return "Z_image_Turbo stack detected: diffusion model, qwen_3_4b CLIP, and ae.safetensors VAE are available. The experimental Z_image_Turbo Text to Image and Image to Image presets can use this stack.";
  }

  if (hasModel) {
    const missing = [
      hasClip ? "" : "qwen_3_4b CLIP",
      hasVae ? "" : "ae.safetensors VAE"
    ].filter(Boolean);

    return `Z_image_Turbo diffusion model detected, but ${missing.join(" and ") || "the full stack"} still needs to be verified before OpenLayer can recommend a runnable preset.`;
  }

  return "Z_image_Turbo was not detected in the diffusion model loader. It will not appear in the checkpoint selector because it is not a checkpoint model.";
}

function choosePrimaryDevice(devices: ComfyHardwareDevice[]) {
  return devices.find((device) => device.type.toLowerCase().includes("cuda"))
    ?? devices.find((device) => Boolean(device.vramTotalBytes ?? device.torchVramTotalBytes))
    ?? devices[0];
}

function hasFamily(inventory: ComfyModelInventory, family: ModelFamily) {
  return [
    ...inventory.checkpoints,
    ...inventory.diffusionModels
  ].some((name) => detectModelFamily(name) === family);
}

function hasZImageTurboStack(inventory: ComfyModelInventory) {
  return inventory.diffusionModels.some(isZImageTurboName)
    && inventory.clipModels.some((name) => name.toLowerCase().includes("qwen_3_4b"))
    && inventory.vaeModels.some((name) => name.toLowerCase().includes("ae.safetensors"));
}

function detectModelFamily(modelName: string): ModelFamily {
  if (isZImageTurboName(modelName)) {
    return "zImage";
  }

  return detectCheckpointFamily(modelName);
}

function isZImageTurboName(modelName: string) {
  const normalized = modelName.toLowerCase();
  return normalized.includes("z_image_turbo") || normalized.includes("z-image-turbo") || normalized.includes("zimage_turbo");
}

function getHardwareTierLabel(tier: HardwareTier) {
  switch (tier) {
    case "low":
      return "Low VRAM";
    case "medium":
      return "Medium VRAM";
    case "high":
      return "High VRAM";
    case "workstation":
      return "Workstation VRAM";
    default:
      return "Unknown VRAM";
  }
}

function getTierSummary(tier: HardwareTier) {
  switch (tier) {
    case "low":
      return "Prioritize SD 1.x, smaller canvases, and fewer steps.";
    case "medium":
      return "Good for SD 1.x and cautious SDXL tests.";
    case "high":
      return "Good for SDXL and future heavier presets.";
    case "workstation":
      return "Suitable for SDXL and serious testing of heavier model families.";
    default:
      return "OpenLayer can still suggest safe defaults after ComfyUI reports VRAM.";
  }
}

function formatBytes(bytes?: number) {
  if (!bytes) {
    return "unknown";
  }

  return `${bytesToGb(bytes).toFixed(1)} GB`;
}

function bytesToGb(bytes: number) {
  return bytes / 1024 / 1024 / 1024;
}
