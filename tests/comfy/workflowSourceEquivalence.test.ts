import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listWorkflowPresets } from "../../src/comfy/presetRegistry";
import {
  compareWorkflowToSource,
  formatEquivalenceReport,
  SourceWorkflowGraph
} from "../../src/comfy/workflowSourceEquivalence";
import { ComfyWorkflow } from "../../src/comfy/types";

const SRC_ROOT = resolve(__dirname, "../../src");

/**
 * Sources that do not match their API workflow, with the reason. Each entry is
 * a defect waiting on a re-export, not an exemption — the test asserts these
 * still mismatch, so fixing one fails here and forces the entry to be deleted
 * rather than left behind as a stale excuse.
 */
const KNOWN_MISMATCHES: Record<string, string> = {};

function loadPair(presetId: string, workflowFile: string, sourceWorkflowFile: string) {
  return {
    api: JSON.parse(readFileSync(resolve(SRC_ROOT, workflowFile), "utf8")) as ComfyWorkflow,
    source: JSON.parse(readFileSync(resolve(SRC_ROOT, sourceWorkflowFile), "utf8")) as SourceWorkflowGraph,
    presetId
  };
}

const pairs = listWorkflowPresets()
  .filter((preset) => preset.sourceWorkflowFile)
  .filter((preset) => existsSync(resolve(SRC_ROOT, preset.sourceWorkflowFile as string)))
  .filter((preset) => existsSync(resolve(SRC_ROOT, preset.workflowFile)))
  .map((preset) => loadPair(preset.id, preset.workflowFile, preset.sourceWorkflowFile as string));

describe("GUI source workflows match the API workflows OpenLayer submits", () => {
  it("has pairs to check", () => {
    expect(pairs.length).toBeGreaterThan(0);
  });

  for (const pair of pairs.filter((entry) => !(entry.presetId in KNOWN_MISMATCHES))) {
    it(`${pair.presetId} source matches its API workflow`, () => {
      const report = compareWorkflowToSource(pair.api, pair.source);

      // The formatted report is the failure message on purpose: "workflows
      // differ" is not something anyone can act on.
      expect(report.equivalent, formatEquivalenceReport(pair.presetId, report)).toBe(true);
    });
  }

  for (const [presetId, reason] of Object.entries(KNOWN_MISMATCHES)) {
    const pair = pairs.find((entry) => entry.presetId === presetId);

    it(`${presetId} is still the known mismatch it is recorded as`, () => {
      if (!pair) {
        throw new Error(`${presetId} has no source/API pair; delete its KNOWN_MISMATCHES entry`);
      }

      const report = compareWorkflowToSource(pair.api, pair.source);

      // Deliberately inverted. When the source is re-exported this fails, which
      // is the reminder to remove the entry above.
      expect(
        report.equivalent,
        `${presetId} now matches its API workflow — remove it from KNOWN_MISMATCHES. Reason recorded: ${reason}`
      ).toBe(false);
    });
  }

  it("accounts for every source workflow on disk", () => {
    // A source file no preset names is shipped in the setup pack, documented in
    // the source README, advertised in REQUIREMENTS.md by nothing, and checked
    // here by nothing. inpaint-flux-fill-basic was exactly that until its
    // sourceWorkflowFile was added to the registry.
    const onDisk = readdirSync(resolve(SRC_ROOT, "workflows/source"))
      .filter((name) => name.endsWith(".workflow.json"))
      .sort();
    const referenced = pairs
      .map((pair) => `${pair.presetId}.workflow.json`)
      .sort();

    expect(onDisk, "a source workflow on disk that no preset's sourceWorkflowFile names").toEqual(referenced);
  });
});

