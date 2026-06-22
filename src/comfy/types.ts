export type WorkflowPreset = "txt2img-basic" | "img2img-basic";
export type WorkflowMode = "txt2img" | "img2img";

export type ComfyWorkflow = Record<string, ComfyWorkflowNode>;

export type ComfyWorkflowNode = {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: {
    title?: string;
  };
};

export type BuildWorkflowOptions = {
  prompt: string;
  negativePrompt?: string;
  checkpointName?: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
};

export type BuildImageToImageWorkflowOptions = {
  prompt: string;
  negativePrompt?: string;
  checkpointName?: string;
  sourceImageName: string;
  steps: number;
  cfg: number;
  seed: number;
  denoise: number;
};

export type BuildWorkflowResult = {
  workflow: ComfyWorkflow;
  seed: number;
  preset: WorkflowPresetDefinition;
};

export type WorkflowNodeRequirement = {
  id: string;
  classType: string;
  requiredInputs: string[];
};

export type WorkflowPresetDefinition = {
  id: WorkflowPreset;
  label: string;
  mode: WorkflowMode;
  description: string;
  workflowFile: string;
  nodeIds: {
    checkpointLoader: string;
    positivePrompt: string;
    negativePrompt: string;
    sampler: string;
    saveImage: string;
    latentImage?: string;
    loadImage?: string;
    vaeEncode?: string;
  };
  requiredNodes: WorkflowNodeRequirement[];
};

export type ComfyPromptResponse = {
  prompt_id: string;
  number?: number;
  node_errors?: Record<string, unknown>;
};

export type ComfyImageOutput = {
  filename: string;
  subfolder?: string;
  type?: string;
};

export type ComfyHistoryItem = {
  prompt?: unknown[];
  outputs?: Record<string, { images?: ComfyImageOutput[] }>;
  status?: {
    status_str?: string;
    completed?: boolean;
    messages?: unknown[];
  };
};

export type ComfyHistoryResponse = Record<string, ComfyHistoryItem>;

export type GeneratedImageResult = {
  blob: Blob;
  filename: string;
  mimeType: string;
};

export type ComfyUploadImageResponse = {
  name?: string;
  subfolder?: string;
  type?: string;
};

export type GenerationSettings = {
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
};

export type ImageToImageSettings = {
  steps: number;
  cfg: number;
  seed: number;
  denoise: number;
};

export type GenerationSettingsInput = {
  width: string;
  height: string;
  steps: string;
  cfg: string;
  seed: string;
};

export type ImageToImageSettingsInput = {
  steps: string;
  cfg: string;
  seed: string;
  denoise: string;
};

export type GenerationSettingsValidation = {
  settings: GenerationSettings;
  warnings: string[];
};

export type ImageToImageSettingsValidation = {
  settings: ImageToImageSettings;
  warnings: string[];
};

export type ComfyCheckpointInfoResponse = {
  CheckpointLoaderSimple?: {
    input?: {
      required?: {
        ckpt_name?: [string[], unknown];
      };
    };
  };
};

export type ComfyQueueResponse = {
  queue_running?: unknown[];
  queue_pending?: unknown[];
};
