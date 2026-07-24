import {
  WorkflowModelFolder,
  WorkflowModelLicenseGate,
  WorkflowPresetDefinition,
  WorkflowRequiredModel
} from "./types";
import { WORKFLOW_PRESETS, listRunnableWorkflowPresets } from "./presetRegistry";
import { getModelTargetFolder, getModelTargetPath, getRequiredModelKey, listPresetRequiredModels } from "./modelFolders";

/**
 * The setup manifest: everything a bare ComfyUI install needs before OpenLayer
 * works, derived entirely from the preset registry.
 *
 * This module is the single producer of that answer. The setup pack generator
 * (`scripts/build-setup-pack.mjs`) serialises it to `requirements.json` and
 * renders it as `REQUIREMENTS.md`; the in-panel Setup tab is meant to read the
 * same structure and check it against a live server. Nothing downstream may
 * restate a model name, a folder, or a node repository — restating is how a
 * setup guide drifts from the software it describes.
 */

/**
 * ComfyUI node classes that do NOT ship with core ComfyUI, and where to get
 * them. Anything absent from this map is treated as core, which is safe only
 * because `tests/comfy/workflowFiles.test.ts` freezes the full set of node
 * classes the presets require — adding a custom node without adding it here
 * fails that test.
 */
export const CUSTOM_NODE_PACKAGES: Record<string, { name: string; repoUrl: string }> = {
  LineArtPreprocessor: {
    name: "comfyui_controlnet_aux",
    repoUrl: "https://github.com/Fannovel16/comfyui_controlnet_aux"
  },
  Florence2ModelLoader: {
    name: "ComfyUI-Florence2",
    repoUrl: "https://github.com/kijai/ComfyUI-Florence2"
  },
  Florence2Run: {
    name: "ComfyUI-Florence2",
    repoUrl: "https://github.com/kijai/ComfyUI-Florence2"
  },
  "ShowText|pysssss": {
    name: "ComfyUI-Custom-Scripts",
    repoUrl: "https://github.com/pythongosssss/ComfyUI-Custom-Scripts"
  }
};

/** The port OpenLayer talks to by default, kept off 8188 on purpose. */
export const DEFAULT_COMFYUI_PORT = 8190;

export type SetupManifestModel = {
  /** Stable identity: `<folder>/<file or directory name>`. */
  key: string;
  modelName: string;
  label: string;
  kind: string;
  loaderNode: string;
  loaderInput: string;
  targetFolder: WorkflowModelFolder;
  /** Install path relative to the ComfyUI root. */
  targetPath: string;
  downloadUrl?: string;
  sourcePageUrl?: string;
  sizeBytes?: number;
  layout: "file" | "repo-folder";
  licenseGate?: WorkflowModelLicenseGate;
  acceptedModelNames?: string[];
  setupHint?: string;
  usedByPresets: string[];
};

export type SetupManifestCustomNode = {
  name: string;
  repoUrl: string;
  classTypes: string[];
  usedByPresets: string[];
};

export type SetupManifestPreset = {
  id: string;
  label: string;
  mode: string;
  status: string;
  description: string;
  workflowFile: string;
  sourceWorkflowFile?: string;
  modelKeys: string[];
  customNodePackages: string[];
};

export type SetupManifest = {
  /** Schema version for the file the panel will one day read. */
  schemaVersion: 1;
  pluginVersion: string;
  generatedAt: string;
  comfyui: {
    defaultPort: number;
  };
  presets: SetupManifestPreset[];
  models: SetupManifestModel[];
  customNodes: SetupManifestCustomNode[];
  totals: {
    presets: number;
    models: number;
    /** Sum of known file sizes; repo-folder models contribute nothing. */
    knownDownloadBytes: number;
    licenseGatedModels: number;
  };
};

export type BuildSetupManifestOptions = {
  pluginVersion: string;
  /** Defaults to the runnable presets: a `todo` preset has no workflow to ship. */
  presets?: readonly WorkflowPresetDefinition[];
  /** Injectable so generated output can be byte-stable in tests. */
  generatedAt?: string;
};

