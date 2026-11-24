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

### The PR 4 gate (recorded 2026-11-24, same ComfyUI 0.44.0, frontend 1.57.6)

- `*.edited.workflow.json` and `*.edited.api.json`: the same template, with
  the prompt typed into the subgraph node's prompt box ("Replace the hat with a
  red wool scarf") and its seed typed into the seed widget's value box
  (424242), then File > Export and File > Export (API) from that state. Never
  Run, nothing queued. The template was opened with the frontend's own
  `app.loadGraphData` on `GET /templates/image_flux.1_fill_dev_OneReward.json`
  (no image upload). Apart from the two edits, the save matches
  `*.workflow.json` above, except for two empty Use Everywhere `extra` arrays.
  The save keeps the old values on the inner nodes 23 and 3; the export queues
  the new ones. SHA-256: `cefb636f...a07a2e19` (save), `24b3d315...17a01e2`
  (API).
- `z-image-proxy-host-edited.api.json`: what `app.graphToPrompt()` (the
  function File > Export (API) calls) returned for
  `src/workflows/source/txt2img-z-image-turbo.workflow.json` with the subgraph
  node's prompt set to "HOST TEXT" and steps to 9, and the inner prompt node
  set to "INNER TEXT" (the test makes the same edit). That save promotes its
  inputs as `["-1", name]` proxy widgets, and 1.57.6 queues the subgraph
  node's values. `cnr_id` and `ver` were removed from `_meta`, as the
  converter does not write them.

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

A preset added later may use a class this file lacks; `sourceGraphs.test.ts`
then lists and skips that graph. To record it, save a full `GET /object_info`
to a file and run the script below (read-only against ComfyUI, Node 20+):

```
node record-raw.mjs <object_info.json> <repo root> <template.json> tests/fixtures/customWorkflow/object-info-raw.json
```

<details>
<summary><code>record-raw.mjs</code>, the script that made this file</summary>

```js
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [full, repo, template, out] = process.argv.slice(2);
const objectInfo = JSON.parse(readFileSync(full, "utf8"));
// The Discussion 179 graph's loaders; that graph itself is not committed.
const need = new Set(["UnetLoaderGGUF", "DualCLIPLoaderGGUF"]);

const addGraph = (workflow) => {
  const subgraphIds = new Set((workflow.definitions?.subgraphs ?? []).map((s) => s.id));
  const walk = (graph) => {
    for (const node of graph.nodes ?? []) if (!subgraphIds.has(node.type)) need.add(node.type);
    for (const sub of graph.definitions?.subgraphs ?? []) walk(sub);
  };
  walk(workflow);
};
const sourceDir = join(repo, "src/workflows/source");
for (const file of readdirSync(sourceDir).filter((f) => f.endsWith(".workflow.json"))) {
  addGraph(JSON.parse(readFileSync(join(sourceDir, file), "utf8")));
}
addGraph(JSON.parse(readFileSync(template, "utf8")));

const FILE_LIKE = (v) => typeof v === "string" && /\.[a-z][a-z0-9_]{1,11}$/i.test(v);

const stripSpec = (name, spec) => {
  if (!Array.isArray(spec)) return spec;
  const [type, opts] = spec;
  const choices = Array.isArray(type) && type.some(FILE_LIKE) ? [] : type;
  let options = opts;
  if (opts && typeof opts === "object" && Array.isArray(opts.options)) {
    options = { ...opts };
    if (type === "COMFY_DYNAMICCOMBO_V3") {
      options.options = opts.options.map((o) => ({ ...o, inputs: stripInputs(o.inputs) }));
    } else if (opts.options.some(FILE_LIKE)) {
      options.options = [];
    }
  }
  return opts === undefined ? [choices] : [choices, options];
};
const stripInputs = (inputs) => {
  if (!inputs) return inputs;
  const result = { ...inputs };
  for (const group of ["required", "optional"]) {
    if (inputs[group]) {
      result[group] = Object.fromEntries(Object.entries(inputs[group]).map(([k, s]) => [k, stripSpec(k, s)]));
    }
  }
  return result;
};

const recorded = {};
for (const cls of [...need].sort()) {
  // Note and MarkdownNote are frontend-only and have no definition.
  if (objectInfo[cls]) recorded[cls] = { ...objectInfo[cls], input: stripInputs(objectInfo[cls].input) };
}
writeFileSync(out, JSON.stringify(recorded, null, 1) + "\n");
```

</details>
