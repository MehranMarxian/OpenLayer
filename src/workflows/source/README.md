# OpenLayer Source Workflows

This folder is for ComfyUI GUI-editable workflow exports.

OpenLayer uses two workflow formats:

- `src/workflows/source/*.workflow.json`: human-editable ComfyUI GUI workflows.
- `src/workflows/api/*.json`: ComfyUI API-format workflows that OpenLayer can submit to `/prompt`.

When adding a new workflow:

1. Build and test the graph in the ComfyUI browser UI.
2. Save the editable GUI workflow in this folder.
3. Export the API workflow JSON from ComfyUI.
4. Save the runnable API JSON in `src/workflows/api/`.
5. Update `src/comfy/presetRegistry.ts` with exact node IDs and injection targets.

Do not enable a preset in OpenLayer until its API workflow exists and passes local node validation.

## Z_image_Turbo Notes

This source folder includes the user-provided Z_image_Turbo GUI workflows as references:

- `txt2img-z-image-turbo.workflow.json`
- `img2img-z-image-turbo.workflow.json`

The runnable OpenLayer API versions are in `src/workflows/api/`. If the GUI workflows are edited in ComfyUI, export matching API workflows and update `src/comfy/presetRegistry.ts` node mappings before relying on them.

## Prompt From Layer Notes

`prompt-from-layer-florence2.workflow.json` is the GUI-editable Florence-2 PromptGen workflow for the Prompt from Layer tool.

The runnable API version is in `src/workflows/api/prompt-from-layer-florence2.json`. It uses Florence2ModelLoader, LoadImage, Florence2Run, and ShowText to return caption text through ComfyUI history. If this source workflow is edited in ComfyUI, export a matching API workflow and update `src/comfy/presetRegistry.ts` node mappings before relying on it.

## Flux Fill Notes

`inpaint-flux-fill-basic.workflow.json` is the GUI-editable reference workflow used to rebuild the experimental Flux Fill API workflow.

The runnable API version is in `src/workflows/api/inpaint-flux-fill-basic.json`. If this source workflow is edited in ComfyUI, export a matching API workflow and update `src/comfy/presetRegistry.ts` node mappings before relying on it.

## Flux Fill Outpaint Notes

`outpaint-flux-fill-basic.workflow.json` is the GUI-editable reference workflow for the experimental Outpaint tool.

The runnable API version is in `src/workflows/api/outpaint-flux-fill-basic.json`. It uses ImagePadForOutpaint to expand the captured source before Flux Fill sampling. If this source workflow is edited in ComfyUI, export a matching API workflow and update `src/comfy/presetRegistry.ts` node mappings before relying on it.
