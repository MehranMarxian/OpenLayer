import txt2imgBasicWorkflow from "../workflows/txt2img-basic.json";
import { BuildWorkflowOptions, BuildWorkflowResult, ComfyWorkflow } from "./types";
import { getWorkflowPreset, validateWorkflowForPreset } from "./presetRegistry";
import { createOpenLayerError } from "../utils/errors";

export async function buildTxt2ImgWorkflow(options: BuildWorkflowOptions): Promise<BuildWorkflowResult> {
  const preset = getWorkflowPreset("txt2img-basic");
  const workflow = cloneWorkflow(txt2imgBasicWorkflow as ComfyWorkflow);
  const seed = options.seed;

  // These node IDs match src/workflows/txt2img-basic.json. If users export a
  // different ComfyUI workflow, adjust the preset metadata in presetRegistry.ts.
  validateWorkflowForPreset(workflow, preset);

  if (options.checkpointName) {
    setInput(workflow, preset.nodeIds.checkpointLoader, "ckpt_name", options.checkpointName);
  }

  setInput(workflow, preset.nodeIds.positivePrompt, "text", options.prompt);
  setInput(workflow, preset.nodeIds.negativePrompt, "text", options.negativePrompt ?? "");
  setInput(workflow, preset.nodeIds.latentImage, "width", options.width);
  setInput(workflow, preset.nodeIds.latentImage, "height", options.height);
  setInput(workflow, preset.nodeIds.sampler, "seed", seed);
  setInput(workflow, preset.nodeIds.sampler, "steps", options.steps);
  setInput(workflow, preset.nodeIds.sampler, "cfg", options.cfg);

  validateWorkflowForPreset(workflow, preset);

  return {
    workflow,
    seed,
    preset
  };
}

function cloneWorkflow(workflow: ComfyWorkflow): ComfyWorkflow {
  return JSON.parse(JSON.stringify(workflow)) as ComfyWorkflow;
}

function setInput(workflow: ComfyWorkflow, nodeId: string, inputName: string, value: unknown) {
  const node = workflow[nodeId];

  if (!node) {
    throw createOpenLayerError(
      "WORKFLOW_INVALID",
      `Workflow node ${nodeId} was not found.`,
      "Update presetRegistry.ts to match the exported ComfyUI workflow."
    );
  }

  node.inputs[inputName] = value;
}
