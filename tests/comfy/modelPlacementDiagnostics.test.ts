import { describe, expect, it } from "vitest";
import {
  findMisplacedModel,
  formatMisplacedModelMessage
} from "../../src/comfy/modelPlacementDiagnostics";
import { WorkflowRequiredModel } from "../../src/comfy/types";

function model(overrides: Partial<WorkflowRequiredModel> = {}): WorkflowRequiredModel {
  return {
    kind: "vae",
    objectInfoNode: "VAELoader",
    inputName: "vae_name",
    label: "Flux VAE",
    modelName: "ae.safetensors",
    ...overrides
  };
}

describe("model placement diagnostics", () => {
  it("reports one wrong folder and the folder the workflow requires", () => {
    const requiredModel = model();
    const misplacedModel = findMisplacedModel(
      { checkpoints: ["ae.safetensors"] },
      requiredModel
    );

    expect(misplacedModel).toEqual({
      modelName: "ae.safetensors",
      folders: ["checkpoints"],
      requiredFolder: "vae"
    });
    expect(formatMisplacedModelMessage(misplacedModel!)).toBe(
      "Found ae.safetensors in models/checkpoints/, but this workflow reads it from models/vae/. Move the file, then refresh ComfyUI."
    );
  });

  it("reports multiple wrong folders in fixed inventory order across runs", () => {
    const requiredModel = model();
    const inventory = {
      controlNetModels: ["ae.safetensors"],
      checkpoints: ["ae.safetensors"]
    };
    const results = Array.from({ length: 5 }, () =>
      findMisplacedModel(inventory, requiredModel)
    );

    for (const misplacedModel of results) {
      expect(misplacedModel).toEqual({
        modelName: "ae.safetensors",
        folders: ["checkpoints", "controlnet"],
        requiredFolder: "vae"
      });
      expect(formatMisplacedModelMessage(misplacedModel!)).toBe(
        "Found ae.safetensors in models/checkpoints/ and models/controlnet/, but this workflow reads it from models/vae/. Move the file, then refresh ComfyUI."
      );
    }
  });

  it("searches accepted model names as well as the preferred name", () => {
    const misplacedModel = findMisplacedModel(
      { checkpoints: ["fallback.safetensors"] },
      model({
        modelName: "preferred.safetensors",
        acceptedModelNames: ["fallback.safetensors"]
      })
    );

    expect(misplacedModel).toEqual({
      modelName: "fallback.safetensors",
      folders: ["checkpoints"],
      requiredFolder: "vae"
    });
  });

  it("matches case-insensitively and preserves ComfyUI's spelling", () => {
    const requiredModel = model();
    const misplacedModel = findMisplacedModel(
      { checkpoints: ["AE.safetensors"] },
      requiredModel
    );

    expect(misplacedModel?.modelName).toBe("AE.safetensors");
    expect(formatMisplacedModelMessage(misplacedModel!)).toContain(
      "Found AE.safetensors"
    );
  });

  it("matches a nested ComfyUI path by basename", () => {
    const misplacedModel = findMisplacedModel(
      { diffusionModels: ["lcm/SD1.5/ae.safetensors"] },
      model()
    );

    expect(misplacedModel).toEqual({
      modelName: "lcm/SD1.5/ae.safetensors",
      folders: ["diffusion_models"],
      requiredFolder: "vae"
    });
  });

  it("matches the full path when an accepted model name contains a slash", () => {
    const requiredModel = model({ modelName: "expected/ae.safetensors" });

    expect(
      findMisplacedModel(
        { checkpoints: ["other/expected/ae.safetensors"] },
        requiredModel
      )
    ).toBeNull();
    expect(
      findMisplacedModel(
        { checkpoints: ["expected/AE.safetensors"] },
        requiredModel
      )
    ).toEqual({
      modelName: "expected/AE.safetensors",
      folders: ["checkpoints"],
      requiredFolder: "vae"
    });
  });

  it("stays silent instead of throwing when the loader has no mapped folder", () => {
    // getModelTargetFolder throws for an unmapped loader, and this runs inside
    // the workflow health report: one unmappable preset must not fail the whole
    // check. No mapped folder means no opinion about where the file belongs.
    const unmapped = model({ objectInfoNode: "SomeFutureLoader" });

    expect(() => findMisplacedModel({ checkpoints: ["ae.safetensors"] }, unmapped)).not.toThrow();
    expect(findMisplacedModel({ checkpoints: ["ae.safetensors"] }, unmapped)).toBeNull();
  });

  it("still advises when an unmapped loader declares its folder explicitly", () => {
    const explicit = model({ objectInfoNode: "SomeFutureLoader", targetFolder: "vae" });

    expect(findMisplacedModel({ checkpoints: ["ae.safetensors"] }, explicit)).toEqual({
      modelName: "ae.safetensors",
      folders: ["checkpoints"],
      requiredFolder: "vae"
    });
  });

  it("never scans missing inventory source diagnostics as model filenames", () => {
    expect(
      findMisplacedModel(
        { missingSources: ["ae.safetensors"] },
        model()
      )
    ).toBeNull();
  });
});
