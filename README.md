<p align="center">
  <img src="src/icons/openlayer.png" alt="OpenLayer icon" width="96" height="96">
</p>

# OpenLayer

Local AI layers for Photoshop.

OpenLayer is an open-source Adobe Photoshop UXP plugin that connects Photoshop to a locally running ComfyUI server. The alpha builds a local-first foundation for generating AI images, previewing results, and importing them into the active Photoshop document as editable layers.

## Alpha Release

`v0.2.0-alpha` is the current public preview. It is intended for testing the core local workflow, not for production work yet.

Included in this alpha:

- Local ComfyUI connection from Photoshop UXP
- Checkpoint loading from ComfyUI
- Text-to-image generation with the `txt2img-basic` preset
- Experimental image-to-image generation with the `img2img-basic` preset
- Active Photoshop layer capture for Image to Image using Photoshop UXP Imaging API
- Source image preview before upload to ComfyUI
- Result preview inside the OpenLayer panel
- Import generated output into the active Photoshop document as a new layer
- Settings persistence for ComfyUI URL, selected checkpoint, and generation defaults
- Passive local ComfyUI active port finder
- Session history for recent generated previews
- Optional auto-import after generation
- Official OpenLayer icon and GitHub Pages landing page

Known v0.2.0-alpha boundaries:

- Image to Image is an early foundation path, not a full production workflow yet.
- Active-layer capture is currently encoded as JPEG through Photoshop's Imaging API.
- Workflow node IDs may need adjustment for custom ComfyUI workflows.
- True PNG selected-layer export, inpainting, masks, selection preservation, aligned regional workflows, ControlNet-style workflows, and upscaling are not included yet.
- The UI is functional but still early. Narrow Photoshop panel layout polish will continue in later releases.

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
- Configurable local ComfyUI server URL
- ComfyUI connection check
- Checkpoint/model selector loaded from ComfyUI
- Settings page with saved local defaults and diagnostics
- Session history for recent generated images
- `txt2img-basic` workflow generation
- `img2img-basic` workflow generation foundation
- Active-layer source capture and ComfyUI image upload
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
packages/openlayer-v0.2.0-alpha.zip
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
4. Click `Capture Active Layer`.
5. Confirm the source preview appears.
6. Enter a prompt describing how to reinterpret the source.
7. Choose a checkpoint and keep the workflow set to `img2img-basic`.
8. Click `Generate Image to Image`.
9. Wait for the result preview.
10. Click `Import Image to Image Result`.

The imported layer is named like:

```text
OpenLayer_Img2Img_YYYYMMDD_HHMM
```

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

Image to Image uses Photoshop's UXP Imaging API to capture the active layer and sends the source image to ComfyUI using `/upload/image`. In `v0.2.0-alpha`, that source capture is encoded as JPEG. True PNG layer export, mask export, and selection-aligned workflows are planned future work.

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
