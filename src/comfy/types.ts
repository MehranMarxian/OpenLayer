export type WorkflowPreset = "txt2img-basic";

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
  seed?: number;
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

export type ComfyCheckpointInfoResponse = {
  CheckpointLoaderSimple?: {
    input?: {
      required?: {
        ckpt_name?: [string[], unknown];
      };
    };
  };
};
