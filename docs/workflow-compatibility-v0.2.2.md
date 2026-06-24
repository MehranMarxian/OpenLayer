# OpenLayer v0.2.2 Workflow Compatibility Notes

OpenLayer now has preset metadata that separates working checkpoint workflows from future diffusion-model-stack workflows. The installed runnable starter presets are:

- `txt2img-basic`
- `img2img-basic`
- `sketch2img-linecn-basic`

These presets use `CheckpointLoaderSimple` and are intended for SD 1.x and SDXL-style checkpoints. SD3, Flux, and Z_image_Turbo models often use different loader, text encoder, VAE, or sampler nodes.

Disabled metadata-only presets also exist for future work:

- `txt2img-z-image-turbo`
- `img2img-z-image-turbo`
- `txt2img-flux1-dev`
- `img2img-flux1-dev`

These presets are intentionally not shown as runnable choices until a validated API workflow exists.

## Sketch to Image LINECN

OpenLayer exposes `sketch2img-linecn-basic` as a starter Sketch to Image preset. It ships with a candidate ComfyUI API workflow built from local `/object_info` schemas for a SD 1.x LineArt ControlNet setup.

Workflow file:

- `src/workflows/api/sketch2img-linecn-basic.json`

Recommended first test setup:

- checkpoint: `epicrealism_naturalSinRC1VAE.safetensors`
- workflow family: SD 1.x / SD 1.5
- guide system: `LineArtPreprocessor` plus `control_v11p_sd15_lineart_fp16.safetensors`

Required node classes:

- `CheckpointLoaderSimple`
- `LoadImage`
- `CLIPTextEncode`
- `LineArtPreprocessor`
- `ControlNetLoader`
- `ControlNetApplyAdvanced`
- `VAEEncode`
- `KSampler`
- `VAEDecode`
- `SaveImage`

The registry maps checkpoint, source image, prompt, negative prompt, seed, steps, CFG, denoise, and ControlNet strength into known node IDs from that workflow.

## Required Before Adding Flux or Z_image_Turbo

Do not guess node APIs. Before wiring a new preset as runnable, export a real ComfyUI API-format workflow JSON from the local ComfyUI setup.

Needed workflow files:

- `src/workflows/api/txt2img-flux1-dev.json`
- `src/workflows/api/img2img-flux1-dev.json`
- `src/workflows/api/txt2img-z-image-turbo.json`
- `src/workflows/api/img2img-z-image-turbo.json`

Optional GUI-editable source workflow files should live in:

- `src/workflows/source/txt2img-flux1-dev.workflow.json`
- `src/workflows/source/img2img-flux1-dev.workflow.json`
- `src/workflows/source/txt2img-z-image-turbo.workflow.json`
- `src/workflows/source/img2img-z-image-turbo.workflow.json`

For each file, update:

- `src/comfy/presetRegistry.ts`
  - preset id
  - supported model families
  - model source object-info node and input name
  - injection targets for prompt, source image, seed, steps, CFG/guidance, denoise, width, and height
  - required node validation
- `src/comfy/workflowBuilder.ts`
  - static import for the JSON file
  - entry in `WORKFLOW_TEMPLATES`

For the current v0.2.2 foundation, the disabled future presets are represented only in `presetRegistry.ts`; they are not imported in `workflowBuilder.ts`.

## Sketch to Image Connection

Sketch to Image uses the same preset architecture instead of a separate one-off builder. Future presets should define source image and control/lineart image injection targets, then validate required ComfyUI nodes before submit.
