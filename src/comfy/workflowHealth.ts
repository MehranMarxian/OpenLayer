import { getWorkflowCapability } from "./workflowCapabilities";
import {
  evaluateWorkflowCompatibility,
  WorkflowCompatibilityContext,
  WorkflowCompatibilityIssue,
  WorkflowCompatibilityResult
} from "./workflowCompatibility";
import { WorkflowPresetDefinition } from "./types";
import { getAvailableRequiredModelName } from "./workflowModelRequirements";

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
  stateCounts: Record<WorkflowHealthState, number>;
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
  const stateCounts = createStateCounts(items);
  const readyCount = items.filter((item) => item.state === "ready" || item.state === "experimental").length;
  const issueCount = items.length - readyCount;

  return {
    items,
    readyCount,
    issueCount,
    stateCounts,
    summary: createReportSummary(items.length, readyCount, stateCounts)
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
    detail: createHealthDetail(preset, context, state, primaryIssue),
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
      return "Experimental but available for testing.";
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

function createStateCounts(items: readonly WorkflowHealthItem[]) {
  const counts: Record<WorkflowHealthState, number> = {
    ready: 0,
    experimental: 0,
    "missing-model": 0,
    "missing-node": 0,
    "missing-workflow": 0,
    "setup-required": 0
  };

  for (const item of items) {
    counts[item.state] += 1;
  }

  return counts;
}

function createReportSummary(
  total: number,
  availableCount: number,
  stateCounts: Record<WorkflowHealthState, number>
) {
  const details = [
    stateCounts["missing-workflow"] > 0 ? `${stateCounts["missing-workflow"]} need workflow JSON` : "",
    stateCounts["missing-model"] > 0 ? `${stateCounts["missing-model"]} missing model setup` : "",
    stateCounts["missing-node"] > 0 ? `${stateCounts["missing-node"]} missing ComfyUI nodes` : "",
    stateCounts["setup-required"] > 0 ? `${stateCounts["setup-required"]} need setup` : ""
  ].filter(Boolean);

  const suffix = details.length > 0 ? ` ${details.join(". ")}.` : "";
  return `${availableCount} of ${total} workflow presets are available for testing.${suffix}`;
}

function createHealthDetail(
  preset: WorkflowPresetDefinition,
  context: WorkflowCompatibilityContext,
  state: WorkflowHealthState,
  primaryIssue: WorkflowCompatibilityIssue | undefined
) {
  const details = [
    state === "ready" || state === "experimental" ? preset.description : "",
    createDetectedModelDetail(preset, context),
    primaryIssue?.technicalMessage,
    preset.compatibilityNote
  ].filter((detail): detail is string => Boolean(detail && detail.trim()));

  return details.join(" ");
}

function createDetectedModelDetail(
  preset: WorkflowPresetDefinition,
  context: WorkflowCompatibilityContext
) {
  const availableModels = context.availableModels;

  if (!availableModels) {
    return "";
  }

  const detectedModels = (preset.requiredModels ?? preset.modelStack ?? [])
    .map((model) => {
      const detectedName = getAvailableRequiredModelName(availableModels, model);
      return detectedName ? `${model.label}: ${detectedName}` : "";
    })
    .filter(Boolean);

  return detectedModels.length > 0 ? `Detected model files: ${detectedModels.join("; ")}.` : "";
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
