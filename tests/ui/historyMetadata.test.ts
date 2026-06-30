import { describe, expect, it } from "vitest";
import {
  createHistoryMetadataLine,
  createHistoryReuseMessage,
  formatHistoryImportStatus,
  formatHistoryToolLabel
} from "../../src/ui/historyMetadata";

describe("historyMetadata", () => {
  it("formats tool labels for artist-facing history entries", () => {
    expect(formatHistoryToolLabel("text-to-image")).toBe("Text to Image");
    expect(formatHistoryToolLabel("image-to-image")).toBe("Image to Image");
    expect(formatHistoryToolLabel("sketch-to-image")).toBe("Sketch to Image");
    expect(formatHistoryToolLabel("inpaint")).toBe("Inpaint");
    expect(formatHistoryToolLabel("outpaint")).toBe("Outpaint");
  });

  it("formats compact history metadata", () => {
    expect(
      createHistoryMetadataLine({
        toolType: "outpaint",
        dimensions: "1024 x 768",
        seed: 42
      })
    ).toBe("Outpaint | 1024 x 768 | Seed 42");
  });

  it("formats import state", () => {
    expect(formatHistoryImportStatus("not-imported")).toBe("Not imported yet");
    expect(formatHistoryImportStatus("imported", "OpenLayer_Generated_001")).toBe(
      "Imported: OpenLayer_Generated_001"
    );
  });

  it("formats reuse messages without changing settings", () => {
    expect(createHistoryReuseMessage("sketch-to-image")).toBe("Reused Sketch to Image settings from history.");
  });
});
