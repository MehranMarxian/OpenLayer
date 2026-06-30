export type WorkflowPreset =
  | "txt2img-basic"
  | "img2img-basic"
  | "txt2img-flux1-dev-fp8"
  | "txt2img-flux1-dev"
  | "img2img-flux1-dev"
  | "txt2img-z-image-turbo"
  | "img2img-z-image-turbo"
  | "prompt-from-layer-florence2"
  | "sketch2img-linecn-basic"
  | "inpaint-basic"
  | "inpaint-flux-fill-basic"
  | "outpaint-flux-fill-basic";
export type WorkflowMode = "txt2img" | "img2img" | "sketch2img" | "inpaint" | "outpaint" | "prompt";
export type ModelFamily = "sd1" | "sdxl" | "sd3" | "flux" | "zImage" | "unknown";
export type WorkflowToolType = WorkflowMode | "realtime";
export type WorkflowLoaderType = "checkpoint" | "diffusion-model-stack" | "vision-language";
export type WorkflowControlId =
  | "prompt"
  | "negativePrompt"
  | "width"
  | "height"
  | "steps"
  | "cfg"
  | "guidance"
  | "denoise"
  | "seed"
  | "task"
  | "numBeams"
  | "controlStrength"
  | "maskBlur"
  | "contextPadding"
  | "outpaintLeft"
  | "outpaintTop"
  | "outpaintRight"
  | "outpaintBottom"
  | "outpaintFeathering";
export type WorkflowPhotoshopInputKind = "canvas" | "active-layer" | "selection" | "selection-mask";
export type WorkflowPhotoshopInputRequirement =
  | WorkflowPhotoshopInputKind
  | {
    anyOf: readonly WorkflowPhotoshopInputKind[];
    label: string;
  };
export type WorkflowOutputKind =
  | "full-image"
  | "source-sized-image"
  | "selection-patch"
  | "transparent-patch"
  | "layer-mask-candidate"
  | "prompt-text";
export type WorkflowOutputSize = "preset" | "source" | "selection-context" | "none";
export type WorkflowImportBehavior = "new-layer" | "aligned-layer" | "future-layer-mask" | "none";

export type WorkflowCapabilityUiHints = {
  showModelSelector: boolean;
  modelSelectorLabel: string;
  primaryActionLabel: string;
  warning?: string;
  experimentalNote?: string;
  hiddenControls?: readonly WorkflowControlId[];
};

export type WorkflowCapability = {
  toolType: WorkflowToolType;
  loaderType: WorkflowLoaderType;
  artistLabel: string;
  technicalLabel: string;
  requiredPhotoshopInputs: readonly WorkflowPhotoshopInputRequirement[];
  controls: readonly WorkflowControlId[];
  output: {
    kind: WorkflowOutputKind;
    size: WorkflowOutputSize;
    importBehavior: WorkflowImportBehavior;
  };
  uiHints: WorkflowCapabilityUiHints;
};

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
  visionLanguageModels: string[];
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
  requiredModelSelections?: Record<string, string>;
};

export type BuildSketchToImageWorkflowOptions = BuildImageToImageWorkflowOptions & {
  controlStrength: number;
};

export type BuildInpaintWorkflowOptions = BuildImageToImageWorkflowOptions & {
  maskImageName: string;
  width?: number;
  height?: number;
};

export type BuildOutpaintWorkflowOptions = BuildImageToImageWorkflowOptions & {
  left: number;
  top: number;
  right: number;
  bottom: number;
  feathering: number;
};

export type BuildPromptFromLayerWorkflowOptions = {
  presetId?: string;
  sourceImageName: string;
  task: string;
  numBeams: number;
  seed: number;
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
  | "task"
  | "numBeams"
  | "controlStrength"
  | "outpaintLeft"
  | "outpaintTop"
  | "outpaintRight"
  | "outpaintBottom"
  | "outpaintFeathering";

export type WorkflowInjectionTargetList = WorkflowInputTarget | readonly WorkflowInputTarget[];

export type WorkflowInjectionTargets = Partial<Record<WorkflowInjectionName, WorkflowInjectionTargetList>>;

export type WorkflowModelSourceKind =
  | "checkpoint"
  | "diffusion-model-stack"
  | "clip"
  | "vae"
  | "controlnet"
  | "vision-language";

export type WorkflowModelSource = {
  kind: WorkflowModelSourceKind;
  objectInfoNode: string;
  inputName: string;
  label: string;
};

export type WorkflowRequiredModel = WorkflowModelSource & {
  modelName: string;
  acceptedModelNames?: readonly string[];
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
  capability?: WorkflowCapability;
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
  outputs?: Record<string, ComfyNodeOutput>;
  status?: {
    status_str?: string;
    completed?: boolean;
    messages?: unknown[];
  };
};

export type ComfyNodeOutput = {
  images?: ComfyImageOutput[];
  text?: unknown;
  texts?: unknown;
  string?: unknown;
  strings?: unknown;
  caption?: unknown;
  [key: string]: unknown;
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

export type OutpaintSettings = ImageToImageSettings & {
  left: number;
  top: number;
  right: number;
  bottom: number;
  feathering: number;
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

export type OutpaintSettingsInput = ImageToImageSettingsInput & {
  left: string;
  top: string;
  right: string;
  bottom: string;
  feathering: string;
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

export type OutpaintSettingsValidation = {
  settings: OutpaintSettings;
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
