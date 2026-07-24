# OpenLayer Model And VRAM Guide

OpenLayer is local-first, so the best model depends on your ComfyUI setup and your graphics card memory.

## What VRAM Means

VRAM is the memory on your graphics card. Image models use VRAM while loading the model, encoding prompts, sampling, decoding images, and running extra guidance nodes such as ControlNet.

More VRAM usually means you can use larger models, higher resolution, more complex workflows, or faster iteration. Less VRAM does not mean OpenLayer is unusable. It means you should start with smaller and more reliable workflows.

## Why OpenLayer Uses ComfyUI Hardware Detection

OpenLayer runs inside Photoshop UXP, which is sandboxed. Instead of trying to inspect your Windows hardware directly, OpenLayer asks the active local ComfyUI server for `/system_stats`.

That is the right source of truth because ComfyUI is the program that actually loads and runs the AI model.

## Recommended Model Families By VRAM

These are practical starter guidelines, not strict rules.

| VRAM range | OpenLayer recommendation |
| --- | --- |
| Under 8 GB | Start with SD 1.x checkpoints at 512px. Keep steps modest. |
| 8-12 GB | SD 1.x is comfortable. SDXL can be tested carefully. |
| 12-24 GB | SDXL is a good quality default. Heavier families can be tested with dedicated presets. |
| 24 GB or more | Good for SDXL and serious testing of Flux, SD3.5, and future Z_image_Turbo workflows. |

## Current OpenLayer Workflow Support

| Task | Recommended current family | Notes |
| --- | --- | --- |
| Text to Image | SD 1.x or SDXL | Uses `txt2img-basic`. |
| Flux1-dev fp8 Text to Image | Flux | Experimental `txt2img-flux1-dev-fp8` using `flux1-dev-fp8.safetensors` through `CheckpointLoaderSimple`. |
| Image to Image | SD 1.x or SDXL | Uses `img2img-basic`. |
| Sketch to Image | SD 1.x | Uses `sketch2img-linecn-basic` with LineArt ControlNet. |
| Inpaint / Flux Fill | Flux Fill Dev | Experimental `inpaint-flux-fill-basic`; not production-ready. |
| Outpaint / Canvas Expansion | Flux Fill Dev | Experimental `outpaint-flux-fill-basic` using `ImagePadForOutpaint`. |
| Z_image_Turbo Text/Image | Z_image_Turbo | Experimental dedicated presets in v0.4.3-alpha. |
| Prompt from Layer | Florence-2 PromptGen | Available for alpha testing through `prompt-from-layer-florence2` for describing captured Photoshop sources. |
| Future Realtime Preview | To be tested | Likely needs a very fast dedicated workflow. |

## Why Z_image_Turbo Does Not Appear In The Checkpoint Selector

Some models are not checkpoints.

`Z_image_Turbo` is a diffusion model stack in ComfyUI. In a typical graph it may use:

- `Load Diffusion Model` for `z_image_turbo_bf16.safetensors`
- `Load CLIP` for a matching CLIP model such as `qwen_3_4b.safetensors`
- `Load VAE` for a matching VAE such as `ae.safetensors`

OpenLayer's SD/SDXL starter workflows use `CheckpointLoaderSimple`, so they only list checkpoint files in the checkpoint selector.

The experimental Z_image_Turbo presets use a separate diffusion-model-stack path. When one of those workflows is selected, OpenLayer asks ComfyUI for models from `UNETLoader` instead of `CheckpointLoaderSimple`.

## How OpenLayer Chooses Recommendations

The Settings advisor combines:

- GPU and VRAM reported by ComfyUI
- model families detected from ComfyUI model loader lists
- current workflow presets
- known model family compatibility
- whether a model stack is only detected or actually runnable through an OpenLayer preset

OpenLayer does not auto-switch your model yet. Recommendations are advisory so artists stay in control.

## Flux1-dev fp8 Text to Image Notes

`flux1-dev-fp8.safetensors` is a checkpoint-style Flux model in the attached ComfyUI workflow, so it appears through `CheckpointLoaderSimple` and can be selected by the experimental `txt2img-flux1-dev-fp8` preset.

