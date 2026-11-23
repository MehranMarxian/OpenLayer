/*
 * Ported from Geekatplay Photoshop Bridge, tests/convert.test.js at commit da5c617
 * (https://github.com/GeekatplayStudio/ComfyUI-Photoshop), by Geekatplay Studio -
 * Vladimir Chopine (https://www.geekatplay.com).
 *
 * MIT License
 *
 * Copyright (c) 2026 Geekatplay Studio - Vladimir Chopine
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Changed in the port: Vitest instead of node:test, toStrictEqual for
 * node:assert/strict's deepEqual, and Geekatplay's own node classes renamed to
 * neutral ones (OpenLayer ships no node pack).
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ConversionError,
  convertUiWorkflow,
  ObjectInfo,
  processDynamicPrompt,
  UiNode,
  UiWorkflow,
  uiNodeTypes,
  widgetLayout
} from "../../../src/comfy/customWorkflow/convert";

const FIXTURES = resolve(__dirname, "../../fixtures/customWorkflow/geekatplay");
const DEFS = JSON.parse(readFileSync(resolve(FIXTURES, "object_info.json"), "utf8")) as ObjectInfo;
const read = (name: string) => JSON.parse(readFileSync(resolve(FIXTURES, name), "utf8"));

/**
 * Test 1 of the v0.50 spike: every GUI/API pair Geekatplay recorded must
 * convert to exactly its API twin, values included. The pinned commit ships 10
 * pairs (the v0.50 plan said 13; it miscounted).
 */
const PAIRS = readdirSync(FIXTURES)
  .filter((file) => file.endsWith(".api.json"))
  .map((file) => file.slice(0, -".api.json".length))
  .sort();

describe("converter, exact values: Geekatplay's frontend 1.53.10 pairs", () => {
  it("has the 10 pairs of commit da5c617", () => {
    expect(PAIRS).toHaveLength(10);
  });

  for (const name of PAIRS) {
    it(`converts ${name} like the ComfyUI frontend`, () => {
      expect(convertUiWorkflow(read(`${name}.json`) as UiWorkflow, DEFS).prompt).toStrictEqual(read(`${name}.api.json`));
    });
  }

  it("exposed inputs: promoted subgraph widgets, nested ones and titled primitives", () => {
    const depth = convertUiWorkflow(read("flux_depth_lora_example.json") as UiWorkflow, DEFS).exposed;
    const keys = depth.map((e) => `${e.id}/${e.key}`);
    expect(keys).toContain("150:3/seed");
    expect(keys).toContain("150:41:101/sigma");
    expect(depth.find((e) => e.key === "seed")).toStrictEqual({ id: "150:3", key: "seed", label: "seed", group: "Depth to Image(Flux.1 Dev)" });
    expect(depth.find((e) => e.key === "sigma")?.group).toBe("Lotus Depth(Subgraph)");

    const relight = convertUiWorkflow(read("templates-product_scene_relight.json") as UiWorkflow, DEFS).exposed;
    expect(relight.map((e) => e.label)).toStrictEqual(["Describe the Product", "Prompt Template"]);
  });
});

const defs: ObjectInfo = {
  LoadImage: { input: { required: { image: [["a.png"], { image_upload: true }] } }, input_order: { required: ["image"] }, display_name: "Load Image" },
  PrimitiveStringMultiline: { input: { required: { value: ["STRING", { multiline: true }] } }, input_order: { required: ["value"] }, display_name: "String (Multiline)" },
  CLIPTextEncode: {
    input: { required: { text: ["STRING", { multiline: true, dynamicPrompts: true }], clip: ["CLIP"] } },
    input_order: { required: ["text", "clip"] },
    display_name: "CLIP Text Encode (Prompt)"
  },
  KSampler: {
    input: { required: { model: ["MODEL"], seed: ["INT", { default: 0 }], steps: ["INT", { default: 20 }], sampler_name: [["euler", "dpmpp_2m"]] } },
    input_order: { required: ["model", "seed", "steps", "sampler_name"] },
    display_name: "KSampler"
  },
  CheckpointLoaderSimple: { input: { required: { ckpt_name: [["a.safetensors"]] } }, input_order: { required: ["ckpt_name"] }, display_name: "Load Checkpoint" },
  SaveImage: {
    input: { required: { images: ["IMAGE"], filename_prefix: ["STRING", { default: "ComfyUI" }] } },
    input_order: { required: ["images", "filename_prefix"] },
    display_name: "Save Image"
  },
  Load3D: { input: { required: { width: ["INT", {}] } }, input_order: { required: ["width"] }, display_name: "Load 3D" }
};

