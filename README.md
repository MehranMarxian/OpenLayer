<p align="center">
  <img src="src/icons/openlayer.png" alt="OpenLayer icon" width="96" height="96">
</p>

# OpenLayer - Open Source Photoshop ComfyUI Plugin

OpenLayer is an open-source Photoshop ComfyUI plugin for local AI layers.

OpenLayer is an open-source Adobe Photoshop UXP plugin that connects Photoshop to a locally running ComfyUI server for text-to-image, image-to-image, sketch-to-image, preview, and importing AI results into the active Photoshop document as editable layers.

## Alpha Release

`v0.4.9-alpha` is the current global generation safety and session history metadata preview. It is intended for testing the core local workflow, not for production work yet.

Included in this alpha:

- Local ComfyUI connection from Photoshop UXP
- Checkpoint loading from ComfyUI
- Photoshop-dark Home dashboard with tool cards for current and planned workflows
- Text-to-image generation with the `txt2img-basic` preset
- Experimental Flux1-dev fp8 Text to Image preset using the attached checkpoint-style ComfyUI workflow
- Experimental image-to-image generation with the `img2img-basic` preset
- Active Photoshop layer capture for Image to Image using Photoshop UXP Imaging API
- Canvas capture option for Image to Image source input
- Experimental Sketch to Image generation with the `sketch2img-linecn-basic` LINECN preset
- Active Photoshop layer or canvas capture for Sketch to Image source input
- ComfyUI setup validation for required LineArt/ControlNet nodes and models
- Experimental checkpoint mode with SD 1.x, SDXL, SD3, and Flux compatibility warnings
- Source image preview before upload to ComfyUI
- Result preview inside the OpenLayer panel
- Import generated output into the active Photoshop document as a new layer
- Settings persistence for ComfyUI URL, selected checkpoint, and generation defaults
- Passive local ComfyUI active port finder
- GPU-aware model recommendations in Settings using ComfyUI `/system_stats`
- Beginner-friendly model family guidance for SD 1.x, SDXL, SD3, Flux, and Z_image_Turbo
- Workflow compatibility foundation that separates checkpoint presets from future diffusion-model-stack presets
- Settings workflow health checker for registered presets, required ComfyUI node classes, and required model-stack files
- Readable Settings diagnostics center with grouped workflow health cards, collapsed technical details, summary counts, and Copy Diagnostics support
- Experimental Z_image_Turbo Text to Image and Image to Image presets using a dedicated diffusion-model-stack workflow path
- Global Cancel Generation button path for Text to Image, Image to Image, Sketch to Image, Inpaint, Outpaint, and Prompt from Layer using ComfyUI's local interrupt endpoint
- Experimental Prompt from Layer workflow using Florence-2 PromptGen to describe a captured layer or canvas
- Experimental Flux Fill Outpaint workflow using `ImagePadForOutpaint`
- PNG/lossless source capture for Image to Image and Sketch to Image using raw Photoshop Imaging API pixels
- Experimental Inpaint/Repaint Selection screen with safe Photoshop selection detection
- PNG/lossless selected-region capture and temporary-layer grayscale mask export for Inpaint
- Experimental SD 1.x `inpaint-basic` workflow with source image and mask upload to ComfyUI
- Friendly Inpaint guardrails when no Photoshop selection exists, mask export fails, or required ComfyUI inpaint nodes are unavailable
- Automated CI and unit test foundation for workflow, settings, model compatibility, and error helpers
- Session history for recent generated previews with prompt, model, workflow preset, seed, dimensions, source mode, tool type, timestamp, and import status where available
- Reuse Settings action for recent generated-image history entries
- Optional auto-import after generation
- Responsive panel spacing fixes for narrow and wide Photoshop panels
- Official OpenLayer icon and GitHub Pages landing page

![OpenLayer v0.2.1 Home dashboard](docs/assets/openlayer-v021-dashboard.png)

Known v0.4.9-alpha boundaries:

