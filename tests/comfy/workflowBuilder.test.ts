import { describe, expect, it } from "vitest";
import {
  buildImg2ImgWorkflow,
  buildSketchToImageWorkflow,
  buildTxt2ImgWorkflow
} from "../../src/comfy/workflowBuilder";
import { OpenLayerError } from "../../src/utils/errors";

describe("workflowBuilder", () => {
  it("injects text-to-image settings into txt2img-basic", async () => {
    const result = await buildTxt2ImgWorkflow({
      presetId: "txt2img-basic",
      prompt: "a quiet moon",
      negativePrompt: "noise",
      checkpointName: "epicrealism_naturalSinRC1VAE.safetensors",
      width: 768,
      height: 512,
      steps: 24,
      cfg: 6.5,
      seed: 1234
    });

    expect(result.preset.id).toBe("txt2img-basic");
    expect(result.workflow["4"].inputs.ckpt_name).toBe("epicrealism_naturalSinRC1VAE.safetensors");
    expect(result.workflow["6"].inputs.text).toBe("a quiet moon");
    expect(result.workflow["7"].inputs.text).toBe("noise");
    expect(result.workflow["5"].inputs.width).toBe(768);
    expect(result.workflow["5"].inputs.height).toBe(512);
    expect(result.workflow["3"].inputs.steps).toBe(24);
    expect(result.workflow["3"].inputs.cfg).toBe(6.5);
    expect(result.workflow["3"].inputs.seed).toBe(1234);
  });

  it("injects source image and denoise into img2img-basic", async () => {
    const result = await buildImg2ImgWorkflow({
      presetId: "img2img-basic",
      prompt: "reinterpret the source",
      negativePrompt: "",
      checkpointName: "sd_xl_base_1.0.safetensors",
      sourceImageName: "openlayer-source.png",
      steps: 18,
      cfg: 7,
      denoise: 0.45,
      seed: 42
    });

    expect(result.workflow["10"].inputs.image).toBe("openlayer-source.png");
    expect(result.workflow["3"].inputs.denoise).toBe(0.45);
  });

  it("injects ControlNet strength into sketch2img-linecn-basic", async () => {
    const result = await buildSketchToImageWorkflow({
      presetId: "sketch2img-linecn-basic",
      prompt: "clean lineart guided portrait",
      negativePrompt: "blur",
      checkpointName: "epicrealism_naturalSinRC1VAE.safetensors",
      sourceImageName: "openlayer-sketch.png",
      steps: 12,
      cfg: 5,
      denoise: 0.6,
      controlStrength: 0.9,
      seed: 99
    });

    expect(result.workflow["10"].inputs.image).toBe("openlayer-sketch.png");
    expect(result.workflow["14"].inputs.strength).toBe(0.9);
  });

  it("blocks disabled future presets before fetching missing workflow files", async () => {
    await expect(
      buildTxt2ImgWorkflow({
        presetId: "txt2img-z-image-turbo",
        prompt: "future",
        width: 512,
        height: 512,
        steps: 4,
        cfg: 1,
        seed: 1
      })
    ).rejects.toMatchObject<Partial<OpenLayerError>>({
      code: "WORKFLOW_PRESET_UNSUPPORTED"
    });
  });
});
