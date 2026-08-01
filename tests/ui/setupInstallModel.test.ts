import { describe, expect, it } from "vitest";
import { planAssistedInstall } from "../../src/comfy/assistedInstall";
import { listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import { evaluateSetupRequirements } from "../../src/comfy/setupRequirements";
import {
  createInstallConfirmationView,
  createInstallStatusLine,
  describeDownloadSource,
  describeInstallResult,
  getInstallOffer
} from "../../src/ui/setupInstallModel";
import type { ComfyModelInventory, WorkflowPresetDefinition } from "../../src/comfy/types";

const PLUGIN_VERSION = "9.9.9";
const FIXED_TIMESTAMP = "2026-08-01T00:00:00.000Z";
const MANAGER_VERSION = "V3.41";

describe("setup install view model", () => {
  it("offers an install only when the plan allows it and Manager is present", () => {
    const plan = planAssistedInstall(missingReport());
    const item = plan.installable[0];

    expect(item).toBeDefined();
    expect(getInstallOffer(plan, MANAGER_VERSION, item.key)).toEqual({ kind: "offered", item });
    // The same row, with ComfyUI-Manager absent, must not grow a button that
    // would fail the moment it was pressed.
    expect(getInstallOffer(plan, null, item.key).kind).toBe("hidden");
    expect(getInstallOffer(null, MANAGER_VERSION, item.key).kind).toBe("hidden");
  });

  it("never offers an install for a requirement the plan excluded", () => {
    const report = missingReport();
    const plan = planAssistedInstall(report);
    const gated = report.models.find((model) => model.licenseGated);

    expect(gated).toBeDefined();
    expect(getInstallOffer(plan, MANAGER_VERSION, gated!.key).kind).toBe("hidden");
  });

  it("puts the file, the size, the destination and the host in the confirmation", () => {
    const item = planAssistedInstall(missingReport()).installable[0];
    const view = createInstallConfirmationView(item);

    expect(view.headline).toContain(item.modelName);
    expect(view.fields.map((field) => field.label)).toEqual(["Size", "Into", "From"]);
    expect(view.fields[1].value).toBe(`models/${item.targetFolder}/`);
    expect(view.fields[2].value).not.toContain("/resolve/");
    expect(view.confirmLabel).toBe("Download");
    expect(view.cancelLabel).toBe("Cancel");
  });

  it("reduces a download URL to its host and never throws on a bad one", () => {
    expect(
      describeDownloadSource("https://huggingface.co/Comfy-Org/flux1-dev/resolve/main/x.safetensors")
    ).toBe("huggingface.co");
    expect(describeDownloadSource("http://127.0.0.1:8190/thing.bin")).toBe("127.0.0.1:8190");
    // A malformed value shows as itself rather than blanking the confirmation.
    expect(describeDownloadSource("not a url")).toBe("not a url");
    expect(describeDownloadSource("  ")).toBe("");
  });

  it("names the model in the download step, because that is the slow one", () => {
    expect(createInstallStatusLine("downloading", "ae.safetensors")).toContain("ae.safetensors");
    expect(createInstallStatusLine("checking-queue", "ae.safetensors")).toContain("ComfyUI-Manager");
  });

  it("reports the result from the re-check, not from the installer finishing", () => {
    expect(describeInstallResult("ae.safetensors", false)).toEqual({
      message: "ae.safetensors is installed and ComfyUI can see it.",
      tone: "ready"
    });

    const stillMissing = describeInstallResult("ae.safetensors", true);

    expect(stillMissing.tone).toBe("error");
    expect(stillMissing.message).toContain("still cannot see");
  });
});

function missingReport() {
  return evaluateSetupRequirements({
    pluginVersion: PLUGIN_VERSION,
    presets: [getPreset("txt2img-krea2-turbo"), getPreset("txt2img-flux1-dev-fp8")],
    inventory: createEmptyInventory(),
    nodeAvailability: {},
    generatedAt: FIXED_TIMESTAMP
  });
}

function getPreset(presetId: string): WorkflowPresetDefinition {
  const preset = listRunnableWorkflowPresets().find((candidate) => candidate.id === presetId);

  if (!preset) {
    throw new Error(`Test fixture needs the ${presetId} preset.`);
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
