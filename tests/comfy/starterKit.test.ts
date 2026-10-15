import { describe, expect, it } from "vitest";
import { getRequiredModelKey, listRequiredModelsForPresets } from "../../src/comfy/modelFolders";
import { listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import { evaluateSetupRequirements } from "../../src/comfy/setupRequirements";
import {
  evaluateStarter,
  getStarterModels,
  getStarterPresets,
  STARTER_TOOLS
} from "../../src/comfy/starterKit";
import { ComfyModelInventory, WorkflowPresetDefinition } from "../../src/comfy/types";
import { WorkflowNodeAvailability } from "../../src/comfy/workflowCompatibility";

const allNodes = (presets: readonly WorkflowPresetDefinition[]): WorkflowNodeAvailability =>
  Object.fromEntries(
    presets.flatMap((preset) => preset.requiredNodes.map((node) => [node.classType, node.requiredInputs]))
  );

// Every node every preset uses, minus the crop-and-stitch pack Inpaint needs.
const nodesWithoutCropAndStitch = (): WorkflowNodeAvailability =>
  Object.fromEntries(
    Object.entries(allNodes(listRunnableWorkflowPresets())).filter(([classType]) => !classType.startsWith("Inpaint"))
  );

function report(inventory: Partial<ComfyModelInventory>, nodes: WorkflowNodeAvailability = nodesWithoutCropAndStitch()) {
  return evaluateSetupRequirements({ pluginVersion: "9.9.9", inventory, nodeAvailability: nodes });
}

const KLEIN = "flux-2-klein-4b-fp8.safetensors";
const ENCODER = "qwen_3_4b.safetensors";
const VAE = "flux2-vae.safetensors";

describe("the starter, read from the registry", () => {
  it("is three files of about 12.5 GB, every one downloadable, ungated and hash-recorded", () => {
    const models = getStarterModels();

    expect(models.map((model) => model.modelName).sort()).toEqual([KLEIN, VAE, ENCODER].sort());
    expect(models.reduce((total, model) => total + (model.downloadSizeBytes ?? 0), 0)).toBe(12451820124);
    for (const model of models) {
      expect(model.downloadUrl, model.modelName).toBeTruthy();
      expect(model.licenseGate, model.modelName).toBeUndefined();
      expect(model.sha256, model.modelName).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("covers every tool with nothing beyond those three files", () => {
    // If a starter preset ever needs a file the others do not, the pitch of one
    // download for all of them stops being true, and this fails first.
    const starterKeys = getStarterModels().map(getRequiredModelKey).sort();

    for (const preset of getStarterPresets()) {
      expect(listRequiredModelsForPresets([preset]).map(getRequiredModelKey).sort(), preset.id).toEqual(starterKeys);
    }
  });

  it("names five tools, each on a preset that exists and is runnable", () => {
    const runnable = new Set(listRunnableWorkflowPresets().map((preset) => preset.id));

    expect(STARTER_TOOLS.map((tool) => tool.toolLabel)).toEqual([
      "Text to Image",
      "Image to Image",
      "Edit Image",
      "Inpaint",
      "Multi-Reference"
    ]);
    expect(STARTER_TOOLS.every((tool) => runnable.has(tool.presetId))).toBe(true);
  });
});

describe("evaluateStarter", () => {
  it("before a check, gives the size without claiming anything is missing", () => {
    const status = evaluateStarter(evaluateSetupRequirements({ pluginVersion: "9.9.9" }));

    expect(status.state).toBe("not-checked");
    expect(status.summary).toBe("Start here: FLUX.2 Klein 4B, 3 files, 12.5 GB. Check Again to see what you already have.");
  });

  it("on a fresh ComfyUI, offers all three files and is honest about Inpaint's node pack", () => {
    const status = evaluateStarter(report({}));

    expect(status.state).toBe("needs-download");
    expect(status.toDownload.map((file) => file.modelName).sort()).toEqual([KLEIN, VAE, ENCODER].sort());
    expect(status.bytesToDownload).toBe(12451820124);
    expect(status.summary).toBe(
      "Start here: download FLUX.2 Klein 4B (3 of 3 files, 12.5 GB, Apache-2.0) to run Text to Image, Image to Image, Edit Image and Multi-Reference. Inpaint also needs the comfyui-inpaint-cropandstitch node pack, installed through ComfyUI-Manager."
    );
  });

  it("counts only what is still missing when the encoder is already there (shared with Z-Image Turbo)", () => {
    const status = evaluateStarter(report({ clipModels: [ENCODER] }));

    expect(status.toDownload.map((file) => file.modelName).sort()).toEqual([KLEIN, VAE].sort());
    expect(status.filesInstalled).toBe(1);
    expect(status.summary).toContain("2 of 3 files");
  });

  it("asks for a move, not a download, when a file is in the wrong folder", () => {
    const status = evaluateStarter(report({ checkpoints: [KLEIN], clipModels: [ENCODER], vaeModels: [VAE] }));

    expect(status.state).toBe("needs-move");
    expect(status.toDownload).toEqual([]);
    expect(status.summary).toContain("flux-2-klein-4b-fp8.safetensors is on disk in the wrong folder");
  });

  it("says which tools run now once the files are installed, and drops the pack note once the pack is too", () => {
    const installed = { diffusionModels: [KLEIN], clipModels: [ENCODER], vaeModels: [VAE] };

    expect(evaluateStarter(report(installed)).summary).toBe(
      "FLUX.2 Klein 4B is installed: Text to Image, Image to Image, Edit Image and Multi-Reference can run now. Inpaint also needs the comfyui-inpaint-cropandstitch node pack, installed through ComfyUI-Manager."
    );
    expect(evaluateStarter(report(installed, allNodes(listRunnableWorkflowPresets()))).summary).toBe(
      "FLUX.2 Klein 4B is installed: Text to Image, Image to Image, Edit Image, Inpaint and Multi-Reference can run now."
    );
  });

  it("marks the experimental tools, so the Setup screen can say so", () => {
    const experimental = evaluateStarter(report({})).tools.filter((tool) => tool.experimental).map((tool) => tool.toolLabel);

    expect(experimental).toEqual(["Inpaint", "Multi-Reference"]);
  });

  it("writes plain text, because the Setup screen renders it with textContent", () => {
    for (const status of [evaluateStarter(report({})), evaluateStarter(report({ checkpoints: [KLEIN] }))]) {
      expect(status.summary).not.toMatch(/`|--/);
    }
  });
});
