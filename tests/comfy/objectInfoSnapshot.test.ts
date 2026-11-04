import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listWorkflowPresets } from "../../src/comfy/presetRegistry";

/**
 * Every preset against a recorded ComfyUI /object_info. Beta gate G1 (roadmap U2).
 *
 * The snapshot is written by `node scripts/object-info-snapshot.mjs` from a live
 * ComfyUI and holds only the node classes OpenLayer uses. When ComfyUI renames
 * a node or an input, re-recording the snapshot makes this test name every
 * preset it breaks -- before an artist finds it in Workflow Health. When a
 * preset starts using a new node, this test asks for the snapshot to be
 * recorded again.
 *
 * Re-record after updating ComfyUI:  node scripts/object-info-snapshot.mjs
 * Check a ComfyUI without recording:  node scripts/object-info-snapshot.mjs --check
 */

type InputSummary = {
  type: string;
  choices?: string[];
  nested?: Record<string, string[]>;
  names?: string[];
};

type Snapshot = {
  comfyuiVersion: string;
  recordedAt: string;
  missingClasses: string[];
  nodes: Record<string, { inputs: Record<string, InputSummary> }>;
};

const root = resolve(__dirname, "../..");
const snapshot = JSON.parse(readFileSync(join(root, "tests/fixtures/comfyui-object-info.json"), "utf8")) as Snapshot;
const apiDir = join(root, "src/workflows/api");
const workflows = readdirSync(apiDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({ name, graph: JSON.parse(readFileSync(join(apiDir, name), "utf8")) as Record<string, { class_type?: string; inputs?: Record<string, unknown> }> }));

/** Whether `input` (possibly "parent.child") exists on the recorded node. */
function hasInput(inputs: Record<string, InputSummary>, input: string): boolean {
  if (inputs[input]) return true;

  const dot = input.indexOf(".");
  if (dot < 0) return false;

  const parent = inputs[input.slice(0, dot)];
  const child = input.slice(dot + 1);

  if (parent?.nested) return Object.values(parent.nested).some((names) => names.includes(child));
  if (parent?.names) return parent.names.includes(child);
  return false;
}

describe("ComfyUI object_info snapshot", () => {
  it("was recorded with every node class OpenLayer uses installed", () => {
    expect(snapshot.missingClasses, `record it again from a ComfyUI with every node pack installed`).toEqual([]);
    expect(Object.keys(snapshot.nodes).length).toBeGreaterThan(0);
  });

  it("knows every node class in every bundled workflow", () => {
    const unknown = workflows.flatMap(({ name, graph }) =>
      Object.values(graph)
        .filter((node) => typeof node?.class_type === "string" && !snapshot.nodes[node.class_type])
        .map((node) => `${name}: ${node.class_type}`)
    );

    expect(unknown, "classes the snapshot lacks: record it again with node scripts/object-info-snapshot.mjs").toEqual([]);
  });

  it("has every input every bundled workflow sets, nested inputs included", () => {
    const missing = workflows.flatMap(({ name, graph }) =>
      Object.values(graph).flatMap((node) => {
        const recorded = node?.class_type ? snapshot.nodes[node.class_type] : undefined;
        if (!recorded) return [];
        return Object.keys(node.inputs ?? {})
          .filter((input) => !hasInput(recorded.inputs, input))
          .map((input) => `${name}: ${node.class_type}.${input}`);
      })
    );

    expect(missing).toEqual([]);
  });

  it("offers every fixed choice a bundled workflow uses, such as a sampler or scheduler", () => {
    // Model file names are left out of the snapshot on purpose (they differ per
    // machine), so only inputs with a recorded fixed list are checked. An empty
    // string is a placeholder the panel fills in at run time.
    const missing = workflows.flatMap(({ name, graph }) =>
      Object.values(graph).flatMap((node) => {
        const recorded = node?.class_type ? snapshot.nodes[node.class_type] : undefined;
        if (!recorded) return [];
        return Object.entries(node.inputs ?? {})
          .filter(([input, value]) => {
            const choices = recorded.inputs[input]?.choices;
            return choices && typeof value === "string" && value !== "" && !choices.includes(value);
          })
          .map(([input, value]) => `${name}: ${node.class_type}.${input} = "${String(value)}"`);
      })
    );

    expect(missing).toEqual([]);
  });

  it("has every node and input the preset registry requires", () => {
    const missing = listWorkflowPresets().flatMap((preset) =>
      preset.requiredNodes.flatMap((required) => {
        const recorded = snapshot.nodes[required.classType];
        if (!recorded) return [`${preset.id}: ${required.classType}`];
        return required.requiredInputs
          .filter((input) => !hasInput(recorded.inputs, input))
          .map((input) => `${preset.id}: ${required.classType}.${input}`);
      })
    );

    expect(missing).toEqual([]);
  });
});
