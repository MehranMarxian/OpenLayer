import {
  evaluateWorkflowCompatibility,
  WorkflowCompatibilityContext,
  WorkflowCompatibilityLevel
} from "./workflowCompatibility";
import { getWorkflowCapability } from "./workflowCapabilities";
import { WorkflowPresetDefinition } from "./types";

export type WorkflowDiagnosticMessage = {
  summary: string;
  detail: string;
  isWarning: boolean;
};

export function createWorkflowDiagnosticMessage(
  preset: WorkflowPresetDefinition,
  context: WorkflowCompatibilityContext = {}
): WorkflowDiagnosticMessage {
  const capability = getWorkflowCapability(preset);
  const result = evaluateWorkflowCompatibility(preset, context);
  const selectedModelName = context.selectedModelName?.trim();
  const modelText = selectedModelName
    ? `${capability.uiHints.modelSelectorLabel}: ${selectedModelName}.`
    : `${capability.uiHints.modelSelectorLabel} not selected.`;

  if (result.level === "ready") {
    const warning = capability.uiHints.warning;

    return {
      summary: `${capability.artistLabel} is ready for this workflow.`,
      detail: [modelText, `Workflow: ${preset.label}.`, warning].filter(Boolean).join(" "),
      isWarning: Boolean(warning)
    };
  }

  const primaryIssue = choosePrimaryIssue(result.issues, result.level);
  const secondaryTechnical = primaryIssue?.technicalMessage ?? result.issues
    .filter((issue) => issue.code !== "WORKFLOW_EXPERIMENTAL")
    .map((issue) => issue.technicalMessage)
    .find((message): message is string => Boolean(message));
  const detail = [
    primaryIssue?.artistMessage,
    capability.uiHints.warning,
    modelText,
    secondaryTechnical
  ].filter(Boolean).join(" ");

  return {
    summary: getLevelSummary(result.level, capability.artistLabel),
    detail,
    isWarning: true
  };
}

export function createWorkflowReadinessSummary(items: readonly WorkflowDiagnosticMessage[]) {
  if (items.length === 0) {
    return "No workflow selected.";
  }

  return items
    .map((item) => `${item.summary} ${item.detail}`.trim())
    .join(" ");
}

function getLevelSummary(level: WorkflowCompatibilityLevel, artistLabel: string) {
  switch (level) {
    case "setup-required":
      return `${artistLabel} needs setup before it is ready.`;
    case "unsupported":
      return `${artistLabel} is not compatible with this selection.`;
    case "experimental":
      return `${artistLabel} is experimental for this setup.`;
    case "warning":
      return `${artistLabel} needs review.`;
    default:
      return `${artistLabel} is ready for this workflow.`;
  }
}

function choosePrimaryIssue(
  issues: ReturnType<typeof evaluateWorkflowCompatibility>["issues"],
  level: WorkflowCompatibilityLevel
) {
  const sameLevelIssues = issues.filter((issue) => issue.level === level);
  const actionableIssue = sameLevelIssues.find((issue) => issue.code !== "WORKFLOW_EXPERIMENTAL");

  return actionableIssue ?? sameLevelIssues[0] ?? issues[0];
}
