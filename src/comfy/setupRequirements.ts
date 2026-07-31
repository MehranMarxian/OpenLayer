import {
  ComfyModelInventory,
  WorkflowModelFolder,
  WorkflowPresetDefinition,
  WorkflowRequiredModel
} from "./types";
import { listRunnableWorkflowPresets } from "./presetRegistry";
import { buildSetupManifest, formatBytes, SetupManifestModel } from "./setupManifest";
import { getRequiredModelKey, listRequiredModelsForPresets } from "./modelFolders";
import { getAvailableRequiredModelName } from "./workflowModelRequirements";
import { findMisplacedModel } from "./modelPlacementDiagnostics";
import { getWorkflowCapability } from "./workflowCapabilities";
import { WorkflowNodeAvailability } from "./workflowCompatibility";

export type SetupRequirementStatus = "installed" | "wrong-folder" | "missing" | "not-checked";

export type SetupModelRequirement = {
  key: string;
  label: string;
  modelName: string;
  status: SetupRequirementStatus;
  targetFolder: WorkflowModelFolder;
  targetPath: string;
  foundInFolders: WorkflowModelFolder[];
  detectedModelName: string | null;
  downloadUrl?: string;
  sourcePageUrl?: string;
  sizeBytes?: number;
  formattedSize: string;
  layout: "file" | "repo-folder";
  licenseGated: boolean;
  acceptedModelNames: string[];
  setupHint?: string;
  usedByPresets: string[];
  unlocksToolLabels: string[];
};

export type SetupNodeRequirement = {
  name: string;
  repoUrl: string;
  status: SetupRequirementStatus;
  classTypes: string[];
  missingClassTypes: string[];
  usedByPresets: string[];
  unlocksToolLabels: string[];
};

export type SetupToolFilter = {
  toolLabel: string;
  presetIds: string[];
  modelKeys: string[];
  customNodeNames: string[];
};

export type SetupRequirementsReport = {
  checked: boolean;
  models: SetupModelRequirement[];
  customNodes: SetupNodeRequirement[];
  toolFilters: SetupToolFilter[];
  counts: Record<SetupRequirementStatus, number>;
  remainingDownloadBytes: number;
  formattedRemainingDownload: string;
  summaryLine: string;
};

export type EvaluateSetupRequirementsOptions = {
  pluginVersion: string;
  presets?: readonly WorkflowPresetDefinition[];
  inventory?: Partial<ComfyModelInventory> | null;
  nodeAvailability?: WorkflowNodeAvailability | null;
  generatedAt?: string;
};

const STATUS_RANK: Record<SetupRequirementStatus, number> = {
  missing: 0,
  "wrong-folder": 1,
  "not-checked": 2,
  installed: 3
};

export function evaluateSetupRequirements(
  options: EvaluateSetupRequirementsOptions
): SetupRequirementsReport {
  const presets = options.presets ?? listRunnableWorkflowPresets();
  const manifest = buildSetupManifest({
    pluginVersion: options.pluginVersion,
    presets,
    generatedAt: options.generatedAt
  });
  const requiredModelsByKey = new Map<string, WorkflowRequiredModel>(
    listRequiredModelsForPresets(presets).map((model) => [getRequiredModelKey(model), model])
  );
  const presetsById = new Map(presets.map((preset) => [preset.id, preset]));
  const inventorySupplied = options.inventory != null;
  const nodeAvailabilitySupplied = options.nodeAvailability != null;

  const models = manifest.models
    .map((manifestModel) => {
      const requiredModel = requiredModelsByKey.get(manifestModel.key);

      if (!requiredModel) {
        throw new Error(`Setup manifest model ${manifestModel.key} has no matching registry model.`);
      }

      return evaluateModelRequirement(
        manifestModel,
        requiredModel,
        presetsById,
        inventorySupplied ? options.inventory ?? {} : null
      );
    })
    .sort(compareModels);

  const customNodes = manifest.customNodes
    .map((node) => {
      const classTypes = [...node.classTypes].sort();
      const missingClassTypes = nodeAvailabilitySupplied
        ? classTypes.filter((classType) => !(classType in (options.nodeAvailability ?? {})))
        : [];
      const status: SetupRequirementStatus = !nodeAvailabilitySupplied
        ? "not-checked"
        : missingClassTypes.length === 0
          ? "installed"
          : "missing";

      return {
        name: node.name,
        repoUrl: node.repoUrl,
        status,
        classTypes,
        missingClassTypes,
        usedByPresets: [...node.usedByPresets],
        unlocksToolLabels: getToolLabels(node.usedByPresets, presetsById)
      };
    })
    .sort(compareNodes);

  const checked = inventorySupplied || nodeAvailabilitySupplied;
  const counts = countStatuses(models, customNodes);
  const remainingDownloadBytes = inventorySupplied
    ? models
        // A wrong-folder model is already downloaded, so it must never prompt another download.
        .filter((model) => model.status === "missing")
        .reduce((total, model) => total + (model.sizeBytes ?? 0), 0)
    : models.reduce((total, model) => total + (model.sizeBytes ?? 0), 0);
  const formattedRemainingDownload = formatBytes(remainingDownloadBytes);

  return {
    checked,
    models,
    customNodes,
    toolFilters: createToolFilters(presets, manifest.presets),
    counts,
    remainingDownloadBytes,
    formattedRemainingDownload,
    summaryLine: createSummaryLine(checked, counts, formattedRemainingDownload)
  };
}

