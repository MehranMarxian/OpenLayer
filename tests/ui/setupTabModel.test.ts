import { describe, expect, it } from "vitest";
import { listRequiredModelsForPresets } from "../../src/comfy/modelFolders";
import { listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import {
  SetupRequirementsReport,
  evaluateSetupRequirements
} from "../../src/comfy/setupRequirements";
import {
  ComfyModelInventory,
  WorkflowPresetDefinition,
  WorkflowRequiredModel
} from "../../src/comfy/types";
import { WorkflowNodeAvailability } from "../../src/comfy/workflowCompatibility";
import {
  SetupRowView,
  SetupSectionView,
  SetupTabView,
  createSetupTabView
} from "../../src/ui/setupTabModel";

const PLUGIN_VERSION = "9.9.9";
const FIXED_TIMESTAMP = "2026-07-31T00:00:00.000Z";

describe("setup tab model", () => {
  it("treats a wrong-folder model as already downloaded", () => {
    const presets = [getRunnablePreset("txt2img-krea2-turbo")];
    const inventory = createCompleteInventory(presets);
    const modelName = "krea2_turbo_fp8_scaled.safetensors";
    inventory.diffusionModels = inventory.diffusionModels.filter(
      (name) => name !== modelName
    );
    inventory.checkpoints.push(modelName);
    const report = evaluateReport(presets, { inventory });
    const requirement = getReportModel(report, `diffusion_models/${modelName}`);
    const row = getRow(createSetupTabView(report), requirement.key);

    expect(row.badgeLabel).toBe("Wrong folder");
    expect(row.badgeTone).toBe("warning");
    expect(row.fields.find((field) => field.label === "Found in")).toEqual({
      label: "Found in",
      value: "models/checkpoints/"
    });
    expect(row.fields.some((field) => field.label === "Download")).toBe(false);
    expect(row.notes[0]).toBe(
      "You already have this file. Move it, then refresh ComfyUI. Nothing to download."
    );
  });

  it("gives a missing model its install details and folder action", () => {
    const presets = [getRunnablePreset("upscale-basic")];
    const report = evaluateReport(presets, { inventory: createEmptyInventory() });
    const requirement = report.models[0];
    const row = getRow(createSetupTabView(report), requirement.key);

    expect(row.badgeLabel).toBe("Missing");
    expect(row.fields.map((field) => field.label)).toEqual([
      "Goes in",
      "Download",
      "Unlocks"
    ]);
    expect(row.actions.find((action) => action.id === "copy-folder-path")).toEqual({
      id: "copy-folder-path",
      label: "Copy Folder Path",
      value: requirement.targetPath,
      copiedMessage: `Copied the folder path for ${requirement.modelName}.`
    });
  });

  it("moves installed rows into collapsedRows without actions", () => {
    const presets = [getRunnablePreset("upscale-basic")];
    const report = evaluateReport(presets, {
      inventory: createCompleteInventory(presets)
    });
    const section = getSection(createSetupTabView(report), "models");

    expect(section.rows).toEqual([]);
    expect(section.collapsedRows).toHaveLength(1);
    expect(section.collapsedRows[0].collapsed).toBe(true);
    expect(section.collapsedRows[0].actions).toEqual([]);
    expect(section.collapsedRows[0].fields).toEqual([]);
  });

  it("keeps an unavailable server neutral while preserving the shopping list", () => {
    const presets = [getRunnablePreset("prompt-from-layer-florence2")];
    const report = evaluateReport(presets);
    const view = createSetupTabView(report);
    const rows = view.sections.flatMap((section) => section.rows);

    expect(report.checked).toBe(false);
    expect(view.tallies.map((tally) => tally.value)).toEqual(["-", "-", "-"]);
    expect(rows).not.toHaveLength(0);
    expect(rows.every((row) => row.badgeLabel === "Not checked")).toBe(true);
    expect(rows.every((row) => row.badgeTone === "neutral")).toBe(true);
    expect(view.downloadLine).toBe(
      `${report.formattedRemainingDownload} across ${report.models.length} models if you are starting from nothing.`
    );
    expect(view.downloadLine).toContain("starting from nothing");
  });

  it("filters requirement rows without changing whole-report totals or summary", () => {
    const presets = [
      getRunnablePreset("txt2img-krea2-turbo"),
      getRunnablePreset("upscale-basic"),
      getRunnablePreset("prompt-from-layer-florence2")
    ];
    const report = evaluateReport(presets, {
      inventory: createEmptyInventory(),
      nodeAvailability: {}
    });
    const unfiltered = createSetupTabView(report);
    const filtered = createSetupTabView(report, { activeToolLabel: "Text to Image" });

    expect(getSection(filtered, "models").rows.length).toBeLessThan(
      getSection(unfiltered, "models").rows.length
    );
    expect(getSection(filtered, "custom-nodes").rows).toEqual([]);
    expect(getSection(filtered, "custom-nodes").emptyMessage).toBe(
      "Text to Image needs no custom node packages."
    );
    expect(filtered.tallies).toEqual(unfiltered.tallies);
    expect(filtered.summaryLine).toBe(unfiltered.summaryLine);
    expect(filtered.downloadLine).toBe(unfiltered.downloadLine);
  });

  it("keeps licence and repository-folder instructions on their model rows", () => {
    const presets = [
      getRunnablePreset("txt2img-flux1-dev-fp8"),
      getRunnablePreset("prompt-from-layer-florence2")
    ];
    const report = evaluateReport(presets, {
      inventory: createEmptyInventory(),
      nodeAvailability: {}
    });
    const view = createSetupTabView(report);
    const licenceModel = report.models.find((model) => model.licenseGated);
    const folderModel = report.models.find((model) => model.layout === "repo-folder");

    expect(licenceModel).toBeDefined();
    expect(folderModel).toBeDefined();
    expect(getRow(view, licenceModel!.key).notes).toContain(
      "Accept the licence on the model page before downloading. This file is not available without signing in."
    );
    expect(getRow(view, folderModel!.key).notes).toContain(
      "Clone the whole repository folder, not a single file. This loader opens a directory."
    );
  });

  it("explains a partially installed custom node package", () => {
    const presets = [getRunnablePreset("prompt-from-layer-florence2")];
    const report = evaluateReport(presets, {
      nodeAvailability: { Florence2ModelLoader: [] }
    });
    const row = getRow(createSetupTabView(report), "ComfyUI-Florence2");

    expect(report.customNodes[0].missingClassTypes).toEqual(["Florence2Run"]);
    expect(row.notes).toEqual([
      "Install it, then restart ComfyUI. New nodes are not picked up by a refresh.",
      "Part of this package is loaded but Florence2Run is not, which usually means a broken or half-finished install."
    ]);
  });

  it("uses singular and plural installed summaries for models and node packages", () => {
    const singleModelPresets = [getRunnablePreset("upscale-basic")];
    const singleModelView = createSetupTabView(
      evaluateReport(singleModelPresets, {
        inventory: createCompleteInventory(singleModelPresets)
      })
    );
    const pluralModelPresets = [getRunnablePreset("txt2img-krea2-turbo")];
    const pluralModelView = createSetupTabView(
      evaluateReport(pluralModelPresets, {
        inventory: createCompleteInventory(pluralModelPresets)
      })
    );
    const singleNodePresets = [getRunnablePreset("prompt-from-layer-florence2")];
    const singleNodeView = createSetupTabView(
      evaluateReport(singleNodePresets, {
        nodeAvailability: createCompleteNodeAvailability(singleNodePresets)
      })
    );
    const pluralNodePresets = [
      getRunnablePreset("prompt-from-layer-florence2"),
      getRunnablePreset("sketch2img-linecn-basic")
    ];
    const pluralNodeView = createSetupTabView(
      evaluateReport(pluralNodePresets, {
        nodeAvailability: createCompleteNodeAvailability(pluralNodePresets)
      })
    );

    expect(getSection(singleModelView, "models").collapsedSummary).toBe(
      "1 installed model"
    );
    expect(getSection(pluralModelView, "models").collapsedSummary).toBe(
      "3 installed models"
    );
    expect(getSection(singleNodeView, "custom-nodes").collapsedSummary).toBe(
      "1 installed node package"
    );
    expect(getSection(pluralNodeView, "custom-nodes").collapsedSummary).toBe(
      "2 installed node packages"
    );
  });

  it("keeps every string in the complete view plain text", () => {
    const presets = listRunnableWorkflowPresets();
    const unchecked = createSetupTabView(evaluateReport(presets));
    const missing = createSetupTabView(
      evaluateReport(presets, {
        inventory: createEmptyInventory(),
        nodeAvailability: {}
      }),
      { checkedAtLabel: "Checked just now", activeToolLabel: "Everything" }
    );
    const installed = createSetupTabView(
      evaluateReport(presets, {
        inventory: createCompleteInventory(presets),
        nodeAvailability: createCompleteNodeAvailability(presets)
      })
    );

    for (const value of collectStrings([unchecked, missing, installed])) {
      expect(value).not.toMatch(/[`\u2014\u2026]/u);
      expect(value).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

function evaluateReport(
  presets: readonly WorkflowPresetDefinition[],
  availability: {
    inventory?: ComfyModelInventory;
    nodeAvailability?: WorkflowNodeAvailability;
  } = {}
): SetupRequirementsReport {
  return evaluateSetupRequirements({
    pluginVersion: PLUGIN_VERSION,
    presets,
    generatedAt: FIXED_TIMESTAMP,
    ...availability
  });
}

function getRunnablePreset(id: string): WorkflowPresetDefinition {
  const preset = listRunnableWorkflowPresets().find((candidate) => candidate.id === id);

  if (!preset) {
    throw new Error(`Expected runnable preset ${id}.`);
  }

  return preset;
}

function getReportModel(report: SetupRequirementsReport, key: string) {
  const model = report.models.find((candidate) => candidate.key === key);

  if (!model) {
    throw new Error(`Expected setup model ${key}.`);
  }

  return model;
}

function getSection(view: SetupTabView, id: SetupSectionView["id"]): SetupSectionView {
  const section = view.sections.find((candidate) => candidate.id === id);

  if (!section) {
    throw new Error(`Expected setup section ${id}.`);
  }

  return section;
}

function getRow(view: SetupTabView, key: string): SetupRowView {
  const row = view.sections
    .flatMap((section) => [...section.rows, ...section.collapsedRows])
    .find((candidate) => candidate.key === key);

  if (!row) {
    throw new Error(`Expected setup row ${key}.`);
  }

  return row;
}

function createEmptyInventory(): ComfyModelInventory {
  return {
    checkpoints: [],
    diffusionModels: [],
    clipModels: [],
    vaeModels: [],
    controlNetModels: [],
    visionLanguageModels: [],
    upscaleModels: [],
    missingSources: []
  };
}

function createCompleteInventory(
  presets: readonly WorkflowPresetDefinition[]
): ComfyModelInventory {
  const inventory = createEmptyInventory();

  for (const model of listRequiredModelsForPresets(presets)) {
    getInventoryBucket(inventory, model).push(model.modelName);
  }

  return inventory;
}

function getInventoryBucket(
  inventory: ComfyModelInventory,
  model: WorkflowRequiredModel
): string[] {
  switch (model.kind) {
    case "checkpoint":
      return inventory.checkpoints;
    case "diffusion-model-stack":
      return inventory.diffusionModels;
    case "clip":
      return inventory.clipModels;
    case "vae":
      return inventory.vaeModels;
    case "controlnet":
      return inventory.controlNetModels;
    case "vision-language":
      return inventory.visionLanguageModels;
    case "upscale":
      return inventory.upscaleModels;
  }
}

function createCompleteNodeAvailability(
  presets: readonly WorkflowPresetDefinition[]
): WorkflowNodeAvailability {
  return Object.fromEntries(
    presets.flatMap((preset) =>
      preset.requiredNodes.map((requirement) => [
        requirement.classType,
        requirement.requiredInputs
      ])
    )
  );
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
}
