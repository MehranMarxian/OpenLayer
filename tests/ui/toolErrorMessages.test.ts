import { describe, expect, it } from "vitest";
import { createOpenLayerError } from "../../src/utils/errors";
import {
  getFriendlyImageToImageErrorMessage,
  getFriendlyInpaintErrorMessage,
  getFriendlyOutpaintErrorMessage,
  getFriendlySketchErrorMessage,
  getFriendlyUpscaleErrorMessage,
  getImageToImageFailureHint,
  getInpaintFailureHint,
  getOutpaintFailureHint,
  getSketchFailureHint,
  getUpscaleFailureHint
} from "../../src/ui/toolErrorMessages";

/**
 * These are the words an artist reads when a generation fails, and until this
 * file they had no tests at all.
 *
 * Two properties matter more than the exact wording. Each tool must recognise
 * the failures that are actually common for it — a checkpoint that cannot drive
 * its workflow, a custom node pack that is not installed — and every one of them
 * must fall back to the real error rather than guessing when it recognises
 * nothing. A confident wrong diagnosis costs more time than an unhelpful
 * accurate one.
 */

/** ComfyUI reports rejections through technicalDetails, not the message. */
function comfyRejection(technicalDetails: string) {
  return createOpenLayerError("COMFY_REJECTED_WORKFLOW", "ComfyUI rejected the workflow.", technicalDetails);
}

describe("hints recognise each tool's characteristic failure", () => {
  it("points Image to Image at a compatible checkpoint family", () => {
    const hint = getImageToImageFailureHint(comfyRejection("CLIP input is invalid: no text encoder"));

    expect(hint).toContain("SD 1.x and SDXL");
    expect(hint).toContain("img2img-basic");
  });

  it("tells Sketch to Image which custom nodes are missing", () => {
    const hint = getSketchFailureHint(comfyRejection("LineArtPreprocessor node type not found"));

    expect(hint).toContain("LineArt");
    expect(hint).toContain("ControlNet");
  });

  it("names the whole Flux Fill stack for Outpaint, which is the setup people get wrong", () => {
    const hint = getOutpaintFailureHint(comfyRejection("missing node: ImagePadForOutpaint"));

    expect(hint).toContain("ImagePadForOutpaint");
    expect(hint).toContain("DualCLIPLoader");
  });

  it("names the required weights when Outpaint fails on a text encoder", () => {
    const hint = getOutpaintFailureHint(comfyRejection("t5xxl not found"));

    expect(hint).toContain("flux1-fill-dev.safetensors");
    expect(hint).toContain("ae.safetensors");
  });

  it("names the nodes Upscale needs", () => {
    const hint = getUpscaleFailureHint(comfyRejection("UpscaleModelLoader missing node"));

    expect(hint).toContain("UpscaleModelLoader");
    expect(hint).toContain("ImageUpscaleWithModel");
  });

  it("tells the artist to rebuild when a bundled workflow file is absent", () => {
    // Distinct from a ComfyUI problem: the plugin build itself is incomplete,
    // and no amount of fiddling in ComfyUI will fix it.
    expect(getSketchFailureHint(comfyRejection("sketch2img-linecn-basic.json not found"))).toContain("Rebuild OpenLayer");
    expect(getInpaintFailureHint(comfyRejection("inpaint-basic.json not found"))).toContain("Rebuild OpenLayer");
    expect(getOutpaintFailureHint(comfyRejection("outpaint-flux-fill-basic.json not found"))).toContain(
      "Rebuild OpenLayer"
    );
    expect(getUpscaleFailureHint(comfyRejection("upscale-basic.json not found"))).toContain("Rebuild OpenLayer");
  });

  it("recognises the setup-missing code Sketch to Image raises before submitting", () => {
    const hint = getSketchFailureHint(comfyRejection("COMFY_SETUP_MISSING: missing lineart controlnet"));

    expect(hint).toContain("Check ComfyUI");
  });

  it("matches regardless of the case ComfyUI happens to use", () => {
    // Every hint lowercases before matching; these arrive with whatever casing
    // the server and node authors chose.
    expect(getInpaintFailureHint(comfyRejection("InpaintModelConditioning MISSING NODE"))).toContain("inpaint");
    expect(getUpscaleFailureHint(comfyRejection("IMAGEUPSCALEWITHMODEL missing node"))).toContain(
      "ImageUpscaleWithModel"
    );
  });
});

describe("friendly messages are short enough for a status bar", () => {
  const cases: [string, string][] = [
    ["image to image", getFriendlyImageToImageErrorMessage(comfyRejection("CLIP input is invalid"))],
    ["sketch to image", getFriendlySketchErrorMessage(comfyRejection("LineArtPreprocessor not found"))],
    ["inpaint", getFriendlyInpaintErrorMessage(comfyRejection("InpaintModelConditioning missing node"))],
    ["outpaint", getFriendlyOutpaintErrorMessage(comfyRejection("ImagePadForOutpaint missing node"))],
    ["upscale", getFriendlyUpscaleErrorMessage(comfyRejection("UpscaleModelLoader missing node"))]
  ];

  for (const [tool, message] of cases) {
    it(`${tool} produces one short sentence`, () => {
      expect(message.length).toBeGreaterThan(0);
      expect(message.length).toBeLessThan(100);
      expect(message).not.toContain("\n");
    });
  }
});

describe("nothing is invented when the failure is not recognised", () => {
  const unrecognised = comfyRejection("ECONNRESET while reading from the socket");

  it("friendly messages fall back to the real error", () => {
    // getErrorMessage returns the OpenLayerError's message, not the details.
    for (const friendly of [
      getFriendlyImageToImageErrorMessage,
      getFriendlySketchErrorMessage,
      getFriendlyInpaintErrorMessage,
      getFriendlyOutpaintErrorMessage,
      getFriendlyUpscaleErrorMessage
    ]) {
      expect(friendly(unrecognised)).toBe("ComfyUI rejected the workflow.");
    }
  });

  const allHints = [
    getImageToImageFailureHint,
    getSketchFailureHint,
    getInpaintFailureHint,
    getOutpaintFailureHint,
    getUpscaleFailureHint
  ];

  it("every hint falls back to the technical detail", () => {
    for (const hint of allHints) {
      expect(hint(unrecognised)).toContain("ECONNRESET");
    }
  });

  it("truncates a very long technical detail rather than flooding the panel", () => {
    // The cut-off is 160 characters for Image to Image, Sketch and Inpaint and
    // 180 for Outpaint and Upscale. Nothing appears to depend on the
    // difference, so this asserts the behaviour that exists rather than
    // pinning a number an extraction has no business choosing.
    const flood = comfyRejection(`ECONNRESET ${"x".repeat(500)}`);

    for (const hint of allHints) {
      const message = hint(flood);
      expect(message.length).toBeLessThanOrEqual(183);
      expect(message.endsWith("...")).toBe(true);
    }
  });

  it("survives being handed something that is not an Error at all", () => {
    // The pipeline catches whatever was thrown; a rejected fetch or a stray
    // string must not take the status bar down with it.
    for (const value of [null, "plain string failure", 42, { unexpected: true }]) {
      expect(() => getImageToImageFailureHint(value)).not.toThrow();
      expect(() => getFriendlyUpscaleErrorMessage(value)).not.toThrow();
      expect(typeof getFriendlyInpaintErrorMessage(value)).toBe("string");
    }
  });
});
