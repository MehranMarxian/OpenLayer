export type WorkflowPreset =
  | "txt2img-basic"
  | "img2img-basic"
  | "txt2img-flux1-dev-fp8"
  | "txt2img-flux2-dev-gguf"
  | "txt2img-z-image-turbo"
  | "img2img-z-image-turbo"
  | "txt2img-krea2-turbo"
  | "img2img-krea2-turbo"
  | "prompt-from-layer-florence2"
  | "sketch2img-linecn-basic"
  | "sketch2img-scribble-basic"
  | "sketch2img-depth-basic"
  | "sketch2img-zimage-fun-controlnet"
  | "sketch2img-zimage-fun-controlnet-full"
  | "inpaint-basic"
  | "inpaint-flux-fill-basic"
  | "inpaint-flux-fill-cropstitch"
  | "outpaint-flux-fill-basic"
  | "upscale-basic";
export type WorkflowMode =
  | "txt2img"
  | "img2img"
  | "sketch2img"
  | "inpaint"
  | "outpaint"
  | "prompt"
  | "upscale";
export type ModelFamily = "sd1" | "sdxl" | "sd3" | "flux" | "flux2" | "zImage" | "unknown";
export type WorkflowToolType = WorkflowMode | "realtime";
export type WorkflowLoaderType = "checkpoint" | "diffusion-model-stack" | "vision-language" | "upscale";
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
  | "prompt-text"
  | "upscaled-image";
export type WorkflowOutputSize = "preset" | "source" | "selection-context" | "none" | "upscaled";
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
  upscaleModels: string[];
  modelPatches: string[];
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
  lora?: WorkflowLoraSelection;
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
  lora?: WorkflowLoraSelection;
};

