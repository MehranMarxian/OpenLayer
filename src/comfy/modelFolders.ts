import { WorkflowModelFolder, WorkflowPresetDefinition, WorkflowRequiredModel } from "./types";
import { createOpenLayerError } from "../utils/errors";

/**
 * Which folder under ComfyUI's `models/` each loader node actually reads.
 *
 * This mapping exists exactly once. Every consumer — the setup pack, the
 * downloader it generates, the future in-panel Setup tab — derives folders from
 * here rather than restating them, because a restated folder is a folder that
 * can drift from the preset it describes.
 *
 * Getting this wrong is the most common OpenLayer setup failure and it fails
 * quietly: `CheckpointLoaderSimple` reads `models/checkpoints/` while
 * `UNETLoader` reads `models/diffusion_models/`, so a Flux model dropped in the
 * checkpoints folder is simply invisible, and the panel can only say the model
 * is missing. Verified against the live ComfyUI at 127.0.0.1:8190 via
 * `GET /models/<folder>` rather than assumed:
 *   - `text_encoders` holds clip_l/t5xxl/qwen; the legacy `clip` folder is empty
 *   - `Florence2ModelLoader` states its own location in its input tooltip
 *     ("models are expected to be in Comfyui/models/LLM folder")
 */
export const MODEL_FOLDER_BY_OBJECT_INFO_NODE = {
  CheckpointLoaderSimple: "checkpoints",
  UNETLoader: "diffusion_models",
  CLIPLoader: "text_encoders",
  DualCLIPLoader: "text_encoders",
  VAELoader: "vae",
  ControlNetLoader: "controlnet",
  UpscaleModelLoader: "upscale_models",
  Florence2ModelLoader: "LLM"
} as const satisfies Record<string, WorkflowModelFolder>;

export type MappedModelLoaderNode = keyof typeof MODEL_FOLDER_BY_OBJECT_INFO_NODE;

export function isMappedModelLoaderNode(objectInfoNode: string): objectInfoNode is MappedModelLoaderNode {
  return objectInfoNode in MODEL_FOLDER_BY_OBJECT_INFO_NODE;
}

/**
 * The folder a model belongs in, derived from the loader that reads it.
 * Throws rather than guessing: a preset that names an unmapped loader would
 * otherwise produce setup instructions that quietly send files nowhere.
 */
export function getModelTargetFolder(model: WorkflowRequiredModel): WorkflowModelFolder {
  if (model.targetFolder) {
    return model.targetFolder;
  }

  if (!isMappedModelLoaderNode(model.objectInfoNode)) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `No ComfyUI model folder is mapped for the ${model.objectInfoNode} loader.`,
      `Add ${model.objectInfoNode} to MODEL_FOLDER_BY_OBJECT_INFO_NODE in src/comfy/modelFolders.ts.`
    );
  }

  return MODEL_FOLDER_BY_OBJECT_INFO_NODE[model.objectInfoNode];
}

/** Install path relative to the ComfyUI root, e.g. `models/diffusion_models`. */
export function getModelTargetPath(model: WorkflowRequiredModel): string {
  return `models/${getModelTargetFolder(model)}`;
}

/**
 * Identity of a model for de-duplication. Two presets naming the same file for
 * the same loader are the same download — `ae.safetensors` is shared by the
 * Flux Fill and Z_image_Turbo stacks, and should be fetched once.
 */
export function getRequiredModelKey(model: WorkflowRequiredModel): string {
  return `${getModelTargetFolder(model)}/${model.modelName}`;
}

/**
 * Every model a preset needs, de-duplicated. `modelStack` and `requiredModels`
 * deliberately overlap in the registry (the stack drives model selection, the
 * requirement list drives health checks), so callers must not concatenate them
 * blindly.
 */
export function listPresetRequiredModels(preset: WorkflowPresetDefinition): WorkflowRequiredModel[] {
  const byKey = new Map<string, WorkflowRequiredModel>();

  for (const model of [...(preset.requiredModels ?? []), ...(preset.modelStack ?? [])]) {
    const key = getRequiredModelKey(model);

    if (!byKey.has(key)) {
      byKey.set(key, model);
    }
  }

  return [...byKey.values()];
}

/** Models across several presets, de-duplicated the same way. */
export function listRequiredModelsForPresets(
  presets: readonly WorkflowPresetDefinition[]
): WorkflowRequiredModel[] {
  const byKey = new Map<string, WorkflowRequiredModel>();

  for (const preset of presets) {
    for (const model of listPresetRequiredModels(preset)) {
      const key = getRequiredModelKey(model);

      if (!byKey.has(key)) {
        byKey.set(key, model);
      }
    }
  }

  return [...byKey.values()];
}
