import { describe, expect, it } from "vitest";
import { MODEL_INVENTORY_SOURCES } from "../../src/comfy/comfyClient";
import { listRequiredModelsForPresets } from "../../src/comfy/modelFolders";
import { listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";

const askedLoaders = new Set(
  Object.values(MODEL_INVENTORY_SOURCES).flatMap((sources) =>
    sources.map((source) => source.objectInfoNode)
  )
);

describe("model inventory sources", () => {
  /**
   * The regression this exists for: the Flux.2 preset shipped with its GGUF
   * loader mapped to a folder but never added here, so the inventory only ever
   * asked core UNETLoader — which does not enumerate .gguf files at all. The
   * model sat on disk while Setup reported it missing and asked for an 18.7 GB
   * download the user had already made.
   */
  it("asks every loader that a preset requires a model through", () => {
    const unasked = new Set<string>();

    for (const model of listRequiredModelsForPresets(listRunnableWorkflowPresets())) {
      if (!askedLoaders.has(model.objectInfoNode)) {
        unasked.add(model.objectInfoNode);
      }
    }

    expect(
      [...unasked].sort(),
      "these loaders supply a required model but are never asked for their model list, so those models will always read as missing"
    ).toEqual([]);
  });

  it("asks the GGUF loaders, which core loaders cannot stand in for", () => {
    // Verified against a live ComfyUI: with flux2-dev-Q4_K_M.gguf present in
    // models/diffusion_models, UNETLoader listed only the three safetensors
    // beside it, while UnetLoaderGGUF listed the .gguf. They are not
    // interchangeable sources for the same folder.
    expect(askedLoaders.has("UnetLoaderGGUF")).toBe(true);
    expect(askedLoaders.has("CLIPLoaderGGUF")).toBe(true);
    expect(askedLoaders.has("DualCLIPLoaderGGUF")).toBe(true);
  });

  it("keeps every asked loader pointed at a real input name", () => {
    for (const [bucket, sources] of Object.entries(MODEL_INVENTORY_SOURCES)) {
      expect(sources.length, `${bucket} has no inventory source`).toBeGreaterThan(0);

      for (const source of sources) {
        expect(source.objectInfoNode).toMatch(/^[A-Za-z0-9_|]+$/);
        expect(source.inputName.length).toBeGreaterThan(0);
        expect(source.label.length).toBeGreaterThan(0);
      }
    }
  });
});
