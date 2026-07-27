import { describe, expect, it } from "vitest";

import type { SaveFileOutcome } from "../../src/utils/saveFile";
import { describeSaveFileOutcome } from "../../src/utils/saveFile";
import {
  LAYER_EXPORT_DESCRIPTORS,
  findLayerExportDescriptor,
  runLayerExport,
  type CapturedExport,
  type LayerExportKind,
  type LayerToolsDependencies
} from "../../src/ui/tools/layerTools";

// The whole point of the per-tool module shape: these are the decisions that
// matter to an artist -- which capture runs, what they are told, what a
// cancelled save does -- and none of them need Photoshop to test.
function createDependencies(
  overrides: Partial<LayerToolsDependencies> = {}
): LayerToolsDependencies & { capturedKinds: LayerExportKind[]; uploads: string[] } {
  const capturedKinds: LayerExportKind[] = [];
  const uploads: string[] = [];

  return {
    capturedKinds,
    uploads,
    capture: async (kind) => {
      capturedKinds.push(kind);

      return { blob: new Blob(["x"]), filename: `${kind}.png` } satisfies CapturedExport;
    },
    saveToFile: async () => ({ kind: "saved", fileName: "chosen.png", byteLength: 1 }),
    uploadToComfyUI: async (_blob, fileName) => {
      uploads.push(fileName);

      return fileName;
    },
    describeSaveOutcome: describeSaveFileOutcome,
    describeError: (caughtError) =>
      caughtError instanceof Error ? caughtError.message : String(caughtError),
    ...overrides
  };
}

describe("layer export inventory", () => {
  it("covers exactly the three advertised exports", () => {
    expect(LAYER_EXPORT_DESCRIPTORS.map((entry) => entry.kind)).toEqual([
      "layer",
      "selection",
      "mask"
    ]);
  });

  it("gives every export a distinct label and subject", () => {
    const labels = LAYER_EXPORT_DESCRIPTORS.map((entry) => entry.label);
    const subjects = LAYER_EXPORT_DESCRIPTORS.map((entry) => entry.subject);

    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(subjects).size).toBe(subjects.length);
  });

  it("refuses an unknown kind rather than silently exporting the wrong thing", () => {
    expect(() => findLayerExportDescriptor("nope" as LayerExportKind)).toThrow(/Unknown layer export kind/);
  });
});

describe("running a layer export", () => {
  it("captures the kind that was asked for", async () => {
    const dependencies = createDependencies();

    await runLayerExport(dependencies, "mask", "file");

    expect(dependencies.capturedKinds).toEqual(["mask"]);
  });

  it("reports a saved file with the name the artist chose", async () => {
    const result = await runLayerExport(createDependencies(), "layer", "file");

    expect(result.status).toBe("ok");
    expect(result.message).toBe("Saved the active layer to chosen.png.");
  });

  it("uploads to ComfyUI and says the name a workflow should reference", async () => {
    const dependencies = createDependencies({
      uploadToComfyUI: async () => "subfolder/selection.png"
    });

    const result = await runLayerExport(dependencies, "selection", "comfyui");

    expect(result.status).toBe("ok");
    expect(result.message).toContain("subfolder/selection.png");
    expect(result.message).toContain("the selection");
  });

  // A cancelled save is the artist changing their mind. Painting it red would
  // train them to ignore the red state.
  it("treats a cancelled save as neither success nor error", async () => {
    const dependencies = createDependencies({
      saveToFile: async () => ({ kind: "cancelled" }) satisfies SaveFileOutcome
    });

    const result = await runLayerExport(dependencies, "layer", "file");

    expect(result.status).toBe("cancelled");
    expect(result.message).toContain("Save cancelled");
  });

  it("reports a capture failure using the adapter's own wording", async () => {
    const dependencies = createDependencies({
      capture: async () => {
        throw new Error("No active Photoshop selection was found. Make a selection before exporting a selection.");
      }
    });

    const result = await runLayerExport(dependencies, "selection", "file");

    expect(result.status).toBe("error");
    expect(result.message).toBe(
      "No active Photoshop selection was found. Make a selection before exporting a selection."
    );
  });

  it("does not attempt to save or upload when the capture failed", async () => {
    let saved = false;
    let uploaded = false;
    const dependencies = createDependencies({
      capture: async () => {
        throw new Error("nope");
      },
      saveToFile: async () => {
        saved = true;

        return { kind: "saved", fileName: "x", byteLength: 0 };
      },
      uploadToComfyUI: async () => {
        uploaded = true;

        return "x";
      }
    });

    await runLayerExport(dependencies, "layer", "file");
    await runLayerExport(dependencies, "layer", "comfyui");

    expect({ saved, uploaded }).toEqual({ saved: false, uploaded: false });
  });

  it("reports an upload failure as an error", async () => {
    const dependencies = createDependencies({
      uploadToComfyUI: async () => {
        throw new Error("Could not upload the source image to ComfyUI. HTTP 500.");
      }
    });

    const result = await runLayerExport(dependencies, "mask", "comfyui");

    expect(result.status).toBe("error");
    expect(result.message).toContain("HTTP 500");
  });

  // The save dialog is absent on some hosts. That must not read as a crash, and
  // it must point at the destination that still works.
  it("explains that ComfyUI still works when the host has no save dialog", async () => {
    const dependencies = createDependencies({
      saveToFile: async () => ({ kind: "unsupported" }) satisfies SaveFileOutcome
    });

    const result = await runLayerExport(dependencies, "mask", "file");

    expect(result.status).toBe("error");
    expect(result.message).toContain("Sending to ComfyUI still works");
  });

  it("uploads under the filename the capture produced", async () => {
    const dependencies = createDependencies();

    await runLayerExport(dependencies, "mask", "comfyui");

    expect(dependencies.uploads).toEqual(["mask.png"]);
  });
});
