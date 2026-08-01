import { describe, expect, it } from "vitest";
import {
  createInstallModelRequest,
  evaluateQueuePrecondition,
  OPENLAYER_UI_ID_PREFIX,
  planAssistedInstall,
  summarizeInstallProgress
} from "../../src/comfy/assistedInstall";
import { listRequiredModelsForPresets } from "../../src/comfy/modelFolders";
import { listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import {
  evaluateSetupRequirements,
  SetupRequirementsReport
} from "../../src/comfy/setupRequirements";
import type {
  ComfyModelInventory,
  WorkflowPresetDefinition,
  WorkflowRequiredModel
} from "../../src/comfy/types";

const PLUGIN_VERSION = "9.9.9";
const FIXED_TIMESTAMP = "2026-08-01T00:00:00.000Z";

describe("assisted install planning", () => {
  it("excludes a missing licence-gated model with the licence reason", () => {
    const report = evaluateMissingRequirements([getRunnablePreset("txt2img-flux1-dev-fp8")]);
    const plan = planAssistedInstall(report);
    const gatedModel = report.models.find((model) => model.licenseGated);

    expect(gatedModel?.status).toBe("missing");
    expect(
      plan.excluded.find(
        (entry) => entry.kind === "model" && entry.requirement.key === gatedModel?.key
      )?.reason
    ).toMatchObject({ id: "licence-gated" });
    expect(plan.installable.map((item) => item.key)).not.toContain(gatedModel?.key);
  });

  it("excludes a wrong-folder model from both the items and installable total", () => {
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
    const plan = planAssistedInstall(report);
    const misplaced = report.models.find((model) => model.modelName === modelName);

    expect(misplaced?.status).toBe("wrong-folder");
    expect(plan.installable).toHaveLength(0);
    expect(plan.totalBytes).toBe(0);
    expect(
      plan.excluded.find(
        (entry) => entry.kind === "model" && entry.requirement.key === misplaced?.key
      )?.reason.id
    ).toBe("wrong-folder");
  });

  it("offers nothing from a report that has not been checked", () => {
    const report = evaluateSetupRequirements({
      pluginVersion: PLUGIN_VERSION,
      generatedAt: FIXED_TIMESTAMP
    });
    const plan = planAssistedInstall(report);

    expect(report.models.every((model) => model.status === "not-checked")).toBe(true);
    expect(plan.installable).toHaveLength(0);
    expect(plan.totalBytes).toBe(0);
  });

  it("says nothing is left to install rather than 'unknown' on a set up machine", () => {
    const presets = [getRunnablePreset("txt2img-krea2-turbo")];
    const report = evaluateSetupRequirements({
      pluginVersion: PLUGIN_VERSION,
      presets,
      inventory: createCompleteInventory(presets),
      generatedAt: FIXED_TIMESTAMP
    });
    const plan = planAssistedInstall(report);

    expect(plan.installable).toHaveLength(0);
    expect(plan.totalBytes).toBe(0);
    // formatBytes returns "unknown" for zero, which is right for an unpublished
    // model size and exactly backwards for a total that reaches zero because
    // everything is already installed.
    expect(plan.formattedTotal).toBe("Nothing");
    expect(plan.formattedTotal).not.toBe("unknown");
  });

  it("never offers custom nodes as installable", () => {
    const report = evaluateSetupRequirements({
      pluginVersion: PLUGIN_VERSION,
      presets: [getRunnablePreset("prompt-from-layer-florence2")],
      inventory: createEmptyInventory(),
      nodeAvailability: {},
      generatedAt: FIXED_TIMESTAMP
    });
    const plan = planAssistedInstall(report);
    const nodeExclusions = plan.excluded.filter((entry) => entry.kind === "custom-node");

    expect(report.customNodes).not.toHaveLength(0);
    expect(nodeExclusions).toHaveLength(report.customNodes.length);
    expect(nodeExclusions.every((entry) => entry.reason.id === "custom-node")).toBe(true);
  });

  it("sorts installable models largest-first and totals only that subset", () => {
    const report = evaluateMissingRequirements([getRunnablePreset("txt2img-krea2-turbo")]);
    const plan = planAssistedInstall(report);
    const sizes = plan.installable.map((item) => item.sizeBytes ?? 0);

    expect(sizes).toEqual([...sizes].sort((left, right) => right - left));
    expect(plan.totalBytes).toBe(sizes.reduce((total, size) => total + size, 0));
    expect(plan.formattedTotal).toMatch(/(GB|MB)$/);
  });

  it("creates the exact Manager body with an attributable OpenLayer ui_id", () => {
    const report = evaluateMissingRequirements([getRunnablePreset("txt2img-krea2-turbo")]);
    const item = planAssistedInstall(report).installable[0];
    const request = createInstallModelRequest(item);

    expect(OPENLAYER_UI_ID_PREFIX).toBe("openlayer:");
    expect(request).toEqual({
      save_path: item.targetFolder,
      base: item.label,
      filename: item.modelName,
      url: item.downloadUrl,
      ui_id: `${OPENLAYER_UI_ID_PREFIX}${item.key}`
    });
  });
});

describe("assisted install queue ownership", () => {
  it("refuses while Manager is processing", () => {
    const verdict = evaluateQueuePrecondition({
      total_count: 1,
      done_count: 0,
      in_progress_count: 1,
      is_processing: true
    });

    expect(verdict).toMatchObject({ allowed: false, reason: "already-processing" });
    expect(verdict.allowed ? "" : verdict.message).toContain("will not add installs");
  });

  it("refuses queued work that OpenLayer does not own", () => {
    const verdict = evaluateQueuePrecondition({
      total_count: 2,
      done_count: 1,
      in_progress_count: 0,
      is_processing: false
    });

    expect(verdict).toMatchObject({ allowed: false, reason: "foreign-items-queued" });
    expect(verdict.allowed ? "" : verdict.message).toContain("OpenLayer did not put there");
  });

  it("allows an idle queue with no unfinished items", () => {
    expect(
      evaluateQueuePrecondition({
        total_count: 3,
        done_count: 3,
        in_progress_count: 0,
        is_processing: false
      })
    ).toEqual({ allowed: true });
  });

  it("keeps foreign targets separate from OpenLayer progress", () => {
    const first = `${OPENLAYER_UI_ID_PREFIX}checkpoints/first.safetensors`;
    const second = `${OPENLAYER_UI_ID_PREFIX}vae/second.safetensors`;
    const summary = summarizeInstallProgress(
      new Set([first, second]),
      [
        { status: "in_progress", target: first },
        { status: "in_progress", target: "manager-browser-item" },
        { status: "done", target: "manager-browser-item" },
        { status: "done", target: first },
        { status: "in_progress", target: second }
      ]
    );

    expect(summary).toEqual({
      pending: 0,
      inProgress: 1,
      done: 1,
      foreign: 1,
      currentUiId: second
    });
  });
});

function evaluateMissingRequirements(
  presets: readonly WorkflowPresetDefinition[]
): SetupRequirementsReport {
  return evaluateSetupRequirements({
    pluginVersion: PLUGIN_VERSION,
    presets,
    inventory: createEmptyInventory(),
    nodeAvailability: {},
    generatedAt: FIXED_TIMESTAMP
  });
}

function getRunnablePreset(id: string): WorkflowPresetDefinition {
  const preset = listRunnableWorkflowPresets().find((candidate) => candidate.id === id);

  if (!preset) {
    throw new Error(`Expected runnable preset ${id}.`);
  }

  return preset;
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
