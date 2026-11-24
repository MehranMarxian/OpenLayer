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
 * Finding 1: 1.57.6 writes `cnr_id` and `ver` (the node pack and its version)
 * into every node's `_meta`; 1.53.10 did not, and neither does the converter.
 * ComfyUI 0.44.0's core reads `_meta` only for the node title in validation
 * error messages (execution.py, validate_prompt), so the graph that runs is
 * the same. Everything else matches exactly: ids, classes, titles, every input
 * value and every link.
 *
 * Finding 2: 1.57.6 saves no `proxyWidgets`. Each widget promoted onto a
 * subgraph node becomes a real subgraph input, and its value is kept in the
 * subgraph node's own `widgets_values`, in input order. The converter reads
 * that through its "older saves" branch, so values convert; `exposed()` finds
 * nothing, which matters for v0.51's settings, not for v0.50.
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

  it("1.57.6 promotes widgets as subgraph inputs: values come from the subgraph node, exposed() is empty", () => {
    const template = read(`${NAME}.template.json`) as UiWorkflow;
    const saved = read(`${NAME}.workflow.json`) as UiWorkflow;
    expect(JSON.stringify(saved)).not.toContain("proxyWidgets");
    expect(convertUiWorkflow(template, DEFS, () => 0).exposed.map((e) => `${e.id}/${e.key}`)).toContain("108:23/text");
    expect(convertUiWorkflow(saved, DEFS, () => 0).exposed).toStrictEqual([]);

    // An artist's edit on the subgraph node is what converts, not the inner
    // node's stale copy. That the 1.57.6 frontend queues the edit the same way
    // is the PR 4 gate at the end of this file, on a real edited export.
    const edited = JSON.parse(JSON.stringify(saved)) as UiWorkflow;
    const host = edited.nodes.find((node) => node.id === 108);
    if (!host || !Array.isArray(host.widgets_values)) throw new Error("subgraph node 108 has no widget values");
    expect(host.widgets_values.slice(0, 2)).toStrictEqual(["Remove the girl's hat\n", 75154916226486]);
    host.widgets_values[0] = "a red scarf";
    host.widgets_values[1] = 7;
    const prompt = convertUiWorkflow(edited, DEFS, () => 0).prompt;
    expect(prompt["108:23"].inputs.text).toBe("a red scarf");
    expect(prompt["108:3"].inputs.seed).toBe(7);
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

describe("v0.50 PR 4 gate: frontend 1.57.6 queues an edited promoted value the way the converter reads it", () => {
  // Recorded 2026-11-24 (README): the OneReward template, prompt and seed
  // typed on the subgraph node, then File > Export and File > Export (API).
  const save = read(`${NAME}.edited.workflow.json`) as UiWorkflow;
  const exported = read(`${NAME}.edited.api.json`) as ComfyWorkflow;

  it("the edited save keeps stale copies inside the subgraph, and the export queues the edits", () => {
    const host = save.nodes.find((node) => node.id === 108);
    const inner = save.definitions?.subgraphs?.find((sub) => sub.id === host?.type)?.nodes ?? [];
    expect(Array.isArray(host?.widgets_values) && host.widgets_values.slice(0, 2)).toStrictEqual(["Replace the hat with a red wool scarf", 424242]);
    expect(inner.find((node) => node.id === 23)?.widgets_values).toStrictEqual(["Remove the girl's hat\n"]);
    expect(Array.isArray(inner.find((node) => node.id === 3)?.widgets_values) && (inner.find((node) => node.id === 3)?.widgets_values as unknown[])[0]).toBe(75154916226486);

    expect(exported["108:23"].inputs.text).toBe("Replace the hat with a red wool scarf");
    expect(exported["108:3"].inputs.seed).toBe(424242);
  });

  it("GO: the converted save equals the API export on every node, _meta pack keys aside", () => {
    const converted = convertUiWorkflow(save, DEFS, () => 0);
    expect(converted.skipped).toStrictEqual([]);
    expect(converted.prompt).toStrictEqual(withoutPackMeta(exported));
  });

  it("a save that promotes subgraph inputs as [\"-1\", name] sends the subgraph node's value, as 1.57.6 does", () => {
    // The bundled z-image source save uses this layout (frontend 1.38). Here
    // its two copies are made to differ; the frontend's own graphToPrompt
    // output for exactly this edit is the fixture.
    const ui = JSON.parse(readFileSync(resolve(__dirname, "../../../src/workflows/source/txt2img-z-image-turbo.workflow.json"), "utf8")) as UiWorkflow;
    const host = ui.nodes.find((node) => node.id === 76);
    if (!host || !Array.isArray(host.widgets_values)) throw new Error("subgraph node 76 has no widget values");
    host.widgets_values[0] = "HOST TEXT";
    host.widgets_values[3] = 9;
    const inner67 = ui.definitions?.subgraphs?.[0].nodes?.find((node) => node.id === 67);
    if (!inner67) throw new Error("no inner node 67");
    inner67.widgets_values = ["INNER TEXT"];

    const frontend = read("frontend-1.57.6/z-image-proxy-host-edited.api.json") as ComfyWorkflow;
    const converted = convertUiWorkflow(ui, DEFS, () => 0).prompt;

    expect(converted["76:67"].inputs.text).toBe("HOST TEXT");
    expect(converted["76:69"].inputs.steps).toBe(9);
    // One deliberate difference: 1.57.6 queues seed null for the direct
    // ["69", "seed"] proxy (its host slot is null), which ComfyUI would
    // reject. The converter keeps the inner seed, and the panel writes its
    // own seed over it anyway.
    expect(frontend["76:69"].inputs.seed).toBeNull();
    expect(converted["76:69"].inputs.seed).toBe(770044821593082);
    const frontendWithInnerSeed = JSON.parse(JSON.stringify(frontend)) as ComfyWorkflow;
    frontendWithInnerSeed["76:69"].inputs.seed = 770044821593082;
    expect(converted).toStrictEqual(frontendWithInnerSeed);
  });
});
