import { describe, expect, it } from "vitest";
import {
  classifyInpaintOutputKind,
  formatInpaintOutputDiagnostics,
  readImageDimensionsFromBlob,
  resolveWithTimeout,
  tryCreateTransparentInpaintResultBlob,
  validateInpaintOutputDimensions
} from "../../src/comfy/inpaintOutput";
import { encodeRgbaPng } from "../../src/utils/png";

describe("inpaint output handling", () => {
  it("reads PNG dimensions from a generated blob", async () => {
    const png = encodeRgbaPng({
      width: 3,
      height: 2,
      rgba: new Uint8Array(3 * 2 * 4)
    });

    const dimensions = await readImageDimensionsFromBlob(new Blob([png], { type: "image/png" }));

    expect(dimensions).toEqual({ width: 3, height: 2 });
  });

  it("classifies matching result dimensions as a full-context output", () => {
    const outputKind = classifyInpaintOutputKind({
      presetId: "inpaint-flux-fill-basic",
      sourceDimensions: { width: 512, height: 512 },
      maskDimensions: { width: 512, height: 512 },
      resultDimensions: { width: 512, height: 512 },
      importMode: "transparent-outside-mask",
      maskPolarity: "white-repaints"
    });

    expect(outputKind).toBe("full-context");
  });

  it("reports mismatched source and mask dimensions", () => {
    const problems = validateInpaintOutputDimensions({
      presetId: "inpaint-flux-fill-basic",
      sourceDimensions: { width: 512, height: 512 },
      maskDimensions: { width: 256, height: 512 },
      resultDimensions: { width: 512, height: 512 },
      importMode: "aligned-context-fallback",
      maskPolarity: "white-repaints"
    });

    expect(problems.join(" ")).toContain("source 512 x 512, mask 256 x 512");
  });

  it("formats artist-readable inpaint diagnostics", () => {
    const diagnostics = formatInpaintOutputDiagnostics({
      presetId: "inpaint-flux-fill-basic",
      sourceDimensions: { width: 319, height: 321 },
      maskDimensions: { width: 319, height: 321 },
      resultDimensions: { width: 319, height: 321 },
      importMode: "transparent-outside-mask",
      maskPolarity: "white-repaints"
    });

    expect(diagnostics).toContain("inpaint-flux-fill-basic");
    expect(diagnostics).toContain("Raw result 319 x 321");
    expect(diagnostics).toContain("transparent outside mask");
    expect(diagnostics).toContain("white = repaint");
  });

  it("times out unsafe transparent compositing work", async () => {
    const outcome = await resolveWithTimeout(new Promise<string>(() => undefined), 5, "fallback");

    expect(outcome).toEqual({
      value: "fallback",
      timedOut: true
    });
  });

  it("skips transparent compositing when DOM canvas support is unavailable", async () => {
    const png = new Blob([
      encodeRgbaPng({
        width: 2,
        height: 2,
        rgba: new Uint8Array(2 * 2 * 4)
      })
    ], { type: "image/png" });

    const outcome = await tryCreateTransparentInpaintResultBlob(png, png, 10);

    expect(outcome.blob).toBeNull();
    expect(outcome.status).toBe("skipped");
    expect(outcome.message).toContain("Aligned context fallback used");
  });
});
