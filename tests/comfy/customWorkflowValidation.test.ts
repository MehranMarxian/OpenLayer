import { describe, expect, it } from "vitest";
import {
  detectCustomWorkflowFormat,
  evaluateCustomWorkflow,
  listCustomWorkflowClassTypes,
  parseCustomWorkflowText
} from "../../src/comfy/customWorkflowValidation";
import { ComfyWorkflow } from "../../src/comfy/types";

const API_WORKFLOW: ComfyWorkflow = {
  "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "model.safetensors" } },
  "6": { class_type: "CLIPTextEncode", inputs: { text: "a cat", clip: ["4", 1] }, _meta: { title: "Positive" } }
};

const AVAILABILITY = {
  CheckpointLoaderSimple: ["ckpt_name"],
  CLIPTextEncode: ["text", "clip"]
};

describe("parseCustomWorkflowText", () => {
  it("accepts an API-format workflow", () => {
    const result = parseCustomWorkflowText(JSON.stringify(API_WORKFLOW));

    expect(result.ok).toBe(true);
    expect(result.ok && result.format).toBe("api");
  });

  it("asks for something before it complains about it", () => {
    const result = parseCustomWorkflowText("   ");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("Paste a ComfyUI workflow first.");
  });

  it("reports invalid JSON with the parser's own message as the hint", () => {
    const result = parseCustomWorkflowText("{ not json ");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("That is not valid JSON.");
    expect(result.ok === false && result.hint).toBeTruthy();
  });

  /**
   * The regression this exists for is a support burden, not a crash: ComfyUI's
   * plain Save writes the editor graph and only Export (API) writes what the
   * /prompt endpoint takes. Both are JSON full of familiar node names, so
   * without this branch the artist is told "no nodes found" about a file that
   * plainly contains their nodes.
   */
  it("tells an artist when they exported the editor file instead of the API one", () => {
    const uiExport = JSON.stringify({
      last_node_id: 9,
      last_link_id: 12,
      nodes: [{ id: 4, type: "CheckpointLoaderSimple", widgets_values: ["model.safetensors"] }],
      links: []
    });
    const result = parseCustomWorkflowText(uiExport);

    expect(result.ok).toBe(false);
    expect(result.format).toBe("ui");
    expect(result.ok === false && result.hint).toContain("Export (API)");
  });

  it("rejects JSON that is not a workflow at all", () => {
    expect(parseCustomWorkflowText("[1,2,3]").ok).toBe(false);
    expect(parseCustomWorkflowText('{"a":1}').ok).toBe(false);
    expect(parseCustomWorkflowText("{}").ok).toBe(false);
  });
});

describe("detectCustomWorkflowFormat", () => {
  it("separates the editor format from the API format", () => {
    expect(detectCustomWorkflowFormat({ nodes: [], links: [] })).toBe("ui");
    expect(detectCustomWorkflowFormat(API_WORKFLOW)).toBe("api");
    expect(detectCustomWorkflowFormat("nope")).toBe("unknown");
    expect(detectCustomWorkflowFormat(null)).toBe("unknown");
  });
});

describe("evaluateCustomWorkflow", () => {
  it("passes a graph whose every node the server has", () => {
    const report = evaluateCustomWorkflow(API_WORKFLOW, AVAILABILITY);

    expect(report.canRun).toBe(true);
    expect(report.nodeCount).toBe(2);
    expect(report.missingNodeClasses).toEqual([]);
    expect(report.summaryLine).toBe("All 2 nodes are available on this ComfyUI.");
  });

  it("names the node classes this ComfyUI does not have", () => {
    const report = evaluateCustomWorkflow(
      { "1": { class_type: "SomeCustomNode", inputs: {} } },
      AVAILABILITY
    );

    expect(report.canRun).toBe(false);
    expect(report.missingNodeClasses).toEqual(["SomeCustomNode"]);
    expect(report.nodes[0].status).toBe("missing-node");
    expect(report.summaryLine).toContain("1 node class is not installed");
  });

  it("flags a required input the graph never supplies", () => {
    const report = evaluateCustomWorkflow(
      { "6": { class_type: "CLIPTextEncode", inputs: { text: "a cat" } } },
      AVAILABILITY
    );

    expect(report.canRun).toBe(false);
    expect(report.nodes[0].status).toBe("missing-inputs");
    expect(report.nodes[0].missingInputs).toEqual(["clip"]);
  });

  /**
   * The availability map records only what ComfyUI marks *required*. Treating an
   * optional input as required is exactly the mistake documented on the Klein
   * edit preset, where it reported a graph that runs perfectly as broken.
   */
  it("never faults a node for omitting an optional input", () => {
    const report = evaluateCustomWorkflow(
      { "1": { class_type: "ReferenceLatent", inputs: { conditioning: ["6", 0] } } },
      { ReferenceLatent: ["conditioning"] }
    );

    expect(report.canRun).toBe(true);
    expect(report.nodes[0].missingInputs).toEqual([]);
  });

  it("counts an input supplied by a link as supplied", () => {
    const report = evaluateCustomWorkflow(API_WORKFLOW, AVAILABILITY);
    const encode = report.nodes.find((node) => node.classType === "CLIPTextEncode");

    // clip arrives as ["4", 1], a link rather than a literal. Still supplied.
    expect(encode?.missingInputs).toEqual([]);
  });

  it("carries the node's own title through for the report", () => {
    const report = evaluateCustomWorkflow(API_WORKFLOW, AVAILABILITY);

    expect(report.nodes.find((node) => node.nodeId === "6")?.title).toBe("Positive");
  });

  it("says something sensible about an empty graph", () => {
    const report = evaluateCustomWorkflow({}, AVAILABILITY);

    expect(report.nodeCount).toBe(0);
    expect(report.summaryLine).toBe("That workflow has no nodes.");
  });
});

describe("listCustomWorkflowClassTypes", () => {
  it("returns each class once, sorted, for asking the server about", () => {
    expect(listCustomWorkflowClassTypes(API_WORKFLOW)).toEqual([
      "CLIPTextEncode",
      "CheckpointLoaderSimple"
    ]);
  });
});
