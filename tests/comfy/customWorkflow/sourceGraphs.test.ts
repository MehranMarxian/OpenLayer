import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { convertUiWorkflow, ObjectInfo, UiWorkflow, uiNodeTypes } from "../../../src/comfy/customWorkflow/convert";
import { listWorkflowPresets } from "../../../src/comfy/presetRegistry";
import { ComfyWorkflow } from "../../../src/comfy/types";
import {
  compareWorkflowToSource,
  formatEquivalenceReport,
  SourceWorkflowGraph,
  SourceWorkflowLink,
  SourceWorkflowNode
} from "../../../src/comfy/workflowSourceEquivalence";

/**
 * Test 3 of the v0.50 spike: convert every `src/workflows/source/*.workflow.json`
 * and compare the result with its `src/workflows/api/` twin, using
 * compareWorkflowToSource. Structure only: node classes, how many of each, and
 * class-typed connections. Values and ids are never compared, on purpose: the
 * twins never had to agree on them (some sources are hand-authored, and
 * OpenLayer injects the values at submit time anyway).
 *
 * compareWorkflowToSource takes (API, editor graph), so the converted API graph
 * is wrapped back into the editor shape below. Because the converter has
 * already resolved reroutes, bypassed nodes and subgraphs, the connections are
 * compared for every graph, including the ones whose raw sources make
 * workflowSourceEquivalence.test.ts fall back to an inventory-only check.
 */
const SRC = resolve(__dirname, "../../../src");
const DEFS = JSON.parse(readFileSync(resolve(__dirname, "../../fixtures/customWorkflow/object-info-raw.json"), "utf8")) as ObjectInfo;
const FRONTEND_ONLY = new Set(["Note", "MarkdownNote", "Reroute", "PrimitiveNode"]);

/** An API graph in the editor shape compareWorkflowToSource reads: integer ids, named inputs, link tuples. */
function asSourceGraph(api: ComfyWorkflow): SourceWorkflowGraph {
  const numberOf = new Map(Object.keys(api).map((id, index) => [id, index + 1]));
  const links: SourceWorkflowLink[] = [];
  const nodes: SourceWorkflowNode[] = Object.entries(api).map(([id, node]) => {
    const target = numberOf.get(id) as number;
    const inputs = Object.entries(node.inputs).map(([name, value], slot) => {
      const origin = Array.isArray(value) && value.length === 2 && typeof value[0] === "string" ? numberOf.get(value[0]) : undefined;
      if (origin === undefined) return { name, link: null };
      const linkId = links.length + 1;
      links.push([linkId, origin, value[1] as number, target, slot]);
      return { name, link: linkId };
    });
    return { id: target, type: node.class_type, mode: 0, inputs };
  });
  return { nodes, links };
}

const pairs = listWorkflowPresets()
  .filter((preset) => preset.sourceWorkflowFile && existsSync(resolve(SRC, preset.sourceWorkflowFile)))
  .map((preset) => ({
    id: preset.id,
    api: JSON.parse(readFileSync(resolve(SRC, preset.workflowFile), "utf8")) as ComfyWorkflow,
    source: JSON.parse(readFileSync(resolve(SRC, preset.sourceWorkflowFile as string), "utf8")) as UiWorkflow
  }));

describe("converter, structure only: every bundled source graph against its API twin", () => {
  it("covers the 31 source graphs", () => {
    expect(pairs).toHaveLength(31);
  });

  it("has a definition for every class the source graphs use, so no graph is skipped", () => {
    const missing = new Set(
      pairs.flatMap((pair) => uiNodeTypes(pair.source).filter((type) => !DEFS[type] && !FRONTEND_ONLY.has(type)))
    );
    expect([...missing]).toStrictEqual([]);
  });

  for (const pair of pairs) {
    it(`${pair.id} converts to its API twin's structure`, () => {
      const converted = convertUiWorkflow(pair.source, DEFS, () => 0);
      expect(converted.skipped).toStrictEqual([]);
      const report = compareWorkflowToSource(pair.api, asSourceGraph(converted.prompt));
      expect(report.notes).toStrictEqual([]); // connections were compared, not skipped
      expect(report.equivalent, formatEquivalenceReport(pair.id, report)).toBe(true);
    });
  }

  it("the wrapper keeps the check honest: a rewired or missing node is still reported", () => {
    const pair = pairs.find((entry) => entry.id === "img2img-basic");
    if (!pair) throw new Error("img2img-basic has no source pair");
    const converted = convertUiWorkflow(pair.source, DEFS, () => 0).prompt;

    const [samplerId] = Object.entries(converted).find(([, node]) => node.class_type === "KSampler") ?? [];
    const [encodeId] = Object.entries(converted).find(([, node]) => node.class_type === "VAEEncode") ?? [];
    expect(samplerId && encodeId).toBeTruthy();
    const copy = () => JSON.parse(JSON.stringify(converted)) as ComfyWorkflow;
    expect(compareWorkflowToSource(pair.api, asSourceGraph(copy())).equivalent).toBe(true);

    // Same node classes, one connection moved to a different class.
    const rewired = copy();
    rewired[samplerId as string].inputs.latent_image = [encodeId as string, 0];
    rewired[samplerId as string].inputs.positive = [encodeId as string, 0];
    expect(compareWorkflowToSource(pair.api, asSourceGraph(rewired)).equivalent).toBe(false);

    const unlinked = copy();
    delete unlinked[samplerId as string].inputs.positive;
    expect(compareWorkflowToSource(pair.api, asSourceGraph(unlinked)).equivalent).toBe(false);

    const dropped = copy();
    delete dropped[samplerId as string];
    expect(compareWorkflowToSource(pair.api, asSourceGraph(dropped)).equivalent).toBe(false);
  });
});
