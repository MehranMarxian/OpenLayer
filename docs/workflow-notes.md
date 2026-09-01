# Workflow notes

How OpenLayer builds and submits ComfyUI graphs, what each starter preset needs, and what to
change if you bring your own workflow.

The included workflows are realistic starter ComfyUI workflows using common built-in nodes:

- `src/workflows/api/txt2img-basic.json`
- `src/workflows/api/txt2img-flux1-dev-fp8.json`
- `src/workflows/api/prompt-from-layer-florence2.json`
- `src/workflows/api/img2img-basic.json`
- `src/workflows/api/sketch2img-linecn-basic.json`
- `src/workflows/api/inpaint-basic.json`
- `src/workflows/api/inpaint-flux-fill-basic.json`

You may need to replace the checkpoint name and node IDs for your own ComfyUI setup.

OpenLayer now keeps workflow files in two folders:

- `src/workflows/api/` for runnable API workflows submitted to ComfyUI
- `src/workflows/source/` for GUI-editable ComfyUI source workflows

See `docs/workflow-files.md`, `docs/custom-workflows.md`, and `docs/comfyui-object-info-audit-v0.2.2.md` for the workflow file structure, custom workflow mapping requirements, and the local node schema audit used by the workflow compatibility foundation.

The workflow builder injects:

- prompt
- negative prompt
- width
- height
- seed
- steps
- cfg

Image to Image and Sketch to Image use Photoshop's UXP Imaging API to capture the active layer or canvas, encode the raw pixels as PNG, then send the source image to ComfyUI using `/upload/image`. JPEG source capture has been removed from this path so clean edges, masks, transparency, and linework are not degraded by lossy compression.

Inpaint uses the same PNG/lossless Imaging API path, clipped to a padded context around the active Photoshop selection when Photoshop exposes selection bounds. In `v0.4.1-alpha`, OpenLayer also creates a temporary white-filled selection layer, captures it as a grayscale PNG mask, deletes the temporary layer, and uploads both source and mask to ComfyUI.

The first `inpaint-basic` preset requires ComfyUI's standard `LoadImage`, `ImageToMask`, `InpaintModelConditioning`, `KSampler`, `VAEDecode`, `ImageCompositeMasked`, and `SaveImage` nodes. It is currently aimed at SD 1.x inpaint checkpoints.

The experimental `inpaint-flux-fill-basic` preset requires:

- `flux1-fill-dev.safetensors` through `UNETLoader` from `models/diffusion_models`
- `clip_l.safetensors` through `DualCLIPLoader.clip_name1` from `models/text_encoders`
- `t5xxl_fp16.safetensors` through `DualCLIPLoader.clip_name2` from `models/text_encoders`
- `t5xxl_fp8_e4m3fn.safetensors` as an accepted T5 fallback when the fp16 file is not installed
- `ae.safetensors` through `VAELoader` from `models/vae`
- `DifferentialDiffusion`, `FluxGuidance`, `ConditioningZeroOut`, `InpaintModelConditioning`, `KSampler`, `VAEDecode`, and `SaveImage`

Flux Fill follows the reference-style graph in `src/workflows/source/inpaint-flux-fill-basic.workflow.json`. That graph expects one `LoadImage` node whose alpha channel becomes the mask. OpenLayer preserves the Photoshop source PNG and embeds the white repaint mask into the uploaded PNG alpha channel before submission. Inpaint import currently uses aligned context import only. The earlier transparent outside-mask PNG experiment is disabled because Photoshop UXP canvas/blob compositing is not trusted yet. Output quality, mask polarity, and alignment are not confirmed stable yet, and Photoshop-native layer mask import remains planned future work.

For debugging, OpenLayer records source, mask, raw result dimensions, import mode, and temporary local debug copies of the source PNG, mask PNG, and raw generated PNG after an Inpaint run.

`img2img-basic` is intended for SD 1.x and SDXL-style checkpoints. SD3, SD3.5, and Flux checkpoints are shown in the selector for transparency, but OpenLayer warns before running them because those model families often need different loader, text encoder, and VAE nodes.

Sketch to Image uses the same Photoshop capture and ComfyUI upload path, then runs `sketch2img-linecn-basic`. This preset requires:

- `epicrealism_naturalSinRC1VAE.safetensors`
- `control_v11p_sd15_lineart_fp16.safetensors`
- `LineartStandardPreprocessor`
- `ControlNetLoader`
- `ControlNetApplyAdvanced`

The first LINECN preset is intentionally narrow. It is a working SD 1.x foundation, not a universal sketch workflow for SDXL, SD3, Flux, or Z_image_Turbo.

If you export a different workflow from ComfyUI, update the node IDs in `src/comfy/presetRegistry.ts`.
