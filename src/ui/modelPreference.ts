import { listRunnableWorkflowPresets } from "../comfy/presetRegistry";
import type { WorkflowPresetDefinition } from "../comfy/types";
import { getAcceptedModelNames } from "../comfy/workflowModelRequirements";

/**
 * The files the Upscale model picker offers for a preset.
 *
 * upscale-basic reads UpscaleModelLoader, whose folder holds nothing but
 * upscale models, so its list passes through untouched. SeedVR2 reads
 * UNETLoader, the folder every diffusion model shares, and the picker offered
 * all of them -- qwen, sd3.5, Klein (Mehran's screenshot, 2026-10-29) -- none of
 * which its graph can load. A preset on a shared loader now lists only its own
 * files. When none is installed it lists the file it needs, so Generate reports
 * that file missing instead of running someone else's model.
 */
export function listUpscaleModelOptions(modelNames: readonly string[], preset: WorkflowPresetDefinition): string[] {
  if (preset.modelSource.kind !== "diffusion-model-stack") {
    return [...modelNames];
  }

  const ownNames = (preset.modelStack ?? [])
    .filter((model) => model.objectInfoNode === preset.modelSource.objectInfoNode)
    .flatMap((model) => getAcceptedModelNames(model));

  if (ownNames.length === 0) {
    return [...modelNames];
  }

  const installed = ownNames.filter((name) => modelNames.includes(name));
  return installed.length > 0 ? installed : ownNames;
}

/**
 * Whether a model refresh may keep the model that was selected before.
 *
 * Every diffusion-model preset reads the same UNETLoader list, so after a
 * preset switch the previous preset's file is still "in the list" -- and it
 * used to be kept: Edit Image showed Qwen-Image 2.1 (edit) running
 * flux-2-klein-4b-fp8 (Photoshop, 2026-09-24), a graph that cannot load it.
 * A pick is now kept only if it is not another preset's pinned model, so a
 * leftover from a different stack is replaced by this preset's own file while
 * a deliberate choice (a fine-tune, say) survives a refresh.
 */
export function keepsPreferredModel(preferredValue: string, modelNames: readonly string[], preset: WorkflowPresetDefinition) {
  if (!preferredValue || !modelNames.includes(preferredValue)) {
    return false;
  }

  const ownModels = new Set((preset.modelStack ?? []).map((model) => model.modelName));

  if (ownModels.has(preferredValue)) {
    return true;
  }

  return !listRunnableWorkflowPresets().some(
    (other) => other.id !== preset.id && (other.modelStack ?? []).some((model) => model.modelName === preferredValue)
  );
}