- Image to Image is an early foundation path, not a full production workflow yet.
- Sketch to Image is limited to the first SD 1.x LINECN starter workflow.
- Sketch to Image is currently tested with `epicrealism_naturalSinRC1VAE.safetensors` and `control_v11p_sd15_lineart_fp16.safetensors`.
- Active-layer and canvas capture now encode raw Photoshop Imaging API pixels as PNG/lossless source images.
- Inpaint can detect and capture the selected rectangular region as a PNG/lossless source image.
- Inpaint now attempts a temporary-layer grayscale PNG mask export and can run the experimental SD 1.x `inpaint-basic` workflow when ComfyUI has the required nodes.
- Inpainting is available for testing, but output quality and Photoshop alignment are not confirmed stable yet.
- The first Inpaint preset is intended for SD 1.x checkpoints. SDXL, SD3, Flux, and Z_image_Turbo inpainting need dedicated future presets.
- `img2img-basic` is the default SD 1.x/SDXL preset. SD3, SD3.5, and Flux checkpoints remain visible but are marked experimental because they usually need dedicated future workflow presets.
- Z_image_Turbo presets are experimental and use `UNETLoader`, `CLIPLoader`, and `VAELoader` instead of the checkpoint loader.
- `txt2img-flux1-dev-fp8` is an experimental checkpoint-style Flux Text to Image preset for `flux1-dev-fp8.safetensors`.
- Generic Flux diffusion-model-stack Text to Image and Image to Image presets remain disabled until validated API workflow JSON files are added.
- Cancel Generation uses ComfyUI's interrupt endpoint and stops OpenLayer watchers/polling for active generation tools, but cancellation cannot undo work ComfyUI already completed.
- The Settings workflow health checker reports local readiness, but it does not auto-fix missing models, missing nodes, or workflow mappings.
- Copy Diagnostics prepares a setup report for testers. It does not send data anywhere.
- Prompt from Layer is experimental and requires `comfyui-florence2`, `comfyui-custom-scripts`, and `Florence-2-base-PromptGen-v2.0`.
- Outpaint is experimental and currently uses `outpaint-flux-fill-basic` with `flux1-fill-dev.safetensors`, `clip_l.safetensors`, `t5xxl_fp16.safetensors` or the accepted T5 fp8 fallback, and `ae.safetensors`.
- SDXL, SD3, Flux, and Z_image_Turbo Sketch to Image workflows need dedicated future presets.
- Workflow node IDs may need adjustment for custom ComfyUI workflows.
- Dedicated selected-layer PNG file export, selection preservation, aligned regional workflows, advanced ControlNet-style workflows, and upscaling are not included yet.
- The UI is functional and responsive enough for testing, but final visual polish will continue in later releases.

## Project Page

The static landing page is in:

```text
docs/index.html
```

For GitHub Pages, publish from the `docs` folder on the main branch.

## Model And VRAM Guide

OpenLayer includes a beginner-friendly guide for local model choices, VRAM tiers, and why diffusion model stacks such as `Z_image_Turbo` do not appear in the checkpoint selector:

```text
docs/model-guide.md
```

The current experimental inpainting status and next debugging checklist are documented in:

```text
docs/inpainting.md
```

Key technical decisions for the project are tracked in:

```text
docs/technical-decisions.md
```

## MVP Status

Working foundation:

- Photoshop UXP panel scaffold for Photoshop 2024+
- Dark, minimal UXP-friendly TypeScript UI
- Photoshop-dark Home dashboard with Text to Image, Image to Image, Sketch to Image, Inpaint, Prompt from Layer, Settings, History, and future workflow cards
- Experimental Outpaint card and screen for Flux Fill canvas expansion testing
- Configurable local ComfyUI server URL
- ComfyUI connection check
- Checkpoint/model selector loaded from ComfyUI
- Settings page with saved local defaults and diagnostics
- Settings hardware advisor for detecting ComfyUI GPU/VRAM and recommending safe model families
- Session history for recent generated images
- `txt2img-basic` workflow generation
- Experimental `txt2img-z-image-turbo` workflow generation
- `img2img-basic` workflow generation foundation
- Experimental `img2img-z-image-turbo` workflow generation foundation
- `sketch2img-linecn-basic` Sketch to Image generation foundation
- Experimental `prompt-from-layer-florence2` text workflow with Task and Num beams controls
- Active-layer or visible-canvas source capture and ComfyUI image upload
- Experimental Inpaint/Repaint Selection screen with Photoshop selection detection, selected-region PNG source capture, grayscale mask export, and SD 1.x `inpaint-basic`
- Experimental checkpoint mode for trying non-SD/SDXL model families with clear warnings
- `/prompt` submission
- `/history/{prompt_id}` polling
- `/view` image retrieval
- Result preview in the panel
- Import result into the active Photoshop document as a new layer

Future placeholders are included for regional import alignment and selection preservation.

## Requirements

- Adobe Photoshop 2024 or newer
- Adobe UXP Developer Tool
- Node.js 18+
- A local ComfyUI server for OpenLayer running at `http://127.0.0.1:8190`

## Local Permissions

OpenLayer is local-first. The Photoshop UXP manifest currently requests filesystem and network access because:

- local filesystem access is used for temporary files and Photoshop import tokens
- network access is used to communicate with the user's local ComfyUI server
- Copy Diagnostics prepares a local text report only

OpenLayer does not send diagnostics, images, prompts, or model information anywhere automatically.

## Install

```bash
npm install
```

