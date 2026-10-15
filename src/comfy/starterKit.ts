import { getWorkflowPreset } from "./presetRegistry";
import { getRequiredModelKey, listRequiredModelsForPresets } from "./modelFolders";
import { formatBytes, getCustomNodePackagesForPreset } from "./setupManifest";
import type { SetupModelRequirement, SetupRequirementsReport } from "./setupRequirements";
import type { WorkflowPresetDefinition, WorkflowRequiredModel } from "./types";

/**
 * The starter: the smallest download that gets a new artist from "ComfyUI is
 * running" to a first layer, and then keeps paying off.
 *
 * FLUX.2 Klein 4B, because three files (the diffusion model, its Qwen3 4B text
 * encoder and the FLUX.2 VAE, about 12.5 GB) drive five of OpenLayer's tools,
 * the licence is Apache-2.0 (fine for client work), the weights need no sign-in,
 * and it runs on the 12 GB cards OpenLayer targets. The alternative a fresh
 * install defaults to today, an SD 1.5 checkpoint, is smaller but drives fewer
 * tools and looks a generation older.
 *
 * Everything here is derived from the preset registry: the files are whatever
 * the starter presets require, and a test fails if one of them ever needs a file
 * the others do not. What is NOT derived is the honest part of the pitch:
 * Inpaint also needs a custom node pack, which OpenLayer cannot install, and two
 * of the five tools are experimental. Those are reported, not hidden.
 *
 * Roadmap item E3. Pure: the Setup screen decides how to show it.
 */

export type StarterTool = {
  toolLabel: string;
  presetId: string;
};

export const STARTER_NAME = "FLUX.2 Klein 4B";
export const STARTER_LICENCE = "Apache-2.0";

/** In the order the Setup screen should list them: most used first. */
export const STARTER_TOOLS: readonly StarterTool[] = [
  { toolLabel: "Text to Image", presetId: "txt2img-flux2-klein" },
  { toolLabel: "Image to Image", presetId: "img2img-flux2-klein" },
  { toolLabel: "Edit Image", presetId: "edit-flux2-klein" },
  { toolLabel: "Inpaint", presetId: "inpaint-flux2-klein" },
  { toolLabel: "Multi-Reference", presetId: "multi-reference-flux2-klein" }
];

export function getStarterPresets(): WorkflowPresetDefinition[] {
  return STARTER_TOOLS.map((tool) => getWorkflowPreset(tool.presetId));
}

/** The files the starter downloads, de-duplicated across its presets. */
export function getStarterModels(): WorkflowRequiredModel[] {
  return listRequiredModelsForPresets(getStarterPresets());
}

export type StarterToolStatus = StarterTool & {
  experimental: boolean;
  /** Custom node packs this tool needs beyond ComfyUI's own nodes. */
  nodePacks: string[];
  /** Needs no download and no node pack once the starter files are in place. */
  readyWithFilesAlone: boolean;
};

export type StarterState = "not-checked" | "ready" | "needs-download" | "needs-move" | "unavailable";

export type StarterStatus = {
  state: StarterState;
  filesTotal: number;
  filesInstalled: number;
  bytesTotal: number;
  bytesToDownload: number;
  /** Missing files the Setup screen can download itself. */
  toDownload: SetupModelRequirement[];
  /** Files already on disk in the wrong folder: moving beats downloading again. */
  toMove: SetupModelRequirement[];
  /** Missing files OpenLayer cannot fetch (no URL, licence gate, repo folder). */
  cannotDownload: SetupModelRequirement[];
  tools: StarterToolStatus[];
  /** One plain-text line for the Setup screen. Rendered with textContent. */
  summary: string;
};

export function describeStarterTools(report?: SetupRequirementsReport): StarterToolStatus[] {
  return STARTER_TOOLS.map((tool) => {
    const preset = getWorkflowPreset(tool.presetId);
    const packs = getCustomNodePackagesForPreset(preset);
    const installedPacks = new Set(
      (report?.customNodes ?? []).filter((node) => node.status === "installed").map((node) => node.name)
    );
    const nodePacks = packs.filter((pack) => !installedPacks.has(pack));

    return {
      ...tool,
      experimental: preset.status === "experimental",
      nodePacks,
      readyWithFilesAlone: nodePacks.length === 0
    };
  });
}

export function evaluateStarter(report: SetupRequirementsReport): StarterStatus {
  const keys = new Set(getStarterModels().map(getRequiredModelKey));
  const files = report.models.filter((model) => keys.has(model.key));
  const tools = describeStarterTools(report.checked ? report : undefined);
  const bytesTotal = files.reduce((total, file) => total + (file.sizeBytes ?? 0), 0);

  if (!report.checked) {
    return {
      state: "not-checked",
      filesTotal: files.length,
      filesInstalled: 0,
      bytesTotal,
      bytesToDownload: bytesTotal,
      toDownload: [],
      toMove: [],
      cannotDownload: [],
      tools,
      summary: `Start here: ${STARTER_NAME}, ${files.length} files, ${formatBytes(bytesTotal)}. Check Again to see what you already have.`
    };
  }

  const missing = files.filter((file) => file.status === "missing");
  const toMove = files.filter((file) => file.status === "wrong-folder");
  const cannotDownload = missing.filter(
    (file) => !file.downloadUrl || file.licenseGated || file.layout === "repo-folder"
  );
  const toDownload = missing.filter((file) => !cannotDownload.includes(file));
  const bytesToDownload = toDownload.reduce((total, file) => total + (file.sizeBytes ?? 0), 0);
  const filesInstalled = files.filter((file) => file.status === "installed").length;

  const state: StarterState =
    cannotDownload.length > 0
      ? "unavailable"
      : toMove.length > 0
        ? "needs-move"
        : toDownload.length > 0
          ? "needs-download"
          : "ready";

  return {
    state,
    filesTotal: files.length,
    filesInstalled,
    bytesTotal,
    bytesToDownload,
    toDownload,
    toMove,
    cannotDownload,
    tools,
    summary: summarize(state, files.length, filesInstalled, bytesToDownload, toMove, tools)
  };
}

function summarize(
  state: StarterState,
  filesTotal: number,
  filesInstalled: number,
  bytesToDownload: number,
  toMove: SetupModelRequirement[],
  tools: StarterToolStatus[]
): string {
  const ready = tools.filter((tool) => tool.readyWithFilesAlone).map((tool) => tool.toolLabel);
  const needPack = tools.filter((tool) => !tool.readyWithFilesAlone);
  const packNote = needPack.length
    ? ` ${listWords(needPack.map((tool) => tool.toolLabel))} also ${needPack.length === 1 ? "needs" : "need"} the ${listWords(
        [...new Set(needPack.flatMap((tool) => tool.nodePacks))]
      )} node pack, installed through ComfyUI-Manager.`
    : "";

  switch (state) {
    case "ready":
      return `${STARTER_NAME} is installed: ${listWords(ready)} can run now.${packNote}`;
    case "needs-move":
      return `${toMove.map((file) => file.modelName).join(", ")} ${toMove.length === 1 ? "is" : "are"} on disk in the wrong folder. Move ${toMove.length === 1 ? "it" : "them"} rather than downloading again.`;
    case "unavailable":
      return `${STARTER_NAME} cannot be downloaded from here. Use Copy Link on the missing files.`;
    case "needs-download":
    default:
      return `Start here: download ${STARTER_NAME} (${filesTotal - filesInstalled} of ${filesTotal} files, ${formatBytes(bytesToDownload)}, ${STARTER_LICENCE}) to run ${listWords(ready)}.${packNote}`;
  }
}

function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
