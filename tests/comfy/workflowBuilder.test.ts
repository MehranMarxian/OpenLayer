import { describe, expect, it } from "vitest";
import {
  buildInpaintWorkflow,
  buildImg2ImgWorkflow,
  buildMultiReferenceWorkflow,
  buildOutpaintWorkflow,
  buildPromptFromLayerWorkflow,
  buildSketchToImageWorkflow,
  buildTxt2ImgWorkflow,
  buildUpscaleWorkflow
} from "../../src/comfy/workflowBuilder";
import { FLUX_FILL_REFERENCE_DEFAULTS } from "../../src/comfy/fluxFillDefaults";
import { getWorkflowPreset } from "../../src/comfy/presetRegistry";
import { createRequiredModelSelectionKey } from "../../src/comfy/workflowModelRequirements";

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

  it("injects Flux1-dev fp8 text-to-image prompt, seed, and guidance while preserving sampler defaults", async () => {
    const result = await buildTxt2ImgWorkflow({
      presetId: "txt2img-flux1-dev-fp8",
      prompt: "a soft cinematic studio portrait",
      negativePrompt: "low detail",
      checkpointName: "flux1-dev-fp8.safetensors",
      width: 1024,
      height: 768,
      steps: 24,
      cfg: 3.5,
      seed: 9876
    });

    expect(result.preset.id).toBe("txt2img-flux1-dev-fp8");
    expect(result.workflow["30"].inputs.ckpt_name).toBe("flux1-dev-fp8.safetensors");
    expect(result.workflow["6"].inputs.text).toBe("a soft cinematic studio portrait");
    expect(result.workflow["33"].inputs.text).toBe("low detail");
    expect(result.workflow["27"].inputs.width).toBe(1024);
    expect(result.workflow["27"].inputs.height).toBe(768);
    expect(result.workflow["31"].inputs.seed).toBe(9876);
    expect(result.workflow["31"].inputs.steps).toBe(24);
    expect(result.workflow["31"].inputs.cfg).toBe(1);
    expect(result.workflow["31"].inputs.sampler_name).toBe("euler");
    expect(result.workflow["31"].inputs.scheduler).toBe("simple");
    expect(result.workflow["31"].inputs.denoise).toBe(1);
    expect(result.workflow["35"].inputs.guidance).toBe(3.5);
    expect(result.workflow["9"].inputs.images).toEqual(["8", 0]);
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

  it("injects Prompt from Layer source, task, beams, and seed into the Florence workflow", async () => {
    const result = await buildPromptFromLayerWorkflow({
      presetId: "prompt-from-layer-florence2",
      sourceImageName: "openlayer-prompt-source.png",
      task: "detailed_caption",
      numBeams: 12,
      seed: 202607
    });

    expect(result.preset.id).toBe("prompt-from-layer-florence2");
    expect(result.workflow["42"].inputs.image).toBe("openlayer-prompt-source.png");
    expect(result.workflow["38"].inputs.image).toEqual(["42", 0]);
    expect(result.workflow["38"].inputs.florence2_model).toEqual(["39", 0]);
    expect(result.workflow["38"].inputs.task).toBe("detailed_caption");
    expect(result.workflow["38"].inputs.num_beams).toBe(12);
    expect(result.workflow["38"].inputs.seed).toBe(202607);
    expect(result.workflow["41"].inputs.source).toEqual(["38", 2]);
  });

  it("injects source image and model into upscale-basic", async () => {
    const result = await buildUpscaleWorkflow({
      presetId: "upscale-basic",
      sourceImageName: "openlayer-upscale-source.png",
      modelName: "4x-UltraSharp.pth"
    });

    expect(result.preset.id).toBe("upscale-basic");
    expect(result.workflow["10"].inputs.image).toBe("openlayer-upscale-source.png");
    expect(result.workflow["11"].inputs.model_name).toBe("4x-UltraSharp.pth");
    expect(result.workflow["12"].class_type).toBe("ImageUpscaleWithModel");
    expect(result.workflow["12"].inputs.upscale_model).toEqual(["11", 0]);
    expect(result.workflow["12"].inputs.image).toEqual(["10", 0]);
    expect(result.workflow["9"].inputs.images).toEqual(["12", 0]);
  });

  it("injects sketch size and ControlNet strength into the txt2img-style sketch2img-linecn-basic", async () => {
    const result = await buildSketchToImageWorkflow({
      presetId: "sketch2img-linecn-basic",
      prompt: "clean lineart guided portrait",
      negativePrompt: "blur",
      checkpointName: "epicrealism_naturalSinRC1VAE.safetensors",
      sourceImageName: "openlayer-sketch.png",
      width: 768,
      height: 960,
      steps: 20,
      cfg: 5,
      denoise: 1,
      controlStrength: 0.9,
      seed: 99
    });

    expect(result.workflow["10"].inputs.image).toBe("openlayer-sketch.png");
    expect(result.workflow["14"].inputs.strength).toBe(0.9);
    expect(result.workflow["5"].class_type).toBe("EmptyLatentImage");
    expect(result.workflow["5"].inputs.width).toBe(768);
    expect(result.workflow["5"].inputs.height).toBe(960);
    expect(result.workflow["3"].inputs.latent_image).toEqual(["5", 0]);
    expect(result.workflow["3"].inputs.denoise).toBe(1);
  });

  it("injects source image, mask image, and denoise into inpaint-basic", async () => {
    const result = await buildInpaintWorkflow({
      presetId: "inpaint-basic",
      prompt: "repair the selected area",
      negativePrompt: "blur",
      checkpointName: "epicrealism_naturalSinRC1VAE.safetensors",
      sourceImageName: "openlayer-inpaint-source.png",
      maskImageName: "openlayer-inpaint-mask.png",
      steps: 16,
      cfg: 7,
      denoise: 0.75,
      seed: 2026
    });

    expect(result.preset.id).toBe("inpaint-basic");
    expect(result.workflow["4"].inputs.ckpt_name).toBe("epicrealism_naturalSinRC1VAE.safetensors");
    expect(result.workflow["10"].inputs.image).toBe("openlayer-inpaint-source.png");
    expect(result.workflow["12"].inputs.image).toBe("openlayer-inpaint-mask.png");
    expect(result.workflow["6"].inputs.text).toBe("repair the selected area");
    expect(result.workflow["7"].inputs.text).toBe("blur");
    expect(result.workflow["11"].class_type).toBe("InpaintModelConditioning");
    expect(result.workflow["3"].inputs.positive).toEqual(["11", 0]);
    expect(result.workflow["3"].inputs.negative).toEqual(["11", 1]);
    expect(result.workflow["3"].inputs.latent_image).toEqual(["11", 2]);
    expect(result.workflow["3"].inputs.denoise).toBe(0.75);
    expect(result.workflow["3"].inputs.seed).toBe(2026);
    expect(result.workflow["14"].class_type).toBe("ImageCompositeMasked");
    expect(result.workflow["14"].inputs.destination).toEqual(["10", 0]);
    expect(result.workflow["14"].inputs.source).toEqual(["8", 0]);
    expect(result.workflow["14"].inputs.mask).toEqual(["13", 0]);
    expect(result.workflow["9"].inputs.images).toEqual(["14", 0]);
  });

  it("keeps the Klein distilled operating point and its Flux.2 latent", async () => {
    const result = await buildTxt2ImgWorkflow({
      presetId: "txt2img-flux2-klein",
      prompt: "a red ceramic teapot",
      negativePrompt: "",
      checkpointName: "flux-2-klein-4b-fp8.safetensors",
      width: 1024,
      height: 1024,
      steps: 4,
      cfg: 1,
      seed: 99
    });

    expect(result.workflow["20"].inputs.unet_name).toBe("flux-2-klein-4b-fp8.safetensors");
    // type must be flux2. The Z_image_Turbo preset loads the same encoder file
    // with type lumina2, so copying that preset's CLIPLoader wholesale would
    // load real weights under the wrong text-encoder contract.
    expect(result.workflow["21"].inputs.type).toBe("flux2");
    expect(result.workflow["21"].inputs.clip_name).toBe("qwen_3_4b.safetensors");
    expect(result.workflow["22"].inputs.vae_name).toBe("flux2-vae.safetensors");

    // Flux.2 latent geometry, not SD3's.
    expect(result.workflow["5"].class_type).toBe("EmptyFlux2LatentImage");

    expect(result.workflow["23"].class_type).toBe("ModelSamplingAuraFlow");
    expect(result.workflow["23"].inputs.shift).toBe(3);
    expect(result.workflow["3"].inputs.sampler_name).toBe("er_sde");
    expect(result.workflow["3"].inputs.scheduler).toBe("simple");
    expect(result.workflow["3"].inputs.denoise).toBe(1);
    expect(result.workflow["3"].inputs.seed).toBe(99);
  });

  it("routes the Klein image-to-image preset through VAEEncode with an injectable denoise", async () => {
    const result = await buildImg2ImgWorkflow({
      presetId: "img2img-flux2-klein",
      prompt: "repaint in oils",
      negativePrompt: "",
      checkpointName: "flux-2-klein-4b-fp8.safetensors",
      sourceImageName: "openlayer-source.png",
      steps: 4,
      cfg: 1,
      seed: 7,
      denoise: 0.55
    });

    expect(result.workflow["10"].inputs.image).toBe("openlayer-source.png");
    expect(result.workflow["11"].class_type).toBe("VAEEncode");
    expect(result.workflow["3"].inputs.latent_image).toEqual(["11", 0]);
    expect(result.workflow["3"].inputs.denoise).toBe(0.55);
    expect(result.workflow["3"].inputs.sampler_name).toBe("er_sde");
    // No empty latent in this graph -- the source is the latent.
    expect(result.workflow["5"]).toBeUndefined();
  });

  it("feeds the Klein edit reference into both conditioning branches and never injects denoise", async () => {
    const result = await buildImg2ImgWorkflow({
      presetId: "edit-flux2-klein",
      prompt: "make the jacket red",
      negativePrompt: "",
      checkpointName: "flux-2-klein-4b-fp8.safetensors",
      sourceImageName: "openlayer-source.png",
      steps: 4,
      cfg: 1,
      seed: 11,
      // The panel always passes a denoise. The preset must ignore it: denoise 1
      // is the technique here, and honouring the slider would silently turn this
      // back into the image-to-image preset sitting next to it.
      denoise: 0.35
    });

    expect(result.workflow["3"].inputs.denoise).toBe(1);
    expect(result.workflow["5"].class_type).toBe("EmptyFlux2LatentImage");
    expect(result.workflow["3"].inputs.latent_image).toEqual(["5", 0]);

    // One encode, reaching BOTH branches. Wiring it into the positive only
    // loses most of the preservation this preset exists for.
    expect(result.workflow["14"].class_type).toBe("ReferenceLatent");
    expect(result.workflow["15"].class_type).toBe("ReferenceLatent");
    expect(result.workflow["14"].inputs.latent).toEqual(["11", 0]);
    expect(result.workflow["15"].inputs.latent).toEqual(["11", 0]);
    expect(result.workflow["3"].inputs.positive).toEqual(["14", 0]);
    expect(result.workflow["3"].inputs.negative).toEqual(["15", 0]);

    // Sampled at ~1 MP, returned at the captured layer's exact size.
    expect(result.workflow["5"].inputs.width).toEqual(["13", 0]);
    expect(result.workflow["17"].inputs.width).toEqual(["16", 0]);
    expect(result.workflow["16"].inputs.image).toEqual(["10", 0]);
    expect(result.workflow["9"].inputs.images).toEqual(["17", 0]);
  });

  it("chains one ReferenceLatent pair per reference and samples from the end of both chains", async () => {
    const result = await buildMultiReferenceWorkflow({
      prompt: "the man and the woman standing on the beach at sunset",
      negativePrompt: "",
      checkpointName: "flux-2-klein-4b-fp8.safetensors",
      referenceImageNames: ["bg.png", "man.png", "woman.png"],
      steps: 4,
      cfg: 1,
      seed: 777
    });

    const workflow = result.workflow;

    // Reference 1 is the shipped slot and keeps its original node ids.
    expect(workflow["30"].inputs.image).toBe("bg.png");
    expect(workflow["40"].inputs.image).toEqual(["30", 0]);
    expect(workflow["50"].inputs.pixels).toEqual(["40", 0]);

    // References 2 and 3 are cloned, and each clone keeps slot 1's megapixel
    // normalisation and VAE edge rather than restating them.
    expect(workflow["ref2load"].inputs.image).toBe("man.png");
    expect(workflow["ref3load"].inputs.image).toBe("woman.png");
    expect(workflow["ref2scale"].inputs.megapixels).toBe(workflow["40"].inputs.megapixels);
    expect(workflow["ref2scale"].inputs.image).toEqual(["ref2load", 0]);
    expect(workflow["ref2encode"].inputs.pixels).toEqual(["ref2scale", 0]);
    expect(workflow["ref2encode"].inputs.vae).toEqual(workflow["50"].inputs.vae);

    // Both branches are chained in list order, each link reading the one before.
    expect(workflow["60"].inputs.conditioning).toEqual(["6", 0]);
    expect(workflow["ref2pos"].inputs.conditioning).toEqual(["60", 0]);
    expect(workflow["ref3pos"].inputs.conditioning).toEqual(["ref2pos", 0]);
    expect(workflow["ref2neg"].inputs.conditioning).toEqual(["70", 0]);
    expect(workflow["ref3neg"].inputs.conditioning).toEqual(["ref2neg", 0]);
    expect(workflow["ref3pos"].inputs.latent).toEqual(["ref3encode", 0]);

    // The sampler must read the TAIL of each chain. Reading the head would
    // silently drop every reference past the first.
    expect(workflow["3"].inputs.positive).toEqual(["ref3pos", 0]);
    expect(workflow["3"].inputs.negative).toEqual(["ref3neg", 0]);

    // Reference 1 alone sets the canvas, and denoise stays at 1.
    expect(workflow["13"].inputs.image).toEqual(["40", 0]);
    expect(workflow["5"].inputs.width).toEqual(["13", 0]);
    expect(workflow["5"].inputs.height).toEqual(["13", 1]);
    expect(workflow["3"].inputs.denoise).toBe(1);
  });

  it("leaves the shipped graph untouched for a single reference", async () => {
    const result = await buildMultiReferenceWorkflow({
      prompt: "a beach at sunset",
      referenceImageNames: ["only.png"],
      steps: 4,
      cfg: 1,
      seed: 5
    });

    const generated = Object.keys(result.workflow).filter((id) => id.startsWith("ref"));

    expect(generated).toEqual([]);
    expect(result.workflow["30"].inputs.image).toBe("only.png");
    expect(result.workflow["3"].inputs.positive).toEqual(["60", 0]);
    expect(result.workflow["3"].inputs.negative).toEqual(["70", 0]);
  });

  it("refuses an empty reference list and anything past the ceiling", async () => {
    await expect(
      buildMultiReferenceWorkflow({
        prompt: "nothing to compose",
        referenceImageNames: [],
        steps: 4,
        cfg: 1,
        seed: 1
      })
    ).rejects.toThrow(/at least one reference/i);

    const ceiling = getWorkflowPreset("multi-reference-flux2-klein").referenceChain?.maximumReferences ?? 0;

    await expect(
      buildMultiReferenceWorkflow({
        prompt: "too many",
        referenceImageNames: Array.from({ length: ceiling + 1 }, (_unused, index) => `ref${index}.png`),
        steps: 4,
        cfg: 1,
        seed: 1
      })
    ).rejects.toThrow(/at most/i);
  });

  it("injects Flux Fill inpaint embedded source, prompt, model, and seed while preserving reference defaults", async () => {
    const result = await buildInpaintWorkflow({
      presetId: "inpaint-flux-fill-basic",
      prompt: "repair the moon surface",
      negativePrompt: "black square",
      checkpointName: "flux1-fill-dev.safetensors",
      sourceImageName: "openlayer-flux-source-mask.png",
      maskImageName: "openlayer-separate-mask-should-not-be-injected.png",
      steps: 18,
      cfg: 3.5,
      denoise: 0.8,
      seed: 4242,
      width: 640,
      height: 512
    });

    expect(result.preset.id).toBe("inpaint-flux-fill-basic");
    expect(result.workflow["31"].inputs.unet_name).toBe("flux1-fill-dev.safetensors");
    expect(result.workflow["34"].inputs.clip_name1).toBe("clip_l.safetensors");
    expect(result.workflow["34"].inputs.clip_name2).toBe("t5xxl_fp16.safetensors");
    expect(result.workflow["34"].inputs.type).toBe("flux");
    expect(result.workflow["17"].inputs.image).toBe("openlayer-flux-source-mask.png");
    expect(result.workflow["23"].inputs.text).toBe("repair the moon surface");
    expect(result.workflow["26"].inputs.guidance).toBe(FLUX_FILL_REFERENCE_DEFAULTS.guidance);
    expect(result.workflow["3"].inputs.steps).toBe(FLUX_FILL_REFERENCE_DEFAULTS.steps);
    expect(result.workflow["3"].inputs.cfg).toBe(FLUX_FILL_REFERENCE_DEFAULTS.cfg);
    expect(result.workflow["3"].inputs.sampler_name).toBe(FLUX_FILL_REFERENCE_DEFAULTS.samplerName);
    expect(result.workflow["3"].inputs.scheduler).toBe(FLUX_FILL_REFERENCE_DEFAULTS.scheduler);
    expect(result.workflow["3"].inputs.denoise).toBe(FLUX_FILL_REFERENCE_DEFAULTS.denoise);
    expect(result.workflow["3"].inputs.seed).toBe(4242);
    expect(result.workflow["38"].inputs.pixels).toEqual(["17", 0]);
    expect(result.workflow["38"].inputs.mask).toEqual(["17", 1]);
    expect(result.workflow["39"].class_type).toBe("DifferentialDiffusion");
    expect(result.workflow["39"].inputs.strength).toBe(FLUX_FILL_REFERENCE_DEFAULTS.differentialDiffusionStrength);
    expect(result.workflow["46"].class_type).toBe("ConditioningZeroOut");
    expect(result.workflow["9"].inputs.images).toEqual(["8", 0]);
  });

  it("routes the Flux Fill crop & stitch preset through InpaintCropImproved and back out through the stitcher", async () => {
    const result = await buildInpaintWorkflow({
      presetId: "inpaint-flux-fill-cropstitch",
      prompt: "repair the moon surface",
      negativePrompt: "black square",
      checkpointName: "flux1-fill-dev.safetensors",
      sourceImageName: "openlayer-flux-source-mask.png",
      maskImageName: "openlayer-separate-mask-should-not-be-injected.png",
      steps: 18,
      cfg: 3.5,
      denoise: 0.8,
      seed: 4242,
      width: 4096,
      height: 3072
    });

    expect(result.preset.id).toBe("inpaint-flux-fill-cropstitch");
    expect(result.workflow["17"].inputs.image).toBe("openlayer-flux-source-mask.png");

    // The crop node reads the image AND the mask from the single uploaded PNG,
    // exactly as the conditioning node used to. Losing the mask edge here is
    // the failure that would look like a working generation of the wrong area.
    expect(result.workflow["50"].class_type).toBe("InpaintCropImproved");
    expect(result.workflow["50"].inputs.image).toEqual(["17", 0]);
    expect(result.workflow["50"].inputs.mask).toEqual(["17", 1]);
    expect(result.workflow["50"].inputs.context_from_mask_extend_factor).toBe(1.5);
    expect(result.workflow["50"].inputs.output_resize_to_target_size).toBe(true);
    expect(result.workflow["50"].inputs.output_target_width).toBe(1024);
    expect(result.workflow["50"].inputs.output_target_height).toBe(1024);
    expect(result.workflow["50"].inputs.mask_blend_pixels).toBe(32);

    // The sampler chain is the untouched reference graph, fed the crop instead
    // of the full canvas.
    expect(result.workflow["38"].inputs.pixels).toEqual(["50", 1]);
    expect(result.workflow["38"].inputs.mask).toEqual(["50", 2]);
    expect(result.workflow["3"].inputs.steps).toBe(FLUX_FILL_REFERENCE_DEFAULTS.steps);
    expect(result.workflow["3"].inputs.seed).toBe(4242);

    // SaveImage must take the stitched image, not the decode. Wiring it to "8"
    // would save a 1024px patch and silently break the aligned Photoshop
    // import, which expects a result the size of the captured context.
    expect(result.workflow["51"].class_type).toBe("InpaintStitchImproved");
    expect(result.workflow["51"].inputs.stitcher).toEqual(["50", 0]);
    expect(result.workflow["51"].inputs.inpainted_image).toEqual(["8", 0]);
    expect(result.workflow["9"].inputs.images).toEqual(["51", 0]);
  });

  it("builds the Klein inpaint graph with panel sampler values and no separate mask upload", async () => {
    const result = await buildInpaintWorkflow({
      presetId: "inpaint-flux2-klein",
      prompt: "a small black swallow tattoo on her shoulder",
      negativePrompt: "blurry",
      checkpointName: "flux-2-klein-4b-fp8.safetensors",
      sourceImageName: "openlayer-flux-fill-source-mask.png",
      maskImageName: "openlayer-separate-mask-should-not-be-injected.png",
      steps: 4,
      cfg: 1,
      denoise: 1,
      seed: 4242,
      width: 4096,
      height: 3072
    });

    expect(result.preset.id).toBe("inpaint-flux2-klein");
    expect(result.workflow["20"].inputs.unet_name).toBe("flux-2-klein-4b-fp8.safetensors");
    expect(result.workflow["21"].inputs.type).toBe("flux2");
    expect(result.workflow["10"].inputs.image).toBe("openlayer-flux-fill-source-mask.png");

    // The mask rides in the source PNG's alpha channel, so the separate mask
    // filename must not appear anywhere in the built graph.
    expect(JSON.stringify(result.workflow)).not.toContain("openlayer-separate-mask-should-not-be-injected.png");

    // Unlike every Flux Fill preset, this one takes the panel's sampler values
    // rather than the locked reference defaults. Routing it through
    // applyFluxFillReferenceDefaults would write 20 steps at guidance 30 into
    // node "3", which exists in both graphs, so nothing would throw.
    expect(result.workflow["3"].inputs.steps).toBe(4);
    expect(result.workflow["3"].inputs.cfg).toBe(1);
    expect(result.workflow["3"].inputs.denoise).toBe(1);
    expect(result.workflow["3"].inputs.seed).toBe(4242);
    expect(result.workflow["3"].inputs.sampler_name).toBe("er_sde");

    // Crop feeds the encode, the noise mask marks the region, and both
    // ReferenceLatent branches see the whole crop -- that conditioning is what
    // holds the frame while the masked area changes.
    expect(result.workflow["50"].inputs.image).toEqual(["10", 0]);
    expect(result.workflow["50"].inputs.mask).toEqual(["10", 1]);
    expect(result.workflow["11"].inputs.pixels).toEqual(["50", 1]);
    expect(result.workflow["30"].inputs.samples).toEqual(["11", 0]);
    expect(result.workflow["30"].inputs.mask).toEqual(["50", 2]);
    expect(result.workflow["14"].inputs.latent).toEqual(["11", 0]);
    expect(result.workflow["15"].inputs.latent).toEqual(["11", 0]);
    expect(result.workflow["3"].inputs.latent_image).toEqual(["30", 0]);

    // Same trap as the Flux Fill crop & stitch preset: SaveImage reading the
    // decode would return a 1024px patch and break the aligned import.
    expect(result.workflow["51"].inputs.inpainted_image).toEqual(["8", 0]);
    expect(result.workflow["9"].inputs.images).toEqual(["51", 0]);
  });

  it("can inject the accepted Flux Fill T5 fallback when fp16 is unavailable", async () => {
    const preset = getWorkflowPreset("inpaint-flux-fill-basic");
    const t5Requirement = preset.requiredModels?.find((model) => model.modelName === "t5xxl_fp16.safetensors");

    expect(t5Requirement).toBeDefined();

    const result = await buildInpaintWorkflow({
      presetId: "inpaint-flux-fill-basic",
      prompt: "repair the selected area",
      negativePrompt: "",
      checkpointName: "flux1-fill-dev.safetensors",
      sourceImageName: "openlayer-flux-source-mask.png",
      maskImageName: "openlayer-flux-source-mask.png",
      steps: 12,
      cfg: 3.5,
      denoise: 0.7,
      seed: 5150,
      width: 512,
      height: 512,
      requiredModelSelections: {
        [createRequiredModelSelectionKey(t5Requirement!)]: "t5xxl_fp8_e4m3fn.safetensors"
      }
    });

    expect(result.workflow["34"].inputs.clip_name1).toBe("clip_l.safetensors");
    expect(result.workflow["34"].inputs.clip_name2).toBe("t5xxl_fp8_e4m3fn.safetensors");
  });

  it("injects Flux Fill outpaint source, padding, prompt, model, and seed", async () => {
    const result = await buildOutpaintWorkflow({
      presetId: "outpaint-flux-fill-basic",
      prompt: "extend the studio background",
      negativePrompt: "",
      checkpointName: "flux1-fill-dev.safetensors",
      sourceImageName: "openlayer-outpaint-source.png",
      steps: 20,
      cfg: 30,
      denoise: 1,
      seed: 6060,
      left: 128,
      top: 0,
      right: 256,
      bottom: 512,
      feathering: 24
    });

    expect(result.preset.id).toBe("outpaint-flux-fill-basic");
    expect(result.workflow["31"].inputs.unet_name).toBe("flux1-fill-dev.safetensors");
    expect(result.workflow["34"].inputs.clip_name1).toBe("clip_l.safetensors");
    expect(result.workflow["34"].inputs.clip_name2).toBe("t5xxl_fp16.safetensors");
    expect(result.workflow["17"].inputs.image).toBe("openlayer-outpaint-source.png");
    expect(result.workflow["44"].inputs.left).toBe(128);
    expect(result.workflow["44"].inputs.top).toBe(0);
    expect(result.workflow["44"].inputs.right).toBe(256);
    expect(result.workflow["44"].inputs.bottom).toBe(512);
    expect(result.workflow["44"].inputs.feathering).toBe(24);
    expect(result.workflow["23"].inputs.text).toBe("extend the studio background");
    expect(result.workflow["26"].inputs.guidance).toBe(30);
    expect(result.workflow["3"].inputs.seed).toBe(6060);
    expect(result.workflow["3"].inputs.steps).toBe(20);
    expect(result.workflow["3"].inputs.cfg).toBe(1);
    expect(result.workflow["3"].inputs.sampler_name).toBe("euler");
    expect(result.workflow["3"].inputs.scheduler).toBe("simple");
    expect(result.workflow["3"].inputs.denoise).toBe(1);
    expect(result.workflow["38"].inputs.pixels).toEqual(["44", 0]);
    expect(result.workflow["38"].inputs.mask).toEqual(["44", 1]);
    expect(result.workflow["9"].inputs.images).toEqual(["8", 0]);
  });

  it("injects Krea-2 Turbo text-to-image settings while preserving the turbo sampler", async () => {
    const result = await buildTxt2ImgWorkflow({
      presetId: "txt2img-krea2-turbo",
      prompt: "a cozy cabin in a snowy forest at dusk",
      negativePrompt: "",
      checkpointName: "krea2_turbo_fp8_scaled.safetensors",
      width: 1024,
      height: 768,
      steps: 8,
      cfg: 1,
      seed: 55
    });

    expect(result.preset.id).toBe("txt2img-krea2-turbo");
    expect(result.workflow["20"].inputs.unet_name).toBe("krea2_turbo_fp8_scaled.safetensors");
    expect(result.workflow["21"].inputs.clip_name).toBe("qwen3vl_4b_fp8_scaled.safetensors");
    expect(result.workflow["21"].inputs.type).toBe("krea2");
    expect(result.workflow["22"].inputs.vae_name).toBe("qwen_image_vae.safetensors");
    expect(result.workflow["6"].inputs.text).toBe("a cozy cabin in a snowy forest at dusk");
    expect(result.workflow["5"].inputs.width).toBe(1024);
    expect(result.workflow["5"].inputs.height).toBe(768);
    expect(result.workflow["3"].inputs.steps).toBe(8);
    expect(result.workflow["3"].inputs.cfg).toBe(1);
    expect(result.workflow["3"].inputs.sampler_name).toBe("euler");
    expect(result.workflow["3"].inputs.scheduler).toBe("simple");
    expect(result.workflow["3"].inputs.seed).toBe(55);
  });

  it("injects Krea-2 Turbo image-to-image source and denoise", async () => {
    const result = await buildImg2ImgWorkflow({
      presetId: "img2img-krea2-turbo",
      prompt: "the same cabin in golden autumn forest",
      negativePrompt: "",
      checkpointName: "krea2_turbo_fp8_scaled.safetensors",
      sourceImageName: "openlayer-krea2-source.png",
      steps: 8,
      cfg: 1,
      denoise: 0.7,
      seed: 66
    });

    expect(result.preset.id).toBe("img2img-krea2-turbo");
    expect(result.workflow["20"].inputs.unet_name).toBe("krea2_turbo_fp8_scaled.safetensors");
    expect(result.workflow["10"].inputs.image).toBe("openlayer-krea2-source.png");
    expect(result.workflow["3"].inputs.latent_image).toEqual(["11", 0]);
    expect(result.workflow["3"].inputs.denoise).toBe(0.7);
  });

  it("injects Z_image_Turbo text-to-image settings into the diffusion stack workflow", async () => {
    const result = await buildTxt2ImgWorkflow({
      presetId: "txt2img-z-image-turbo",
      prompt: "surreal blue forest",
      negativePrompt: "muddy colors",
      checkpointName: "z_image_turbo_bf16.safetensors",
      width: 896,
      height: 1024,
      steps: 6,
      cfg: 1.5,
      seed: 77
    });

    expect(result.preset.id).toBe("txt2img-z-image-turbo");
    expect(result.workflow["20"].inputs.unet_name).toBe("z_image_turbo_bf16.safetensors");
    expect(result.workflow["6"].inputs.text).toBe("surreal blue forest");
    expect(result.workflow["7"].inputs.text).toBe("muddy colors");
    expect(result.workflow["5"].inputs.width).toBe(896);
    expect(result.workflow["5"].inputs.height).toBe(1024);
    expect(result.workflow["3"].inputs.steps).toBe(6);
    expect(result.workflow["3"].inputs.cfg).toBe(1.5);
    expect(result.workflow["3"].inputs.seed).toBe(77);
  });

  it("injects Z_image_Turbo image-to-image source and denoise", async () => {
    const result = await buildImg2ImgWorkflow({
      presetId: "img2img-z-image-turbo",
      prompt: "painterly reinterpretation",
      negativePrompt: "flat",
      checkpointName: "z_image_turbo_bf16.safetensors",
      sourceImageName: "openlayer-z-source.png",
      steps: 5,
      cfg: 1,
      denoise: 0.6,
      seed: 88
    });

    expect(result.preset.id).toBe("img2img-z-image-turbo");
    expect(result.workflow["20"].inputs.unet_name).toBe("z_image_turbo_bf16.safetensors");
    expect(result.workflow["10"].inputs.image).toBe("openlayer-z-source.png");
    expect(result.workflow["3"].inputs.latent_image).toEqual(["11", 0]);
    expect(result.workflow["3"].inputs.denoise).toBe(0.6);
  });
});
