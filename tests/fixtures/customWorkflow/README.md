# Custom workflow spike fixtures (v0.50 PR 1)

Read by `tests/comfy/customWorkflow/`. JSON cannot carry a header comment, so
the copyright notices for the copied files live here and in `geekatplay/LICENSE`.
Every copied JSON file is byte-identical to its source.

## `geekatplay/`

Copied unchanged from Geekatplay Photoshop Bridge, `tests/fixtures/convert/` at
commit `da5c617` (https://github.com/GeekatplayStudio/ComfyUI-Photoshop),
MIT License, Copyright (c) 2026 Geekatplay Studio - Vladimir Chopine. The full
licence text is in `geekatplay/LICENSE`, and their own `README.md` sits beside
the files.

The workflows themselves come from Comfy-Org's ComfyUI workflow templates package
(MIT). Each `*.api.json` is what ComfyUI frontend 1.53.10 queues for the
`*.json` next to it; `object_info.json` holds the node definitions they use.
That commit ships 10 pairs, not the 13 the v0.50 plan mentions.

## `frontend-1.57.6/`

One stock template, `image_flux.1_fill_dev_OneReward` (Comfy-Org workflow
templates package 0.11.101, MIT), recorded 2026-11-23 from ComfyUI 0.44.0 with
frontend 1.57.6. It is the stand-in for the Discussion 179 graph (a Flux Fill
inpaint graph), which is not committed.

- `*.template.json`: `GET /templates/image_flux.1_fill_dev_OneReward.json`, as
  the server ships it.
- `*.workflow.json`: the same template loaded in the frontend, then
  File > Export. It carries properties that extensions installed on the
  recording machine add to every node (Use Everywhere, SD-PPP, Video Helper
  Suite). That is realistic noise and the converter ignores it.
- `*.api.json`: File > Export (API) from the same graph state. Nothing was
  queued.

Both exports were taken through the menu, and their SHA-256 was checked against
the bytes the page produced.

## `object-info-raw.json`

Raw `GET /object_info` entries from ComfyUI 0.44.0 on 2026-11-23, 74 classes:
every class `src/workflows/source/*.workflow.json` and the template above use,
plus `UnetLoaderGGUF` and `DualCLIPLoaderGGUF` (the Discussion 179 graph's
loaders). The converter needs the raw shape (`input_order` and widget options
such as `control_after_generate`, `image_upload` and `forceInput`), which
`tests/fixtures/comfyui-object-info.json` does not keep. That file is left
untouched.

Every choice list with a file-like entry (a model, LoRA or input image name,
anything ending in an extension) is emptied, so no machine's files are recorded.
Each spec keeps its shape and options. The spike checked that every graph
converts to the same API graph with the full and with the emptied lists.
