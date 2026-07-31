import {
  SetupModelRequirement,
  SetupNodeRequirement,
  SetupRequirementStatus,
  SetupRequirementsReport
} from "../comfy/setupRequirements";

export type SetupBadgeTone = "ready" | "warning" | "error" | "neutral";
export type SetupRowActionId =
  | "copy-download-link"
  | "copy-folder-path"
  | "copy-source-page";
export type SetupRowAction = {
  id: SetupRowActionId;
  label: string;
  value: string;
  copiedMessage: string;
};
export type SetupRowField = { label: string; value: string };
export type SetupRowView = {
  key: string;
  title: string;
  subtitle: string;
  badgeLabel: string;
  badgeTone: SetupBadgeTone;
  fields: SetupRowField[];
  notes: string[];
  actions: SetupRowAction[];
  collapsed: boolean;
};
export type SetupSectionView = {
  id: "models" | "custom-nodes";
  title: string;
  meta: string;
  rows: SetupRowView[];
  collapsedRows: SetupRowView[];
  collapsedSummary: string;
  emptyMessage: string;
};
export type SetupTallyView = {
  label: string;
  value: string;
  tone: SetupBadgeTone;
};
export type SetupFilterView = { toolLabel: string; active: boolean };
export type SetupTabView = {
  tallies: SetupTallyView[];
  summaryLine: string;
  downloadLine: string;
  checkedLabel: string;
  filters: SetupFilterView[];
  sections: SetupSectionView[];
  hasActionableRows: boolean;
};

const EVERYTHING_FILTER = "Everything";

const BADGES: Record<
  SetupRequirementStatus,
  { label: string; tone: SetupBadgeTone }
> = {
  installed: { label: "Installed", tone: "ready" },
  "wrong-folder": { label: "Wrong folder", tone: "warning" },
  missing: { label: "Missing", tone: "error" },
  "not-checked": { label: "Not checked", tone: "neutral" }
};

export function createSetupTabView(
  report: SetupRequirementsReport,
  options?: {
    checkedAtLabel?: string | null;
    activeToolLabel?: string | null;
  }
): SetupTabView {
  const activeToolLabel = options?.activeToolLabel ?? EVERYTHING_FILTER;
  const filterActive = activeToolLabel !== EVERYTHING_FILTER;
  const activeFilter = filterActive
    ? report.toolFilters.find((filter) => filter.toolLabel === activeToolLabel)
    : undefined;
  const visibleModelKeys = new Set(activeFilter?.modelKeys ?? []);
  const visibleNodeNames = new Set(activeFilter?.customNodeNames ?? []);

  const modelViews = report.models
    .filter((model) => !filterActive || visibleModelKeys.has(model.key))
    .map(createModelRow);
  const nodeViews = report.customNodes
    .filter((node) => !filterActive || visibleNodeNames.has(node.name))
    .map(createNodeRow);

  const sections = [
    createSection(
      "models",
      "Models",
      modelViews,
      activeToolLabel,
      filterActive,
      "model",
      "models"
    ),
    createSection(
      "custom-nodes",
      "Custom nodes",
      nodeViews,
      activeToolLabel,
      filterActive,
      "node package",
      "custom node packages"
    )
  ];

  // Tallies and summary lines intentionally describe the whole report. A tool
  // filter narrows only the requirement lists and must not change the totals.
  const tallyValue = (status: "missing" | "wrong-folder" | "installed") =>
    report.checked ? String(report.counts[status]) : "-";

  return {
    tallies: [
      { label: "Missing", value: tallyValue("missing"), tone: "error" },
      {
        label: "Wrong folder",
        value: tallyValue("wrong-folder"),
        tone: "warning"
      },
      { label: "Installed", value: tallyValue("installed"), tone: "ready" }
    ],
    summaryLine: report.summaryLine,
    downloadLine: createDownloadLine(report),
    checkedLabel: options?.checkedAtLabel ?? "Not checked yet.",
    filters: [EVERYTHING_FILTER, ...report.toolFilters.map((filter) => filter.toolLabel)].map(
      (toolLabel) => ({
        toolLabel,
        active: toolLabel === activeToolLabel
      })
    ),
    sections,
    hasActionableRows: sections.some((section) => section.rows.length > 0)
  };
}

function createModelRow(model: SetupModelRequirement): SetupRowView {
  const badge = BADGES[model.status];
  const installed = model.status === "installed";
  const wrongFolder = model.status === "wrong-folder";
  const fields: SetupRowField[] = [];

  if (wrongFolder) {
    fields.push({
      label: "Found in",
      value: joinWithAnd(model.foundInFolders.map((folder) => `models/${folder}/`))
    });
  }

  if (!installed) {
    fields.push({ label: "Goes in", value: `models/${model.targetFolder}/` });
  }

  if (!installed && !wrongFolder) {
    fields.push({ label: "Download", value: model.formattedSize });
  }

  if (!installed && model.unlocksToolLabels.length > 0) {
    fields.push({ label: "Unlocks", value: model.unlocksToolLabels.join(", ") });
  }

  return {
    key: model.key,
    title: model.label,
    subtitle: model.modelName,
    badgeLabel: badge.label,
    badgeTone: badge.tone,
    fields,
    notes: createModelNotes(model),
    actions: installed ? [] : createModelActions(model),
    collapsed: installed
  };
}

