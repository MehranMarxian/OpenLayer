import { detectCheckpointFamily } from "./modelCompatibility";
import { getWorkflowCapability } from "./workflowCapabilities";
import {
  ComfyModelInventory,
  ModelFamily,
  WorkflowPhotoshopInputKind,
  WorkflowPhotoshopInputRequirement,
  WorkflowPresetDefinition,
  WorkflowRequiredModel
} from "./types";
import {
  formatMissingRequiredModelMessage,
  hasRequiredModel
} from "./workflowModelRequirements";

export type WorkflowCompatibilityLevel =
  | "ready"
  | "warning"
  | "experimental"
  | "setup-required"
  | "unsupported";

export type WorkflowCompatibilityIssue = {
  level: WorkflowCompatibilityLevel;
  code: string;
  artistMessage: string;
  technicalMessage?: string;
};

export type WorkflowNodeAvailability = Record<string, readonly string[]>;

export type WorkflowPhotoshopInputAvailability = Partial<Record<WorkflowPhotoshopInputKind, boolean>>;

export type WorkflowCompatibilityContext = {
  selectedModelName?: string;
  selectedModelFamily?: ModelFamily;
  availableNodes?: WorkflowNodeAvailability;
  availableModels?: Partial<ComfyModelInventory>;
  photoshopInputs?: WorkflowPhotoshopInputAvailability;
};

export type WorkflowCompatibilityResult = {
  presetId: WorkflowPresetDefinition["id"];
  level: WorkflowCompatibilityLevel;
  canRun: boolean;
  issues: WorkflowCompatibilityIssue[];
  recommendedAction?: string;
};

const LEVEL_RANK: Record<WorkflowCompatibilityLevel, number> = {
  ready: 0,
  warning: 1,
  experimental: 2,
  "setup-required": 3,
  unsupported: 4
};

export function evaluateWorkflowCompatibility(
  preset: WorkflowPresetDefinition,
  context: WorkflowCompatibilityContext = {}
): WorkflowCompatibilityResult {
  const capability = getWorkflowCapability(preset);
  const issues: WorkflowCompatibilityIssue[] = [];

  if (preset.status === "todo") {
    issues.push({
      level: "setup-required",
      code: "WORKFLOW_NOT_RUNNABLE",
      artistMessage: `${capability.artistLabel} is registered for future support, but this preset is not runnable yet.`,
      technicalMessage: preset.disabledReason
    });
  } else if (preset.status === "experimental") {
    issues.push({
      level: "experimental",
      code: "WORKFLOW_EXPERIMENTAL",
      artistMessage: `${capability.artistLabel} is experimental and should be tested carefully.`,
      technicalMessage: preset.compatibilityNote
    });
  }

  addModelFamilyIssues(preset, context, issues);
  addNodeIssues(preset, context, issues);
  addModelFileIssues(preset, context, issues);
  addPhotoshopInputIssues(preset, context, issues);

  const level = getHighestLevel(issues);
  const canRun = !issues.some((issue) => issue.level === "setup-required" || issue.level === "unsupported");

  return {
    presetId: preset.id,
    level,
    canRun,
    issues,
    recommendedAction: getRecommendedAction(issues)
  };
}

function addModelFamilyIssues(
  preset: WorkflowPresetDefinition,
  context: WorkflowCompatibilityContext,
  issues: WorkflowCompatibilityIssue[]
) {
  const family = context.selectedModelFamily ?? (
    context.selectedModelName ? detectCheckpointFamily(context.selectedModelName) : undefined
  );

  if (!family) {
    return;
  }

  if (preset.supportedModelFamilies.includes(family)) {
    return;
  }

  if (preset.experimentalModelFamilies.includes(family)) {
    issues.push({
      level: "experimental",
      code: "MODEL_FAMILY_EXPERIMENTAL",
      artistMessage: `${formatModelFamily(family)} may need a dedicated workflow before it behaves correctly here.`,
      technicalMessage: `${preset.id} supports ${preset.supportedModelFamilies.map(formatModelFamily).join(", ")}.`
    });
    return;
  }

  issues.push({
    level: "unsupported",
    code: "MODEL_FAMILY_UNSUPPORTED",
    artistMessage: `${formatModelFamily(family)} is not supported by this workflow preset.`,
    technicalMessage: `${preset.id} supports ${preset.supportedModelFamilies.map(formatModelFamily).join(", ")}.`
  });
}

