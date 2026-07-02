import { describe, expect, it } from "vitest";
import { formatInpaintOutpaintDebugContract } from "../../src/metadata/inpaintDebugContract";

describe("inpaint/outpaint debug contract", () => {
  it("formats inpaint source, mask, context, and import expectations", () => {
    expect(
      formatInpaintOutpaintDebugContract({
        toolType: "inpaint",
        presetId: "inpaint-flux-fill-basic",
        sourceMode: "Visible canvas",
        sourceDimensions: {
          width: 512,
          height: 384
        },
        maskDimensions: {
          width: 512,
          height: 384
        },
        maskPolarity: "white-repaints",
        contextBounds: {
          left: 10,
          top: 20,
          right: 522,
          bottom: 404
        },
        outputKind: "full context",
        importMode: "Photoshop layer mask"
      })
    ).toBe(
      "Inpaint debug contract: inpaint-flux-fill-basic. Source mode: Visible canvas. Source: 512 x 384. Mask: 512 x 384. Mask polarity: white = repaint. Context: 10, 20 to 522, 404. Output: full context. Import: Photoshop layer mask."
    );
  });

  it("formats outpaint without mask noise", () => {
    expect(
      formatInpaintOutpaintDebugContract({
        toolType: "outpaint",
        presetId: "outpaint-flux-fill-basic",
        sourceDimensions: {
          width: 640,
          height: 640
        },
        outputKind: "expanded canvas",
        importMode: "new layer"
      })
    ).toBe(
      "Outpaint debug contract: outpaint-flux-fill-basic. Source: 640 x 640. Output: expanded canvas. Import: new layer."
    );
  });
});
