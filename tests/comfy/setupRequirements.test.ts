import { describe, expect, it } from "vitest";
import { listRequiredModelsForPresets } from "../../src/comfy/modelFolders";
import { listRunnableWorkflowPresets, listWorkflowPresets } from "../../src/comfy/presetRegistry";
import {
  SetupRequirementsReport,
  evaluateSetupRequirements
} from "../../src/comfy/setupRequirements";
import { buildSetupManifest } from "../../src/comfy/setupManifest";
import { createWorkflowHealthItem } from "../../src/comfy/workflowHealth";
import {
  ComfyModelInventory,
  WorkflowPresetDefinition,
  WorkflowRequiredModel
} from "../../src/comfy/types";
import { WorkflowNodeAvailability } from "../../src/comfy/workflowCompatibility";

const PLUGIN_VERSION = "9.9.9";
const FIXED_TIMESTAMP = "2026-07-31T00:00:00.000Z";

describe("setup requirements", () => {
  it("keeps every requirement visible and unchecked while the server is unavailable", () => {
    const manifest = buildSetupManifest({
      pluginVersion: PLUGIN_VERSION,
      generatedAt: FIXED_TIMESTAMP
    });
    const report = evaluateSetupRequirements({
      pluginVersion: PLUGIN_VERSION,
      generatedAt: FIXED_TIMESTAMP
    });

    expect(report.checked).toBe(false);
    expect(report.models).not.toHaveLength(0);
    expect(report.customNodes).not.toHaveLength(0);
    expect(report.models.every((model) => model.status === "not-checked")).toBe(true);
    expect(report.customNodes.every((node) => node.status === "not-checked")).toBe(true);
    expect(report.remainingDownloadBytes).toBe(manifest.totals.knownDownloadBytes);
    expect(report.summaryLine).toContain("have not been checked against a server");
    expect(report.summaryLine).toContain(report.formattedRemainingDownload);
  });

  it("reports a complete setup positively when every model and custom node is present", () => {
    const presets = listRunnableWorkflowPresets();
    const report = evaluateSetupRequirements({
      pluginVersion: PLUGIN_VERSION,
      presets,
      inventory: createCompleteInventory(presets),
      nodeAvailability: createCompleteNodeAvailability(presets),
      generatedAt: FIXED_TIMESTAMP
    });

    expect(report.models.every((model) => model.status === "installed")).toBe(true);
    expect(report.customNodes.every((node) => node.status === "installed")).toBe(true);
    expect(report.remainingDownloadBytes).toBe(0);
    expect(report.summaryLine).toBe("All setup requirements are installed. No downloads remain.");
  });

  it("finds Krea-2 Turbo in checkpoints without asking for another download", () => {
    const presets = [getRunnablePreset("txt2img-krea2-turbo")];
    const inventory = createCompleteInventory(presets);
    const modelName = "krea2_turbo_fp8_scaled.safetensors";
    inventory.diffusionModels = inventory.diffusionModels.filter((name) => name !== modelName);
    inventory.checkpoints.push(modelName);

    const report = evaluateSetupRequirements({
      pluginVersion: PLUGIN_VERSION,
      presets,
      inventory,
      generatedAt: FIXED_TIMESTAMP
    });
    const model = getReportModel(report, `diffusion_models/${modelName}`);

    expect(model.status).toBe("wrong-folder");
    expect(model.foundInFolders).toEqual(["checkpoints"]);
    expect(model.detectedModelName).toBe(modelName);
    expect(report.remainingDownloadBytes).toBe(0);
  });

  it("counts a genuinely missing Krea-2 Turbo model in the remaining download", () => {
    const presets = [getRunnablePreset("txt2img-krea2-turbo")];
    const inventory = createCompleteInventory(presets);
    const modelName = "krea2_turbo_fp8_scaled.safetensors";
    inventory.diffusionModels = inventory.diffusionModels.filter((name) => name !== modelName);

    const report = evaluateSetupRequirements({
      pluginVersion: PLUGIN_VERSION,
      presets,
      inventory,
      generatedAt: FIXED_TIMESTAMP
    });
    const model = getReportModel(report, `diffusion_models/${modelName}`);

    expect(model.status).toBe("missing");
    expect(model.foundInFolders).toEqual([]);
    expect(model.detectedModelName).toBeNull();
    expect(model.sizeBytes).toBeGreaterThan(0);
    expect(report.remainingDownloadBytes).toBe(model.sizeBytes);
  });

  it("sorts actionable models by status, usage count, and stable key", () => {
    const presets = [
      getRunnablePreset("txt2img-krea2-turbo"),
      getRunnablePreset("img2img-krea2-turbo"),
      getRunnablePreset("upscale-basic")
    ];
    const inventory = createCompleteInventory(presets);
    const misplacedName = "krea2_turbo_fp8_scaled.safetensors";
    const sharedMissingName = "qwen3vl_4b_fp8_scaled.safetensors";
    const singleMissingName = "4x-UltraSharp.pth";
    inventory.diffusionModels = inventory.diffusionModels.filter((name) => name !== misplacedName);
    inventory.checkpoints.push(misplacedName);
    inventory.clipModels = inventory.clipModels.filter((name) => name !== sharedMissingName);
    inventory.upscaleModels = inventory.upscaleModels.filter((name) => name !== singleMissingName);

    const report = evaluateSetupRequirements({
      pluginVersion: PLUGIN_VERSION,
      presets,
      inventory,
      generatedAt: FIXED_TIMESTAMP
    });

    expect(report.models.map((model) => model.status)).toEqual([
      "missing",
      "missing",
      "wrong-folder",
      "installed"
    ]);
    expect(report.models.slice(0, 2).map((model) => model.usedByPresets.length)).toEqual([2, 1]);
    expect(report.models.slice(0, 2).map((model) => model.modelName)).toEqual([
      sharedMissingName,
      singleMissingName
    ]);

    const uncheckedReport = evaluateSetupRequirements({
      pluginVersion: PLUGIN_VERSION,
      presets,
      generatedAt: FIXED_TIMESTAMP
    });
    expect(uncheckedReport.models.every((model) => model.status === "not-checked")).toBe(true);
    expect(uncheckedReport.models.map((model) => model.usedByPresets.length)).toEqual([2, 2, 2, 1]);
  });

  it("reports a partially installed custom node package as missing", () => {
    const presets = [getRunnablePreset("prompt-from-layer-florence2")];
    const nodeAvailability: WorkflowNodeAvailability = {
      Florence2ModelLoader: []
    };
    const report = evaluateSetupRequirements({
      pluginVersion: PLUGIN_VERSION,
      presets,
      nodeAvailability,
      generatedAt: FIXED_TIMESTAMP
    });

    expect(report.customNodes).toHaveLength(1);
    expect(report.customNodes[0].name).toBe("ComfyUI-Florence2");
    expect(report.customNodes[0].status).toBe("missing");
    expect(report.customNodes[0].missingClassTypes).toEqual(["Florence2Run"]);
  });

  it("gives every registered preset a separate artist-facing display name", () => {
    for (const preset of listWorkflowPresets()) {
      expect(preset.displayName, `${preset.id} has no display name`).toBeTruthy();
      expect(preset.displayName).not.toBe(preset.id);
    }
  });

  it("keeps technical manifest labels while Workflow Health uses display names", () => {
    const preset = getRunnablePreset("txt2img-krea2-turbo");
    const manifest = buildSetupManifest({
      pluginVersion: PLUGIN_VERSION,
      presets: [preset],
      generatedAt: FIXED_TIMESTAMP
    });

    expect(manifest.presets[0].label).toBe("txt2img-krea2-turbo");
    expect(manifest.presets[0].displayName).toBe("Krea-2 Turbo");
    expect(createWorkflowHealthItem(preset).label).toBe("Krea-2 Turbo");
  });

  it("keeps all user-visible report strings plain", () => {
    const reports = [
      evaluateSetupRequirements({
        pluginVersion: PLUGIN_VERSION,
        generatedAt: FIXED_TIMESTAMP
      }),
      evaluateSetupRequirements({
        pluginVersion: PLUGIN_VERSION,
        inventory: createEmptyInventory(),
        nodeAvailability: {},
        generatedAt: FIXED_TIMESTAMP
      })
    ];

    for (const report of reports) {
      const visibleStrings = [
        report.summaryLine,
        report.formattedRemainingDownload,
        ...report.models.map((model) => model.formattedSize)
      ];

      for (const value of visibleStrings) {
        expect(value).not.toMatch(/[`—…]/u);
        expect(value).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });

  it("builds deterministic tool filters from the presets and manifest relationships", () => {
    const presets = [
      getRunnablePreset("txt2img-krea2-turbo"),
      getRunnablePreset("txt2img-z-image-turbo"),
      getRunnablePreset("prompt-from-layer-florence2")
    ];
    const report = evaluateSetupRequirements({
      pluginVersion: PLUGIN_VERSION,
      presets,
      generatedAt: FIXED_TIMESTAMP
    });

    expect(report.toolFilters.map((filter) => filter.toolLabel)).toEqual([
      "Prompt from Layer",
      "Text to Image"
    ]);
    expect(report.toolFilters[1].presetIds).toEqual([
      "txt2img-krea2-turbo",
      "txt2img-z-image-turbo"
    ]);
    expect(report.toolFilters[1].modelKeys).toEqual(
      [...new Set(report.models.flatMap((model) => model.usedByPresets.some((id) => id.startsWith("txt2img-")) ? [model.key] : []))]
        .sort((left, right) => left.localeCompare(right))
    );
    expect(report.toolFilters[0].customNodeNames).toEqual(["ComfyUI-Florence2"]);
  });
});

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
      preset.requiredNodes.map((requirement) => [requirement.classType, requirement.requiredInputs])
    )
  );
}
