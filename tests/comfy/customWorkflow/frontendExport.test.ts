import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { convertUiWorkflow, ObjectInfo, UiWorkflow } from "../../../src/comfy/customWorkflow/convert";
import { findTargets, imageRoles } from "../../../src/comfy/customWorkflow/targets";
import { ComfyWorkflow } from "../../../src/comfy/types";

/**
 * Test 2 of the v0.50 spike: the converter, written against frontend 1.53,
 * on a fresh export from frontend 1.57.6 (ComfyUI 0.44.0). One stock template,
 * `image_flux.1_fill_dev_OneReward`, which also stands in for the Discussion 179
 * graph: a Flux Fill inpaint graph with a subgraph, a bypassed outpaint
 * subgraph, a bypassed SaveImage and two previews. Provenance in
 * tests/fixtures/customWorkflow/README.md.
 *
 * Finding: 1.57.6 writes `cnr_id` and `ver` (the node pack and its version)
 * into every node's `_meta`; 1.53.10 did not, and neither does the converter.
 * ComfyUI does not read `_meta` when it executes, so the graph that runs is
 * identical. Everything else matches exactly: ids, classes, titles, every
 * input value and every link.
 */
const FIXTURES = resolve(__dirname, "../../fixtures/customWorkflow");
const read = (path: string) => JSON.parse(readFileSync(resolve(FIXTURES, path), "utf8"));
const DEFS = read("object-info-raw.json") as ObjectInfo;
const NAME = "frontend-1.57.6/image_flux.1_fill_dev_OneReward";
const EXPORTED = read(`${NAME}.api.json`) as ComfyWorkflow;

/** The 1.57.6 export with the two `_meta` keys it added, and only those, removed. */
function withoutPackMeta(workflow: ComfyWorkflow): ComfyWorkflow {
  return Object.fromEntries(
    Object.entries(workflow).map(([id, node]) => {
      const meta: Record<string, unknown> = { ...node._meta };
      delete meta.cnr_id;
      delete meta.ver;
      return [id, { ...node, _meta: meta }];
    })
  );
}

describe("converter, exact values: frontend 1.57.6 export", () => {
  it("every node in the 1.57.6 export carries the new _meta keys", () => {
    for (const node of Object.values(EXPORTED)) {
      expect(Object.keys(node._meta ?? {}).sort()).toStrictEqual(["cnr_id", "title", "ver"]);
    }
  });

  it("the File > Export save converts to the File > Export (API) file, _meta pack keys aside", () => {
    const converted = convertUiWorkflow(read(`${NAME}.workflow.json`) as UiWorkflow, DEFS, () => 0);
    expect(converted.skipped).toStrictEqual([]);
    expect(converted.prompt).toStrictEqual(withoutPackMeta(EXPORTED));
  });

  it("the raw /templates file (what a template browser would fetch) converts to the same API file", () => {
    // The frontend rewrites the template on load (the two files differ), and
    // the converter still lands on the same graph from either.
    const template = read(`${NAME}.template.json`);
    expect(JSON.stringify(template)).not.toBe(JSON.stringify(read(`${NAME}.workflow.json`)));
    expect(convertUiWorkflow(template as UiWorkflow, DEFS, () => 0).prompt).toStrictEqual(withoutPackMeta(EXPORTED));
  });

  it("the finder sends the prompt into the inpaint subgraph's encoder and the layer into the one Load Image", () => {
    const ui = read(`${NAME}.workflow.json`) as UiWorkflow;
    const found = findTargets(convertUiWorkflow(ui, DEFS, () => 0).prompt, imageRoles(ui));
    expect(found.prompt.auto?.map((c) => `${c.id}.${c.key}`)).toStrictEqual(["108:23.text"]);
    expect(found.imageAuto?.id).toBe("17");
    expect(found.image.map((slot) => slot.id)).toStrictEqual(["17"]);
  });
});

describe("the Discussion 179 graph's GGUF loaders", () => {
  it("convert from the recorded definitions", () => {
    const ui: UiWorkflow = {
      nodes: [
        { id: 1, type: "UnetLoaderGGUF", mode: 0, outputs: [{ type: "MODEL", links: [] }], widgets_values: ["flux1-fill-dev-Q8_0.gguf"] },
        { id: 2, type: "DualCLIPLoaderGGUF", mode: 0, outputs: [{ type: "CLIP", links: [] }], widgets_values: ["clip_l.safetensors", "t5-v1_1-xxl-encoder-Q8_0.gguf", "flux"] }
      ],
      links: []
    };
    expect(convertUiWorkflow(ui, DEFS).prompt).toStrictEqual({
      1: { inputs: { unet_name: "flux1-fill-dev-Q8_0.gguf" }, class_type: "UnetLoaderGGUF", _meta: { title: "Unet Loader (GGUF)" } },
      2: {
        inputs: { clip_name1: "clip_l.safetensors", clip_name2: "t5-v1_1-xxl-encoder-Q8_0.gguf", type: "flux" },
        class_type: "DualCLIPLoaderGGUF",
        _meta: { title: "DualCLIPLoader (GGUF)" }
      }
    });
  });
});
