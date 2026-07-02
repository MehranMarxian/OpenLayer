import { describe, expect, it } from "vitest";
import {
  createOpenLayerLayerMetadata,
  sanitizeOpenLayerLayerMetadata,
  serializeOpenLayerLayerMetadata,
  summarizeOpenLayerLayerMetadata
} from "../../src/metadata/layerMetadata";

describe("OpenLayer layer metadata", () => {
  it("creates sanitized metadata for imported AI layers", () => {
    const metadata = createOpenLayerLayerMetadata({
      openLayerVersion: "0.5.1",
      toolType: "image-to-image",
      workflowPresetId: "img2img-basic",
      modelName: "epicrealism_naturalSinRC1VAE.safetensors",
      prompt: "  painterly portrait\nwith clean edges  ",
      negativePrompt: " watermark\tlogo ",
      seed: 42,
      dimensions: {
        width: 1024,
        height: 768,
        label: "1024 x 768"
      },
      sourceMode: "Active layer",
      sourceBounds: {
        left: 10,
        top: 20,
        right: 110,
        bottom: 220
      },
      importTimestamp: new Date("2026-07-02T10:00:00.000Z")
    });

    expect(metadata.prompt).toBe("painterly portrait with clean edges");
    expect(metadata.negativePrompt).toBe("watermark logo");
    expect(metadata.sourceBounds).toMatchObject({
      left: 10,
      top: 20,
      right: 110,
      bottom: 220,
      width: 100,
      height: 200
    });
    expect(metadata.importTimestamp).toBe("2026-07-02T10:00:00.000Z");
  });

  it("serializes metadata as JSON for future Photoshop persistence", () => {
    const metadata = createOpenLayerLayerMetadata({
      openLayerVersion: "0.5.1",
      toolType: "text-to-image",
      workflowPresetId: "txt2img-basic",
      modelName: "sd_xl_base_1.0.safetensors",
      prompt: "cloud city",
      seed: 123,
      dimensions: "512 x 512"
    });

    const parsed = JSON.parse(serializeOpenLayerLayerMetadata(metadata)) as Record<string, unknown>;

    expect(parsed.appName).toBe("OpenLayer");
    expect(parsed.workflowPresetId).toBe("txt2img-basic");
    expect(parsed.seed).toBe(123);
  });

  it("summarizes metadata for diagnostics and history", () => {
    const metadata = createOpenLayerLayerMetadata({
      openLayerVersion: "0.5.1",
      toolType: "inpaint",
      workflowPresetId: "inpaint-flux-fill-basic",
      modelName: "flux1-fill-dev.safetensors",
      prompt: "repair sleeve",
      seed: 7,
      dimensions: "selection context",
      experimental: true
    });

    expect(summarizeOpenLayerLayerMetadata(metadata)).toBe(
      "OpenLayer v0.5.1 | Inpaint | inpaint-flux-fill-basic | flux1-fill-dev.safetensors | Seed 7 | selection context | Experimental"
    );
  });

  it("drops unsafe or invalid optional values", () => {
    const metadata = sanitizeOpenLayerLayerMetadata({
      schemaVersion: 1,
      appName: "OpenLayer",
      openLayerVersion: "",
      toolType: "upscale",
      workflowPresetId: "",
      modelName: "",
      prompt: "",
      seed: Number.NaN,
      dimensions: {
        width: -1,
        height: 0,
        label: ""
      },
      sourceBounds: {
        left: Number.NaN,
        top: 0,
        right: 10,
        bottom: 10
      },
      importTimestamp: "not a date",
      experimental: false
    });

    expect(metadata.openLayerVersion).toBe("unknown");
    expect(metadata.workflowPresetId).toBe("unknown");
    expect(metadata.modelName).toBe("unknown");
    expect(metadata.prompt).toBe("Untitled prompt");
    expect(metadata.seed).toBeUndefined();
    expect(metadata.dimensions).toBeUndefined();
    expect(metadata.sourceBounds).toBeUndefined();
    expect(Date.parse(metadata.importTimestamp)).not.toBeNaN();
  });
});
