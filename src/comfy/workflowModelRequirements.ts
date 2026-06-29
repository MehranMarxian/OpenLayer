import { ComfyModelInventory, WorkflowRequiredModel } from "./types";

export type WorkflowRequiredModelSelections = Record<string, string>;

export function getAcceptedModelNames(model: WorkflowRequiredModel) {
  return uniqueModelNames([model.modelName, ...(model.acceptedModelNames ?? [])]);
}

export function getAvailableRequiredModelName(
  inventory: Partial<ComfyModelInventory>,
  model: WorkflowRequiredModel
) {
  const bucket = getModelBucket(inventory, model.kind);
  const acceptedNames = getAcceptedModelNames(model);

  return acceptedNames.find((modelName) => bucket.includes(modelName)) ?? null;
}

export function hasRequiredModel(
  inventory: Partial<ComfyModelInventory>,
  model: WorkflowRequiredModel
) {
  return Boolean(getAvailableRequiredModelName(inventory, model));
}

export function formatRequiredModelChoices(model: WorkflowRequiredModel) {
  const [preferredName, ...fallbackNames] = getAcceptedModelNames(model);

  if (!preferredName) {
    return model.modelName;
  }

  if (fallbackNames.length === 0) {
    return preferredName;
  }

  return `${preferredName} or accepted fallback ${fallbackNames.join(" or ")}`;
}

export function formatMissingRequiredModelMessage(model: WorkflowRequiredModel) {
  return `Missing ${model.label}: ${formatRequiredModelChoices(model)}.`;
}

export function createRequiredModelSelectionKey(model: WorkflowRequiredModel) {
  return `${model.objectInfoNode}.${model.inputName}.${model.modelName}`;
}

function getModelBucket(inventory: Partial<ComfyModelInventory>, kind: WorkflowRequiredModel["kind"]) {
  switch (kind) {
    case "checkpoint":
      return inventory.checkpoints ?? [];
    case "diffusion-model-stack":
      return inventory.diffusionModels ?? [];
    case "clip":
      return inventory.clipModels ?? [];
    case "vae":
      return inventory.vaeModels ?? [];
    case "controlnet":
      return inventory.controlNetModels ?? [];
    default:
      return [];
  }
}

function uniqueModelNames(modelNames: readonly string[]) {
  const seen = new Set<string>();
  const uniqueNames: string[] = [];

  for (const modelName of modelNames) {
    const trimmedName = modelName.trim();

    if (!trimmedName || seen.has(trimmedName)) {
      continue;
    }

    seen.add(trimmedName);
    uniqueNames.push(trimmedName);
  }

  return uniqueNames;
}
