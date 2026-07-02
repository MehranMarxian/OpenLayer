import { describe, expect, it } from "vitest";
import { createOpenLayerLayerMetadata } from "../../src/metadata/layerMetadata";
import { writeOpenLayerLayerMetadata } from "../../src/photoshop/layerMetadata";

describe("Photoshop layer metadata writer", () => {
  it("returns an honest unsupported result when safe layer persistence is not exposed", async () => {
    const metadata = createOpenLayerLayerMetadata({
      openLayerVersion: "0.5.1",
      toolType: "text-to-image",
      workflowPresetId: "txt2img-basic",
      modelName: "model.safetensors",
      prompt: "test prompt"
    });
    const messages: string[] = [];

    const result = await writeOpenLayerLayerMetadata(metadata, (message) => messages.push(message));

    expect(result.supported).toBe(false);
    expect(result.status).toBe("unsupported");
    expect(result.summary).toContain("txt2img-basic");
    expect(result.message).toContain("session history");
    expect(messages).toEqual(["Checking Photoshop layer metadata support..."]);
  });
});
