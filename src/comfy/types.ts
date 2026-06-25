export type WorkflowPreset =
  | "txt2img-basic"
  | "img2img-basic"
  | "txt2img-flux1-dev"
  | "img2img-flux1-dev"
  | "txt2img-z-image-turbo"
  | "img2img-z-image-turbo"
  | "sketch2img-linecn-basic"
  | "inpaint-basic";
export type WorkflowMode = "txt2img" | "img2img" | "sketch2img" | "inpaint";
export type ModelFamily = "sd1" | "sdxl" | "sd3" | "flux" | "zImage" | "unknown";

export type ComfyHardwareDevice = {
  name: string;
  type: string;
  index?: number;
  vramTotalBytes?: number;
  vramFreeBytes?: number;
  torchVramTotalBytes?: number;
  torchVramFreeBytes?: number;
};

export type ComfySystemStats = {
  devices: ComfyHardwareDevice[];
  system?: {
    os?: string;
    ramTotalBytes?: number;
    ramFreeBytes?: number;
    comfyuiVersion?: string;
    pythonVersion?: string;
    pytorchVersion?: string;
  };
};

export type ComfyModelInventory = {
  checkpoints: string[];
  diffusionModels: string[];
  clipModels: string[];
  vaeModels: string[];
  controlNetModels: string[];
  missingSources: string[];
};

export type ComfyWorkflow = Record<string, ComfyWorkflowNode>;

export type ComfyWorkflowNode = {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: {
    title?: string;
  };
};

export type BuildWorkflowOptions = {
  presetId?: string;
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
  presetId?: string;
  prompt: string;
  negativePrompt?: string;
  checkpointName?: string;
  sourceImageName: string;
  steps: number;
  cfg: number;
  seed: number;
  denoise: number;
};

export type BuildSketchToImageWorkflowOptions = BuildImageToImageWorkflowOptions & {
  controlStrength: number;
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

export type WorkflowInputTarget = {
  nodeId: string;
  inputName: string;
};

export type WorkflowInjectionName =
  | "checkpoint"
  | "positivePrompt"
  | "negativePrompt"
  | "width"
  | "height"
  | "seed"
  | "steps"
  | "cfg"
  | "denoise"
  | "sourceImage"
  | "maskImage"
  | "controlStrength";

export type WorkflowInjectionTargets = Partial<Record<WorkflowInjectionName, WorkflowInputTarget>>;

export type WorkflowModelSourceKind = "checkpoint" | "diffusion-model-stack" | "clip" | "vae" | "controlnet";

export type WorkflowModelSource = {
  kind: WorkflowModelSourceKind;
  objectInfoNode: string;
  inputName: string;
  label: string;
};

export type WorkflowRequiredModel = WorkflowModelSource & {
  modelName: string;
  setupHint?: string;
};

export type WorkflowPresetDefinition = {
  id: WorkflowPreset;
  label: string;
  mode: WorkflowMode;
  description: string;
  workflowFile: string;
  sourceWorkflowFile?: string;
  status: "stable" | "experimental" | "todo";
  supportedModelFamilies: ModelFamily[];
  experimentalModelFamilies: ModelFamily[];
  modelSource: WorkflowModelSource;
  modelStack?: WorkflowRequiredModel[];
  injections: WorkflowInjectionTargets;
  requiredNodes: WorkflowNodeRequirement[];
  requiredModels?: WorkflowRequiredModel[];
  compatibilityNote?: string;
  disabledReason?: string;
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

export type SketchToImageSettings = ImageToImageSettings & {
  controlStrength: number;
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

export type SketchToImageSettingsInput = ImageToImageSettingsInput & {
  controlStrength: string;
};

export type GenerationSettingsValidation = {
  settings: GenerationSettings;
  warnings: string[];
};

export type ImageToImageSettingsValidation = {
  settings: ImageToImageSettings;
  warnings: string[];
};

export type SketchToImageSettingsValidation = {
  settings: SketchToImageSettings;
  warnings: string[];
};

export type ComfyObjectInfoResponse = Record<
  string,
  {
    input?: {
      required?: {
        [inputName: string]: unknown;
      };
    };
  }
>;

export type ComfyQueueResponse = {
  queue_running?: unknown[];
  queue_pending?: unknown[];
};
