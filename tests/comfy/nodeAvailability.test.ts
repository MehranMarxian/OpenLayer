import { afterEach, describe, expect, it, vi } from "vitest";
import { ComfyClient } from "../../src/comfy/comfyClient";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";
import { createWorkflowHealthItem } from "../../src/comfy/workflowHealth";

/**
 * Workflow Health asked ComfyUI which inputs each preset node has, but kept
 * only the required ones. On ComfyUI 0.44, 13 working presets were marked
 * "Missing ComfyUI node" because the input they wire is optional there:
 * InpaintCropImproved's mask, LaMaInpaint's lama_model, SAM3_Detect's
 * conditioning, ReferenceLatent's latent and others. Beta gate G1.
 */
describe("node availability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // InpaintCropImproved as ComfyUI 0.44 reports it: `mask` is optional.
  function stubInpaintCrop() {
    vi.stubGlobal("fetch", async (url: string) => {
      const classType = decodeURIComponent(String(url).split("/object_info/")[1] ?? "");
      const body =
        classType === "InpaintCropImproved"
          ? { InpaintCropImproved: { input: { required: { image: ["IMAGE"] }, optional: { mask: ["MASK"] } } } }
          : {};
      return new Response(JSON.stringify(body), { status: 200 });
    });
  }

  it("gives the preset checks every declared input, optional ones included", async () => {
    stubInpaintCrop();
    const nodes = await new ComfyClient("http://127.0.0.1:8188").getWorkflowNodeAvailability([
      getWorkflowPreset("inpaint-flux2-klein")
    ]);

    expect(nodes.InpaintCropImproved).toEqual(["image", "mask"]);
  });

  it("keeps the custom workflow check on required inputs only", async () => {
    // A pasted graph that leaves out an optional input is not broken.
    stubInpaintCrop();
    const nodes = await new ComfyClient("http://127.0.0.1:8188").getNodeAvailability(["InpaintCropImproved"]);

    expect(nodes.InpaintCropImproved).toEqual(["image"]);
  });

  it("no longer reports a preset as missing a node when its input is optional", () => {
    const preset = getWorkflowPreset("inpaint-flux2-klein");
    const crop = preset.requiredNodes.find((node) => node.classType === "InpaintCropImproved");
    const availableNodes = Object.fromEntries(preset.requiredNodes.map((node) => [node.classType, node.requiredInputs]));

    expect(crop?.requiredInputs).toContain("mask");
    expect(createWorkflowHealthItem(preset, { availableNodes }).state).not.toBe("missing-node");
  });
});