## Development

Build the plugin:

```bash
npm run build
```

Load the generated `dist` folder in Adobe UXP Developer Tool.

Run local checks:

```bash
npm run typecheck
npm test
```

These checks do not require Photoshop or ComfyUI.

For fast UI iteration outside Photoshop, you can run:

```bash
npm run dev
```

The dev server is useful for panel layout work, but the Photoshop-specific APIs only run inside Photoshop through UXP.

## Package

```bash
npm run package
```

This creates a zip package from `dist` in the `packages` folder. For the current alpha, the expected package name is:

```text
packages/openlayer-v0.4.9-alpha.zip
```

## Loading In UXP Developer Tool

1. Open Adobe UXP Developer Tool.
2. Click `Add Plugin`.
3. Select `dist/manifest.json` after running `npm run build`.
4. Click `Load`.
5. Open Photoshop and find OpenLayer in the Plugins panel.

## Starting ComfyUI

Start ComfyUI locally using your normal ComfyUI launch command. Confirm the server is reachable:

```bash
curl http://127.0.0.1:8190/system_stats
```

In OpenLayer, keep the default server URL or enter your own:

```text
http://127.0.0.1:8190
```

OpenLayer uses port `8190` by default so it does not interfere with another plugin that may already be using ComfyUI on port `8188`.

If your other plugin is already using ComfyUI on `8188`, start a second ComfyUI instance for OpenLayer on `8190`, for example:

```bash
python main.py --listen 127.0.0.1 --port 8190
```

Click `Check ComfyUI` before generating.

## First Image

1. Open a Photoshop document.
2. Open the OpenLayer panel.
3. Open Settings and click `Find ComfyUI Active Port` or `Check ComfyUI` to load the available checkpoints.
4. Optional: click `Detect GPU & Recommend Models` to see hardware-aware model suggestions.
5. Choose a checkpoint.
6. Enter a prompt.
7. Optionally enter a negative prompt.
8. Keep the workflow preset set to `txt2img-basic`.
9. Click `Generate`.
10. Wait for the preview.
11. Click `Import Result as New Layer`, or enable `Import Result Automatically` before generating.

The imported layer is named like:

```text
OpenLayer_Generated_YYYYMMDD_HHMM
```

## First Image To Image Test

1. Open a Photoshop document.
2. Select the layer you want to use as the source.
3. Open the OpenLayer panel and choose `Image to Image`.
4. Click `Capture Active Layer`, or click `Capture Canvas` to use the visible document.
5. Confirm the source preview appears.
6. Enter a prompt describing how to reinterpret the source.
7. Choose a checkpoint and keep the workflow set to `img2img-basic`.
8. Click `Generate Image to Image`.
9. Wait for the result preview.
10. Click `Import to Layers`.

The imported layer is named like:

```text
OpenLayer_Img2Img_YYYYMMDD_HHMM
```

## First Sketch To Image LINECN Test

1. Install or confirm this SD 1.x checkpoint is available in ComfyUI:

```text
epicrealism_naturalSinRC1VAE.safetensors
```

2. Install or confirm this SD 1.5 LineArt ControlNet model is available in ComfyUI:

```text
control_v11p_sd15_lineart_fp16.safetensors
```

3. Open a Photoshop document with a visible source layer or canvas.
4. Open the OpenLayer panel and choose `Sketch to Image`.
5. Click `Capture Active Layer`, or click `Capture Canvas`.
6. Confirm the source preview appears.
7. Enter a prompt describing the final image.
8. Keep the workflow set to `sketch2img-linecn-basic`.
9. Choose `epicrealism_naturalSinRC1VAE.safetensors`.
10. Click `Generate Sketch to Image`.
11. Wait for the result preview.
12. Click `Import to Layers`.

The imported layer is named like:

```text
OpenLayer_Sketch_YYYYMMDD_HHMM
```

## First Inpaint Test

This alpha includes the first experimental SD 1.x mask-based inpainting path.

1. Open a Photoshop document.
2. Make a rectangular or freeform selection in Photoshop.
3. Open the OpenLayer panel and choose `Inpaint`.
4. Click `Capture Selection`.
5. Confirm the source preview appears and the status shows the selection bounds.
6. Confirm the mask preview appears as a black/white PNG mask.
7. Enter a prompt and click `Generate Inpaint`.
8. Wait for the result preview.
9. Click `Import to Layers`.

The first `inpaint-basic` preset is experimental and intended for SD 1.x inpaint checkpoints first. `inpaint-flux-fill-basic` is also available as an experimental Flux Fill path when your local ComfyUI exposes the required Flux Fill model stack.

Inpaint output quality, mask interpretation, and Photoshop alignment are still being tested. Use this path for debugging and feedback rather than production work.

