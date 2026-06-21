<p align="center">
  <img src="src/icons/openlayer.png" alt="OpenLayer icon" width="96" height="96">
</p>

# OpenLayer

Local AI layers for Photoshop.

OpenLayer is an open-source Adobe Photoshop UXP plugin that connects Photoshop to a locally running ComfyUI server. The v0.1 prototype focuses on one stable path: text-to-image generation, previewing the result, and importing that result into the active Photoshop document as a new editable layer.

## MVP Status

Working foundation:

- Photoshop UXP panel scaffold for Photoshop 2024+
- Dark, minimal UXP-friendly TypeScript UI
- Configurable local ComfyUI server URL
- ComfyUI connection check
- Checkpoint/model selector loaded from ComfyUI
- `txt2img-basic` workflow generation
- `/prompt` submission
- `/history/{prompt_id}` polling
- `/view` image retrieval
- Result preview in the panel
- Import result into the active Photoshop document as a new layer

Future placeholders are included for layer export, selection export, masks, selection alignment, and selection preservation.

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

This creates a zip package from `dist` in the `packages` folder.

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

OpenLayer uses port `8190` by default so it does not interfere with another plugin that may already be using ComfyUI on port `8188`. To keep that separation strong, the UXP manifest only permits OpenLayer to access `8190`.

If your other plugin is already using ComfyUI on `8188`, start a second ComfyUI instance for OpenLayer on `8190`, for example:

```bash
python main.py --listen 127.0.0.1 --port 8190
```

Click `Check ComfyUI` before generating.

## First Image

1. Open a Photoshop document.
2. Open the OpenLayer panel.
3. Click `Check ComfyUI` to load the available checkpoints.
4. Choose a checkpoint.
5. Enter a prompt.
6. Optionally enter a negative prompt.
7. Keep the workflow preset set to `txt2img-basic`.
8. Click `Generate`.
9. Wait for the preview.
10. Click `Import Result as New Layer`.

The imported layer is named like:

```text
OpenLayer_Generated_YYYYMMDD_HHMM
```

## Workflow Notes

The included workflow at `src/workflows/txt2img-basic.json` is a realistic starter ComfyUI workflow using common built-in nodes. You may need to replace the checkpoint name and node IDs for your own ComfyUI setup.

The workflow builder injects:

- prompt
- negative prompt
- width
- height
- seed
- steps
- cfg

If you export a different workflow from ComfyUI, update the node IDs in `src/comfy/workflowBuilder.ts`.

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
