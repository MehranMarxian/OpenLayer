# Custom ComfyUI Workflows

OpenLayer does not yet include a visual custom workflow importer. For now, custom workflows are developer-mapped.

## Current Structure

- `src/workflows/source/` contains GUI-editable ComfyUI workflow references.
- `src/workflows/api/` contains runnable API-format workflows sent to ComfyUI.

OpenLayer only submits API workflows.

## Why Mapping Is Required

When OpenLayer runs a workflow, it injects values into specific ComfyUI node IDs:

- prompt
- negative prompt
- checkpoint or model name
- source image name
- width and height
- seed
- steps
- CFG or guidance
- denoise
- ControlNet strength
- selection source image
- future grayscale selection mask image

Those node IDs are different in every custom workflow. The mapping lives in `src/comfy/presetRegistry.ts`.

## Inpaint Workflow Status

`inpaint-basic` is registered as a placeholder preset in `v0.4.0-alpha`, but it is not runnable yet.

The current Inpaint screen can capture Photoshop selection bounds and a selected-region PNG/lossless source image. A production inpaint workflow still needs:

- a verified ComfyUI API workflow JSON in `src/workflows/api/inpaint-basic.json`
- a GUI-editable source workflow in `src/workflows/source/inpaint-basic.workflow.json`
- injection targets for prompt, negative prompt, checkpoint, source image, mask image, seed, steps, CFG, and denoise
- a verified Photoshop UXP grayscale mask export path
- an aligned regional import path for placing results back over the original selection

Until those pieces are mapped, OpenLayer shows a friendly setup message instead of submitting a fake inpaint workflow.

## Safe Custom Workflow Process

1. Build and test the workflow in ComfyUI.
2. Save the GUI workflow into `src/workflows/source/`.
3. Export the API workflow JSON from ComfyUI.
4. Save the API workflow into `src/workflows/api/`.
5. Add or update a preset in `src/comfy/presetRegistry.ts`.
6. Map every injection target to the correct node ID and input name.
7. Add required node validation.
8. Run:

```bash
npm test
npm run build
```

9. Test inside Photoshop with ComfyUI running locally.

## Common Error Meaning

If OpenLayer says a workflow node or input is missing, the API workflow JSON and `presetRegistry.ts` mapping do not match. Re-export the API workflow or update the mapping.

Future v0.5 work should turn this into a guided importer so artists do not need to edit TypeScript manually.
