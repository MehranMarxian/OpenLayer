<p align="center">
  <img src="src/icons/openlayer.png" alt="OpenLayer icon" width="96" height="96">
</p>

# OpenLayer

Local AI layers for Photoshop.

OpenLayer is an open-source Adobe Photoshop UXP plugin that connects Photoshop to a locally running ComfyUI server. The alpha builds a local-first foundation for generating AI images, previewing results, and importing them into the active Photoshop document as editable layers.

## Alpha Release

`v0.2.1-alpha` is the current public preview. It is intended for testing the core local workflow, not for production work yet.

Included in this alpha:

- Local ComfyUI connection from Photoshop UXP
- Checkpoint loading from ComfyUI
- Photoshop-dark Home dashboard with tool cards for current and planned workflows
- Text-to-image generation with the `txt2img-basic` preset
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
- Session history for recent generated previews
- Optional auto-import after generation
- Responsive panel spacing fixes for narrow and wide Photoshop panels
- Official OpenLayer icon and GitHub Pages landing page

![OpenLayer v0.2.1 Home dashboard](docs/assets/openlayer-v021-dashboard.png)

Known v0.2.1-alpha boundaries:

- Image to Image is an early foundation path, not a full production workflow yet.
- Sketch to Image is limited to the first SD 1.x LINECN starter workflow.
- Sketch to Image is currently tested with `epicrealism_naturalSinRC1VAE.safetensors` and `control_v11p_sd15_lineart_fp16.safetensors`.
- Active-layer and canvas capture are currently encoded as JPEG through Photoshop's Imaging API.
- `img2img-basic` is the default SD 1.x/SDXL preset. SD3, SD3.5, and Flux checkpoints remain visible but are marked experimental because they usually need dedicated future workflow presets.
- SDXL, SD3, Flux, and Z-Image Sketch to Image workflows need dedicated future presets.
- Workflow node IDs may need adjustment for custom ComfyUI workflows.
- True PNG selected-layer export, inpainting, masks, selection preservation, aligned regional workflows, advanced ControlNet-style workflows, and upscaling are not included yet.
- The UI is functional and responsive enough for testing, but final visual polish will continue in later releases.

## Project Page

The static landing page is in:

```text
docs/index.html
```

For GitHub Pages, publish from the `docs` folder on the main branch.

## MVP Status

Working foundation:

- Photoshop UXP panel scaffold for Photoshop 2024+
- Dark, minimal UXP-friendly TypeScript UI
- Photoshop-dark Home dashboard with Text to Image, Image to Image, Settings, History, and future workflow cards
- Configurable local ComfyUI server URL
- ComfyUI connection check
- Checkpoint/model selector loaded from ComfyUI
- Settings page with saved local defaults and diagnostics
- Session history for recent generated images
- `txt2img-basic` workflow generation
- `img2img-basic` workflow generation foundation
- `sketch2img-linecn-basic` Sketch to Image generation foundation
- Active-layer or visible-canvas source capture and ComfyUI image upload
- Experimental checkpoint mode for trying non-SD/SDXL model families with clear warnings
- `/prompt` submission
- `/history/{prompt_id}` polling
- `/view` image retrieval
- Result preview in the panel
- Import result into the active Photoshop document as a new layer

Future placeholders are included for PNG layer export, selection export, masks, selection alignment, and selection preservation.

## Requirements

- Adobe Photoshop 2024 or newer
- Adobe UXP Developer Tool
- Node.js 18+
- A local ComfyUI server for OpenLayer running at `http://127.0.0.1:8190`

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
packages/openlayer-v0.2.1-alpha.zip
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
4. Choose a checkpoint.
5. Enter a prompt.
6. Optionally enter a negative prompt.
7. Keep the workflow preset set to `txt2img-basic`.
8. Click `Generate`.
9. Wait for the preview.
10. Click `Import Result as New Layer`, or enable `Import Result Automatically` before generating.

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

## Pre-release Tester Checklist

Use this quick pass before reporting a v0.2.1-alpha test result:

1. Start ComfyUI on `http://127.0.0.1:8190`.
2. Build OpenLayer and load `dist/manifest.json` in Adobe UXP Developer Tool.
3. Open Photoshop, create or open a document, and launch OpenLayer.
4. Open Settings and click `Check ComfyUI`; confirm checkpoints load.
5. Generate one `txt2img-basic` image and import it as a new layer.
6. Open `Image to Image`, capture either the active layer or canvas, generate with `img2img-basic`, and click `Import to Layers`.
7. Open `Sketch to Image`, capture either the active layer or canvas, generate with `sketch2img-linecn-basic`, and click `Import to Layers`.
8. Resize the panel narrow and wide; confirm the header, footer, buttons, preview, and cards remain reachable.

## Testing Checklist

For a step-by-step beginner smoke test, see:

```text
docs/testing-v0.1-alpha.md
```

## Workflow Notes

The included workflows are realistic starter ComfyUI workflows using common built-in nodes:

- `src/workflows/txt2img-basic.json`
- `src/workflows/img2img-basic.json`

You may need to replace the checkpoint name and node IDs for your own ComfyUI setup.

The workflow builder injects:

- prompt
- negative prompt
- width
- height
- seed
- steps
- cfg

Image to Image and Sketch to Image use Photoshop's UXP Imaging API to capture the active layer or canvas, then send the source image to ComfyUI using `/upload/image`. In `v0.2.1-alpha`, that source capture is encoded as JPEG. True PNG layer export, mask export, and selection-aligned workflows are planned future work.

`img2img-basic` is intended for SD 1.x and SDXL-style checkpoints. SD3, SD3.5, and Flux checkpoints are shown in the selector for transparency, but OpenLayer warns before running them because those model families often need different loader, text encoder, and VAE nodes.

Sketch to Image uses the same Photoshop capture and ComfyUI upload path, then runs `sketch2img-linecn-basic`. This preset requires:

- `epicrealism_naturalSinRC1VAE.safetensors`
- `control_v11p_sd15_lineart_fp16.safetensors`
- `LineArtPreprocessor`
- `ControlNetLoader`
- `ControlNetApplyAdvanced`

The first LINECN preset is intentionally narrow. It is a working SD 1.x foundation, not a universal sketch workflow for SDXL, SD3, Flux, or Z-Image.

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

Check that the selected checkpoint exists in ComfyUI and that the `txt2img-basic` workflow node IDs still match the starter workflow. Custom workflows may need edits in:

```text
src/comfy/workflowBuilder.ts
```

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
