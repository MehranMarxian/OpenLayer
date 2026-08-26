import {
  ComfyModelInventoryBucket,
  getModelTargetFolder,
  isMappedModelLoaderNode,
  MODEL_FOLDER_BY_INVENTORY_BUCKET
} from "./modelFolders";
import { ComfyModelInventory, WorkflowModelFolder, WorkflowRequiredModel } from "./types";
import { getAcceptedModelNames } from "./workflowModelRequirements";

/**
 * Answers "the file is missing — is it actually just in the wrong folder?".
 *
 * Every string here is rendered with `textContent` (see `createWorkflowHealthCard`
 * in `src/ui/App.ts`), so it is plain text. No markdown, no backticks, no
 * em dashes: whatever is written here is exactly what the artist reads.
 */

const MODEL_INVENTORY_BUCKET_ORDER = [
  "checkpoints",
  "diffusionModels",
  "clipModels",
  "vaeModels",
  "controlNetModels",
  "visionLanguageModels",
  "upscaleModels",
  "modelPatches",
  "clipVisionModels",
  "ipAdapterModels"
] as const satisfies readonly ComfyModelInventoryBucket[];

export type MisplacedModel = {
  modelName: string;
  folders: WorkflowModelFolder[];
  requiredFolder: WorkflowModelFolder;
};

export function findMisplacedModel(
  inventory: Partial<ComfyModelInventory>,
  model: WorkflowRequiredModel
): MisplacedModel | null {
  // `getModelTargetFolder` throws for a loader that has no mapped folder, and
  // this runs inside the workflow health report: one unmappable preset must not
  // take down the whole check. If we cannot say where the file belongs, we
  // cannot say it is in the wrong place, so say nothing and let the plain
  // "missing" message stand.
  if (!model.targetFolder && !isMappedModelLoaderNode(model.objectInfoNode)) {
    return null;
  }

  const acceptedNames = getAcceptedModelNames(model);
  const targetFolder = getModelTargetFolder(model);
  const folders: WorkflowModelFolder[] = [];
  let matchedModelName: string | null = null;

  for (const bucket of MODEL_INVENTORY_BUCKET_ORDER) {
    const folder = MODEL_FOLDER_BY_INVENTORY_BUCKET[bucket];

    if (folder === targetFolder) {
      continue;
    }

    const bucketMatch = (inventory[bucket] ?? []).find((candidate) =>
      acceptedNames.some((acceptedName) => modelNameMatches(candidate, acceptedName))
    );

    if (!bucketMatch) {
      continue;
    }

    matchedModelName ??= bucketMatch;
    folders.push(folder);
  }

  return matchedModelName
    ? { modelName: matchedModelName, folders, requiredFolder: targetFolder }
    : null;
}

export function formatMisplacedModelMessage(misplacedModel: MisplacedModel): string {
  const foundFolders = formatFolderList(misplacedModel.folders);
  const requiredFolder = formatModelFolder(misplacedModel.requiredFolder);

  return `Found ${misplacedModel.modelName} in ${foundFolders}, but this workflow reads it from ${requiredFolder}. Move the file, then refresh ComfyUI.`;
}

function modelNameMatches(candidate: string, acceptedName: string): boolean {
  const normalizedCandidate = normalizeModelPath(candidate);
  const normalizedAcceptedName = normalizeModelPath(acceptedName);
  const candidateName = normalizedAcceptedName.includes("/")
    ? normalizedCandidate
    : getBaseName(normalizedCandidate);

  return candidateName.toLowerCase() === normalizedAcceptedName.toLowerCase();
}

function normalizeModelPath(modelName: string): string {
  return modelName.replace(/\\/g, "/");
}

function getBaseName(modelName: string): string {
  return modelName.slice(modelName.lastIndexOf("/") + 1);
}

function formatFolderList(folders: readonly WorkflowModelFolder[]): string {
  const formattedFolders = folders.map(formatModelFolder);

  if (formattedFolders.length <= 1) {
    return formattedFolders[0] ?? "";
  }

  if (formattedFolders.length === 2) {
    return `${formattedFolders[0]} and ${formattedFolders[1]}`;
  }

  return `${formattedFolders.slice(0, -1).join(", ")}, and ${
    formattedFolders[formattedFolders.length - 1]
  }`;
}

function formatModelFolder(folder: WorkflowModelFolder): string {
  return `models/${folder}/`;
}