function createModelNotes(model: SetupModelRequirement): string[] {
  const notes: string[] = [];

  if (model.status === "wrong-folder") {
    notes.push(
      "You already have this file. Move it, then refresh ComfyUI. Nothing to download."
    );
  }

  if (model.licenseGated) {
    notes.push(
      "Accept the licence on the model page before downloading. This file is not available without signing in."
    );
  }

  if (model.layout === "repo-folder") {
    notes.push(
      "Clone the whole repository folder, not a single file. This loader opens a directory."
    );
  }

  if (
    model.status !== "installed" &&
    model.status !== "not-checked" &&
    model.acceptedModelNames.length > 0
  ) {
    const alternatives = joinWithAnd(model.acceptedModelNames);
    notes.push(
      model.acceptedModelNames.length === 1
        ? `${alternatives} also works.`
        : `${alternatives} also work.`
    );
  }

  return notes;
}

function createModelActions(model: SetupModelRequirement): SetupRowAction[] {
  const actions: SetupRowAction[] = [];

  if (model.downloadUrl) {
    actions.push({
      id: "copy-download-link",
      label: "Copy Link",
      value: model.downloadUrl,
      copiedMessage: `Copied the download link for ${model.modelName}.`
    });
  }

  actions.push({
    id: "copy-folder-path",
    label: "Copy Folder Path",
    value: model.targetPath,
    copiedMessage: `Copied the folder path for ${model.modelName}.`
  });

  if (model.sourcePageUrl && model.sourcePageUrl !== model.downloadUrl) {
    actions.push({
      id: "copy-source-page",
      label: "Copy Page",
      value: model.sourcePageUrl,
      copiedMessage: `Copied the source page for ${model.modelName}.`
    });
  }

  return actions;
}

function createNodeRow(node: SetupNodeRequirement): SetupRowView {
  const badge = BADGES[node.status];
  const installed = node.status === "installed";
  const fields: SetupRowField[] = [];

  if (!installed) {
    fields.push({ label: "Goes in", value: "custom_nodes/" });
  }

  fields.push({ label: "Provides", value: node.classTypes.join(", ") });

  if (!installed && node.unlocksToolLabels.length > 0) {
    fields.push({ label: "Unlocks", value: node.unlocksToolLabels.join(", ") });
  }

  return {
    key: node.name,
    title: node.name,
    subtitle: node.repoUrl.replace(/^https:\/\//, ""),
    badgeLabel: badge.label,
    badgeTone: badge.tone,
    fields,
    notes: createNodeNotes(node),
    actions: installed
      ? []
      : [
          {
            id: "copy-download-link",
            label: "Copy Link",
            value: node.repoUrl,
            copiedMessage: `Copied the repository link for ${node.name}.`
          }
        ],
    collapsed: installed
  };
}

function createNodeNotes(node: SetupNodeRequirement): string[] {
  if (node.status !== "missing") {
    return [];
  }

  const notes = [
    "Install it, then restart ComfyUI. New nodes are not picked up by a refresh."
  ];

  if (
    node.missingClassTypes.length > 0 &&
    node.missingClassTypes.length < node.classTypes.length
  ) {
    notes.push(
      `Part of this package is loaded but ${node.missingClassTypes.join(", ")} is not, which usually means a broken or half-finished install.`
    );
  }

  return notes;
}

function createSection(
  id: SetupSectionView["id"],
  title: string,
  views: SetupRowView[],
  activeToolLabel: string,
  filterActive: boolean,
  singularName: string,
  pluralName: string
): SetupSectionView {
  const rows = views.filter((row) => !row.collapsed);
  const collapsedRows = views.filter((row) => row.collapsed);

  return {
    id,
    title,
    meta: formatCount(views.length, singularName, pluralName),
    rows,
    collapsedRows,
    collapsedSummary: formatInstalledSummary(id, collapsedRows.length),
    emptyMessage: filterActive
      ? `${activeToolLabel} needs no ${pluralName}.`
      : `No ${pluralName} are required.`
  };
}

function formatInstalledSummary(id: SetupSectionView["id"], count: number): string {
  if (count === 0) {
    return "";
  }

  if (id === "models") {
    return `${count} installed ${count === 1 ? "model" : "models"}`;
  }

  return `${count} installed ${count === 1 ? "node package" : "node packages"}`;
}

function formatCount(count: number, singularName: string, pluralName: string): string {
  return `${count} ${count === 1 ? singularName : pluralName}`;
}

function createDownloadLine(report: SetupRequirementsReport): string {
  if (!report.checked) {
    return `${report.formattedRemainingDownload} across ${report.models.length} models if you are starting from nothing.`;
  }

  if (report.remainingDownloadBytes === 0) {
    return "Nothing left to download.";
  }

  return `${report.formattedRemainingDownload} left to download.`;
}

function joinWithAnd(values: readonly string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}
