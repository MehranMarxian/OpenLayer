import { describe, expect, it } from "vitest";
import {
  MODEL_FOLDER_BY_OBJECT_INFO_NODE,
  getModelTargetFolder,
  getModelTargetPath,
  getRequiredModelKey,
  isMappedModelLoaderNode,
  listPresetRequiredModels,
  listRequiredModelsForPresets
} from "../../src/comfy/modelFolders";
import { WORKFLOW_PRESETS, getWorkflowPreset, listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import { WorkflowRequiredModel } from "../../src/comfy/types";
import { getTechnicalErrorDetails } from "../../src/utils/errors";

function model(overrides: Partial<WorkflowRequiredModel>): WorkflowRequiredModel {
  return {
    kind: "checkpoint",
    objectInfoNode: "CheckpointLoaderSimple",
    inputName: "ckpt_name",
    label: "Test model",
    modelName: "test.safetensors",
    ...overrides
  };
}

describe("model folder mapping", () => {
  it("sends each loader to the folder ComfyUI actually reads", () => {
    // Verified against a live ComfyUI via GET /models/<folder>. The
    // checkpoints/diffusion_models split is the one that has bitten this
    // project before: the same Flux file is invisible in the wrong folder.
    expect(MODEL_FOLDER_BY_OBJECT_INFO_NODE).toEqual({
      CheckpointLoaderSimple: "checkpoints",
      UNETLoader: "diffusion_models",
      CLIPLoader: "text_encoders",
      DualCLIPLoader: "text_encoders",
      VAELoader: "vae",
      ControlNetLoader: "controlnet",
      UpscaleModelLoader: "upscale_models",
      Florence2ModelLoader: "LLM"
    });
  });

  it("builds install paths relative to the ComfyUI root", () => {
    expect(getModelTargetPath(model({ objectInfoNode: "UNETLoader" }))).toBe("models/diffusion_models");
    expect(getModelTargetPath(model({ objectInfoNode: "CheckpointLoaderSimple" }))).toBe("models/checkpoints");
    expect(getModelTargetPath(model({ objectInfoNode: "Florence2ModelLoader" }))).toBe("models/LLM");
  });

  it("lets a model override the derived folder", () => {
    expect(getModelTargetFolder(model({ objectInfoNode: "UNETLoader", targetFolder: "checkpoints" }))).toBe(
      "checkpoints"
    );
  });

  it("refuses to guess a folder for an unmapped loader", () => {
    let thrown: unknown;

    try {
      getModelTargetFolder(model({ objectInfoNode: "SomeFutureLoader" }));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    expect(getTechnicalErrorDetails(thrown)).toContain("MODEL_FOLDER_BY_OBJECT_INFO_NODE");
  });

  it("maps every loader node any preset actually names", () => {
    const unmapped: string[] = [];

    for (const preset of WORKFLOW_PRESETS) {
      const nodes = [
        preset.modelSource.objectInfoNode,
        ...(preset.requiredModels ?? []).map((entry) => entry.objectInfoNode),
        ...(preset.modelStack ?? []).map((entry) => entry.objectInfoNode)
      ];

      for (const node of nodes) {
        if (!isMappedModelLoaderNode(node)) {
          unmapped.push(`${preset.id}: ${node}`);
        }
      }
    }

    expect(unmapped).toEqual([]);
  });
});

describe("required model inventory", () => {
  const runnableModels = listRequiredModelsForPresets(listRunnableWorkflowPresets());

  it("freezes what a complete install of the runnable presets needs", () => {
    expect(runnableModels.map(getRequiredModelKey).sort()).toEqual(
      [
        "LLM/Florence-2-base-PromptGen-v2.0",
        "checkpoints/flux1-dev-fp8.safetensors",
        "controlnet/control_v11p_sd15_lineart_fp16.safetensors",
        "diffusion_models/flux1-fill-dev.safetensors",
        "diffusion_models/krea2_turbo_fp8_scaled.safetensors",
        "diffusion_models/z_image_turbo_bf16.safetensors",
        "text_encoders/clip_l.safetensors",
        "text_encoders/qwen3vl_4b_fp8_scaled.safetensors",
        "text_encoders/qwen_3_4b.safetensors",
        "text_encoders/t5xxl_fp16.safetensors",
        "upscale_models/4x-UltraSharp.pth",
        "vae/ae.safetensors",
        "vae/qwen_image_vae.safetensors"
      ].sort()
    );
  });

  it("counts ae.safetensors once even though two stacks load it", () => {
    const fluxFill = listPresetRequiredModels(getWorkflowPreset("inpaint-flux-fill-basic"));
    const zImage = listPresetRequiredModels(getWorkflowPreset("txt2img-z-image-turbo"));

    expect(fluxFill.filter((entry) => entry.modelName === "ae.safetensors")).toHaveLength(1);
    expect(zImage.filter((entry) => entry.modelName === "ae.safetensors")).toHaveLength(1);
    expect(runnableModels.filter((entry) => entry.modelName === "ae.safetensors")).toHaveLength(1);
  });

  it("gives every required model somewhere to download from", () => {
    for (const entry of runnableModels) {
      expect(entry.downloadUrl, `${entry.modelName} has no download URL`).toBeTruthy();
      expect(entry.downloadUrl).toMatch(/^https:\/\//);
      expect(entry.sourcePageUrl).toMatch(/^https:\/\//);
      expect(() => getModelTargetFolder(entry)).not.toThrow();
    }
  });

  it("records a verified size for every single-file download", () => {
    for (const entry of runnableModels) {
      if (entry.downloadLayout === "repo-folder") {
        expect(entry.downloadSizeBytes).toBeUndefined();
        continue;
      }

      expect(entry.downloadSizeBytes, `${entry.modelName} has no verified size`).toBeGreaterThan(0);
    }
  });

  it("gates the licence-restricted Flux weights and nothing else", () => {
    const gated = runnableModels.filter((entry) => entry.licenseGate).map((entry) => entry.modelName);

    expect(gated.sort()).toEqual(["flux1-dev-fp8.safetensors", "flux1-fill-dev.safetensors"]);

    for (const entry of runnableModels) {
      if (!entry.licenseGate) {
        continue;
      }

      expect(entry.licenseGate.name).toBeTruthy();
      expect(entry.licenseGate.url).toMatch(/^https:\/\//);
      expect(entry.licenseGate.summary.length).toBeGreaterThan(20);
    }
  });

  it("keeps the Florence model marked as a repository folder, not a file", () => {
    const florence = runnableModels.find((entry) => entry.modelName === "Florence-2-base-PromptGen-v2.0");

    expect(florence?.downloadLayout).toBe("repo-folder");
    expect(getModelTargetPath(florence!)).toBe("models/LLM");
  });
});