const node = (id: number, type: string, extra: Partial<UiNode> = {}): UiNode => ({ id, type, mode: 0, inputs: [], outputs: [], ...extra });

describe("converter, ported unit cases", () => {
  it("widget layout follows the frontend: seed control slot, upload button last", () => {
    expect(widgetLayout(defs.KSampler!, () => undefined).map((w) => w?.name ?? null)).toStrictEqual(["seed", null, "steps", "sampler_name"]);
    expect(widgetLayout(defs.LoadImage!, () => undefined).map((w) => w?.name ?? null)).toStrictEqual(["image", null]);
  });

  it("converts a workflow with widget values and links", () => {
    const ui: UiWorkflow = {
      last_node_id: 3,
      nodes: [
        node(1, "CheckpointLoaderSimple", { outputs: [{ type: "MODEL", links: [1] }], widgets_values: ["a.safetensors"] }),
        node(2, "KSampler", { inputs: [{ name: "model", type: "MODEL", link: 1 }], widgets_values: [42, "randomize", 30, "dpmpp_2m"] }),
        node(3, "LoadImage", { widgets_values: ["layer.png", "image"] }),
        node(4, "Note", { widgets_values: ["just a note"] })
      ],
      links: [[1, 1, 0, 2, 0, "MODEL"]]
    };
    expect(convertUiWorkflow(ui, defs).prompt).toStrictEqual({
      1: { inputs: { ckpt_name: "a.safetensors" }, class_type: "CheckpointLoaderSimple", _meta: { title: "Load Checkpoint" } },
      2: { inputs: { seed: 42, steps: 30, sampler_name: "dpmpp_2m", model: ["1", 0] }, class_type: "KSampler", _meta: { title: "KSampler" } },
      3: { inputs: { image: "layer.png" }, class_type: "LoadImage", _meta: { title: "Load Image" } }
    });
  });

  it("a stale link reference falls back to the link that ends at the input", () => {
    const ui: UiWorkflow = {
      nodes: [
        node(1, "CheckpointLoaderSimple", { outputs: [{ type: "MODEL", links: [7] }], widgets_values: ["a.safetensors"] }),
        node(2, "KSampler", { inputs: [{ name: "model", type: "MODEL", link: 99 }], widgets_values: [1, "fixed", 20, "euler"] }),
        node(3, "KSampler", { widgets_values: [1, "fixed", 20, "euler"] })
      ],
      links: [
        [99, 1, 0, 3, 0, "MODEL"],
        [7, 1, 0, 2, 0, "MODEL"]
      ]
    };
    expect(convertUiWorkflow(ui, defs).prompt[2].inputs.model).toStrictEqual(["1", 0]);
  });

  it("Set/Get nodes, reroutes and primitives resolve to real nodes and values", () => {
    const ui: UiWorkflow = {
      nodes: [
        node(1, "CheckpointLoaderSimple", { outputs: [{ type: "MODEL", links: [1] }], widgets_values: ["a.safetensors"] }),
        node(2, "SetNode", { inputs: [{ name: "MODEL", type: "MODEL", link: 1 }], widgets_values: ["model"] }),
        node(3, "GetNode", { outputs: [{ type: "MODEL", links: [2] }], widgets_values: ["model"] }),
        node(4, "Reroute", { inputs: [{ name: "", type: "*", link: 2 }], outputs: [{ type: "MODEL", links: [3] }] }),
        node(5, "PrimitiveNode", { outputs: [{ type: "INT", links: [4], widget: { name: "steps" } }], widgets_values: [12, "fixed"] }),
        node(6, "KSampler", {
          inputs: [
            { name: "model", type: "MODEL", link: 3 },
            { name: "steps", type: "INT", widget: { name: "steps" }, link: 4 }
          ],
          widgets_values: [5, "fixed", 20, "euler"]
        })
      ],
      links: [
        [1, 1, 0, 2, 0, "MODEL"],
        [2, 3, 0, 4, 0, "MODEL"],
        [3, 4, 0, 6, 0, "MODEL"],
        [4, 5, 0, 6, 1, "INT"]
      ]
    };
    const prompt = convertUiWorkflow(ui, defs).prompt;
    expect(Object.keys(prompt).sort()).toStrictEqual(["1", "6"]);
    expect(prompt[6].inputs).toStrictEqual({ seed: 5, steps: 12, sampler_name: "euler", model: ["1", 0] });
  });

  it("muted nodes drop out and bypassed nodes pass their input through", () => {
    const ui: UiWorkflow = {
      nodes: [
        node(1, "CheckpointLoaderSimple", { outputs: [{ type: "MODEL", links: [1] }], widgets_values: ["a.safetensors"] }),
        node(2, "KSampler", { mode: 4, inputs: [{ name: "model", type: "MODEL", link: 1 }], outputs: [{ type: "MODEL", links: [2] }], widgets_values: [1, "fixed", 1, "euler"] }),
        node(3, "KSampler", { inputs: [{ name: "model", type: "MODEL", link: 2 }], widgets_values: [1, "fixed", 1, "euler"] }),
        node(4, "KSampler", { mode: 2, outputs: [{ type: "MODEL", links: [3] }], widgets_values: [1, "fixed", 1, "euler"] }),
        node(5, "KSampler", { inputs: [{ name: "model", type: "MODEL", link: 3 }], widgets_values: [1, "fixed", 1, "euler"] })
      ],
      links: [
        [1, 1, 0, 2, 0, "MODEL"],
        [2, 2, 0, 3, 0, "MODEL"],
        [3, 4, 0, 5, 0, "MODEL"]
      ]
    };
    const prompt = convertUiWorkflow(ui, defs).prompt;
    expect(Object.keys(prompt).sort()).toStrictEqual(["1", "3", "5"]);
    expect(prompt[3].inputs.model).toStrictEqual(["1", 0]);
    expect(prompt[5].inputs.model).toBeUndefined();
  });

  it("dynamic prompts are processed like the frontend", () => {
    expect(processDynamicPrompt("a {red|blue} fox // comment", () => 0.9)).toBe("a blue fox ");
    const ui: UiWorkflow = { nodes: [node(1, "CLIPTextEncode", { widgets_values: ["a {cute|fluffy} fennec girl"] })], links: [] };
    expect(convertUiWorkflow(ui, defs, () => 0).prompt[1].inputs.text).toBe("a cute fennec girl");
  });

  it("missing nodes: leaf nodes are skipped and reported, needed ones fail clearly", () => {
    const leaf: UiWorkflow = { nodes: [node(1, "LoadImage", { widgets_values: ["x.png"] }), node(2, "Fast Groups Bypasser (rgthree)")], links: [] };
    expect(convertUiWorkflow(leaf, defs).skipped).toStrictEqual(["Fast Groups Bypasser (rgthree)"]);
    const needed: UiWorkflow = {
      nodes: [node(1, "MissingLoader", { outputs: [{ type: "MODEL", links: [1] }] }), node(2, "KSampler", { inputs: [{ name: "model", type: "MODEL", link: 1 }] })],
      links: [[1, 1, 0, 2, 0, "MODEL"]]
    };
    expect(() => convertUiWorkflow(needed, defs)).toThrow(ConversionError);
    expect(() => convertUiWorkflow(needed, defs)).toThrow(/MissingLoader.*not installed/);
  });

  it("nodes the converter cannot read and legacy group nodes are refused", () => {
    expect(() => convertUiWorkflow({ nodes: [node(1, "Load3D", { widgets_values: [512] })], links: [] }, defs)).toThrow(/Export \(API\)/);
    expect(() => convertUiWorkflow({ nodes: [], links: [], extra: { groupNodes: { g: {} } } }, defs)).toThrow(/group nodes/);
  });

  it("uiNodeTypes lists the classes inside subgraphs, not the subgraph ids", () => {
    const ui: UiWorkflow = {
      nodes: [node(1, "sub-1"), node(2, "KSampler")],
      links: [],
      definitions: { subgraphs: [{ id: "sub-1", nodes: [node(3, "CLIPTextEncode")], links: [] }] }
    };
    expect(uiNodeTypes(ui).sort()).toStrictEqual(["CLIPTextEncode", "KSampler"]);
  });
});
