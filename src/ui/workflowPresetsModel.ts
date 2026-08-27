import { getWorkflowCapability } from "../comfy/workflowCapabilities";
import { listPresetRequiredModels } from "../comfy/modelFolders";
import { getCustomNodePackagesForPreset } from "../comfy/setupManifest";
import { WorkflowPresetDefinition } from "../comfy/types";

/**
 * The Workflow Presets catalogue: every preset OpenLayer ships, grouped by the
 * tool it belongs to.
 *
 * This answers a different question from the Setup screen, which is deliberate.
 * Setup answers "what do I still have to download". This answers "what can this
 * plugin actually do, and what does each route cost me" -- a question that today
 * has no home at all, because presets are only visible as terse ids in each
 * tool's own Workflow dropdown, where `inpaint-flux-fill-cropstitch` sits next
 * to `inpaint-basic` with nothing to say which is which or why.
 *
 * It is built from the registry alone and makes no server call. That is the
 * point: the catalogue is true whether or not ComfyUI is running, and an artist
 * deciding what to try should not need the server up to read it. Install status
 * belongs to Setup, which already owns it and already checks.
 *
 * Pure data in, pure data out -- no DOM, no ComfyClient -- so the grouping and
 * the counting are directly testable.
 */

export type WorkflowPresetStatusTone = "stable" | "experimental";

export type WorkflowPresetRowView = {
  id: string;
  /** Artist-facing model or approach name, e.g. "Flux Fill crop & stitch". */
  displayName: string;
  /** The preset id, shown small so the Workflow dropdown can be matched to a row. */
  technicalId: string;
  description: string;
  statusLabel: string;
  statusTone: WorkflowPresetStatusTone;
  /** e.g. "3 models", or "No extra downloads" when the preset needs none. */
  modelSummary: string;
  /**
   * Named rather than counted. "2 packs" tells an artist nothing actionable,
   * whereas the pack name is the thing they would search for.
   */
  customNodePackages: readonly string[];
  /** The registry's own compatibilityNote, when it has one. */
  note?: string;
};

export type WorkflowPresetGroupView = {
  /** The tool's artist-facing name, e.g. "Inpaint". */
  toolLabel: string;
  rows: readonly WorkflowPresetRowView[];
};

export type WorkflowPresetsView = {
  groups: readonly WorkflowPresetGroupView[];
  summaryLine: string;
};

export function createWorkflowPresetsView(
  presets: readonly WorkflowPresetDefinition[]
): WorkflowPresetsView {
  const groups = new Map<string, WorkflowPresetRowView[]>();

  for (const preset of presets) {
    const toolLabel = getWorkflowCapability(preset).artistLabel;
    const rows = groups.get(toolLabel) ?? [];

    rows.push(createPresetRow(preset));
    groups.set(toolLabel, rows);
  }

  return {
    // Insertion order, which is registry order. The registry is curated so the
    // most generally useful preset for a tool comes first; re-sorting here would
    // throw that away and put "basic" above the route we actually recommend.
    groups: [...groups.entries()].map(([toolLabel, rows]) => ({ toolLabel, rows })),
    summaryLine: createSummaryLine(presets)
  };
}

function createPresetRow(preset: WorkflowPresetDefinition): WorkflowPresetRowView {
  const modelCount = listPresetRequiredModels(preset).length;

  return {
    id: preset.id,
    displayName: preset.displayName,
    technicalId: preset.id,
    description: preset.description,
    statusLabel: preset.status === "stable" ? "Stable" : "Experimental",
    statusTone: preset.status === "stable" ? "stable" : "experimental",
    modelSummary: formatModelSummary(modelCount),
    customNodePackages: getCustomNodePackagesForPreset(preset),
    note: preset.compatibilityNote
  };
}

/**
 * "No extra downloads" rather than "0 models", because zero here is good news
 * and a bare count reads like something is missing. Same reasoning as the Setup
 * screen's refusal to render a zero remaining download as "unknown".
 */
function formatModelSummary(modelCount: number) {
  if (modelCount === 0) {
    return "No extra downloads";
  }

  return modelCount === 1 ? "1 model" : `${modelCount} models`;
}

function createSummaryLine(presets: readonly WorkflowPresetDefinition[]) {
  if (presets.length === 0) {
    return "No workflow presets are available.";
  }

  const stable = presets.filter((preset) => preset.status === "stable").length;
  const experimental = presets.length - stable;
  const presetWord = presets.length === 1 ? "preset" : "presets";

  if (experimental === 0) {
    return `${presets.length} ${presetWord}, all stable.`;
  }

  return `${presets.length} ${presetWord}: ${stable} stable, ${experimental} experimental.`;
}
