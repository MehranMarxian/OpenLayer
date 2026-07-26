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

## The API file is canonical

The API workflow is what OpenLayer submits and what `presetRegistry.ts` maps node ids against. The
source beside it is a **reference for humans**, not an input to anything the plugin does.

That direction matters when editing. Re-exporting an API workflow from an edited source renumbers
every node id, which silently breaks the registry's injection targets. If a graph genuinely needs to
change: edit it in ComfyUI, export **both** files, and update the registry's node ids to match the
new API export.

## What checks these against each other

- `tests/comfy/workflowSourceEquivalence.test.ts` compares each **source against its API twin**.
- `tests/comfy/workflowFiles.test.ts` compares each **API workflow against the preset registry**
  mapping. It does not look at source files.

The equivalence check compares **structure**: which node classes are present, how many of each, and
how they are wired. It ignores node ids, because the two formats never agreed on them — `upscale-basic`
is hand-authored with ids 1-4 against the API's 9-12, while `prompt-from-layer-florence2` is a real
export whose ids match, and both are fine.

It deliberately ignores **widget values**. OpenLayer injects prompts, seeds, dimensions, model names,
steps, CFG and denoise at submit time, so the numbers in both files are placeholders that were never
required to agree. Comparing them would fail constantly for no defect, and a check that cries wolf
gets switched off.

Connections are not compared when a source uses subgraphs, reroute/primitive nodes, or bypassed
nodes — each of those is collapsed or rewritten by the API export, so comparing edges naively would
report differences that are not there. Node inventory is still compared in all three cases, and the
report says which limitation applied.

`npm run setup-pack` runs the same check and refuses to advertise a source that fails it. A file
people would open, edit, and export from is worse than no file at all if it describes a different
graph.

### Known mismatch

`img2img-z-image-turbo.workflow.json` does **not** match its API workflow. It is the vendor's Z-Image
*text-to-image* demo — `EmptySD3LatentImage`, `ConditioningZeroOut`, a bypassed LoRA loader — rather
than the image-to-image graph OpenLayer submits, which loads an image and VAE-encodes it. It is
recorded in `KNOWN_MISMATCHES` in the equivalence test and omitted from the setup pack's
`REQUIREMENTS.md` until someone exports the real graph.

## Z_image_Turbo Notes

This source folder includes the user-provided Z_image_Turbo GUI workflows as references:

- `txt2img-z-image-turbo.workflow.json`
- `img2img-z-image-turbo.workflow.json`

The runnable OpenLayer API versions are in `src/workflows/api/`. If the GUI workflows are edited in ComfyUI, export matching API workflows and update `src/comfy/presetRegistry.ts` node mappings before relying on them.

## Prompt From Layer Notes

`prompt-from-layer-florence2.workflow.json` is the GUI-editable Florence-2 PromptGen workflow for the Prompt from Layer tool.

The runnable API version is in `src/workflows/api/prompt-from-layer-florence2.json`. It uses Florence2ModelLoader, LoadImage, Florence2Run, and core ComfyUI's PreviewAny to return caption text through ComfyUI history. The `ShowText|pysssss` and `SaveText|pysssss` nodes this graph used to carry were removed so the preset needs no `comfyui-custom-scripts` install; PreviewAny was already wired to the same caption output. If this source workflow is edited in ComfyUI, export a matching API workflow and update `src/comfy/presetRegistry.ts` node mappings before relying on it.

## Flux Fill Notes

`inpaint-flux-fill-basic.workflow.json` is the GUI-editable reference workflow used to rebuild the experimental Flux Fill API workflow.

The runnable API version is in `src/workflows/api/inpaint-flux-fill-basic.json`. If this source workflow is edited in ComfyUI, export a matching API workflow and update `src/comfy/presetRegistry.ts` node mappings before relying on it.

## Flux Fill Outpaint Notes

`outpaint-flux-fill-basic.workflow.json` is the GUI-editable reference workflow for the experimental Outpaint tool.

The runnable API version is in `src/workflows/api/outpaint-flux-fill-basic.json`. It uses ImagePadForOutpaint to expand the captured source before Flux Fill sampling. If this source workflow is edited in ComfyUI, export a matching API workflow and update `src/comfy/presetRegistry.ts` node mappings before relying on it.
