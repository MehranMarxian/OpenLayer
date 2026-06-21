import txt2imgBasicWorkflow from "../workflows/txt2img-basic.json";
import { BuildWorkflowOptions, ComfyWorkflow } from "./types";

const NODE_IDS = {
  positivePrompt: "6",
  negativePrompt: "7",
  sampler: "3",
  latentImage: "5"
} as const;

export async function buildTxt2ImgWorkflow(options: BuildWorkflowOptions): Promise<ComfyWorkflow> {
  const workflow = cloneWorkflow(txt2imgBasicWorkflow as ComfyWorkflow);
  const seed = options.seed ?? createRandomSeed();

  // These node IDs match src/workflows/txt2img-basic.json. If users export a
  // different ComfyUI workflow, adjust this map to the matching node IDs.
  setInput(workflow, NODE_IDS.positivePrompt, "text", options.prompt);
  setInput(workflow, NODE_IDS.negativePrompt, "text", options.negativePrompt ?? "");
  setInput(workflow, NODE_IDS.latentImage, "width", options.width);
  setInput(workflow, NODE_IDS.latentImage, "height", options.height);
  setInput(workflow, NODE_IDS.sampler, "seed", seed);
  setInput(workflow, NODE_IDS.sampler, "steps", options.steps);
  setInput(workflow, NODE_IDS.sampler, "cfg", options.cfg);

  return workflow;
}

function cloneWorkflow(workflow: ComfyWorkflow): ComfyWorkflow {
  return JSON.parse(JSON.stringify(workflow)) as ComfyWorkflow;
}

function setInput(workflow: ComfyWorkflow, nodeId: string, inputName: string, value: unknown) {
  const node = workflow[nodeId];

  if (!node) {
    throw new Error(`Workflow node ${nodeId} was not found. Update workflowBuilder.ts to match your ComfyUI workflow.`);
  }

  node.inputs[inputName] = value;
}

function createRandomSeed() {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}