function toManifestModel(model: WorkflowRequiredModel, usedByPresets: string[]): SetupManifestModel {
  return {
    key: getRequiredModelKey(model),
    modelName: model.modelName,
    label: model.label,
    kind: model.kind,
    loaderNode: model.objectInfoNode,
    loaderInput: model.inputName,
    targetFolder: getModelTargetFolder(model),
    targetPath: getModelTargetPath(model),
    downloadUrl: model.downloadUrl,
    sourcePageUrl: model.sourcePageUrl,
    sizeBytes: model.downloadSizeBytes,
    layout: model.downloadLayout ?? "file",
    licenseGate: model.licenseGate,
    acceptedModelNames: model.acceptedModelNames ? [...model.acceptedModelNames] : undefined,
    setupHint: model.setupHint,
    usedByPresets
  };
}

export function getCustomNodePackagesForPreset(preset: WorkflowPresetDefinition): string[] {
  const names = new Set<string>();

  for (const node of preset.requiredNodes) {
    const custom = CUSTOM_NODE_PACKAGES[node.classType];

    if (custom) {
      names.add(custom.name);
    }
  }

  return [...names].sort();
}

export function buildSetupManifest(options: BuildSetupManifestOptions): SetupManifest {
  const presets = options.presets ?? listRunnableWorkflowPresets();
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  const modelsByKey = new Map<string, SetupManifestModel>();
  const nodesByName = new Map<string, SetupManifestCustomNode>();
  const manifestPresets: SetupManifestPreset[] = [];

  for (const preset of presets) {
    const modelKeys: string[] = [];

    for (const model of listPresetRequiredModels(preset)) {
      const key = getRequiredModelKey(model);
      modelKeys.push(key);

      const existing = modelsByKey.get(key);

      if (existing) {
        existing.usedByPresets.push(preset.id);
      } else {
        modelsByKey.set(key, toManifestModel(model, [preset.id]));
      }
    }

    for (const node of preset.requiredNodes) {
      const custom = CUSTOM_NODE_PACKAGES[node.classType];

      if (!custom) {
        continue;
      }

      const existing = nodesByName.get(custom.name);

      if (existing) {
        if (!existing.classTypes.includes(node.classType)) {
          existing.classTypes.push(node.classType);
        }

        if (!existing.usedByPresets.includes(preset.id)) {
          existing.usedByPresets.push(preset.id);
        }
      } else {
        nodesByName.set(custom.name, {
          name: custom.name,
          repoUrl: custom.repoUrl,
          classTypes: [node.classType],
          usedByPresets: [preset.id]
        });
      }
    }

    manifestPresets.push({
      id: preset.id,
      label: preset.label,
      mode: preset.mode,
      status: preset.status,
      description: preset.description,
      workflowFile: preset.workflowFile,
      sourceWorkflowFile: preset.sourceWorkflowFile,
      modelKeys: modelKeys.sort(),
      customNodePackages: getCustomNodePackagesForPreset(preset)
    });
  }

  const models = [...modelsByKey.values()].sort((left, right) => left.key.localeCompare(right.key));
  const customNodes = [...nodesByName.values()].sort((left, right) => left.name.localeCompare(right.name));

  return {
    schemaVersion: 1,
    pluginVersion: options.pluginVersion,
    generatedAt,
    comfyui: {
      defaultPort: DEFAULT_COMFYUI_PORT
    },
    presets: manifestPresets,
    models,
    customNodes,
    totals: {
      presets: manifestPresets.length,
      models: models.length,
      knownDownloadBytes: models.reduce((total, model) => total + (model.sizeBytes ?? 0), 0),
      licenseGatedModels: models.filter((model) => model.licenseGate).length
    }
  };
}

/** Every preset in the registry, including `todo` ones, for diagnostics. */
export function listAllPresetIds(): string[] {
  return WORKFLOW_PRESETS.map((preset) => preset.id);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "unknown";
  }

  const gigabytes = bytes / 1024 ** 3;

  if (gigabytes >= 1) {
    return `${gigabytes.toFixed(1)} GB`;
  }

  return `${Math.round(bytes / 1024 ** 2)} MB`;
}
