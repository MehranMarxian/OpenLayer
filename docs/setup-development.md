# OpenLayer Development Notes

## Scripts

```bash
npm install
npm run dev
npm run build
npm run package
```

`npm run dev` starts Vite for UI iteration. Photoshop APIs are only available when the built plugin is loaded through UXP.

`npm run build` writes the production plugin to `dist` and copies UXP assets such as `manifest.json` and workflow JSON files.

`npm run package` zips the contents of `dist` into `packages/openlayer-v0.2.2-alpha.zip`.

## ComfyUI Workflow Development

The starter workflows are:

```text
src/workflows/api/txt2img-basic.json
src/workflows/api/img2img-basic.json
src/workflows/api/sketch2img-linecn-basic.json
```

OpenLayer separates runnable API workflows from GUI-editable source workflows:

```text
src/workflows/api/
src/workflows/source/
```

The injection logic is:

```text
src/comfy/workflowBuilder.ts
```

When replacing a workflow with one exported from ComfyUI, update the node IDs in `presetRegistry.ts` so prompt, negative prompt, seed, size, steps, cfg, denoise, and source image fields are written to the correct nodes.

## Photoshop Integration

The Photoshop boundary is intentionally small:

```text
src/photoshop/photoshopAdapter.ts
```

The import path writes the generated image to a UXP temporary file, creates a session token, places the file into the active document, and renames the placed layer.

The v0.2 Image to Image foundation captures the active layer through Photoshop's Imaging API and uploads that source image to ComfyUI. It is currently JPEG source capture only; true PNG layer export and mask workflows are future work.

Future work should keep Photoshop-specific APIs inside this folder so ComfyUI and UI code remain testable.
