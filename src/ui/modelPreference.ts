import { listRunnableWorkflowPresets } from "../comfy/presetRegistry";
import type { WorkflowPresetDefinition } from "../comfy/types";

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