This preset uses `CheckpointLoaderSimple`, `EmptySD3LatentImage`, `CLIPTextEncode`, `FluxGuidance`, `KSampler`, `VAEDecode`, and `SaveImage`. OpenLayer maps the UI CFG field to `FluxGuidance.guidance`; the sampler CFG stays at `1`, matching the ComfyUI workflow note that Flux dev does not use negative prompt guidance in the usual SD way.

## Prompt from Layer Notes

Prompt from Layer uses a vision-language workflow, not a diffusion image model. The first runnable preset is `prompt-from-layer-florence2`.

Required local setup:

- `comfyui-florence2`
- `Florence-2-base-PromptGen-v2.0` available to `Florence2ModelLoader`

`comfyui-custom-scripts` is no longer required. The workflow used to end in that pack's
`ShowText|pysssss` node; it now ends in core ComfyUI's `PreviewAny`, which publishes the caption in
the same history shape. The node cannot simply be deleted — `Florence2Run` is not an output node, so
a graph without one is refused by ComfyUI before it runs.

OpenLayer uploads the captured Photoshop source PNG to ComfyUI, runs Florence-2 PromptGen, reads the text output from ComfyUI history, and places the generated caption into the plugin text area. The default task is `detailed_caption` with `num_beams` set to `12`.

## Flux Fill Notes

`flux1-fill-dev.safetensors` is not a checkpoint. OpenLayer lists it through the diffusion model loader path and runs it through the experimental `inpaint-flux-fill-basic` preset.

The current Flux Fill preset follows a reference ComfyUI graph with `UNETLoader`, `DifferentialDiffusion`, `DualCLIPLoader`, `FluxGuidance`, `InpaintModelConditioning`, regular `KSampler`, `VAEDecode`, and `SaveImage`. It expects `clip_l.safetensors`, `t5xxl_fp16.safetensors` or the accepted `t5xxl_fp8_e4m3fn.safetensors` fallback, and `ae.safetensors`.

OpenLayer embeds the Photoshop selection mask into the uploaded source PNG alpha channel for this preset because ComfyUI `LoadImage` provides the mask from image alpha.

## Flux Fill Outpaint Notes

The first Outpaint preset is `outpaint-flux-fill-basic`. It uses the same Flux Fill model stack as the experimental inpaint path, but adds ComfyUI's `ImagePadForOutpaint` node to expand the captured source before sampling.

Required local setup:

- `flux1-fill-dev.safetensors`
- `clip_l.safetensors`
- `t5xxl_fp16.safetensors`, or the accepted `t5xxl_fp8_e4m3fn.safetensors` fallback
- `ae.safetensors`

Outpaint is available for testing, but it is still experimental. Start with small expansions and use Workflow Health in Settings to confirm the Flux Fill stack is ready before judging output quality.

## Settings Diagnostics

Use `Check Workflow Health` in Settings to see which presets are ready on your local ComfyUI install.

For diffusion model stacks, OpenLayer checks the model loader lists instead of the checkpoint list. This is why `Z_image_Turbo` readiness depends on files such as `z_image_turbo_bf16.safetensors`, `qwen_3_4b.safetensors`, and `ae.safetensors`.

Flux1-dev fp8 Text to Image has an experimental preset when ComfyUI exposes `flux1-dev-fp8.safetensors` through `CheckpointLoaderSimple`. Flux Fill inpainting has an experimental preset when ComfyUI exposes `flux1-fill-dev.safetensors`, `t5xxl_fp16.safetensors` or the accepted `t5xxl_fp8_e4m3fn.safetensors` fallback, `clip_l.safetensors`, and `ae.safetensors`. Generic Flux diffusion-model-stack text-to-image and image-to-image presets still stay setup-required until OpenLayer has matching validated API workflow JSON files.

`Copy Diagnostics` creates a local text report that you can paste into an issue or test note. It does not send hardware, model, or workflow information anywhere.

## Practical Starting Advice

For reliable testing today:

1. Use SDXL for general Text to Image quality if your GPU can handle it.
2. Use SD 1.x for the current Sketch to Image LINECN workflow.
3. Treat Z_image_Turbo, Flux1-dev fp8, Flux Fill Inpaint, and Flux Fill Outpaint as experimental. Treat generic Flux/SD3.5 as future dedicated preset work until OpenLayer has matching API workflow JSON files for each family.
4. Use the Settings button `Detect GPU & Recommend Models` after starting ComfyUI.
