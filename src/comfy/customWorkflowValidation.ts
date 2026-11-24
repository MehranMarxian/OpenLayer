import { UiWorkflow } from "./customWorkflow/convert";
import { ComfyWorkflow } from "./types";
import { WorkflowNodeAvailability } from "./workflowCompatibility";

/**
 * Checking somebody else's ComfyUI workflow against this ComfyUI.
 *
 * This module says whether a graph *could* run here. Where the prompt and the
 * image go is the target finder's job (customWorkflow/targets.ts), which asks
 * instead of guessing; turning an editor save into a runnable graph is the
 * converter's (customWorkflow/convert.ts, called from customWorkflow/load.ts).
 *
 * Pure functions over parsed JSON plus a node-availability map, so every branch
 * is testable without a server.
 */

export type CustomWorkflowFormat = "api" | "ui" | "unknown";

export type CustomWorkflowParseResult =
  | { ok: true; workflow: ComfyWorkflow; format: "api" }
  | { ok: true; ui: UiWorkflow; format: "ui" }
  | { ok: false; format: CustomWorkflowFormat; reason: string; hint?: string };

export type CustomWorkflowNodeStatus = "ok" | "missing-node" | "missing-inputs";

export type CustomWorkflowNodeReport = {
  nodeId: string;
  classType: string;
  title?: string;
  status: CustomWorkflowNodeStatus;
  /** Required inputs ComfyUI declares that this graph never supplies. */
  missingInputs: readonly string[];
};

export type CustomWorkflowReport = {
  nodeCount: number;
  nodes: readonly CustomWorkflowNodeReport[];
  missingNodeClasses: readonly string[];
  canRun: boolean;
  summaryLine: string;
};

/**
 * Turns pasted text into a workflow of either format, or explains why not.
 *
 * ComfyUI's Save and Export write the editor graph; Export (API) writes what
 * the /prompt endpoint accepts. Until v0.50 the editor graph was refused here
 * with a "wrong export" hint. It is now returned as `ui` for the converter
 * (customWorkflow/load.ts), because that is the file artists actually have.
 */
export function parseCustomWorkflowText(text: string): CustomWorkflowParseResult {
  const trimmed = text.trim();

  if (!trimmed) {
    return { ok: false, format: "unknown", reason: "Paste a ComfyUI workflow first." };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch (caughtError) {
    return {
      ok: false,
      format: "unknown",
      reason: "That is not valid JSON.",
      hint: caughtError instanceof Error ? caughtError.message : String(caughtError)
    };
  }

  const format = detectCustomWorkflowFormat(parsed);

  if (format === "ui") {
    return { ok: true, ui: parsed as UiWorkflow, format };
  }

  if (format !== "api") {
    return {
      ok: false,
      format,
      reason: "That JSON does not look like a ComfyUI workflow.",
      hint: "Paste a workflow saved from ComfyUI with File > Save or File > Export, or one from File > Export (API)."
    };
  }

  return { ok: true, workflow: parsed as ComfyWorkflow, format };
}

export function detectCustomWorkflowFormat(value: unknown): CustomWorkflowFormat {
  if (!isPlainObject(value)) {
    return "unknown";
  }

  // The editor format is an object too, so it has to be ruled out by its own
  // fields before the API shape is tested.
  if (Array.isArray((value as Record<string, unknown>).nodes)) {
    return "ui";
  }

  const entries = Object.values(value as Record<string, unknown>);

  if (entries.length === 0) {
    return "unknown";
  }

  const looksLikeApi = entries.every(
    (entry) => isPlainObject(entry) && typeof (entry as Record<string, unknown>).class_type === "string"
  );

  return looksLikeApi ? "api" : "unknown";
}

/**
 * Compares a parsed graph against what this ComfyUI actually has.
 *
 * `availability` maps a class type to the inputs ComfyUI marks *required*, so
 * only those are checked. Flagging anything else would repeat the mistake
 * already documented on the Klein edit preset, where a check that treated an
 * optional input as required reported a working graph as broken.
 */
export function evaluateCustomWorkflow(
  workflow: ComfyWorkflow,
  availability: WorkflowNodeAvailability
): CustomWorkflowReport {
  const nodes: CustomWorkflowNodeReport[] = [];
  const missingNodeClasses = new Set<string>();

  for (const [nodeId, node] of Object.entries(workflow)) {
    const classType = node.class_type;
    const known = Object.prototype.hasOwnProperty.call(availability, classType);

    if (!known) {
      missingNodeClasses.add(classType);
      nodes.push({
        nodeId,
        classType,
        title: node._meta?.title,
        status: "missing-node",
        missingInputs: []
      });
      continue;
    }

    const supplied = new Set(Object.keys(node.inputs ?? {}));
    const missingInputs = (availability[classType] ?? []).filter((name) => !supplied.has(name));

    nodes.push({
      nodeId,
      classType,
      title: node._meta?.title,
      status: missingInputs.length > 0 ? "missing-inputs" : "ok",
      missingInputs
    });
  }

  const canRun = nodes.every((node) => node.status === "ok");

  return {
    nodeCount: nodes.length,
    nodes,
    missingNodeClasses: [...missingNodeClasses].sort(),
    canRun,
    summaryLine: createSummaryLine(nodes, missingNodeClasses.size)
  };
}

/** Every distinct node class a graph uses, for asking the server about them. */
export function listCustomWorkflowClassTypes(workflow: ComfyWorkflow): string[] {
  return [...new Set(Object.values(workflow).map((node) => node.class_type))].sort();
}

function createSummaryLine(nodes: readonly CustomWorkflowNodeReport[], missingClassCount: number) {
  if (nodes.length === 0) {
    return "That workflow has no nodes.";
  }

  const nodeWord = nodes.length === 1 ? "node" : "nodes";
  const incompleteCount = nodes.filter((node) => node.status === "missing-inputs").length;

  if (missingClassCount === 0 && incompleteCount === 0) {
    return `All ${nodes.length} ${nodeWord} are available on this ComfyUI.`;
  }

  const parts: string[] = [];

  if (missingClassCount > 0) {
    parts.push(
      missingClassCount === 1
        ? "1 node class is not installed"
        : `${missingClassCount} node classes are not installed`
    );
  }

  if (incompleteCount > 0) {
    parts.push(
      incompleteCount === 1
        ? "1 node is missing a required input"
        : `${incompleteCount} nodes are missing required inputs`
    );
  }

  return `${nodes.length} ${nodeWord} checked: ${parts.join(", ")}.`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
