import { getRequiredModelKey, listPresetRequiredModels } from "./modelFolders";
import { listRunnableWorkflowPresets } from "./presetRegistry";
import { buildSetupManifest, formatBytes } from "./setupManifest";
import { WorkflowPresetDefinition } from "./types";
import { getWorkflowCapability } from "./workflowCapabilities";
import { createOpenLayerError } from "../utils/errors";

export type PresetSizeConfidence = "complete" | "partial" | "checkpoint-dependent";
export type VramExpectation = "comfortable" | "tight" | "offloads" | "unknown";

export type PresetFootprint = {
  presetId: string;
  displayName: string;
  toolLabel: string;
  modelCount: number;
  totalBytes: number;
  largestModelBytes: number;
  largestModelName: string | null;
  unknownSizeCount: number;
  confidence: PresetSizeConfidence;
  formattedTotal: string;
  formattedLargest: string;
};

export type PresetVramOutlook = PresetFootprint & {
  expectation: VramExpectation;
  expectationLabel: string;
  expectationNote: string;
};

const EXPECTATION_LABELS: Record<VramExpectation, string> = {
  comfortable: "Comfortable",
  tight: "Tight",
  offloads: "Will offload",
  unknown: "Not known"
};

const EXPECTATION_RANK: Record<VramExpectation, number> = {
  comfortable: 0,
  tight: 1,
  offloads: 2,
  unknown: 3
};

export function createPresetFootprints(options: {
  pluginVersion: string;
  presets?: readonly WorkflowPresetDefinition[];
  generatedAt?: string;
}): PresetFootprint[] {
  const presets = options.presets ?? listRunnableWorkflowPresets();
  const manifest = buildSetupManifest({
    pluginVersion: options.pluginVersion,
    presets,
    generatedAt: options.generatedAt
  });
  const manifestModelsByKey = new Map(manifest.models.map((model) => [model.key, model]));

  return presets.map((preset) => {
    const requiredModels = listPresetRequiredModels(preset);
    let totalBytes = 0;
    let largestModelBytes = 0;
    let largestModelName: string | null = null;
    let unknownSizeCount = 0;

    for (const requiredModel of requiredModels) {
      const key = getRequiredModelKey(requiredModel);
      const manifestModel = manifestModelsByKey.get(key);

      if (!manifestModel) {
        throw createOpenLayerError(
          "WORKFLOW_INVALID",
          `No setup manifest entry matches the required model ${key}.`,
          "The setup manifest and the preset registry disagree about a required model key."
        );
      }

      if (manifestModel.sizeBytes === undefined) {
        unknownSizeCount += 1;
        continue;
      }

      totalBytes += manifestModel.sizeBytes;

      if (manifestModel.sizeBytes > largestModelBytes) {
        largestModelBytes = manifestModel.sizeBytes;
        largestModelName = manifestModel.modelName;
      }
    }

    const confidence = getSizeConfidence(requiredModels.length, unknownSizeCount);

    return {
      presetId: preset.id,
      displayName: preset.displayName,
      toolLabel: getWorkflowCapability(preset).artistLabel,
      modelCount: requiredModels.length,
      totalBytes,
      largestModelBytes,
      largestModelName,
      unknownSizeCount,
      confidence,
      formattedTotal: formatFootprintBytes(totalBytes, confidence),
      formattedLargest: formatFootprintBytes(largestModelBytes, confidence)
    };
  });
}

export function rankPresetsByVramOutlook(options: {
  pluginVersion: string;
  presets?: readonly WorkflowPresetDefinition[];
  vramTotalBytes?: number | null;
  generatedAt?: string;
}): PresetVramOutlook[] {
  return createPresetFootprints(options)
    .map((footprint) => {
      // ComfyUI can load components at different times and offload them between
      // stages. The largest single file is therefore a better proxy for the
      // dominant resident chunk than the sum. The sum instead describes the
      // total download and the amount of model data that may need streaming.
      const expectation = getVramExpectation(footprint, options.vramTotalBytes);
      const hasVramFigure =
        options.vramTotalBytes != null &&
        options.vramTotalBytes > 0 &&
        Number.isFinite(options.vramTotalBytes);

      return {
        ...footprint,
        expectation,
        expectationLabel: EXPECTATION_LABELS[expectation],
        expectationNote: getExpectationNote(expectation, footprint.confidence, hasVramFigure)
      };
    })
    .sort(compareOutlooks);
}

function getSizeConfidence(
  modelCount: number,
  unknownSizeCount: number
): PresetSizeConfidence {
  if (modelCount === 0) {
    return "checkpoint-dependent";
  }

  return unknownSizeCount > 0 ? "partial" : "complete";
}

function formatFootprintBytes(bytes: number, confidence: PresetSizeConfidence): string {
  if (confidence === "checkpoint-dependent") {
    return "Depends on the checkpoint you pick";
  }

  // A partial stack whose every size is unpublished has nothing to be "at least".
  // Florence-2 is the live case: it is one repo-folder model with no published
  // size, so the naive form of this read "At least 0 MB".
  if (bytes <= 0) {
    return "Size not published";
  }

  return confidence === "partial" ? `At least ${formatBytes(bytes)}` : formatBytes(bytes);
}

function getVramExpectation(
  footprint: PresetFootprint,
  vramTotalBytes?: number | null
): VramExpectation {
  if (
    footprint.confidence === "checkpoint-dependent" ||
    vramTotalBytes == null ||
    vramTotalBytes <= 0 ||
    !Number.isFinite(vramTotalBytes)
  ) {
    return "unknown";
  }

  // An unpublished size is not a small size. With any size missing, "tight" and
  // "offloads" stay safe -- the known part alone already reaches that much -- but
  // "comfortable" does not, because the model nobody published a size for could
  // be the largest in the stack. Left unguarded, Florence-2 measured zero bytes
  // and was reported as the single most comfortable preset on the list.
  if (footprint.largestModelBytes <= vramTotalBytes * 0.7) {
    return footprint.unknownSizeCount > 0 ? "unknown" : "comfortable";
  }

  if (footprint.largestModelBytes <= vramTotalBytes) {
    return "tight";
  }

  return "offloads";
}

function getExpectationNote(
  expectation: VramExpectation,
  confidence: PresetSizeConfidence,
  hasVramFigure: boolean
): string {
  switch (expectation) {
    case "comfortable":
      return "The largest file fits in VRAM with room to spare, so this should run at full speed.";
    case "tight":
      return "The largest file nearly fills VRAM, so expect slower generations and less room for large canvases.";
    case "offloads":
      return "The largest file is bigger than the VRAM, so ComfyUI will keep part of it in system RAM. This means generations will be slower, not broken.";
    case "unknown":
      if (confidence === "checkpoint-dependent") {
        return "The size depends on the checkpoint chosen.";
      }

      if (!hasVramFigure) {
        return "ComfyUI has not reported VRAM, so only the sizes are shown.";
      }

      return "This stack includes a model with no published size, so there is nothing reliable to say about speed.";
  }
}

function compareOutlooks(left: PresetVramOutlook, right: PresetVramOutlook): number {
  return (
    EXPECTATION_RANK[left.expectation] - EXPECTATION_RANK[right.expectation] ||
    left.largestModelBytes - right.largestModelBytes ||
    left.totalBytes - right.totalBytes ||
    left.presetId.localeCompare(right.presetId)
  );
}
