import { getWorkflowCapability } from "./workflowCapabilities";
import {
  evaluateWorkflowCompatibility,
  WorkflowCompatibilityContext,
  WorkflowCompatibilityIssue,
  WorkflowCompatibilityResult
} from "./workflowCompatibility";
import { WorkflowPresetDefinition } from "./types";

export type WorkflowHealthState =
  | "ready"
  | "experimental"
  | "missing-model"
  | "missing-node"
  | "missing-workflow"
  | "setup-required";

export type WorkflowHealthItem = {
  presetId: WorkflowPresetDefinition["id"];
  label: string;
  toolLabel: string;
  state: WorkflowHealthState;
  stateLabel: string;
  summary: string;
  detail: string;
  canRun: boolean;
};

export type WorkflowHealthReport = {
  items: WorkflowHealthItem[];
  summary: string;
  readyCount: number;
  issueCount: number;
};

const STATE_LABELS: Record<WorkflowHealthState, string> = {
  ready: "Ready",
  experimental: "Experimental",
  "missing-model": "Missing model",
  "missing-node": "Missing ComfyUI node",
  "missing-workflow": "Missing workflow JSON",
  "setup-required": "Setup required"
};

export function createWorkflowHealthReport(
  presets: readonly WorkflowPresetDefinition[],
  context: WorkflowCompatibilityContext = {}
): WorkflowHealthReport {
  const items = presets.map((preset) => createWorkflowHealthItem(preset, context));
  const readyCount = items.filter((item) => item.state === "ready" || item.state === "experimental").length;
  const issueCount = items.length - readyCount;

  return {
    items,
    readyCount,
    issueCount,
    summary: `${readyCount} of ${items.length} workflow presets are ready or available for testing.`
  };
}

export function createWorkflowHealthItem(
  preset: WorkflowPresetDefinition,
  context: WorkflowCompatibilityContext = {}
): WorkflowHealthItem {
  const capability = getWorkflowCapability(preset);
  const result = evaluateWorkflowCompatibility(preset, context);
  const state = chooseHealthState(result);
  const primaryIssue = choosePrimaryIssue(result, state);

  return {
    presetId: preset.id,
    label: preset.label,
    toolLabel: capability.artistLabel,
    state,
    stateLabel: STATE_LABELS[state],
    summary: createHealthSummary(preset, state, primaryIssue),
    detail: createHealthDetail(preset, state, primaryIssue),
    canRun: result.canRun
  };
}

function chooseHealthState(result: WorkflowCompatibilityResult): WorkflowHealthState {
  if (hasIssue(result, "WORKFLOW_NOT_RUNNABLE")) {
    return "missing-workflow";
  }

  if (hasIssue(result, "COMFY_NODE_MISSING") || hasIssue(result, "COMFY_NODE_INPUT_MISSING")) {
    return "missing-node";
  }

  if (hasIssue(result, "MODEL_FILE_MISSING")) {
    return "missing-model";
  }

  if (result.level === "setup-required" || result.level === "unsupported") {
    return "setup-required";
  }

  if (result.level === "experimental" || hasIssue(result, "WORKFLOW_EXPERIMENTAL")) {
    return "experimental";
  }

  return "ready";
}

function createHealthSummary(
  preset: WorkflowPresetDefinition,
  state: WorkflowHealthState,
  primaryIssue: WorkflowCompatibilityIssue | undefined
) {
  switch (state) {
    case "ready":
      return "Ready on this ComfyUI.";
    case "experimental":
      return "Available for testing.";
    case "missing-workflow":
      return "A validated OpenLayer API workflow is not ready yet.";
    case "missing-node":
    case "missing-model":
    case "setup-required":
      return primaryIssue?.artistMessage ?? "This preset needs setup before it can run.";
    default:
      return preset.description;
  }
}

function createHealthDetail(
  preset: WorkflowPresetDefinition,
  state: WorkflowHealthState,
  primaryIssue: WorkflowCompatibilityIssue | undefined
) {
  const details = [
    state === "ready" || state === "experimental" ? preset.description : "",
    primaryIssue?.technicalMessage,
    preset.compatibilityNote
  ].filter((detail): detail is string => Boolean(detail && detail.trim()));

  return details.join(" ");
}

function hasIssue(result: WorkflowCompatibilityResult, code: string) {
  return result.issues.some((issue) => issue.code === code);
}

function choosePrimaryIssue(
  result: WorkflowCompatibilityResult,
  state: WorkflowHealthState
) {
  const preferredCodes = getPreferredIssueCodes(state);

  for (const code of preferredCodes) {
    const issue = result.issues.find((candidate) => candidate.code === code);

    if (issue) {
      return issue;
    }
  }

  return result.issues.find((issue) => issue.code !== "WORKFLOW_EXPERIMENTAL") ?? result.issues[0];
}

function getPreferredIssueCodes(state: WorkflowHealthState) {
  switch (state) {
    case "missing-workflow":
      return ["WORKFLOW_NOT_RUNNABLE"];
    case "missing-node":
      return ["COMFY_NODE_MISSING", "COMFY_NODE_INPUT_MISSING"];
    case "missing-model":
      return ["MODEL_FILE_MISSING"];
    case "setup-required":
      return ["PHOTOSHOP_INPUT_MISSING", "MODEL_FAMILY_UNSUPPORTED"];
    case "experimental":
      return ["WORKFLOW_EXPERIMENTAL", "MODEL_FAMILY_EXPERIMENTAL"];
    default:
      return [];
  }
}
