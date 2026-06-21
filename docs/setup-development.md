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

`npm run package` zips the contents of `dist` into `packages/openlayer-v0.1.0.zip`.

## ComfyUI Workflow Development

The starter workflow is:

```text
src/workflows/txt2img-basic.json
```

The injection logic is:

```text
src/comfy/workflowBuilder.ts
```

When replacing the workflow with one exported from ComfyUI, update the node IDs in `workflowBuilder.ts` so prompt, negative prompt, seed, size, steps, and cfg are written to the correct nodes.

## Photoshop Integration

The Photoshop boundary is intentionally small:

```text
src/photoshop/photoshopAdapter.ts
```

The v0.1 import path writes the generated image to a UXP temporary file, creates a session token, places the file into the active document, and renames the placed layer.

Future work should keep Photoshop-specific APIs inside this folder so ComfyUI and UI code remain testable.