## Pre-release Tester Checklist

Use this quick pass before reporting a v0.4.9-alpha test result:

1. Start ComfyUI on `http://127.0.0.1:8190`.
2. Build OpenLayer and load `dist/manifest.json` in Adobe UXP Developer Tool.
3. Open Photoshop, create or open a document, and launch OpenLayer.
4. Open Settings and click `Check ComfyUI`; confirm checkpoints load.
5. Click `Check Workflow Health`; confirm each registered preset shows Ready, Experimental, Missing model, Missing ComfyUI node, Missing workflow JSON, or Setup required.
6. Confirm Settings shows readable summary counts and collapsed technical details without overlapping cards.
7. Click `Copy Diagnostics`; confirm the report is copied or appears in the read-only diagnostics box.
8. Generate one `txt2img-basic` image and import it as a new layer.
9. Select `txt2img-flux1-dev-fp8` with `flux1-dev-fp8.safetensors` if available, generate once, and confirm the result preview appears.
10. Start one Text to Image generation and click `Cancel Generation`; confirm the status changes to `Generation cancelled.` and the next generation still works.
11. Open `Image to Image`, capture either the active layer or canvas, generate with `img2img-basic`, and click `Import to Layers`.
12. Open `Sketch to Image`, capture either the active layer or canvas, generate with `sketch2img-linecn-basic`, and click `Import to Layers`.
13. Open `Inpaint`, make a Photoshop selection, click `Capture Selection`, and confirm the selected-region preview and mask preview appear.
14. Generate with `inpaint-basic` using an SD 1.x checkpoint, then click `Import to Layers`.
15. Start and cancel one longer Image to Image, Sketch, Outpaint, Inpaint, or Prompt from Layer run if your ComfyUI setup supports it; confirm the next generation still works.
16. Open History after a generation; confirm prompt, model, workflow, seed, dimensions, source mode, tool type, timestamp, import status, Preview, Import, and Reuse Settings are visible.
17. Resize the panel narrow and wide; confirm Settings, workflow health cards, buttons, preview, and footer remain readable and reachable.

## Testing Checklist

For a step-by-step beginner smoke test, see:

```text
docs/testing-v0.1-alpha.md
```

## Workflow Notes

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
- `LineArtPreprocessor`
- `ControlNetLoader`
- `ControlNetApplyAdvanced`

The first LINECN preset is intentionally narrow. It is a working SD 1.x foundation, not a universal sketch workflow for SDXL, SD3, Flux, or Z_image_Turbo.

If you export a different workflow from ComfyUI, update the node IDs in `src/comfy/presetRegistry.ts`.

## Troubleshooting

### GitHub Pages shows 404

Make sure GitHub Pages is configured to publish from:

```text
main / docs
```

The landing page entry file is `docs/index.html`.

### Plugin does not appear in Photoshop

Run `npm run build`, then load:

```text
dist/manifest.json
```

in Adobe UXP Developer Tool. After loading, open Photoshop and use the Plugins menu to open OpenLayer.

### The panel opens but ComfyUI does not connect

Confirm ComfyUI is running on:

```text
http://127.0.0.1:8190
```

You can test it in a browser or terminal:

```bash
curl http://127.0.0.1:8190/system_stats
```

If another local tool is already using `8188`, keep OpenLayer on `8190` and start a separate ComfyUI instance for OpenLayer.

### Checkpoint list is empty

Click `Check ComfyUI` after ComfyUI is fully started. If it is still empty, confirm your models are installed in ComfyUI and that the server URL in OpenLayer matches the running ComfyUI port.

### Generate fails

Check that the selected checkpoint exists in ComfyUI and that the selected workflow node IDs still match the starter workflow. Custom workflows currently require manual mapping in:

```text
src/comfy/presetRegistry.ts
```

See `docs/custom-workflows.md` for the current custom workflow process.

### Image to Image fails with a model mismatch

Use an SD 1.x or SDXL checkpoint with `img2img-basic` first. If you select SD3, SD3.5, Flux, or another newer model family, OpenLayer will keep it visible but warn that it is experimental for this preset. Those checkpoints usually need a dedicated workflow preset before they can run reliably.

### Import Result as New Layer fails

Open a Photoshop document before importing. OpenLayer imports into the active document and will show an error if no document is open.

## Project Structure

```text
.
|-- docs/
|-- scripts/
|-- src/
|   |-- comfy/
|   |-- photoshop/
|   |-- ui/
|   |-- utils/
|   |-- workflows/
|   |-- index.html
|   |-- main.ts
|   |-- manifest.json
|   `-- styles.css
|-- package.json
|-- tsconfig.json
`-- vite.config.ts
```

## License

MIT