export type BuildSketchToImageWorkflowOptions = BuildImageToImageWorkflowOptions & {
  controlStrength: number;
  /** Size the latent is sampled at, after any `minimumGenerationSize` floor. */
  width: number;
  height: number;
  /**
   * Size the finished image is scaled back to — the captured source size.
   * Only presets declaring `minimumGenerationSize` need this; without it the
   * generation size and the output size are the same thing.
   */
  outputWidth?: number;
  outputHeight?: number;
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

export type BuildUpscaleWorkflowOptions = {
  presetId?: string;
  sourceImageName: string;
  modelName: string;
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
  | "outputWidth"
  | "outputHeight"
  | "task"
  | "numBeams"
  | "controlStrength"
  | "outpaintLeft"
  | "outpaintTop"
  | "outpaintRight"
  | "outpaintBottom"
  | "outpaintFeathering";

export type WorkflowInjectionTargetList = WorkflowInputTarget | readonly WorkflowInputTarget[];

/** Where a link starts: a node and one of its output slots. */
export type WorkflowLinkSource = {
  nodeId: string;
  slot: number;
};

/**
 * How to splice an optional `LoraLoader` into a preset's graph.
 *
 * Every other injection sets a *value* on a node the shipped workflow already
 * contains. A LoRA cannot work that way: core `LoraLoader` offers no "none"
 * entry — `lora_name` is a combo of files that exist — so a permanently wired
 * loader would force every user to own and load a LoRA they may not want. The
 * node is therefore absent from the shipped workflow and spliced in only when
 * an artist actually picks one, which is the first and only case where building
 * a workflow changes its topology rather than its values.
 *
 * The wiring is declared here rather than inferred because inferring it means
 * guessing which MODEL and CLIP edges are the "main" ones, and a wrong guess
 * silently produces an image with the LoRA applied to nothing.
 */
export type WorkflowLoraInsertion = {
  /** Id the inserted node takes. Must not already exist in the workflow. */
  nodeId: string;
  /**
   * Filename fragments that suggest a LoRA was trained for this preset's model.
   * Used only to label the dropdown, never to hide an entry -- see
   * `loraCompatibility.ts` for why nothing stronger is available.
   */
  familyTokens?: readonly string[];
  /** Feeds the loader's `model` input — normally the diffusion model loader. */
  modelSource: WorkflowLinkSource;
  /** Feeds the loader's `clip` input — normally the text encoder loader. */
  clipSource: WorkflowLinkSource;
  /** Inputs reading the model directly, rewired to the loader's MODEL output. */
  modelConsumers: readonly WorkflowInputTarget[];
  /** Inputs reading the CLIP directly, rewired to the loader's CLIP output. */
  clipConsumers: readonly WorkflowInputTarget[];
};

/** An artist's LoRA choice. Absent or nameless means "no LoRA". */
export type WorkflowLoraSelection = {
  loraName: string;
  strengthModel: number;
  strengthClip: number;
};

export type WorkflowInjectionTargets = Partial<Record<WorkflowInjectionName, WorkflowInjectionTargetList>>;

export type WorkflowModelSourceKind =
  | "checkpoint"
  | "diffusion-model-stack"
  | "clip"
  | "vae"
  | "controlnet"
  | "vision-language"
  | "upscale"
  | "model-patch";

export type WorkflowModelSource = {
  kind: WorkflowModelSourceKind;
  objectInfoNode: string;
  inputName: string;
  label: string;
};

/**
 * The folder under ComfyUI's `models/` that a loader actually reads from.
 * Kept as a closed union so a typo cannot invent a folder that ComfyUI will
 * never scan — the wrong-folder mistake is this project's most common setup
 * failure and it fails silently, as "model not found".
 */
export type WorkflowModelFolder =
  | "checkpoints"
  | "diffusion_models"
  | "text_encoders"
  | "vae"
  | "controlnet"
  | "upscale_models"
  | "LLM"
  | "model_patches";

/**
 * A model whose terms have to be accepted by a person before it is fetched.
 * Its presence means "do not download this without explicit consent", even
 * when `downloadUrl` resolves without credentials.
 */
export type WorkflowModelLicenseGate = {
  /** Licence name as the publisher writes it. */
  name: string;
  /** Where the actual terms live. */
  url: string;
  /** The restriction in one sentence, for a setup README or a dialog. */
  summary: string;
};

export type WorkflowModelDownloadLayout = "file" | "repo-folder";

export type WorkflowRequiredModel = WorkflowModelSource & {
  modelName: string;
  acceptedModelNames?: readonly string[];
  setupHint?: string;
  /**
   * Direct download URL. Every URL in the registry was verified with a live
   * HEAD request; see `downloadSizeBytes` for the Content-Length observed at
   * the time. Absent when no unauthenticated URL exists.
   */
  downloadUrl?: string;
  /** Human-readable page for the model: licence, model card, release notes. */
  sourcePageUrl?: string;
  /** Content-Length observed when the URL was verified. Used to warn about disk cost. */
  downloadSizeBytes?: number;
  /** `repo-folder` models are a directory of files, not a single download. */
  downloadLayout?: WorkflowModelDownloadLayout;
  /** Set when a person must accept terms before the file may be fetched. */
  licenseGate?: WorkflowModelLicenseGate;
  /**
   * Only for the rare loader whose folder is not implied by its node class.
   * Leave unset: the folder is derived from `objectInfoNode` so the mapping
   * lives in exactly one place (`src/comfy/modelFolders.ts`).
   */
  targetFolder?: WorkflowModelFolder;
};

export type WorkflowRecommendedSettings = {
  steps?: number;
  cfg?: number;
  /**
   * Only for sketch presets whose ControlNet wants a different strength from
   * the panel's global default. The Z-Image Fun ControlNet lite weights apply
   * control to 3 layer blocks where the full weights use 15, so they need 1.0
   * to hold a sketch where 0.8 barely controls at all -- measured, not guessed.
   */
  controlStrength?: number;
};

export type WorkflowPresetDefinition = {
  id: WorkflowPreset;
  label: string;
  /** Artist-facing name of the model or approach; the tool name is shown separately. */
  displayName: string;
  mode: WorkflowMode;
  description: string;
  workflowFile: string;
  sourceWorkflowFile?: string;
  status: "stable" | "experimental" | "todo";
  recommendedSettings?: WorkflowRecommendedSettings;
  /**
   * Smallest long edge, in pixels, this preset's model can actually render at.
   *
   * Set only where the model has a native resolution well above the canvas
   * sizes artists work at. Z_image_Turbo is one: on a 447px document it would
   * otherwise sample a 28x28 latent, which does not resolve into an image at
   * all -- it returns the ControlNet's own line map over a maze-like texture.
   * The builder scales the generation up to this floor, keeps the source
   * aspect, and scales the finished image back down to the captured size, so
   * the imported layer still matches the artist's canvas.
   */
  minimumGenerationSize?: number;
  supportedModelFamilies: ModelFamily[];
  experimentalModelFamilies: ModelFamily[];
  modelSource: WorkflowModelSource;
  modelStack?: WorkflowRequiredModel[];
  injections: WorkflowInjectionTargets;
  requiredNodes: WorkflowNodeRequirement[];
  requiredModels?: WorkflowRequiredModel[];
  capability?: WorkflowCapability;
  /** Present only on presets that can take an optional LoRA. */
  loraInsertion?: WorkflowLoraInsertion;
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
      // ComfyUI's own required/optional split, which is about what the node
      // will run without -- not about what OpenLayer depends on. A preset that
      // wires an input the node declares optional still needs it to exist, so
      // the setup check reads both. InpaintCropImproved declares `mask`
      // optional and OpenLayer's whole inpaint contract rides on it.
      optional?: {
        [inputName: string]: unknown;
      };
    };
  }
>;

export type ComfyQueueResponse = {
  queue_running?: unknown[];
  queue_pending?: unknown[];
};
