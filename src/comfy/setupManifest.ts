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
  // Kept although no preset ships it any more: it is still a legal node in a
  // user's own custom workflow, and naming its package is what lets Workflow
  // Health say which install is missing rather than reporting an absent node.
  LineartStandardPreprocessor: {
    name: "comfyui_controlnet_aux",
    repoUrl: "https://github.com/Fannovel16/comfyui_controlnet_aux"
  },
  AnyLineArtPreprocessor_aux: {
    name: "comfyui_controlnet_aux",
    repoUrl: "https://github.com/Fannovel16/comfyui_controlnet_aux"
  },
  Scribble_PiDiNet_Preprocessor: {
    name: "comfyui_controlnet_aux",
    repoUrl: "https://github.com/Fannovel16/comfyui_controlnet_aux"
  },
  // Added late: `sketch2img-depth-basic` shipped in v0.13.0 with its
  // preprocessor missing from this map, so Setup and the setup pack reported
  // that the Depth preset needed *no* custom node at all -- the one sketch
  // preset of five that looked installable out of the box was the one whose
  // add-on requirement was invisible. Verified against a live server:
  // `/object_info/DepthAnythingV2Preprocessor` reports its `python_module` as
  // `custom_nodes.comfyui_controlnet_aux`, the same package as the two above.
  DepthAnythingV2Preprocessor: {
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
  },
  // Listing these matters more than usual. ComfyUI-GGUF fails in a way that
  // looks like nothing at all: it needs a `gguf` Python package that its own
  // install does not always pull in, and without it the pack imports silently,
  // registers no classes, and every .gguf model becomes invisible to every
  // loader. Naming the package here means Setup and Workflow Health can say
  // which install is missing instead of reporting an unexplained absent node.
  UnetLoaderGGUF: {
    name: "ComfyUI-GGUF",
    repoUrl: "https://github.com/city96/ComfyUI-GGUF"
  },
  CLIPLoaderGGUF: {
    name: "ComfyUI-GGUF",
    repoUrl: "https://github.com/city96/ComfyUI-GGUF"
  },
  DualCLIPLoaderGGUF: {
    name: "ComfyUI-GGUF",
    repoUrl: "https://github.com/city96/ComfyUI-GGUF"
  },
  // Context-aware inpainting: crop to the mask plus context, sample at a sane
  // resolution, stitch the result back with a blended seam. Both halves are
  // listed because they are two node classes from one package, and Workflow
  // Health names the *package* to install -- reporting "InpaintStitchImproved
  // is absent" tells a user nothing they can act on.
  InpaintCropImproved: {
    name: "comfyui-inpaint-cropandstitch",
    repoUrl: "https://github.com/lquesada/ComfyUI-Inpaint-CropAndStitch"
  },
  InpaintStitchImproved: {
    name: "comfyui-inpaint-cropandstitch",
    repoUrl: "https://github.com/lquesada/ComfyUI-Inpaint-CropAndStitch"
  },
  // Style Reference. CLIPVisionLoader is core ComfyUI and needs no entry here;
  // these two classes are cubiq's IPAdapter Plus reference implementation.
  IPAdapterModelLoader: {
    name: "ComfyUI_IPAdapter_plus",
    repoUrl: "https://github.com/cubiq/ComfyUI_IPAdapter_plus"
  },
  IPAdapterAdvanced: {
    name: "ComfyUI_IPAdapter_plus",
    repoUrl: "https://github.com/cubiq/ComfyUI_IPAdapter_plus"
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
  displayName: string;
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
      displayName: preset.displayName,
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

/**
 * A model file's size, for a human deciding whether to download it.
 *
 * **Decimal, because the number has to match the page it is compared against.**
 * This divided by 1024³ while labelling the result "GB", so every size in Setup,
 * Workflow Health, the footprint estimate and the setup pack read low against
 * the source it was about to be downloaded from: Unflatten's stack showed as
 * "28.1 GB" where Hugging Face says 30.17 GB, and `flux-2-klein-4b-fp8` as
 * "3.8 GB" against a published 4.07 GB. Nobody reads that as two conventions;
 * they read it as the panel disagreeing with the download page about which file
 * this is.
 *
 * Two sibling formatters deliberately do *not* follow this:
 *
 * - `formatBytesForDownload` in `modelDownload.ts` stays binary and says `GiB`
 *   outright. It measures a transfer in progress, not a published file size, and
 *   it is labelled honestly.
 * - `formatBytes` in `hardwareAdvisor.ts` stays binary under a "GB" label,
 *   because it reports VRAM. A 12 GB card is 12 GiB, and every vendor, driver
 *   and operating system calls that "12 GB" — rendering it as "12.9 GB" would be
 *   arithmetically defensible and read as a bug.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "unknown";
  }

  const gigabytes = bytes / 1_000_000_000;

  if (gigabytes >= 1) {
    return `${gigabytes.toFixed(1)} GB`;
  }

  return `${Math.round(bytes / 1_000_000)} MB`;
}