function evaluateModelRequirement(
  manifestModel: SetupManifestModel,
  requiredModel: WorkflowRequiredModel,
  presetsById: ReadonlyMap<string, WorkflowPresetDefinition>,
  inventory: Partial<ComfyModelInventory> | null
): SetupModelRequirement {
  let status: SetupRequirementStatus = "not-checked";
  let foundInFolders: WorkflowModelFolder[] = [];
  let detectedModelName: string | null = null;

  if (inventory) {
    const availableModelName = getAvailableRequiredModelName(inventory, requiredModel);

    if (availableModelName) {
      status = "installed";
      detectedModelName = availableModelName;
    } else {
      const misplacedModel = findMisplacedModel(inventory, requiredModel);

      if (misplacedModel) {
        status = "wrong-folder";
        foundInFolders = [...misplacedModel.folders];
        detectedModelName = misplacedModel.modelName;
      } else {
        status = "missing";
      }
    }
  }

  return {
    key: getRequiredModelKey(requiredModel),
    label: manifestModel.label,
    modelName: manifestModel.modelName,
    status,
    targetFolder: manifestModel.targetFolder,
    targetPath: manifestModel.targetPath,
    foundInFolders,
    detectedModelName,
    downloadUrl: manifestModel.downloadUrl,
    sourcePageUrl: manifestModel.sourcePageUrl,
    sizeBytes: manifestModel.sizeBytes,
    formattedSize:
      manifestModel.sizeBytes === undefined ? "Size not published" : formatBytes(manifestModel.sizeBytes),
    layout: manifestModel.layout,
    licenseGated: Boolean(manifestModel.licenseGate),
    acceptedModelNames: uniqueSorted(
      (manifestModel.acceptedModelNames ?? []).filter((name) => name !== manifestModel.modelName)
    ),
    setupHint: manifestModel.setupHint,
    usedByPresets: [...manifestModel.usedByPresets],
    unlocksToolLabels: getToolLabels(manifestModel.usedByPresets, presetsById)
  };
}

function getToolLabels(
  presetIds: readonly string[],
  presetsById: ReadonlyMap<string, WorkflowPresetDefinition>
): string[] {
  const labels = presetIds.flatMap((presetId) => {
    const preset = presetsById.get(presetId);
    return preset ? [getWorkflowCapability(preset).artistLabel] : [];
  });

  return uniqueSorted(labels);
}

function createToolFilters(
  presets: readonly WorkflowPresetDefinition[],
  manifestPresets: readonly {
    id: string;
    modelKeys: string[];
    customNodePackages: string[];
  }[]
): SetupToolFilter[] {
  const manifestPresetsById = new Map(manifestPresets.map((preset) => [preset.id, preset]));
  const filtersByLabel = new Map<string, SetupToolFilter>();

  for (const preset of presets) {
    const toolLabel = getWorkflowCapability(preset).artistLabel;
    const manifestPreset = manifestPresetsById.get(preset.id);
    const filter = filtersByLabel.get(toolLabel) ?? {
      toolLabel,
      presetIds: [],
      modelKeys: [],
      customNodeNames: []
    };

    filter.presetIds.push(preset.id);
    filter.modelKeys.push(...(manifestPreset?.modelKeys ?? []));
    filter.customNodeNames.push(...(manifestPreset?.customNodePackages ?? []));
    filtersByLabel.set(toolLabel, filter);
  }

  return [...filtersByLabel.values()]
    .map((filter) => ({
      toolLabel: filter.toolLabel,
      presetIds: uniqueSorted(filter.presetIds),
      modelKeys: uniqueSorted(filter.modelKeys),
      customNodeNames: uniqueSorted(filter.customNodeNames)
    }))
    .sort((left, right) => left.toolLabel.localeCompare(right.toolLabel));
}

function countStatuses(
  models: readonly SetupModelRequirement[],
  customNodes: readonly SetupNodeRequirement[]
): Record<SetupRequirementStatus, number> {
  const counts: Record<SetupRequirementStatus, number> = {
    installed: 0,
    "wrong-folder": 0,
    missing: 0,
    "not-checked": 0
  };

  for (const requirement of [...models, ...customNodes]) {
    counts[requirement.status] += 1;
  }

  return counts;
}

function createSummaryLine(
  checked: boolean,
  counts: Record<SetupRequirementStatus, number>,
  formattedRemainingDownload: string
): string {
  if (!checked) {
    return `Requirements have not been checked against a server. Total known download size is ${formattedRemainingDownload}.`;
  }

  if (counts.missing === 0 && counts["wrong-folder"] === 0 && counts["not-checked"] === 0) {
    return "All setup requirements are installed. No downloads remain.";
  }

  return `Setup check found ${counts.missing} missing, ${counts["wrong-folder"]} in the wrong folder, ${counts["not-checked"]} not checked, and ${counts.installed} installed. Remaining download is ${formattedRemainingDownload}.`;
}

function compareModels(left: SetupModelRequirement, right: SetupModelRequirement): number {
  return (
    STATUS_RANK[left.status] - STATUS_RANK[right.status] ||
    right.usedByPresets.length - left.usedByPresets.length ||
    left.key.localeCompare(right.key)
  );
}

function compareNodes(left: SetupNodeRequirement, right: SetupNodeRequirement): number {
  return STATUS_RANK[left.status] - STATUS_RANK[right.status] || left.name.localeCompare(right.name);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