describe("the comparator itself", () => {
  const api: ComfyWorkflow = {
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "x.safetensors" } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: "hello", clip: ["4", 1] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "OpenLayer", images: ["6", 0] } }
  };

  const source: SourceWorkflowGraph = {
    nodes: [
      { id: 1, type: "CheckpointLoaderSimple", inputs: [] },
      { id: 2, type: "CLIPTextEncode", inputs: [{ name: "clip" }] },
      { id: 3, type: "SaveImage", inputs: [{ name: "images" }] }
    ],
    links: [
      [10, 1, 1, 2, 0, "CLIP"],
      [11, 2, 0, 3, 0, "IMAGE"]
    ]
  };

  it("matches graphs whose node ids disagree", () => {
    // The API file uses 4/6/9, the source 1/2/3. Both are legitimate: ComfyUI
    // renumbers whenever a graph is rebuilt.
    expect(compareWorkflowToSource(api, source).equivalent).toBe(true);
  });

  it("ignores widget values, which OpenLayer injects at submit time", () => {
    const retuned: ComfyWorkflow = {
      ...api,
      "6": { class_type: "CLIPTextEncode", inputs: { text: "something else entirely", clip: ["4", 1] } }
    };

    expect(compareWorkflowToSource(retuned, source).equivalent).toBe(true);
  });

  it("names the class and both counts when a node is missing from the source", () => {
    const withExtra: ComfyWorkflow = {
      ...api,
      "11": { class_type: "VAEEncode", inputs: { pixels: ["6", 0] } }
    };

    const report = compareWorkflowToSource(withExtra, source);

    expect(report.equivalent).toBe(false);
    expect(report.differences).toContain("node VAEEncode: the API workflow has 1, the source has 0");
  });

  it("reports a node the source has and the API workflow does not", () => {
    const withExtra: SourceWorkflowGraph = {
      ...source,
      nodes: [...(source.nodes ?? []), { id: 4, type: "LoraLoaderModelOnly", inputs: [] }]
    };

    const report = compareWorkflowToSource(api, withExtra);

    expect(report.differences).toContain("node LoraLoaderModelOnly: the source has 1, the API workflow has 0");
  });

  it("ignores annotation nodes, which never reach an API export", () => {
    const annotated: SourceWorkflowGraph = {
      ...source,
      nodes: [...(source.nodes ?? []), { id: 5, type: "MarkdownNote" }, { id: 6, type: "Note" }]
    };

    expect(compareWorkflowToSource(api, annotated).equivalent).toBe(true);
  });

  it("ignores muted and bypassed nodes, which do not execute", () => {
    const withBypassed: SourceWorkflowGraph = {
      ...source,
      nodes: [
        ...(source.nodes ?? []),
        { id: 7, type: "LoraLoaderModelOnly", mode: 4, inputs: [] },
        { id: 8, type: "UNETLoader", mode: 2, inputs: [] }
      ]
    };

    expect(compareWorkflowToSource(api, withBypassed).equivalent).toBe(true);
  });

  it("does not invent a missing connection around a bypassed node", () => {
    // A bypassed node passes its input through to its output, so the API export
    // shows its neighbours wired directly together. Dropping the node and its
    // links would report that direct edge as missing. Found by running this
    // against the real Z-Image source, which bypasses a LoRA loader between
    // UNETLoader and ModelSamplingAuraFlow.
    const bridged: SourceWorkflowGraph = {
      nodes: [
        { id: 1, type: "CheckpointLoaderSimple", inputs: [] },
        { id: 2, type: "LoraLoaderModelOnly", mode: 4, inputs: [{ name: "model" }] },
        { id: 3, type: "CLIPTextEncode", inputs: [{ name: "clip" }] },
        { id: 4, type: "SaveImage", inputs: [{ name: "images" }] }
      ],
      links: [
        [10, 1, 1, 2, 0, "CLIP"],
        [11, 2, 0, 3, 0, "CLIP"],
        [12, 3, 0, 4, 0, "IMAGE"]
      ]
    };

    const report = compareWorkflowToSource(api, bridged);

    expect(report.differences).toEqual([]);
    expect(report.notes.join(" ")).toContain("bypassed nodes");
  });

  it("catches a rewired connection even when every node is present", () => {
    // The failure mode the inventory check alone would miss, and the one that
    // matters most: inpaint-basic wiring SaveImage to the VAEDecode instead of
    // the composite would look plausible and be wrong.
    const rewired: SourceWorkflowGraph = {
      ...source,
      links: [
        [10, 1, 1, 2, 0, "CLIP"],
        [11, 1, 0, 3, 0, "IMAGE"]
      ]
    };

    const report = compareWorkflowToSource(api, rewired);

    expect(report.equivalent).toBe(false);
    expect(report.differences.join("\n")).toContain("connection CLIPTextEncode:0 -> SaveImage.images");
  });

  it("expands a subgraph rather than reporting its contents as missing", () => {
    const subgraphSource: SourceWorkflowGraph = {
      nodes: [
        { id: 1, type: "9b9009e4-2d3d-445f-9be5-6063f465757e" },
        { id: 2, type: "SaveImage", inputs: [{ name: "images" }] }
      ],
      links: [],
      definitions: {
        subgraphs: [
          {
            id: "9b9009e4-2d3d-445f-9be5-6063f465757e",
            name: "Text to Image(Z-Image-Base)",
            nodes: [
              { id: 10, type: "CheckpointLoaderSimple", inputs: [] },
              { id: 11, type: "CLIPTextEncode", inputs: [{ name: "clip" }] }
            ]
          }
        ]
      }
    };

    const report = compareWorkflowToSource(api, subgraphSource);

    expect(report.equivalent).toBe(true);
    expect(report.notes.join(" ")).toContain("Text to Image(Z-Image-Base)");
    // Links inside a subgraph cross a boundary the API export flattens.
    expect(report.notes.join(" ")).toContain("connections not compared");
  });
});
