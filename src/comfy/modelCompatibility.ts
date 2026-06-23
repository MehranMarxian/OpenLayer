import { ModelFamily, WorkflowPresetDefinition } from "./types";

export type CheckpointCompatibility = {
  family: ModelFamily;
  familyLabel: string;
  isExperimental: boolean;
  label: string;
  warning: string;
  experimentalNote: string;
};

const FAMILY_LABELS: Record<ModelFamily, string> = {
  sd1: "SD 1.x",
  sdxl: "SDXL",
  sd3: "SD3",
  flux: "Flux",
  zImage: "Z-Image",
  unknown: "Unknown"
};

export function detectCheckpointFamily(checkpointName: string): ModelFamily {
  const normalized = checkpointName.toLowerCase();

  if (
    normalized.includes("z_image") ||
    normalized.includes("z-image") ||
    normalized.includes("zimage")
  ) {
    return "zImage";
  }

  if (normalized.includes("flux")) {
    return "flux";
  }

  if (
    normalized.includes("sd3") ||
    normalized.includes("sd_3") ||
    normalized.includes("sd-3") ||
    normalized.includes("stable-diffusion-3") ||
    normalized.includes("stable_diffusion_3")
  ) {
    return "sd3";
  }

  if (
    normalized.includes("sdxl") ||
    normalized.includes("sd_xl") ||
    normalized.includes("sd-xl") ||
    normalized.includes("xl_base") ||
    normalized.includes("_xl") ||
    normalized.includes("refiner")
  ) {
    return "sdxl";
  }

  if (
    normalized.includes("sd1") ||
    normalized.includes("sd_1") ||
    normalized.includes("sd-1") ||
    normalized.includes("1.5") ||
    normalized.includes("v1") ||
    normalized.includes("epicrealism")
  ) {
    return "sd1";
  }

  return "unknown";
}

export function getCheckpointCompatibility(
  checkpointName: string,
  preset: WorkflowPresetDefinition
): CheckpointCompatibility {
  const family = detectCheckpointFamily(checkpointName);
  const familyLabel = FAMILY_LABELS[family];
  const isSupported = preset.supportedModelFamilies.includes(family);
  const isExplicitlyExperimental = preset.experimentalModelFamilies.includes(family);
  const isKnownMismatch = family !== "unknown" && !isSupported;
  const isExperimental = isExplicitlyExperimental || isKnownMismatch;

  if (family === "unknown") {
    return {
      family,
      familyLabel,
      isExperimental: false,
      label: `Unknown checkpoint family: allowed, but ${formatSupportedFamilies(preset)} are safest for ${preset.id}.`,
      warning: "",
      experimentalNote: "If generation fails, try an SD 1.x or SDXL checkpoint first."
    };
  }

  if (isSupported) {
    return {
      family,
      familyLabel,
      isExperimental: false,
      label: `${familyLabel} checkpoint: compatible with ${preset.id}.`,
      warning: "",
      experimentalNote: `This is a good default choice for ${preset.label}.`
    };
  }

  return {
    family,
    familyLabel,
    isExperimental,
    label: `${familyLabel} checkpoint: experimental for ${preset.id}.`,
    warning: getFamilyWarning(family),
    experimentalNote: `Use ${familyLabel} only with a dedicated ${familyLabel} workflow preset.`
  };
}

export function getPresetCompatibilityNote(checkpointName: string, preset: WorkflowPresetDefinition) {
  if (!checkpointName) {
    return preset.compatibilityNote ?? "";
  }

  const compatibility = getCheckpointCompatibility(checkpointName, preset);

  if (compatibility.warning) {
    return `${compatibility.label} ${compatibility.warning}`;
  }

  return compatibility.label;
}

function getFamilyWarning(family: ModelFamily) {
  switch (family) {
    case "sd3":
      return "SD3 and SD3.5 usually need dedicated text encoder and VAE loader nodes.";
    case "flux":
      return "Flux usually needs dedicated UNet, CLIP/T5, and VAE loader nodes.";
    case "zImage":
      return "Z-Image models usually need a dedicated Z-Image workflow preset and loader setup.";
    default:
      return "This model family may need a dedicated workflow preset.";
  }
}

function formatSupportedFamilies(preset: WorkflowPresetDefinition) {
  const labels = preset.supportedModelFamilies
    .filter((family) => family !== "unknown")
    .map((family) => FAMILY_LABELS[family]);

  return labels.length > 0 ? labels.join(" or ") : "the preset-supported model families";
}