function addNodeIssues(
  preset: WorkflowPresetDefinition,
  context: WorkflowCompatibilityContext,
  issues: WorkflowCompatibilityIssue[]
) {
  if (!context.availableNodes) {
    return;
  }

  for (const requirement of preset.requiredNodes) {
    const availableInputs = context.availableNodes[requirement.classType];

    if (!availableInputs) {
      issues.push({
        level: "setup-required",
        code: "COMFY_NODE_MISSING",
        artistMessage: `ComfyUI is missing the ${requirement.classType} node required by ${preset.label}.`,
        technicalMessage: `Missing node class: ${requirement.classType}.`
      });
      continue;
    }

    const missingInputs = requirement.requiredInputs.filter((inputName) => !availableInputs.includes(inputName));

    if (missingInputs.length > 0) {
      issues.push({
        level: "setup-required",
        code: "COMFY_NODE_INPUT_MISSING",
        artistMessage: `A ComfyUI node used by ${preset.label} is missing expected inputs.`,
        technicalMessage: `${requirement.classType} missing input(s): ${missingInputs.join(", ")}.`
      });
    }
  }
}

function addModelFileIssues(
  preset: WorkflowPresetDefinition,
  context: WorkflowCompatibilityContext,
  issues: WorkflowCompatibilityIssue[]
) {
  if (!context.availableModels) {
    return;
  }

  for (const model of getRequiredModels(preset)) {
    if (!hasRequiredModel(context.availableModels, model)) {
      issues.push({
        level: "setup-required",
        code: "MODEL_FILE_MISSING",
        artistMessage: formatMissingRequiredModelMessage(model),
        technicalMessage: model.setupHint
      });
    }
  }
}

function addPhotoshopInputIssues(
  preset: WorkflowPresetDefinition,
  context: WorkflowCompatibilityContext,
  issues: WorkflowCompatibilityIssue[]
) {
  if (!context.photoshopInputs) {
    return;
  }

  const capability = getWorkflowCapability(preset);

  for (const requirement of capability.requiredPhotoshopInputs) {
    if (isPhotoshopRequirementAvailable(requirement, context.photoshopInputs)) {
      continue;
    }

    issues.push({
      level: "setup-required",
      code: "PHOTOSHOP_INPUT_MISSING",
      artistMessage: `This workflow needs ${formatPhotoshopRequirement(requirement)} before it can run.`
    });
  }
}

function getRequiredModels(preset: WorkflowPresetDefinition): readonly WorkflowRequiredModel[] {
  return preset.requiredModels ?? preset.modelStack ?? [];
}

function isPhotoshopRequirementAvailable(
  requirement: WorkflowPhotoshopInputRequirement,
  availability: WorkflowPhotoshopInputAvailability
) {
  if (typeof requirement === "string") {
    return Boolean(availability[requirement]);
  }

  return requirement.anyOf.some((inputKind) => Boolean(availability[inputKind]));
}

function formatPhotoshopRequirement(requirement: WorkflowPhotoshopInputRequirement) {
  if (typeof requirement === "string") {
    return formatPhotoshopInput(requirement);
  }

  return requirement.label;
}

function formatPhotoshopInput(inputKind: WorkflowPhotoshopInputKind) {
  switch (inputKind) {
    case "active-layer":
      return "an active Photoshop layer";
    case "canvas":
      return "a captured canvas";
    case "selection":
      return "a Photoshop selection";
    case "selection-mask":
      return "a selection mask";
    default:
      return inputKind;
  }
}

function getHighestLevel(issues: WorkflowCompatibilityIssue[]): WorkflowCompatibilityLevel {
  return issues.reduce<WorkflowCompatibilityLevel>((current, issue) => (
    LEVEL_RANK[issue.level] > LEVEL_RANK[current] ? issue.level : current
  ), "ready");
}

function getRecommendedAction(issues: WorkflowCompatibilityIssue[]) {
  const blockingIssue = issues.find((issue) => issue.level === "unsupported" || issue.level === "setup-required");
  return blockingIssue?.artistMessage ?? issues[0]?.artistMessage;
}

function formatModelFamily(family: ModelFamily) {
  switch (family) {
    case "sd1":
      return "SD 1.x";
    case "sdxl":
      return "SDXL";
    case "sd3":
      return "SD3 / SD3.5";
    case "flux":
      return "Flux";
    case "zImage":
      return "Z_image_Turbo";
    default:
      return "Unknown model family";
  }
}
