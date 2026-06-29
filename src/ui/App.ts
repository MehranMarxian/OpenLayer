import { ComfyClient } from "../comfy/comfyClient";
import {
  createHardwareRecommendationReport,
  formatHardwareReport,
  HardwareRecommendationReport
} from "../comfy/hardwareAdvisor";
import {
  createFluxFillInpaintDebugSummary,
  validateFluxFillInpaintSource
} from "../comfy/inpaintValidation";
import { createFluxFillEmbeddedMaskSource } from "../comfy/fluxFillMaskBridge";
import {
  formatInpaintOutputDiagnostics,
  ImageDimensions,
  InpaintImportMode,
  readImageDimensionsFromBlob,
  saveInpaintDebugBlobsToTemporaryFiles
} from "../comfy/inpaintOutput";
import { getCheckpointCompatibility } from "../comfy/modelCompatibility";
import { getWorkflowPreset, listRunnableWorkflowPresets, listWorkflowPresets } from "../comfy/presetRegistry";
import { validateGenerationSettings, validateImageToImageSettings, validateSketchToImageSettings } from "../comfy/settings";
import {
  buildImg2ImgWorkflow,
  buildInpaintWorkflow,
  buildSketchToImageWorkflow,
  buildTxt2ImgWorkflow
} from "../comfy/workflowBuilder";
import {
  createWorkflowDiagnosticMessage,
  createWorkflowReadinessSummary,
  WorkflowDiagnosticMessage
} from "../comfy/workflowDiagnostics";
import {
  createWorkflowHealthReport,
  WorkflowHealthItem,
  WorkflowHealthReport
} from "../comfy/workflowHealth";
import type { WorkflowPhotoshopInputAvailability } from "../comfy/workflowCompatibility";
import { GeneratedImageResult, WorkflowPresetDefinition } from "../comfy/types";
import {
  ExportedSourceImage,
  SelectedRegionSourceImage,
  captureSelectionForInpainting,
  exportActiveLayerForImageToImage,
  exportCanvasForImageToImage,
  getActiveDocumentInfo,
  importGeneratedImageAsLayer,
  importImageAlignedToSelection
} from "../photoshop/photoshopAdapter";
import { formatSelectionBounds } from "../photoshop/selectionUtils";
import { createOpenLayerError, getErrorMessage, getTechnicalErrorDetails } from "../utils/errors";
import { createLayerName } from "../utils/fileUtils";
import {
  clearOpenLayerPreferences,
  loadOpenLayerPreferences,
  OpenLayerPreferences,
  saveOpenLayerPreferences
} from "../utils/preferences";

const DEFAULT_SERVER_URL = "http://127.0.0.1:8190";
const APP_VERSION = "0.4.6";
const DEVELOPER_GITHUB = "https://github.com/MehranMarxian";
const HISTORY_LIMIT = 5;
const COMFY_PORT_CANDIDATES = [8190, 8188, 8189, 8191, 8192, 8193, 7860];
const DEFAULT_WORKFLOW = "txt2img-basic";
const DEFAULT_IMAGE_WORKFLOW = "img2img-basic";
const DEFAULT_SKETCH_WORKFLOW = "sketch2img-linecn-basic";
const DEFAULT_INPAINT_WORKFLOW = "inpaint-basic";
const RECOMMENDED_SKETCH_CHECKPOINT = "epicrealism_naturalSinRC1VAE.safetensors";
const DEFAULT_WIDTH = "512";
const DEFAULT_HEIGHT = "512";
const DEFAULT_STEPS = "4";
const DEFAULT_CFG = "7";
const DEFAULT_IMG2IMG_STEPS = "12";
const DEFAULT_IMG2IMG_DENOISE = "0.55";
const DEFAULT_SKETCH_STEPS = "16";
const DEFAULT_SKETCH_DENOISE = "0.65";
const DEFAULT_SKETCH_CONTROL_STRENGTH = "0.8";
const DEFAULT_INPAINT_STEPS = "16";
const DEFAULT_INPAINT_DENOISE = "0.75";
const FALLBACK_CHECKPOINTS = [
  "epicrealism_naturalSinRC1VAE.safetensors",
  "epicrealism_pureEvolutionV5-inpainting.safetensors",
  "flux1-dev-fp8.safetensors",
  "model.safetensors",
  "sd3.5_large.safetensors",
  "sd3_medium_incl_clips_t5xxlfp8.safetensors",
  "sd_xl_base_1.0.safetensors",
  "sd_xl_refiner_1.0.safetensors"
];

type StatusTone = "idle" | "ready" | "error";
type AppView =
  | "home"
  | "text-to-image"
  | "image-to-image"
  | "sketch-to-image"
  | "inpaint"
  | "prompt-from-layer"
  | "settings"
  | "history";
type ToolCardStatus = "available" | "experimental" | "coming-soon";

type ToolCard = {
  id: string;
  title: string;
  subtitle: string;
  icon: ToolIconName;
  status: ToolCardStatus;
  view?: AppView;
};

type ToolIconName =
  | "image"
  | "imagePlus"
  | "brush"
  | "expand"
  | "lineart"
  | "promptFromLayer"
  | "upscale"
  | "style"
  | "control"
  | "workflow"
  | "layers"
  | "history"
  | "settings";

const TOOL_CARDS: ToolCard[] = [
  {
    id: "text-to-image",
    title: "Text to Image",
    subtitle: "Generate a new layer from a prompt",
    icon: "imagePlus",
    status: "available",
    view: "text-to-image"
  },
  {
    id: "image-to-image",
    title: "Image to Image",
    subtitle: "Use the active layer as visual input",
    icon: "image",
    status: "available",
    view: "image-to-image"
  },
  {
    id: "inpaint",
    title: "Inpaint",
    subtitle: "Selection repaint is in testing",
    icon: "brush",
    status: "experimental",
    view: "inpaint"
  },
  {
    id: "prompt-from-layer",
    title: "Prompt from Layer",
    subtitle: "Describe a layer into prompt text",
    icon: "promptFromLayer",
    status: "experimental",
    view: "prompt-from-layer"
  },
  {
    id: "outpaint",
    title: "Outpaint",
    subtitle: "Extend canvas content beyond edges",
    icon: "expand",
    status: "coming-soon"
  },
  {
    id: "lineart",
    title: "Sketch to Image",
    subtitle: "Guide generation with lineart",
    icon: "lineart",
    status: "available",
    view: "sketch-to-image"
  },
  {
    id: "upscale",
    title: "Upscale",
    subtitle: "Enhance generated or selected layers",
    icon: "upscale",
    status: "coming-soon"
  },
  {
    id: "style-reference",
    title: "Style Reference",
    subtitle: "Match mood, color, or visual language",
    icon: "style",
    status: "coming-soon"
  },
  {
    id: "workflow-presets",
    title: "Workflow Presets",
    subtitle: "Manage reusable ComfyUI workflows",
    icon: "control",
    status: "coming-soon"
  },
  {
    id: "workflow",
    title: "Workflow",
    subtitle: "Build and test custom ComfyUI graphs",
    icon: "workflow",
    status: "coming-soon"
  },
  {
    id: "layer-tools",
    title: "Layer Tools",
    subtitle: "Export layers, selections, and masks",
    icon: "layers",
    status: "coming-soon"
  },
  {
    id: "history",
    title: "History",
    subtitle: "Review recent generations",
    icon: "history",
    status: "available",
    view: "history"
  },
  {
    id: "settings",
    title: "Settings",
    subtitle: "Defaults, ports, paths, and diagnostics",
    icon: "settings",
    status: "available",
    view: "settings"
  }
];

type AppElements = {
  homeView: HTMLElement;
  generatorView: HTMLElement;
  imageToImageView: HTMLElement;
  sketchToImageView: HTMLElement;
  inpaintView: HTMLElement;
  promptFromLayerView: HTMLElement;
  settingsView: HTMLElement;
  historyView: HTMLElement;
  homeStatusText: HTMLElement;
  homeStatusDot: HTMLElement;
  serverUrl: HTMLInputElement;
  prompt: HTMLTextAreaElement;
  negativePrompt: HTMLTextAreaElement;
  workflow: HTMLSelectElement;
  checkpoint: HTMLSelectElement;
  width: HTMLInputElement;
  height: HTMLInputElement;
  steps: HTMLInputElement;
  cfg: HTMLInputElement;
  seed: HTMLInputElement;
  checkButton: HTMLElement;
  findPortButton: HTMLElement;
  detectHardwareButton: HTMLElement;
  checkWorkflowHealthButton: HTMLElement;
  copyDiagnosticsButton: HTMLElement;
  saveSettingsButton: HTMLElement;
  resetSettingsButton: HTMLElement;
  generateButton: HTMLElement;
  importButton: HTMLElement;
  autoImportToggle: HTMLElement;
  imgPrompt: HTMLTextAreaElement;
  imgNegativePrompt: HTMLTextAreaElement;
  imgWorkflow: HTMLSelectElement;
  imgCheckpoint: HTMLSelectElement;
  imgSteps: HTMLInputElement;
  imgCfg: HTMLInputElement;
  imgSeed: HTMLInputElement;
  imgDenoise: HTMLInputElement;
  captureLayerButton: HTMLElement;
  captureCanvasButton: HTMLElement;
  generateImg2ImgButton: HTMLElement;
  importImg2ImgButton: HTMLElement;
  sketchPrompt: HTMLTextAreaElement;
  sketchNegativePrompt: HTMLTextAreaElement;
  sketchWorkflow: HTMLSelectElement;
  sketchCheckpoint: HTMLSelectElement;
  sketchSteps: HTMLInputElement;
  sketchCfg: HTMLInputElement;
  sketchSeed: HTMLInputElement;
  sketchDenoise: HTMLInputElement;
  sketchControlStrength: HTMLInputElement;
  captureSketchLayerButton: HTMLElement;
  captureSketchCanvasButton: HTMLElement;
  generateSketchButton: HTMLElement;
  importSketchButton: HTMLElement;
  inpaintPrompt: HTMLTextAreaElement;
  inpaintNegativePrompt: HTMLTextAreaElement;
  inpaintWorkflow: HTMLSelectElement;
  inpaintCheckpoint: HTMLSelectElement;
  inpaintSteps: HTMLInputElement;
  inpaintCfg: HTMLInputElement;
  inpaintSeed: HTMLInputElement;
  inpaintDenoise: HTMLInputElement;
  captureInpaintSelectionButton: HTMLElement;
  generateInpaintButton: HTMLElement;
  importInpaintButton: HTMLElement;
  capturePromptLayerButton: HTMLElement;
  capturePromptCanvasButton: HTMLElement;
  generatePromptLayerButton: HTMLElement;
  copyPromptLayerButton: HTMLElement;
  sendPromptLayerButton: HTMLElement;
  experimentalCheckpointToggle: HTMLElement;
  negativePromptToggle: HTMLElement;
  negativePromptField: HTMLElement;
  clearHistoryButton: HTMLElement;
  statusText: HTMLElement;
  statusPill: HTMLElement;
  imgStatusText: HTMLElement;
  imgStatusPill: HTMLElement;
  sketchStatusText: HTMLElement;
  sketchStatusPill: HTMLElement;
  inpaintStatusText: HTMLElement;
  inpaintStatusPill: HTMLElement;
  promptLayerStatusText: HTMLElement;
  promptLayerStatusPill: HTMLElement;
  settingsStatusText: HTMLElement;
  settingsStatusPill: HTMLElement;
  diagnosticsText: HTMLElement;
  imgDiagnosticsText: HTMLElement;
  imgCompatibilityNote: HTMLElement;
  sketchDiagnosticsText: HTMLElement;
  sketchCompatibilityNote: HTMLElement;
  inpaintDiagnosticsText: HTMLElement;
  inpaintCompatibilityNote: HTMLElement;
  promptLayerDiagnosticsText: HTMLElement;
  settingsDiagnosticsText: HTMLElement;
  errorMessage: HTMLElement;
  imgErrorMessage: HTMLElement;
  sketchErrorMessage: HTMLElement;
  inpaintErrorMessage: HTMLElement;
  promptLayerErrorMessage: HTMLElement;
  settingsErrorMessage: HTMLElement;
  previewPanel: HTMLElement;
  imageSourcePreviewPanel: HTMLElement;
  imageSourceTitle: HTMLElement;
  imageSourceMeta: HTMLElement;
  imageResultPreviewPanel: HTMLElement;
  sketchSourcePreviewPanel: HTMLElement;
  sketchSourceTitle: HTMLElement;
  sketchSourceMeta: HTMLElement;
  sketchResultPreviewPanel: HTMLElement;
  inpaintSourcePreviewPanel: HTMLElement;
  inpaintSourceTitle: HTMLElement;
  inpaintSourceMeta: HTMLElement;
  inpaintMaskPreviewPanel: HTMLElement;
  inpaintMaskMeta: HTMLElement;
  inpaintResultPreviewPanel: HTMLElement;
  promptLayerSourcePreviewPanel: HTMLElement;
  promptLayerSourceTitle: HTMLElement;
  promptLayerSourceMeta: HTMLElement;
  promptLayerGeneratedText: HTMLTextAreaElement;
  historyList: HTMLElement;
  settingsUrlValue: HTMLElement;
  settingsCheckpointCount: HTMLElement;
  settingsLastCheckpoint: HTMLElement;
  settingsDocumentStatus: HTMLElement;
  settingsWorkflowReadiness: HTMLElement;
  settingsGpuName: HTMLElement;
  settingsVramTotal: HTMLElement;
  settingsVramFree: HTMLElement;
  settingsVramTier: HTMLElement;
  settingsModelFamilies: HTMLElement;
  settingsZImageTurbo: HTMLElement;
  settingsModelRecommendations: HTMLElement;
  settingsWorkflowHealthSummary: HTMLElement;
  settingsWorkflowHealthList: HTMLElement;
  settingsDiagnosticsReport: HTMLTextAreaElement;
};

type HistoryEntry = {
  id: string;
  result: GeneratedImageResult;
  previewUrl: string;
  prompt: string;
  checkpointName: string;
  seed: number;
  sizeLabel: string;
  createdAt: string;
};

type ImageSourceState = ExportedSourceImage & {
  previewUrl: string;
};

type InpaintSourceState = SelectedRegionSourceImage & {
  previewUrl: string;
};

export function renderApp(rootElement: HTMLElement) {
  let currentView: AppView = "home";
  let isBusy = false;
  let result: GeneratedImageResult | null = null;
  let previewUrl = "";
  let livePreviewUrl = "";
  let imageSource: ImageSourceState | null = null;
  let imageResult: GeneratedImageResult | null = null;
  let imageSourcePreviewUrl = "";
  let imageResultPreviewUrl = "";
  let imageLivePreviewUrl = "";
  let sketchSource: ImageSourceState | null = null;
  let sketchResult: GeneratedImageResult | null = null;
  let sketchSourcePreviewUrl = "";
  let sketchResultPreviewUrl = "";
  let sketchLivePreviewUrl = "";
  let inpaintSource: InpaintSourceState | null = null;
  let inpaintResult: GeneratedImageResult | null = null;
  let inpaintSourcePreviewUrl = "";
  let inpaintMaskPreviewUrl = "";
  let inpaintResultPreviewUrl = "";
  let inpaintLivePreviewUrl = "";
  let promptLayerSource: ImageSourceState | null = null;
  let promptLayerSourcePreviewUrl = "";
  let importAutomatically = false;
  let isNegativePromptOpen = false;
  let allowExperimentalCheckpoints = false;
  let hardwareReport: HardwareRecommendationReport | null = null;
  let workflowHealthReport: WorkflowHealthReport | null = null;
  const historyEntries: HistoryEntry[] = [];

  rootElement.innerHTML = createAppMarkup();

  const elements = getAppElements(rootElement);
  const preferences = loadOpenLayerPreferences();
  applyPreferences(elements, preferences);
  fillCheckpointOptions(elements, FALLBACK_CHECKPOINTS, preferences.checkpointName || FALLBACK_CHECKPOINTS[0]);

  const actionHandlers: ActionHandlers = {
    check: createActionRunner(elements, "check", handleCheckComfy),
    findPort: createActionRunner(elements, "findPort", handleFindComfyPort),
    detectHardware: createActionRunner(elements, "detectHardware", handleDetectHardware),
    checkWorkflowHealth: createActionRunner(elements, "checkWorkflowHealth", handleCheckWorkflowHealth),
    copyDiagnostics: createActionRunner(elements, "copyDiagnostics", handleCopyDiagnostics),
    saveSettings: createActionRunner(elements, "saveSettings", handleSaveSettings),
    resetSettings: createActionRunner(elements, "resetSettings", handleResetSettings),
    toggleNegativePrompt: createActionRunner(elements, "toggleNegativePrompt", handleToggleNegativePrompt),
    toggleAutoImport: createActionRunner(elements, "toggleAutoImport", handleToggleAutoImport),
    generate: createActionRunner(elements, "generate", handleGenerate),
    import: createActionRunner(elements, "import", handleImport),
    captureImageSource: createActionRunner(elements, "captureImageSource", handleCaptureImageSource),
    captureCanvasSource: createActionRunner(elements, "captureCanvasSource", handleCaptureCanvasSource),
    toggleExperimentalCheckpoints: createActionRunner(
      elements,
      "toggleExperimentalCheckpoints",
      handleToggleExperimentalCheckpoints
    ),
    generateImg2Img: createActionRunner(elements, "generateImg2Img", handleGenerateImg2Img),
    importImg2Img: createActionRunner(elements, "importImg2Img", handleImportImg2Img),
    captureSketchSource: createActionRunner(elements, "captureSketchSource", handleCaptureSketchSource),
    captureSketchCanvasSource: createActionRunner(elements, "captureSketchCanvasSource", handleCaptureSketchCanvasSource),
    generateSketch: createActionRunner(elements, "generateSketch", handleGenerateSketch),
    importSketch: createActionRunner(elements, "importSketch", handleImportSketch),
    captureInpaintSelection: createActionRunner(elements, "captureInpaintSelection", handleCaptureInpaintSelection),
    generateInpaint: createActionRunner(elements, "generateInpaint", handleGenerateInpaint),
    importInpaint: createActionRunner(elements, "importInpaint", handleImportInpaint),
    capturePromptLayerSource: createActionRunner(elements, "capturePromptLayerSource", handleCapturePromptLayerSource),
    capturePromptCanvasSource: createActionRunner(elements, "capturePromptCanvasSource", handleCapturePromptCanvasSource),
    generatePromptFromLayer: createActionRunner(elements, "generatePromptFromLayer", handleGeneratePromptFromLayer),
    copyPromptFromLayer: createActionRunner(elements, "copyPromptFromLayer", handleCopyPromptFromLayer),
    sendPromptToTextToImage: createActionRunner(elements, "sendPromptToTextToImage", handleSendPromptToTextToImage),
    clearHistory: createActionRunner(elements, "clearHistory", handleClearHistory)
  };

  bindActionControl(elements.checkButton, actionHandlers.check);
  bindActionControl(elements.findPortButton, actionHandlers.findPort);
  bindActionControl(elements.detectHardwareButton, actionHandlers.detectHardware);
  bindActionControl(elements.checkWorkflowHealthButton, actionHandlers.checkWorkflowHealth);
  bindActionControl(elements.copyDiagnosticsButton, actionHandlers.copyDiagnostics);
  bindActionControl(elements.saveSettingsButton, actionHandlers.saveSettings);
  bindActionControl(elements.resetSettingsButton, actionHandlers.resetSettings);
  bindActionControl(elements.negativePromptToggle, actionHandlers.toggleNegativePrompt);
  bindActionControl(elements.autoImportToggle, actionHandlers.toggleAutoImport);
  bindActionControl(elements.generateButton, actionHandlers.generate);
  bindActionControl(elements.importButton, actionHandlers.import);
  bindActionControl(elements.captureLayerButton, actionHandlers.captureImageSource);
  bindActionControl(elements.captureCanvasButton, actionHandlers.captureCanvasSource);
  bindActionControl(elements.experimentalCheckpointToggle, actionHandlers.toggleExperimentalCheckpoints);
  bindActionControl(elements.generateImg2ImgButton, actionHandlers.generateImg2Img);
  bindActionControl(elements.importImg2ImgButton, actionHandlers.importImg2Img);
  bindActionControl(elements.captureSketchLayerButton, actionHandlers.captureSketchSource);
  bindActionControl(elements.captureSketchCanvasButton, actionHandlers.captureSketchCanvasSource);
  bindActionControl(elements.generateSketchButton, actionHandlers.generateSketch);
  bindActionControl(elements.importSketchButton, actionHandlers.importSketch);
  bindActionControl(elements.captureInpaintSelectionButton, actionHandlers.captureInpaintSelection);
  bindActionControl(elements.generateInpaintButton, actionHandlers.generateInpaint);
  bindActionControl(elements.importInpaintButton, actionHandlers.importInpaint);
  bindActionControl(elements.capturePromptLayerButton, actionHandlers.capturePromptLayerSource);
  bindActionControl(elements.capturePromptCanvasButton, actionHandlers.capturePromptCanvasSource);
  bindActionControl(elements.generatePromptLayerButton, actionHandlers.generatePromptFromLayer);
  bindActionControl(elements.copyPromptLayerButton, actionHandlers.copyPromptFromLayer);
  bindActionControl(elements.sendPromptLayerButton, actionHandlers.sendPromptToTextToImage);
  bindActionControl(elements.clearHistoryButton, actionHandlers.clearHistory);
  bindDelegatedActions(rootElement, actionHandlers);
  bindDocumentActions(rootElement, actionHandlers);
  bindToolCards(rootElement, (view) => setView(view));
  bindHistoryActions(rootElement, handleHistoryAction);
  bindExternalLinks(rootElement);

  setStatus(elements, "Ready.", "idle");
  setView(currentView);
  setError(elements, "");
  setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
  updateNegativePromptDisclosure(elements, isNegativePromptOpen);
  updateAutoImportToggle(elements, importAutomatically);
  updateExperimentalCheckpointToggle(elements, allowExperimentalCheckpoints);
  updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
  setImageSource(null);
  setImageResult(null);
  updateSketchCheckpointCompatibility(elements, sketchSource);
  setSketchSource(null);
  setSketchResult(null);
  updateInpaintCheckpointCompatibility(elements, inpaintSource);
  setInpaintSource(null);
  setInpaintResult(null);
  setPromptLayerSource(null);
  updateSettingsReport(elements);
  renderHardwareReport(elements, hardwareReport);
  renderWorkflowHealthReport(elements, workflowHealthReport);
  renderHistory(elements, historyEntries);
  void loadInitialCheckpoints();

  elements.workflow.addEventListener("change", () => {
    void refreshTextModelOptionsForSelectedPreset(elements).then(() => updateTextCheckpointCompatibility(elements));
  });

  elements.checkpoint.addEventListener("change", () => {
    updateTextCheckpointCompatibility(elements);
  });

  elements.imgWorkflow.addEventListener("change", () => {
    void refreshImageModelOptionsForSelectedPreset(elements).then(() => (
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource)
    ));
  });

  elements.imgCheckpoint.addEventListener("change", () => {
    updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
  });

  elements.sketchWorkflow.addEventListener("change", () => {
    updateSketchCheckpointCompatibility(elements, sketchSource);
  });

  elements.sketchCheckpoint.addEventListener("change", () => {
    updateSketchCheckpointCompatibility(elements, sketchSource);
  });

  elements.inpaintWorkflow.addEventListener("change", () => {
    void refreshInpaintModelOptionsForSelectedPreset(elements);
    updateInpaintCheckpointCompatibility(elements, inpaintSource);
  });

  elements.inpaintCheckpoint.addEventListener("change", () => {
    updateInpaintCheckpointCompatibility(elements, inpaintSource);
  });

  async function loadInitialCheckpoints() {
    setStatus(elements, "Loading ComfyUI models...", "idle");

    try {
      const client = new ComfyClient(elements.serverUrl.value);
      await client.checkOnline();
      await loadCheckpoints(client, elements, preferences.checkpointName || readSelectValue(elements.checkpoint));
      await refreshTextModelOptionsForSelectedPreset(elements, client);
      await refreshImageModelOptionsForSelectedPreset(elements, client);
      await refreshInpaintModelOptionsForSelectedPreset(elements, client);
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
      updateSketchCheckpointCompatibility(elements, sketchSource);
      updateInpaintCheckpointCompatibility(elements, inpaintSource);
      setStatus(elements, "ComfyUI is online. Models loaded.", "ready");
      savePreferencesFromElements(elements);
      updateSettingsReport(elements);
    } catch (caughtError) {
      setStatus(elements, "Ready.", "idle");
      setError(elements, `Using fallback model list. ${getErrorMessage(caughtError)}`);
      updateSettingsReport(elements);
    }
  }

  async function handleCheckComfy() {
    setDiagnostics(elements, "Check ComfyUI pressed.");
    setError(elements, "");
    setStatus(elements, "Checking ComfyUI...", "idle");

    try {
      const client = new ComfyClient(elements.serverUrl.value);
      await client.checkOnline();
      await loadCheckpoints(client, elements);
      await refreshTextModelOptionsForSelectedPreset(elements, client);
      await refreshImageModelOptionsForSelectedPreset(elements, client);
      await refreshInpaintModelOptionsForSelectedPreset(elements, client);
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
      updateSketchCheckpointCompatibility(elements, sketchSource);
      updateInpaintCheckpointCompatibility(elements, inpaintSource);
      setStatus(elements, "ComfyUI is online. Models loaded.", "ready");
      savePreferencesFromElements(elements);
      updateSettingsReport(elements);
    } catch (caughtError) {
      setStatus(elements, "ComfyUI check failed.", "error");
      setError(elements, getErrorMessage(caughtError));
      updateSettingsReport(elements);
    }
  }

  async function handleFindComfyPort() {
    setDiagnostics(elements, "Scanning common local ComfyUI ports...");
    setError(elements, "");
    setStatus(elements, "Looking for ComfyUI...", "idle");

    const foundUrl = await findActiveComfyUrl(elements.serverUrl.value, (message) => {
      setDiagnostics(elements, message);
    });

    if (!foundUrl) {
      setStatus(elements, "No active ComfyUI port found.", "error");
      setError(elements, "OpenLayer could not find ComfyUI on the common local ports. Start ComfyUI and try again.");
      updateSettingsReport(elements);
      return;
    }

    elements.serverUrl.value = foundUrl;

    try {
      const client = new ComfyClient(foundUrl);
      await loadCheckpoints(client, elements);
      await refreshTextModelOptionsForSelectedPreset(elements, client);
      await refreshImageModelOptionsForSelectedPreset(elements, client);
      await refreshInpaintModelOptionsForSelectedPreset(elements, client);
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
      updateSketchCheckpointCompatibility(elements, sketchSource);
      updateInpaintCheckpointCompatibility(elements, inpaintSource);
      savePreferencesFromElements(elements);
      setStatus(elements, `Found ComfyUI at ${foundUrl}.`, "ready");
      setDiagnostics(elements, `Active ComfyUI server selected: ${foundUrl}.`);
    } catch (caughtError) {
      setStatus(elements, `Found ${foundUrl}, but model loading failed.`, "error");
      setError(elements, getErrorMessage(caughtError));
    } finally {
      updateSettingsReport(elements);
    }
  }

  async function handleDetectHardware() {
    setDiagnostics(elements, "Detecting GPU and installed model families through ComfyUI...");
    setError(elements, "");
    setStatus(elements, "Detecting GPU...", "idle");

    try {
      const client = new ComfyClient(elements.serverUrl.value);
      const systemStats = await client.getSystemStats();
      const inventory = await client.getModelInventory();
      hardwareReport = createHardwareRecommendationReport(systemStats, inventory, listWorkflowPresets());

      renderHardwareReport(elements, hardwareReport);
      setStatus(elements, "GPU recommendations ready.", "ready");
      setDiagnostics(elements, formatHardwareReport(hardwareReport));
    } catch (caughtError) {
      hardwareReport = null;
      renderHardwareReport(elements, hardwareReport);
      setStatus(elements, "GPU detection failed.", "error");
      setError(elements, getErrorMessage(caughtError));
      setDiagnostics(elements, "Start ComfyUI, confirm the server URL, then run Detect GPU & Recommend Models again.");
    } finally {
      updateSettingsReport(elements);
    }
  }

  async function handleCheckWorkflowHealth() {
    setDiagnostics(elements, "Checking workflow health against local ComfyUI...");
    setError(elements, "");
    setStatus(elements, "Checking workflow health...", "idle");

    try {
      const presets = listWorkflowPresets();
      const client = new ComfyClient(elements.serverUrl.value);
      await client.checkOnline();
      const inventory = await client.getModelInventory();
      const availableNodes = await client.getWorkflowNodeAvailability(presets);
      const report = createWorkflowHealthReport(presets, {
        availableModels: inventory,
        availableNodes
      });

      workflowHealthReport = report;
      renderWorkflowHealthReport(elements, workflowHealthReport);
      setStatus(elements, "Workflow health checked.", report.issueCount > 0 ? "idle" : "ready");
      setDiagnostics(elements, report.summary);
    } catch (caughtError) {
      workflowHealthReport = null;
      renderWorkflowHealthReport(elements, workflowHealthReport);
      setStatus(elements, "Workflow health check failed.", "error");
      setError(elements, getErrorMessage(caughtError));
      setDiagnostics(elements, "Start ComfyUI, confirm the server URL, then run Check Workflow Health again.");
    } finally {
      updateSettingsReport(elements);
    }
  }

  async function handleCopyDiagnostics() {
    const reportText = createDiagnosticsReport(elements, hardwareReport, workflowHealthReport);
    elements.settingsDiagnosticsReport.value = reportText;
    elements.settingsDiagnosticsReport.hidden = false;

    try {
      const clipboard = (navigator as Navigator & {
        clipboard?: { writeText?: (text: string) => Promise<void> };
      }).clipboard;

      if (typeof clipboard?.writeText !== "function") {
        throw new Error("Clipboard API is unavailable.");
      }

      await clipboard.writeText(reportText);
      setStatus(elements, "Diagnostics copied.", "ready");
      setDiagnostics(elements, "Copied a compact OpenLayer diagnostics report to the clipboard.");
    } catch {
      setStatus(elements, "Diagnostics ready to copy.", "ready");
      setDiagnostics(elements, "Clipboard is unavailable here. The diagnostics report is shown below for manual copy.");
    }
  }

  function handleSaveSettings() {
    const wasSaved = savePreferencesFromElements(elements);
    updateSettingsReport(elements);
    setStatus(elements, wasSaved ? "Settings saved." : "Settings are active for this session.", "ready");
    setDiagnostics(
      elements,
      wasSaved
        ? "Saved ComfyUI URL, checkpoint, and generation defaults."
        : "Local storage is unavailable, so settings will reset when the panel reloads."
    );
  }

  function handleResetSettings() {
    clearOpenLayerPreferences();
    applyDefaultSettings(elements);
    fillCheckpointOptions(elements, FALLBACK_CHECKPOINTS, FALLBACK_CHECKPOINTS[0]);
    updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
    updateSketchCheckpointCompatibility(elements, sketchSource);
    updateInpaintCheckpointCompatibility(elements, inpaintSource);
    setError(elements, "");
    setStatus(elements, "Settings reset to OpenLayer defaults.", "ready");
    setDiagnostics(elements, "Defaults restored. Click Check ComfyUI to reload available models.");
    updateSettingsReport(elements);
  }

  function handleToggleNegativePrompt() {
    isNegativePromptOpen = !isNegativePromptOpen;
    updateNegativePromptDisclosure(elements, isNegativePromptOpen);
  }

  function handleToggleAutoImport() {
    importAutomatically = !importAutomatically;
    updateAutoImportToggle(elements, importAutomatically);
    setDiagnostics(elements, importAutomatically ? "Auto import is on." : "Auto import is off.");
  }

  function handleToggleExperimentalCheckpoints() {
    allowExperimentalCheckpoints = !allowExperimentalCheckpoints;
    updateExperimentalCheckpointToggle(elements, allowExperimentalCheckpoints);
    updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
    setImageDiagnostics(
      elements,
      allowExperimentalCheckpoints
        ? "Experimental checkpoints are allowed for Image to Image. Some workflows may still fail."
        : "Experimental checkpoints are protected. Use SD 1.x or SDXL for img2img-basic."
    );
  }

  async function handleGenerate() {
    setDiagnostics(elements, `Generate pressed at ${new Date().toLocaleTimeString()}.`);

    if (!elements.prompt.value.trim()) {
      setError(elements, getErrorMessage(createOpenLayerError("PROMPT_REQUIRED", "Enter a prompt before generating.")));
      setStatus(elements, "Prompt required.", "error");
      return;
    }

    setError(elements, "");
    setResult(null);
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    setStatus(elements, "Preparing workflow...", "idle");
    setProgressPreview(elements, "Preparing workflow...");
    let progressWatcher: ReturnType<ComfyClient["watchProgress"]> | null = null;

    try {
      const workflowPreset = readSelectValue(elements.workflow, DEFAULT_WORKFLOW);
      const preset = getWorkflowPreset(workflowPreset);
      const checkpointName = readSelectValue(elements.checkpoint);
      const requestedSeed = elements.seed.value.trim();
      const { settings, warnings } = validateGenerationSettings({
        width: elements.width.value,
        height: elements.height.value,
        steps: elements.steps.value,
        cfg: elements.cfg.value,
        seed: elements.seed.value
      });
      const client = new ComfyClient(elements.serverUrl.value);

      applyValidatedSettings(elements, settings);
      setDiagnostics(elements, warnings.length > 0 ? warnings.join(" ") : createWorkflowDiagnostics(preset, checkpointName));
      await client.checkOnline();

      if (!checkpointName) {
        throw createOpenLayerError("CHECKPOINT_REQUIRED", "Choose a ComfyUI checkpoint before generating.");
      }

      const compatibility = getCheckpointCompatibility(checkpointName, preset);

      if (compatibility.isExperimental) {
        setDiagnostics(elements, `${compatibility.label} ${compatibility.warning}`);
      }

      setStatus(elements, "Checking selected checkpoint...", "idle");
      setProgressPreview(elements, "Checking selected checkpoint...");

      if (!(await client.hasModelForPreset(checkpointName, preset))) {
        throw createOpenLayerError(
          "CHECKPOINT_REQUIRED",
          `The ${preset.modelSource.label.toLowerCase()} "${checkpointName}" was not found in ComfyUI. Click Check ComfyUI and choose an available model.`
        );
      }

      const buildResult = await buildTxt2ImgWorkflow({
        presetId: preset.id,
        prompt: elements.prompt.value,
        negativePrompt: elements.negativePrompt.value,
        checkpointName,
        width: settings.width,
        height: settings.height,
        steps: settings.steps,
        cfg: settings.cfg,
        seed: settings.seed
      });

      setStatus(elements, "Submitting prompt to ComfyUI...", "idle");
      setProgressPreview(elements, "Submitting prompt to ComfyUI...");
      const promptId = await client.submitPrompt(buildResult.workflow);
      let hasLivePreview = false;
      progressWatcher = client.watchProgress(promptId, {
        onStatus: (message) => {
          setStatus(elements, message, "idle");

          if (!hasLivePreview) {
            setProgressPreview(elements, message);
          }
        },
        onPreviewBlob: (blob) => {
          hasLivePreview = true;
          setProgressPreview(elements, "Live ComfyUI preview...", blob);
        },
        onError: (message) => setDiagnostics(elements, message)
      });

      setStatus(elements, "Generating image...", "idle");
      setProgressPreview(elements, "Generating image...");
      const history = await client.pollUntilComplete(
        promptId,
        {
          onTick: (message) => {
            setStatus(elements, message, "idle");

            if (!hasLivePreview) {
              setProgressPreview(elements, message);
            }
          }
        }
      );
      progressWatcher?.close();
      progressWatcher = null;

      setStatus(elements, "Retrieving image...", "idle");
      setProgressPreview(elements, "Retrieving final image...");
      const generatedResult = await client.retrieveFirstOutputImage(promptId, history, {
        preferredNodeId: getSaveImageNodeId(buildResult.preset)
      });
      setResult(generatedResult);
      addHistoryEntry(elements, historyEntries, generatedResult, {
        prompt: elements.prompt.value,
        checkpointName,
        seed: buildResult.seed,
        sizeLabel: `${settings.width} x ${settings.height}`
      });

      if (importAutomatically) {
        setStatus(elements, "Generation complete. Auto-importing...", "idle");
        setDiagnostics(elements, `Seed used: ${buildResult.seed}. Auto import is on.`);
        await handleImport("auto");
      } else {
        setStatus(elements, "Generation complete.", "ready");
        setDiagnostics(elements, `Seed used: ${buildResult.seed}. Workflow: ${buildResult.preset.id}.`);
      }

      savePreferencesFromElements(elements, { seed: requestedSeed });
      updateSettingsReport(elements);
    } catch (caughtError) {
      setStatus(elements, "Generation failed.", "error");
      setError(elements, getErrorMessage(caughtError));
      setDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      progressWatcher?.close();
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  function handleClearHistory() {
    clearHistoryEntries(historyEntries);
    renderHistory(elements, historyEntries);
    setStatus(elements, "History cleared.", "ready");
    setDiagnostics(elements, "Recent session history cleared.");
  }

  function handleHistoryAction(action: HistoryActionName, historyId: string) {
    if (isBusy) {
      setDiagnostics(elements, "Finish the current operation before using history.");
      return;
    }

    const entry = historyEntries.find((item) => item.id === historyId);

    if (!entry) {
      setStatus(elements, "History item not found.", "error");
      setError(elements, "That history item is no longer available in this session.");
      return;
    }

    setResult(entry.result);
    setError(elements, "");
    setView("text-to-image");

    if (action === "preview") {
      setStatus(elements, "Loaded history item into preview.", "ready");
      setDiagnostics(elements, `History item loaded: seed ${entry.seed}, ${entry.sizeLabel}.`);
      return;
    }

    void handleImport();
  }

  async function handleImport(source: "manual" | "auto" = "manual") {
    setDiagnostics(elements, source === "auto" ? "Auto import started." : "Import pressed.");

    if (!result) {
      setError(elements, "Generate an image before importing.");
      return;
    }

    setError(elements, "");
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    setStatus(elements, "Importing image into Photoshop...", "idle");

    try {
      const documentInfo = await getActiveDocumentInfo();
      const layerName = createLayerName("OpenLayer_Generated");

      setDiagnostics(elements, `Importing into ${documentInfo.name || "active document"}...`);
      const importedLayerName = await importGeneratedImageAsLayer(result.blob, layerName, (message) => {
        setStatus(elements, message, "idle");
        setDiagnostics(elements, message);
      });
      setStatus(elements, `Imported layer: ${importedLayerName}`, "ready");
      setDiagnostics(elements, `Layer created: ${importedLayerName}`);
    } catch (caughtError) {
      setStatus(elements, "Import failed.", "error");
      setError(elements, getErrorMessage(caughtError));
    } finally {
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  async function handleCaptureImageSource() {
    await captureImageToImageSource({
      progressMessage: "Capturing active Photoshop layer...",
      statusMessage: "Capturing active layer...",
      successMessage: "Source layer captured.",
      capture: exportActiveLayerForImageToImage
    });
  }

  async function handleCaptureCanvasSource() {
    await captureImageToImageSource({
      progressMessage: "Capturing Photoshop canvas...",
      statusMessage: "Capturing canvas...",
      successMessage: "Canvas captured.",
      capture: exportCanvasForImageToImage
    });
  }

  async function captureImageToImageSource(options: {
    progressMessage: string;
    statusMessage: string;
    successMessage: string;
    capture: () => Promise<ExportedSourceImage>;
  }) {
    setImageDiagnostics(elements, options.progressMessage);
    setImageError(elements, "");
    setImageStatus(elements, options.statusMessage, "idle");
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);

    try {
      const exportedSource = await options.capture();
      const sourcePreview = URL.createObjectURL(exportedSource.blob);
      setImageSource({
        ...exportedSource,
        previewUrl: sourcePreview
      });
      setImageStatus(elements, options.successMessage, "ready");
      setImageDiagnostics(
        elements,
        createSourceCaptureMessage(exportedSource)
      );
    } catch (caughtError) {
      setImageStatus(elements, "Source capture failed.", "error");
      setImageError(elements, getErrorMessage(caughtError));
      setImageDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  async function handleGenerateImg2Img() {
    setImageDiagnostics(elements, `Image to Image generate pressed at ${new Date().toLocaleTimeString()}.`);

    if (!imageSource) {
      setImageError(elements, "Capture the active Photoshop layer before generating Image to Image.");
      setImageStatus(elements, "Source required.", "error");
      setImageDiagnostics(
        elements,
        createWorkflowDiagnostics(
          getWorkflowPreset(readSelectValue(elements.imgWorkflow, DEFAULT_IMAGE_WORKFLOW)),
          readSelectValue(elements.imgCheckpoint),
          createSourceInputAvailability(imageSource)
        )
      );
      return;
    }

    if (!elements.imgPrompt.value.trim()) {
      setImageError(elements, getErrorMessage(createOpenLayerError("PROMPT_REQUIRED", "Enter a prompt before generating.")));
      setImageStatus(elements, "Prompt required.", "error");
      return;
    }

    setImageError(elements, "");
    setImageResult(null);
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    setImageStatus(elements, "Preparing Image to Image workflow...", "idle");
    setImageProgressPreview(elements, "Preparing Image to Image workflow...");
    let progressWatcher: ReturnType<ComfyClient["watchProgress"]> | null = null;

    try {
      const workflowPreset = readSelectValue(elements.imgWorkflow, DEFAULT_IMAGE_WORKFLOW);
      const preset = getWorkflowPreset(workflowPreset);
      const checkpointName = readSelectValue(elements.imgCheckpoint);
      const { settings, warnings } = validateImageToImageSettings({
        steps: elements.imgSteps.value,
        cfg: elements.imgCfg.value,
        seed: elements.imgSeed.value,
        denoise: elements.imgDenoise.value
      });
      const client = new ComfyClient(elements.serverUrl.value);

      applyValidatedImageToImageSettings(elements, settings);
      setImageDiagnostics(
        elements,
        warnings.length > 0
          ? warnings.join(" ")
          : createWorkflowDiagnostics(preset, checkpointName, createSourceInputAvailability(imageSource))
      );
      await client.checkOnline();

      if (!checkpointName) {
        throw createOpenLayerError("CHECKPOINT_REQUIRED", "Choose a ComfyUI checkpoint before generating.");
      }

      const compatibility = getCheckpointCompatibility(checkpointName, preset);

      if (compatibility.isExperimental && !allowExperimentalCheckpoints) {
        throw createOpenLayerError(
          "CHECKPOINT_UNSUPPORTED",
          `${checkpointName} is marked experimental for ${preset.id}.`,
          `${compatibility.warning} Enable Experimental checkpoints to try it anyway.`
        );
      } else if (compatibility.isExperimental) {
        setImageDiagnostics(
          elements,
          `Experimental checkpoint: ${checkpointName}. ${compatibility.warning}`
        );
      }

      setImageStatus(elements, "Checking selected checkpoint...", "idle");
      setImageProgressPreview(elements, "Checking selected checkpoint...");

      if (!(await client.hasModelForPreset(checkpointName, preset))) {
        throw createOpenLayerError(
          "CHECKPOINT_REQUIRED",
          `The ${preset.modelSource.label.toLowerCase()} "${checkpointName}" was not found in ComfyUI. Click Check ComfyUI and choose an available model.`
        );
      }

      setImageStatus(elements, "Uploading source image to ComfyUI...", "idle");
      setImageProgressPreview(elements, "Uploading source image...");
      const sourceImageName = await client.uploadImage(imageSource.blob, imageSource.filename);
      const buildResult = await buildImg2ImgWorkflow({
        presetId: preset.id,
        prompt: elements.imgPrompt.value,
        negativePrompt: elements.imgNegativePrompt.value,
        checkpointName,
        sourceImageName,
        steps: settings.steps,
        cfg: settings.cfg,
        seed: settings.seed,
        denoise: settings.denoise
      });

      setImageStatus(elements, "Submitting Image to Image prompt...", "idle");
      setImageProgressPreview(elements, "Submitting prompt to ComfyUI...");
      const promptId = await client.submitPrompt(buildResult.workflow);
      let hasLivePreview = false;
      progressWatcher = client.watchProgress(promptId, {
        onStatus: (message) => {
          setImageStatus(elements, message, "idle");

          if (!hasLivePreview) {
            setImageProgressPreview(elements, message);
          }
        },
        onPreviewBlob: (blob) => {
          hasLivePreview = true;
          setImageProgressPreview(elements, "Live ComfyUI preview...", blob);
        },
        onError: (message) => setImageDiagnostics(elements, message)
      });

      setImageStatus(elements, "Generating Image to Image result...", "idle");
      setImageProgressPreview(elements, "Generating image...");
      const history = await client.pollUntilComplete(promptId, {
        onTick: (message) => {
          setImageStatus(elements, message, "idle");

          if (!hasLivePreview) {
            setImageProgressPreview(elements, message);
          }
        }
      });
      progressWatcher?.close();
      progressWatcher = null;

      setImageStatus(elements, "Retrieving Image to Image result...", "idle");
      setImageProgressPreview(elements, "Retrieving final image...");
      const generatedResult = await client.retrieveFirstOutputImage(promptId, history, {
        preferredNodeId: getSaveImageNodeId(buildResult.preset)
      });
      setImageResult(generatedResult);
      addHistoryEntry(elements, historyEntries, generatedResult, {
        prompt: elements.imgPrompt.value,
        checkpointName,
        seed: buildResult.seed,
        sizeLabel: "Image to Image"
      });
      setImageStatus(elements, "Image to Image generation complete.", "ready");
      setImageDiagnostics(
        elements,
        `Seed used: ${buildResult.seed}. Source uploaded as ${sourceImageName}. Workflow: ${buildResult.preset.id}.`
      );
    } catch (caughtError) {
      setImageStatus(elements, "Image to Image generation failed.", "error");
      setImageError(elements, getFriendlyImageToImageErrorMessage(caughtError));
      console.error("[OpenLayer] Image to Image generation failed", getTechnicalErrorDetails(caughtError));
      setImageDiagnostics(elements, getImageToImageFailureHint(caughtError));
    } finally {
      progressWatcher?.close();
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  async function handleImportImg2Img() {
    setImageDiagnostics(elements, "Image to Image import pressed.");

    if (!imageResult) {
      setImageError(elements, "Generate an Image to Image result before importing.");
      return;
    }

    setImageError(elements, "");
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    setImageStatus(elements, "Importing Image to Image result into Photoshop...", "idle");

    try {
      const documentInfo = await getActiveDocumentInfo();
      const layerName = createLayerName("OpenLayer_Img2Img");

      setImageDiagnostics(elements, `Importing into ${documentInfo.name || "active document"}...`);
      const importedLayerName = await importGeneratedImageAsLayer(imageResult.blob, layerName, (message) => {
        setImageStatus(elements, message, "idle");
        setImageDiagnostics(elements, message);
      });
      setImageStatus(elements, `Imported layer: ${importedLayerName}`, "ready");
      setImageDiagnostics(elements, `Layer created: ${importedLayerName}`);
    } catch (caughtError) {
      setImageStatus(elements, "Import failed.", "error");
      setImageError(elements, getErrorMessage(caughtError));
    } finally {
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  async function handleCaptureSketchSource() {
    await captureSketchToImageSource({
      progressMessage: "Capturing active Photoshop layer for Sketch to Image...",
      statusMessage: "Capturing active layer...",
      successMessage: "Sketch source captured.",
      capture: exportActiveLayerForImageToImage
    });
  }

  async function handleCaptureSketchCanvasSource() {
    await captureSketchToImageSource({
      progressMessage: "Capturing Photoshop canvas for Sketch to Image...",
      statusMessage: "Capturing canvas...",
      successMessage: "Sketch canvas captured.",
      capture: exportCanvasForImageToImage
    });
  }

  async function captureSketchToImageSource(options: {
    progressMessage: string;
    statusMessage: string;
    successMessage: string;
    capture: () => Promise<ExportedSourceImage>;
  }) {
    setSketchDiagnostics(elements, options.progressMessage);
    setSketchError(elements, "");
    setSketchStatus(elements, options.statusMessage, "idle");
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);

    try {
      const exportedSource = await options.capture();
      const sourcePreview = URL.createObjectURL(exportedSource.blob);
      setSketchSource({
        ...exportedSource,
        previewUrl: sourcePreview
      });
      setSketchStatus(elements, options.successMessage, "ready");
      setSketchDiagnostics(
        elements,
        createSourceCaptureMessage(exportedSource, " for LINECN guidance")
      );
    } catch (caughtError) {
      setSketchStatus(elements, "Sketch source capture failed.", "error");
      setSketchError(elements, getErrorMessage(caughtError));
      setSketchDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  async function handleGenerateSketch() {
    setSketchDiagnostics(elements, `Sketch to Image generate pressed at ${new Date().toLocaleTimeString()}.`);

    if (!sketchSource) {
      setSketchError(elements, "Capture the active Photoshop layer or canvas before generating Sketch to Image.");
      setSketchStatus(elements, "Source required.", "error");
      setSketchDiagnostics(
        elements,
        createWorkflowDiagnostics(
          getWorkflowPreset(readSelectValue(elements.sketchWorkflow, DEFAULT_SKETCH_WORKFLOW)),
          readSelectValue(elements.sketchCheckpoint),
          createSourceInputAvailability(sketchSource)
        )
      );
      return;
    }

    if (!elements.sketchPrompt.value.trim()) {
      setSketchError(
        elements,
        getErrorMessage(createOpenLayerError("PROMPT_REQUIRED", "Enter a prompt before generating Sketch to Image."))
      );
      setSketchStatus(elements, "Prompt required.", "error");
      return;
    }

    setSketchError(elements, "");
    setSketchResult(null);
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    setSketchStatus(elements, "Preparing LINECN workflow...", "idle");
    setSketchProgressPreview(elements, "Preparing LINECN workflow...");
    let progressWatcher: ReturnType<ComfyClient["watchProgress"]> | null = null;

    try {
      const workflowPreset = readSelectValue(elements.sketchWorkflow, DEFAULT_SKETCH_WORKFLOW);
      const preset = getWorkflowPreset(workflowPreset);
      const checkpointName = readSelectValue(elements.sketchCheckpoint);
      const { settings, warnings } = validateSketchToImageSettings({
        steps: elements.sketchSteps.value,
        cfg: elements.sketchCfg.value,
        seed: elements.sketchSeed.value,
        denoise: elements.sketchDenoise.value,
        controlStrength: elements.sketchControlStrength.value
      });
      const client = new ComfyClient(elements.serverUrl.value);

      applyValidatedSketchToImageSettings(elements, settings);
      setSketchDiagnostics(
        elements,
        warnings.length > 0
          ? warnings.join(" ")
          : createWorkflowDiagnostics(preset, checkpointName, createSourceInputAvailability(sketchSource))
      );
      await client.checkOnline();

      if (!checkpointName) {
        throw createOpenLayerError("CHECKPOINT_REQUIRED", "Choose a ComfyUI checkpoint before generating.");
      }

      const compatibility = getCheckpointCompatibility(checkpointName, preset);

      if (compatibility.isExperimental) {
        throw createOpenLayerError(
          "CHECKPOINT_UNSUPPORTED",
          "Sketch to Image LINECN basic is built for SD 1.x checkpoints.",
          `${checkpointName}: ${compatibility.warning}`
        );
      }

      setSketchStatus(elements, "Checking selected checkpoint...", "idle");
      setSketchProgressPreview(elements, "Checking selected checkpoint...");

      if (!(await client.hasModelForPreset(checkpointName, preset))) {
        throw createOpenLayerError(
          "CHECKPOINT_REQUIRED",
          `The ${preset.modelSource.label.toLowerCase()} "${checkpointName}" was not found in ComfyUI. Click Check ComfyUI and choose an available model.`
        );
      }

      setSketchStatus(elements, "Checking LINECN nodes and ControlNet model...", "idle");
      setSketchProgressPreview(elements, "Checking LINECN setup...");
      await client.validatePresetSetup(preset);

      setSketchStatus(elements, "Uploading source image to ComfyUI...", "idle");
      setSketchProgressPreview(elements, "Uploading source image...");
      const sourceImageName = await client.uploadImage(sketchSource.blob, sketchSource.filename);
      const buildResult = await buildSketchToImageWorkflow({
        presetId: preset.id,
        prompt: elements.sketchPrompt.value,
        negativePrompt: elements.sketchNegativePrompt.value,
        checkpointName,
        sourceImageName,
        steps: settings.steps,
        cfg: settings.cfg,
        seed: settings.seed,
        denoise: settings.denoise,
        controlStrength: settings.controlStrength
      });

      setSketchStatus(elements, "Submitting Sketch to Image prompt...", "idle");
      setSketchProgressPreview(elements, "Submitting prompt to ComfyUI...");
      const promptId = await client.submitPrompt(buildResult.workflow);
      let hasLivePreview = false;
      progressWatcher = client.watchProgress(promptId, {
        onStatus: (message) => {
          setSketchStatus(elements, message, "idle");

          if (!hasLivePreview) {
            setSketchProgressPreview(elements, message);
          }
        },
        onPreviewBlob: (blob) => {
          hasLivePreview = true;
          setSketchProgressPreview(elements, "Live ComfyUI preview...", blob);
        },
        onError: (message) => setSketchDiagnostics(elements, message)
      });

      setSketchStatus(elements, "Generating Sketch to Image result...", "idle");
      setSketchProgressPreview(elements, "Generating image...");
      const history = await client.pollUntilComplete(promptId, {
        onTick: (message) => {
          setSketchStatus(elements, message, "idle");

          if (!hasLivePreview) {
            setSketchProgressPreview(elements, message);
          }
        }
      });
      progressWatcher?.close();
      progressWatcher = null;

      setSketchStatus(elements, "Retrieving Sketch to Image result...", "idle");
      setSketchProgressPreview(elements, "Retrieving final image...");
      const generatedResult = await client.retrieveFirstOutputImage(promptId, history, {
        preferredNodeId: getSaveImageNodeId(buildResult.preset)
      });
      setSketchResult(generatedResult);
      addHistoryEntry(elements, historyEntries, generatedResult, {
        prompt: elements.sketchPrompt.value,
        checkpointName,
        seed: buildResult.seed,
        sizeLabel: "Sketch to Image"
      });
      setSketchStatus(elements, "Sketch to Image generation complete.", "ready");
      setSketchDiagnostics(
        elements,
        `Seed used: ${buildResult.seed}. Source uploaded as ${sourceImageName}. Workflow: ${buildResult.preset.id}.`
      );
    } catch (caughtError) {
      setSketchStatus(elements, "Sketch to Image generation failed.", "error");
      setSketchError(elements, getFriendlySketchErrorMessage(caughtError));
      console.error("[OpenLayer] Sketch to Image generation failed", getTechnicalErrorDetails(caughtError));
      setSketchDiagnostics(elements, getSketchFailureHint(caughtError));
    } finally {
      progressWatcher?.close();
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  async function handleImportSketch() {
    setSketchDiagnostics(elements, "Sketch to Image import pressed.");

    if (!sketchResult) {
      setSketchError(elements, "Generate a Sketch to Image result before importing.");
      return;
    }

    setSketchError(elements, "");
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    setSketchStatus(elements, "Importing Sketch to Image result into Photoshop...", "idle");

    try {
      const documentInfo = await getActiveDocumentInfo();
      const layerName = createLayerName("OpenLayer_Sketch");

      setSketchDiagnostics(elements, `Importing into ${documentInfo.name || "active document"}...`);
      const importedLayerName = await importGeneratedImageAsLayer(sketchResult.blob, layerName, (message) => {
        setSketchStatus(elements, message, "idle");
        setSketchDiagnostics(elements, message);
      });
      setSketchStatus(elements, `Imported layer: ${importedLayerName}`, "ready");
      setSketchDiagnostics(elements, `Layer created: ${importedLayerName}`);
    } catch (caughtError) {
      setSketchStatus(elements, "Import failed.", "error");
      setSketchError(elements, getErrorMessage(caughtError));
    } finally {
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  async function handleCaptureInpaintSelection() {
    setInpaintDiagnostics(elements, "Capturing active Photoshop selection...");
    setInpaintError(elements, "");
    setInpaintStatus(elements, "Capturing selection...", "idle");
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);

    try {
      const exportedSource = await captureSelectionForInpainting();
      const sourcePreview = URL.createObjectURL(exportedSource.blob);
      setInpaintSource({
        ...exportedSource,
        previewUrl: sourcePreview
      });
      setInpaintResult(null);
      setInpaintStatus(elements, "Selection captured.", "ready");
      setInpaintDiagnostics(
        elements,
        `${createSourceCaptureMessage(exportedSource, " for inpainting")} Selection: ${formatSelectionBounds(exportedSource.selection.bounds)}. Context: ${formatSelectionBounds(exportedSource.selection.contextBounds)}. ${exportedSource.maskMessage}`
      );
    } catch (caughtError) {
      setInpaintStatus(elements, "Selection capture failed.", "error");
      setInpaintError(elements, getErrorMessage(caughtError));
      setInpaintDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  async function handleGenerateInpaint() {
    setInpaintDiagnostics(elements, `Inpaint generate pressed at ${new Date().toLocaleTimeString()}.`);

    if (!inpaintSource) {
      setInpaintError(elements, "Make a Photoshop selection, then click Capture Selection before generating Inpaint.");
      setInpaintStatus(elements, "Selection required.", "error");
      setInpaintDiagnostics(
        elements,
        createWorkflowDiagnostics(
          getWorkflowPreset(readSelectValue(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW)),
          readSelectValue(elements.inpaintCheckpoint),
          {
            selection: false,
            "selection-mask": false
          }
        )
      );
      return;
    }

    if (!elements.inpaintPrompt.value.trim()) {
      setInpaintError(elements, getErrorMessage(createOpenLayerError("PROMPT_REQUIRED", "Enter a prompt before generating Inpaint.")));
      setInpaintStatus(elements, "Prompt required.", "error");
      return;
    }

    if (!inpaintSource.mask) {
      setInpaintError(elements, inpaintSource.maskMessage || "Capture Selection did not produce a mask image.");
      setInpaintStatus(elements, "Mask required.", "error");
      setInpaintDiagnostics(
        elements,
        createWorkflowDiagnostics(
          getWorkflowPreset(readSelectValue(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW)),
          readSelectValue(elements.inpaintCheckpoint),
          {
            selection: true,
            "selection-mask": false
          }
        )
      );
      return;
    }

    setInpaintError(elements, "");
    setInpaintResult(null);
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    setInpaintStatus(elements, "Preparing Inpaint workflow...", "idle");
    setInpaintProgressPreview(elements, "Preparing Inpaint workflow...");
    let progressWatcher: ReturnType<ComfyClient["watchProgress"]> | null = null;

    try {
      const workflowPreset = readSelectValue(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW);
      const preset = getWorkflowPreset(workflowPreset);
      const checkpointName = readSelectValue(elements.inpaintCheckpoint);
      const { settings, warnings } = validateImageToImageSettings({
        steps: elements.inpaintSteps.value,
        cfg: elements.inpaintCfg.value,
        seed: elements.inpaintSeed.value,
        denoise: elements.inpaintDenoise.value
      });
      const client = new ComfyClient(elements.serverUrl.value);
      const fluxDebugSummary = createFluxFillInpaintDebugSummary({
        presetId: preset.id,
        hasSourceImage: Boolean(inpaintSource),
        hasMaskImage: Boolean(inpaintSource.mask),
        sourceWidth: inpaintSource.width,
        sourceHeight: inpaintSource.height,
        maskWidth: inpaintSource.mask.width,
        maskHeight: inpaintSource.mask.height,
        hasSelectionContextBounds: Boolean(inpaintSource.selection.contextBounds),
        selectedFluxModelName: checkpointName
      });
      const fluxSourceProblems = validateFluxFillInpaintSource({
        presetId: preset.id,
        hasSourceImage: Boolean(inpaintSource),
        hasMaskImage: Boolean(inpaintSource.mask),
        sourceWidth: inpaintSource.width,
        sourceHeight: inpaintSource.height,
        maskWidth: inpaintSource.mask.width,
        maskHeight: inpaintSource.mask.height,
        hasSelectionContextBounds: Boolean(inpaintSource.selection.contextBounds)
      });

      if (fluxSourceProblems.length > 0) {
        throw createOpenLayerError(
          "INPAINT_SOURCE_INVALID",
          fluxSourceProblems[0],
          fluxSourceProblems.join(" ")
        );
      }

      applyValidatedInpaintSettings(elements, settings);
      const workflowDiagnostics = warnings.length > 0
        ? warnings.join(" ")
        : createWorkflowDiagnostics(preset, checkpointName, {
          selection: Boolean(inpaintSource),
          "selection-mask": Boolean(inpaintSource?.mask)
        });
      setInpaintDiagnostics(
        elements,
        [workflowDiagnostics, fluxDebugSummary].filter(Boolean).join(" ")
      );
      await client.checkOnline();

      if (!checkpointName) {
        throw createOpenLayerError("CHECKPOINT_REQUIRED", "Choose a ComfyUI checkpoint before generating Inpaint.");
      }

      const compatibility = getCheckpointCompatibility(checkpointName, preset);

      if (compatibility.isExperimental && !allowExperimentalCheckpoints) {
        throw createOpenLayerError(
          "CHECKPOINT_UNSUPPORTED",
          `${checkpointName} is marked experimental for ${preset.id}.`,
          `${compatibility.warning} Enable Experimental checkpoints to try it anyway.`
        );
      } else if (compatibility.isExperimental) {
        setInpaintDiagnostics(
          elements,
          `Experimental checkpoint: ${checkpointName}. ${compatibility.warning}`
        );
      }

      setInpaintStatus(elements, "Checking selected checkpoint...", "idle");
      setInpaintProgressPreview(elements, "Checking selected checkpoint...");

      if (!(await client.hasModelForPreset(checkpointName, preset))) {
        throw createOpenLayerError(
          "CHECKPOINT_REQUIRED",
          `The ${preset.modelSource.label.toLowerCase()} "${checkpointName}" was not found in ComfyUI. Click Check ComfyUI and choose an available model.`
        );
      }

      setInpaintStatus(elements, "Checking Inpaint nodes...", "idle");
      setInpaintProgressPreview(elements, "Checking Inpaint setup...");
      const requiredModelSelections = await client.validatePresetSetup(preset);

      setInpaintStatus(elements, "Uploading source and mask to ComfyUI...", "idle");
      setInpaintProgressPreview(elements, "Uploading source and mask...");
      let sourceUploadBlob = inpaintSource.blob;
      let sourceUploadFilename = inpaintSource.filename;
      let maskUploadBlob = inpaintSource.mask.blob;
      let maskUploadFilename = inpaintSource.mask.filename;
      let fluxEmbeddedMaskMessage = "";

      if (preset.id === "inpaint-flux-fill-basic") {
        setInpaintStatus(elements, "Preparing Flux Fill masked source...", "idle");
        setInpaintProgressPreview(elements, "Embedding mask into Flux Fill source...");
        const embeddedSource = await createFluxFillEmbeddedMaskSource(inpaintSource.blob, inpaintSource.mask.blob);
        sourceUploadBlob = embeddedSource.blob;
        sourceUploadFilename = embeddedSource.filename;
        maskUploadBlob = embeddedSource.blob;
        maskUploadFilename = embeddedSource.filename;
        fluxEmbeddedMaskMessage = embeddedSource.message;
      }

      const sourceImageName = await client.uploadImage(sourceUploadBlob, sourceUploadFilename);
      const maskImageName =
        preset.id === "inpaint-flux-fill-basic"
          ? sourceImageName
          : await client.uploadImage(maskUploadBlob, maskUploadFilename);
      const buildResult = await buildInpaintWorkflow({
        presetId: preset.id,
        prompt: elements.inpaintPrompt.value,
        negativePrompt: elements.inpaintNegativePrompt.value,
        checkpointName,
        sourceImageName,
        maskImageName,
        steps: settings.steps,
        cfg: settings.cfg,
        seed: settings.seed,
        denoise: settings.denoise,
        width: Math.round(inpaintSource.width),
        height: Math.round(inpaintSource.height),
        requiredModelSelections
      });

      setInpaintStatus(elements, "Submitting Inpaint prompt...", "idle");
      setInpaintProgressPreview(elements, "Submitting prompt to ComfyUI...");
      const promptId = await client.submitPrompt(buildResult.workflow);
      let hasLivePreview = false;
      progressWatcher = client.watchProgress(promptId, {
        onStatus: (message) => {
          setInpaintStatus(elements, message, "idle");

          if (!hasLivePreview) {
            setInpaintProgressPreview(elements, message);
          }
        },
        onPreviewBlob: (blob) => {
          hasLivePreview = true;
          setInpaintProgressPreview(elements, "Live ComfyUI preview...", blob);
        },
        onError: (message) => setInpaintDiagnostics(elements, message)
      });

      setInpaintStatus(elements, "Generating Inpaint result...", "idle");
      setInpaintProgressPreview(elements, "Generating image...");
      const history = await client.pollUntilComplete(promptId, {
        onTick: (message) => {
          setInpaintStatus(elements, message, "idle");

          if (!hasLivePreview) {
            setInpaintProgressPreview(elements, message);
          }
        }
      });
      progressWatcher?.close();
      progressWatcher = null;

      setInpaintStatus(elements, "Retrieving Inpaint result...", "idle");
      setInpaintProgressPreview(elements, "Retrieving final image...");
      const generatedResult = await client.retrieveFirstOutputImage(promptId, history, {
        preferredNodeId: getSaveImageNodeId(buildResult.preset)
      });
      const resultDimensions = await readImageDimensionsFromBlob(generatedResult.blob);
      const inpaintOutputDiagnostics = formatInpaintOutputDiagnostics({
        presetId: buildResult.preset.id,
        sourceDimensions: {
          width: inpaintSource.width,
          height: inpaintSource.height
        },
        maskDimensions: inpaintSource.mask
          ? {
            width: inpaintSource.mask.width,
            height: inpaintSource.mask.height
          }
          : null,
        resultDimensions,
        importMode: "aligned-context-fallback",
        maskPolarity: "white-repaints"
      });
      let debugExportMessage = "";

      try {
        const debugFiles = await saveInpaintDebugBlobsToTemporaryFiles({
          sourceBlob: inpaintSource.blob,
          maskBlob: inpaintSource.mask.blob,
          resultBlob: generatedResult.blob
        });
        debugExportMessage = ` Debug copies saved in the UXP temporary folder: ${debugFiles.join(", ")}.`;
      } catch (debugError) {
        debugExportMessage = ` Debug copy export unavailable: ${getErrorMessage(debugError)}.`;
      }

      setInpaintResult(generatedResult);
      addHistoryEntry(elements, historyEntries, generatedResult, {
        prompt: elements.inpaintPrompt.value,
        checkpointName,
        seed: buildResult.seed,
        sizeLabel: "Inpaint"
      });
      setInpaintStatus(elements, "Inpaint generation complete.", "ready");
      setInpaintDiagnostics(
        elements,
        [
          `Seed used: ${buildResult.seed}. Source uploaded as ${sourceImageName}; mask uploaded as ${maskImageName}. Workflow: ${buildResult.preset.id}.`,
          fluxEmbeddedMaskMessage,
          inpaintOutputDiagnostics,
          fluxDebugSummary,
          debugExportMessage
        ].filter(Boolean).join(" ")
      );
    } catch (caughtError) {
      setInpaintStatus(elements, "Inpaint generation failed.", "error");
      setInpaintError(elements, getFriendlyInpaintErrorMessage(caughtError));
      console.error("[OpenLayer] Inpaint generation failed", getTechnicalErrorDetails(caughtError));
      setInpaintDiagnostics(elements, getInpaintFailureHint(caughtError));
    } finally {
      progressWatcher?.close();
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  async function handleImportInpaint() {
    setInpaintDiagnostics(elements, "Inpaint import pressed.");

    if (!inpaintResult) {
      setInpaintError(elements, "Generate an Inpaint result before importing.");
      return;
    }

    if (!inpaintSource) {
      setInpaintError(elements, "Capture the Photoshop selection again before importing this Inpaint result.");
      return;
    }

    if (!inpaintSource.mask) {
      setInpaintError(elements, "Capture the Photoshop selection mask again before importing this Inpaint result.");
      return;
    }

    setInpaintError(elements, "");
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    setInpaintStatus(elements, "Importing Inpaint result into Photoshop...", "idle");

    try {
      const documentInfo = await getActiveDocumentInfo();
      const layerName = createLayerName("OpenLayer_Inpaint");
      const presetId = readSelectValue(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW);
      const sourceDimensions = {
        width: inpaintSource.width,
        height: inpaintSource.height
      };
      const maskDimensions = {
        width: inpaintSource.mask.width,
        height: inpaintSource.mask.height
      };
      const resultDimensions = await readImageDimensionsFromBlob(inpaintResult.blob);
      let importMode: InpaintImportMode = "aligned-context-fallback";

      setInpaintDiagnostics(elements, `Importing into ${documentInfo.name || "active document"}...`);
      setInpaintStatus(elements, "Using aligned context fallback...", "idle");
      setInpaintDiagnostics(
        elements,
        resultDimensions && dimensionsMatchForUi(resultDimensions, maskDimensions)
          ? "Transparent mask compositing is disabled for this experimental build. Aligned context fallback used."
          : "Raw inpaint result dimensions do not match the captured mask. Aligned context fallback used."
      );

      const importedLayerName = await importImageAlignedToSelection({
        blob: inpaintResult.blob,
        bounds: inpaintSource.selection.contextBounds,
        layerName,
        onProgress: (message) => {
          setInpaintStatus(elements, message, "idle");
          setInpaintDiagnostics(elements, message);
        }
      });
      setInpaintStatus(elements, `Imported layer: ${importedLayerName}`, "ready");
      setInpaintDiagnostics(
        elements,
        [
          `Layer created: ${importedLayerName}.`,
          formatInpaintOutputDiagnostics({
            presetId,
            sourceDimensions,
            maskDimensions,
            resultDimensions,
            importMode,
            maskPolarity: "white-repaints"
          })
        ].join(" ")
      );
    } catch (caughtError) {
      setInpaintStatus(elements, "Import failed.", "error");
      setInpaintError(elements, getErrorMessage(caughtError));
    } finally {
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  async function handleCapturePromptLayerSource() {
    await capturePromptFromLayerSource({
      progressMessage: "Capturing active Photoshop layer for Prompt from Layer...",
      statusMessage: "Capturing active layer...",
      successMessage: "Layer captured.",
      capture: exportActiveLayerForImageToImage
    });
  }

  async function handleCapturePromptCanvasSource() {
    await capturePromptFromLayerSource({
      progressMessage: "Capturing Photoshop canvas for Prompt from Layer...",
      statusMessage: "Capturing canvas...",
      successMessage: "Canvas captured.",
      capture: exportCanvasForImageToImage
    });
  }

  async function capturePromptFromLayerSource(options: {
    progressMessage: string;
    statusMessage: string;
    successMessage: string;
    capture: () => Promise<ExportedSourceImage>;
  }) {
    setPromptLayerDiagnostics(elements, options.progressMessage);
    setPromptLayerError(elements, "");
    setPromptLayerStatus(elements, options.statusMessage, "idle");
    isBusy = true;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);

    try {
      const exportedSource = await options.capture();
      const sourcePreview = URL.createObjectURL(exportedSource.blob);
      setPromptLayerSource({
        ...exportedSource,
        previewUrl: sourcePreview
      });
      setPromptLayerStatus(elements, options.successMessage, "ready");
      setPromptLayerDiagnostics(
        elements,
        `${createSourceCaptureMessage(exportedSource)} Prompt from Layer needs a validated Florence-2 PromptGen workflow before text generation is enabled.`
      );
    } catch (caughtError) {
      setPromptLayerStatus(elements, "Source capture failed.", "error");
      setPromptLayerError(elements, getErrorMessage(caughtError));
      setPromptLayerDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
    }
  }

  function handleGeneratePromptFromLayer() {
    if (!promptLayerSource) {
      setPromptLayerStatus(elements, "Source required.", "error");
      setPromptLayerError(elements, "Capture an active layer or canvas before generating prompt text.");
      return;
    }

    setPromptLayerStatus(elements, "PromptGen setup required.", "error");
    setPromptLayerError(
      elements,
      "Florence-2 PromptGen nodes and model are detected locally, but OpenLayer still needs a validated API workflow and text-output reader before this feature can run."
    );
    setPromptLayerDiagnostics(
      elements,
      "Required foundation: Florence2ModelLoader or DownloadAndLoadFlorence2Model, Florence2Run, Florence-2-base-PromptGen-v2.0, source PNG upload, and ComfyUI text output parsing."
    );
  }

  async function handleCopyPromptFromLayer() {
    const generatedText = elements.promptLayerGeneratedText.value.trim();

    if (!generatedText) {
      setPromptLayerError(elements, "No generated prompt text to copy yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedText);
      setPromptLayerStatus(elements, "Prompt copied.", "ready");
      setPromptLayerError(elements, "");
    } catch {
      setPromptLayerStatus(elements, "Copy unavailable.", "error");
      setPromptLayerError(elements, "Clipboard access is unavailable in this UXP environment.");
    }
  }

  function handleSendPromptToTextToImage() {
    const generatedText = elements.promptLayerGeneratedText.value.trim();

    if (!generatedText) {
      setPromptLayerError(elements, "No generated prompt text to send yet.");
      return;
    }

    elements.prompt.value = generatedText;
    setPromptLayerError(elements, "");
    setView("text-to-image");
    updateTextCheckpointCompatibility(elements);
  }

  function setResult(nextResult: GeneratedImageResult | null) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = "";
    }

    if (livePreviewUrl) {
      URL.revokeObjectURL(livePreviewUrl);
      livePreviewUrl = "";
    }

    result = nextResult;
    elements.previewPanel.innerHTML = "";

    if (!result) {
      const empty = document.createElement("span");
      empty.className = "preview-empty";
      empty.textContent = "No result yet";
      elements.previewPanel.append(empty);
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
      return;
    }

    previewUrl = URL.createObjectURL(result.blob);
    const image = document.createElement("img");
    image.src = previewUrl;
    image.alt = "Generated OpenLayer preview";
    elements.previewPanel.append(image);
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
  }

  function setProgressPreview(elements: AppElements, message: string, blob?: Blob) {
    if (result) {
      return;
    }

    elements.previewPanel.innerHTML = "";

    if (blob) {
      if (livePreviewUrl) {
        URL.revokeObjectURL(livePreviewUrl);
      }

      livePreviewUrl = URL.createObjectURL(blob);
      const image = document.createElement("img");
      image.src = livePreviewUrl;
      image.alt = "Live ComfyUI generation preview";
      elements.previewPanel.append(image);
      return;
    }

    const progress = document.createElement("span");
    progress.className = "preview-empty";
    progress.textContent = message;
    elements.previewPanel.append(progress);
  }

  function setImageSource(nextSource: ImageSourceState | null) {
    if (imageSourcePreviewUrl) {
      URL.revokeObjectURL(imageSourcePreviewUrl);
      imageSourcePreviewUrl = "";
    }

    imageSource = nextSource;
    elements.imageSourcePreviewPanel.innerHTML = "";

    if (!imageSource) {
      const empty = document.createElement("span");
      empty.className = "source-empty";
      empty.textContent = "None";
      elements.imageSourcePreviewPanel.append(empty);
      elements.imageSourceTitle.textContent = "No source captured";
      elements.imageSourceMeta.textContent = "Choose active layer or full canvas.";
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
      return;
    }

    imageSourcePreviewUrl = imageSource.previewUrl;
    const image = document.createElement("img");
    image.src = imageSourcePreviewUrl;
    image.alt = "Captured active Photoshop layer";
    elements.imageSourcePreviewPanel.append(image);
    elements.imageSourceTitle.textContent = imageSource.sourceName;
    elements.imageSourceMeta.textContent = createSourceMetaText(imageSource);
    updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
  }

  function setImageResult(nextResult: GeneratedImageResult | null) {
    if (imageResultPreviewUrl) {
      URL.revokeObjectURL(imageResultPreviewUrl);
      imageResultPreviewUrl = "";
    }

    if (imageLivePreviewUrl) {
      URL.revokeObjectURL(imageLivePreviewUrl);
      imageLivePreviewUrl = "";
    }

    imageResult = nextResult;
    elements.imageResultPreviewPanel.innerHTML = "";

    if (!imageResult) {
      const empty = document.createElement("span");
      empty.className = "preview-empty";
      empty.textContent = "No Image to Image result yet";
      elements.imageResultPreviewPanel.append(empty);
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
      return;
    }

    imageResultPreviewUrl = URL.createObjectURL(imageResult.blob);
    const image = document.createElement("img");
    image.src = imageResultPreviewUrl;
    image.alt = "Generated Image to Image preview";
    elements.imageResultPreviewPanel.append(image);
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
  }

  function setImageProgressPreview(elements: AppElements, message: string, blob?: Blob) {
    if (imageResult) {
      return;
    }

    elements.imageResultPreviewPanel.innerHTML = "";

    if (blob) {
      if (imageLivePreviewUrl) {
        URL.revokeObjectURL(imageLivePreviewUrl);
      }

      imageLivePreviewUrl = URL.createObjectURL(blob);
      const image = document.createElement("img");
      image.src = imageLivePreviewUrl;
      image.alt = "Live ComfyUI Image to Image preview";
      elements.imageResultPreviewPanel.append(image);
      return;
    }

    const progress = document.createElement("span");
    progress.className = "preview-empty";
    progress.textContent = message;
    elements.imageResultPreviewPanel.append(progress);
  }

  function setSketchSource(nextSource: ImageSourceState | null) {
    if (sketchSourcePreviewUrl) {
      URL.revokeObjectURL(sketchSourcePreviewUrl);
      sketchSourcePreviewUrl = "";
    }

    sketchSource = nextSource;
    elements.sketchSourcePreviewPanel.innerHTML = "";

    if (!sketchSource) {
      const empty = document.createElement("span");
      empty.className = "source-empty";
      empty.textContent = "None";
      elements.sketchSourcePreviewPanel.append(empty);
      elements.sketchSourceTitle.textContent = "No source captured";
      elements.sketchSourceMeta.textContent = "Choose active layer or full canvas.";
      updateSketchCheckpointCompatibility(elements, sketchSource);
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
      return;
    }

    sketchSourcePreviewUrl = sketchSource.previewUrl;
    const image = document.createElement("img");
    image.src = sketchSourcePreviewUrl;
    image.alt = "Captured Photoshop source for Sketch to Image";
    elements.sketchSourcePreviewPanel.append(image);
    elements.sketchSourceTitle.textContent = sketchSource.sourceName;
    elements.sketchSourceMeta.textContent = createSourceMetaText(sketchSource);
    updateSketchCheckpointCompatibility(elements, sketchSource);
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
  }

  function setSketchResult(nextResult: GeneratedImageResult | null) {
    if (sketchResultPreviewUrl) {
      URL.revokeObjectURL(sketchResultPreviewUrl);
      sketchResultPreviewUrl = "";
    }

    if (sketchLivePreviewUrl) {
      URL.revokeObjectURL(sketchLivePreviewUrl);
      sketchLivePreviewUrl = "";
    }

    sketchResult = nextResult;
    elements.sketchResultPreviewPanel.innerHTML = "";

    if (!sketchResult) {
      const empty = document.createElement("span");
      empty.className = "preview-empty";
      empty.textContent = "No Sketch to Image result yet";
      elements.sketchResultPreviewPanel.append(empty);
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
      return;
    }

    sketchResultPreviewUrl = URL.createObjectURL(sketchResult.blob);
    const image = document.createElement("img");
    image.src = sketchResultPreviewUrl;
    image.alt = "Generated Sketch to Image preview";
    elements.sketchResultPreviewPanel.append(image);
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
  }

  function setSketchProgressPreview(elements: AppElements, message: string, blob?: Blob) {
    if (sketchResult) {
      return;
    }

    elements.sketchResultPreviewPanel.innerHTML = "";

    if (blob) {
      if (sketchLivePreviewUrl) {
        URL.revokeObjectURL(sketchLivePreviewUrl);
      }

      sketchLivePreviewUrl = URL.createObjectURL(blob);
      const image = document.createElement("img");
      image.src = sketchLivePreviewUrl;
      image.alt = "Live ComfyUI Sketch to Image preview";
      elements.sketchResultPreviewPanel.append(image);
      return;
    }

    const progress = document.createElement("span");
    progress.className = "preview-empty";
    progress.textContent = message;
    elements.sketchResultPreviewPanel.append(progress);
  }

  function setInpaintSource(nextSource: InpaintSourceState | null) {
    if (inpaintSourcePreviewUrl) {
      URL.revokeObjectURL(inpaintSourcePreviewUrl);
      inpaintSourcePreviewUrl = "";
    }

    if (inpaintMaskPreviewUrl) {
      URL.revokeObjectURL(inpaintMaskPreviewUrl);
      inpaintMaskPreviewUrl = "";
    }

    inpaintSource = nextSource;
    elements.inpaintSourcePreviewPanel.innerHTML = "";
    elements.inpaintMaskPreviewPanel.innerHTML = "";

    if (!inpaintSource) {
      const sourceEmpty = document.createElement("span");
      sourceEmpty.className = "source-empty";
      sourceEmpty.textContent = "None";
      elements.inpaintSourcePreviewPanel.append(sourceEmpty);
      elements.inpaintSourceTitle.textContent = "No selection captured";
      elements.inpaintSourceMeta.textContent = "Make a Photoshop selection first.";

      const maskEmpty = document.createElement("span");
      maskEmpty.className = "source-empty";
      maskEmpty.textContent = "Mask";
      elements.inpaintMaskPreviewPanel.append(maskEmpty);
      elements.inpaintMaskMeta.textContent = "Mask export not available yet.";
      updateInpaintCheckpointCompatibility(elements, inpaintSource);
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
      return;
    }

    inpaintSourcePreviewUrl = inpaintSource.previewUrl;
    const image = document.createElement("img");
    image.src = inpaintSourcePreviewUrl;
    image.alt = "Captured Photoshop selection for Inpaint";
    elements.inpaintSourcePreviewPanel.append(image);
    elements.inpaintSourceTitle.textContent = inpaintSource.sourceName;
    elements.inpaintSourceMeta.textContent = `${createSourceMetaText(inpaintSource)} | Selection ${formatSelectionBounds(inpaintSource.selection.bounds)} | Context ${formatSelectionBounds(inpaintSource.selection.contextBounds)}`;

    if (inpaintSource.mask) {
      inpaintMaskPreviewUrl = URL.createObjectURL(inpaintSource.mask.blob);
      const maskImage = document.createElement("img");
      maskImage.src = inpaintMaskPreviewUrl;
      maskImage.alt = "Captured Photoshop selection mask";
      elements.inpaintMaskPreviewPanel.append(maskImage);
      elements.inpaintMaskMeta.textContent = `${inpaintSource.mask.width} x ${inpaintSource.mask.height} | PNG/lossless mask`;
    } else {
      const maskEmpty = document.createElement("span");
      maskEmpty.className = "source-empty";
      maskEmpty.textContent = "N/A";
      elements.inpaintMaskPreviewPanel.append(maskEmpty);
      elements.inpaintMaskMeta.textContent = inpaintSource.maskMessage;
    }

    updateInpaintCheckpointCompatibility(elements, inpaintSource);
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
  }

  function setInpaintResult(nextResult: GeneratedImageResult | null) {
    if (inpaintResultPreviewUrl) {
      URL.revokeObjectURL(inpaintResultPreviewUrl);
      inpaintResultPreviewUrl = "";
    }

    if (inpaintLivePreviewUrl) {
      URL.revokeObjectURL(inpaintLivePreviewUrl);
      inpaintLivePreviewUrl = "";
    }

    inpaintResult = nextResult;
    elements.inpaintResultPreviewPanel.innerHTML = "";

    if (!inpaintResult) {
      const empty = document.createElement("span");
      empty.className = "preview-empty";
      empty.textContent = "No Inpaint result yet";
      elements.inpaintResultPreviewPanel.append(empty);
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
      return;
    }

    inpaintResultPreviewUrl = URL.createObjectURL(inpaintResult.blob);
    const image = document.createElement("img");
    image.src = inpaintResultPreviewUrl;
    image.alt = "Generated Inpaint preview";
    elements.inpaintResultPreviewPanel.append(image);
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource, inpaintResult, inpaintSource);
  }

  function setInpaintProgressPreview(elements: AppElements, message: string, blob?: Blob) {
    if (inpaintResult) {
      return;
    }

    elements.inpaintResultPreviewPanel.innerHTML = "";

    if (blob) {
      if (inpaintLivePreviewUrl) {
        URL.revokeObjectURL(inpaintLivePreviewUrl);
      }

      inpaintLivePreviewUrl = URL.createObjectURL(blob);
      const image = document.createElement("img");
      image.src = inpaintLivePreviewUrl;
      image.alt = "Live ComfyUI Inpaint preview";
      elements.inpaintResultPreviewPanel.append(image);
      return;
    }

    const progress = document.createElement("span");
    progress.className = "preview-empty";
    progress.textContent = message;
    elements.inpaintResultPreviewPanel.append(progress);
  }

  function setPromptLayerSource(nextSource: ImageSourceState | null) {
    if (promptLayerSourcePreviewUrl) {
      URL.revokeObjectURL(promptLayerSourcePreviewUrl);
      promptLayerSourcePreviewUrl = "";
    }

    promptLayerSource = nextSource;
    elements.promptLayerSourcePreviewPanel.innerHTML = "";

    if (!promptLayerSource) {
      const empty = document.createElement("span");
      empty.className = "source-empty";
      empty.textContent = "None";
      elements.promptLayerSourcePreviewPanel.append(empty);
      elements.promptLayerSourceTitle.textContent = "No source captured";
      elements.promptLayerSourceMeta.textContent = "Choose active layer or full canvas.";
      return;
    }

    promptLayerSourcePreviewUrl = promptLayerSource.previewUrl;
    const image = document.createElement("img");
    image.src = promptLayerSourcePreviewUrl;
    image.alt = "Captured Photoshop source for Prompt from Layer";
    elements.promptLayerSourcePreviewPanel.append(image);
    elements.promptLayerSourceTitle.textContent = promptLayerSource.sourceName;
    elements.promptLayerSourceMeta.textContent = createSourceMetaText(promptLayerSource);
  }

  function setView(view: AppView) {
    currentView = view;
    elements.homeView.hidden = currentView !== "home";
    elements.generatorView.hidden = currentView !== "text-to-image";
    elements.imageToImageView.hidden = currentView !== "image-to-image";
    elements.sketchToImageView.hidden = currentView !== "sketch-to-image";
    elements.inpaintView.hidden = currentView !== "inpaint";
    elements.promptFromLayerView.hidden = currentView !== "prompt-from-layer";
    elements.settingsView.hidden = currentView !== "settings";
    elements.historyView.hidden = currentView !== "history";

    if (currentView === "settings") {
      void refreshDocumentStatus(elements);
    }

    if (currentView === "history") {
      renderHistory(elements, historyEntries);
    }
  }
}

function createAppMarkup() {
  return `
    <main class="app-shell">
      ${createBrandHeaderMarkup()}
      <div class="home-status-row">
        <span>Status:</span>
        <strong id="home-status-text">Ready</strong>
        <span class="home-status-dot idle" id="home-status-dot" aria-hidden="true"></span>
      </div>

      <section class="home-view" id="home-view" aria-label="OpenLayer tools">
        <div class="tool-grid">
          ${TOOL_CARDS.map(createToolCardMarkup).join("")}
        </div>
      </section>

      <section class="prompt-from-layer-view image-to-image-view" id="prompt-from-layer-view" aria-label="Prompt from Layer" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            <span class="screen-kicker">PFL</span>
            <span class="screen-title">Prompt from Layer</span>
          </div>
        </div>

        <section class="panel-section generator-panel source-panel" aria-label="Prompt from Layer source">
          <div class="section-heading">
            <span class="label">Source layer</span>
            <span class="muted-label">Vision input</span>
          </div>
          <div class="source-action-row" aria-label="Prompt from Layer source capture actions">
            <button class="button source-action-button action-control" id="capture-prompt-layer-source" data-openlayer-action="capturePromptLayerSource" type="button">Capture Active Layer</button>
            <button class="button source-action-button action-control" id="capture-prompt-canvas-source" data-openlayer-action="capturePromptCanvasSource" type="button">Capture Canvas</button>
          </div>
          <div class="source-card">
            <div class="source-thumb-frame" id="prompt-layer-source-preview-panel">
              <span class="source-empty">None</span>
            </div>
            <div class="source-card-body">
              <span class="source-title" id="prompt-layer-source-title">No source captured</span>
              <span class="source-card-meta" id="prompt-layer-source-meta">Choose active layer or full canvas.</span>
            </div>
          </div>
        </section>

        <section class="panel-section generator-panel" aria-label="Prompt from Layer text">
          <div class="section-heading">
            <span class="label">Generated prompt</span>
            <span class="muted-label">Florence-2 PromptGen foundation</span>
          </div>
          <textarea class="textarea compact-textarea" id="prompt-layer-generated-text" placeholder="Generated prompt text will appear here after the Florence workflow is connected."></textarea>
          <button class="button button-primary button-generate button-wide action-control" id="generate-prompt-from-layer" data-openlayer-action="generatePromptFromLayer" type="button">Generate Text from Layer</button>
          <div class="import-actions">
            <button class="button action-control" id="copy-prompt-from-layer" data-openlayer-action="copyPromptFromLayer" type="button">Copy Prompt</button>
            <button class="button action-control" id="send-prompt-to-text-to-image" data-openlayer-action="sendPromptToTextToImage" type="button">Send to Text to Image</button>
          </div>
        </section>

        <section class="generation-status-panel" aria-label="Prompt from Layer status">
          <div class="status-bar" role="status">
            <span class="status-text" id="prompt-layer-status-text">Foundation ready.</span>
            <span class="status-pill idle" id="prompt-layer-status-pill">Status</span>
          </div>
          <div class="diagnostics-line" id="prompt-layer-diagnostics-text">Florence-2 PromptGen support is prepared as a setup-required foundation.</div>
          <div class="error-message" id="prompt-layer-error-message" hidden></div>
        </section>
      </section>

      <section class="settings-view" id="settings-view" aria-label="Settings" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            <span class="screen-kicker">SET</span>
            <span class="screen-title">Settings</span>
          </div>
        </div>

        <section class="panel-section settings-panel diagnostic-section diagnostic-scroll-safe" aria-label="ComfyUI settings">
          <div class="section-heading">
            <span class="label">ComfyUI</span>
            <span class="muted-label">Local server</span>
          </div>
          <label class="field">
            <span class="label">ComfyUI server URL</span>
            <input class="input" id="server-url" value="${DEFAULT_SERVER_URL}" placeholder="${DEFAULT_SERVER_URL}" />
          </label>
          <div class="settings-button-stack diagnostic-action-stack" aria-label="ComfyUI diagnostic actions">
            <button class="button action-control" id="check-comfy" data-openlayer-action="check" type="button">Check ComfyUI</button>
            <button class="button action-control" id="find-comfy-port" data-openlayer-action="findPort" type="button">Find ComfyUI Active Port</button>
            <button class="button action-control" id="detect-gpu" data-openlayer-action="detectHardware" type="button">Detect GPU &amp; Recommend Models</button>
            <button class="button action-control" id="check-workflow-health" data-openlayer-action="checkWorkflowHealth" type="button">Check Workflow Health</button>
            <button class="button action-control" id="copy-diagnostics" data-openlayer-action="copyDiagnostics" type="button">Copy Diagnostics</button>
            <button class="button action-control" id="save-settings" data-openlayer-action="saveSettings" type="button">Save Settings</button>
            <button class="button action-control" id="reset-settings" data-openlayer-action="resetSettings" type="button">Reset Defaults</button>
          </div>
          <textarea class="textarea compact-textarea diagnostics-report" id="settings-diagnostics-report" readonly hidden></textarea>
        </section>

        <section class="panel-section settings-panel diagnostic-section diagnostic-scroll-safe" aria-label="Status report">
          <div class="section-heading">
            <span class="label">Status report</span>
            <span class="muted-label">Runtime</span>
          </div>
          <div class="status-bar" role="status">
            <span class="status-text" id="settings-status-text">Ready.</span>
            <span class="status-pill idle" id="settings-status-pill">Status</span>
          </div>
          <div class="diagnostics-line" id="settings-diagnostics-text">Diagnostics ready for v${APP_VERSION}.</div>
          <div class="error-message" id="settings-error-message" hidden></div>
        </section>

        <section class="panel-section settings-panel diagnostic-section diagnostic-scroll-safe" aria-label="Hardware advisor">
          <div class="section-heading">
            <span class="label">Hardware advisor</span>
            <span class="muted-label">Model guidance</span>
          </div>
          <div class="settings-list diagnostic-list hardware-list">
            <div><span>GPU</span><strong id="settings-gpu-name">Not detected</strong></div>
            <div><span>Total VRAM</span><strong id="settings-vram-total">Not detected</strong></div>
            <div><span>Free VRAM</span><strong id="settings-vram-free">Not detected</strong></div>
            <div><span>Recommendation tier</span><strong id="settings-vram-tier">Run detection</strong></div>
            <div><span>Detected model families</span><strong id="settings-model-families">Run detection</strong></div>
            <div><span>Z_image_Turbo</span><strong id="settings-z-image-turbo">Run detection</strong></div>
          </div>
          <div class="diagnostics-line hardware-recommendations" id="settings-model-recommendations">
            Click Detect GPU &amp; Recommend Models to get local hardware-aware suggestions.
          </div>
          <div class="diagnostics-line model-stack-note">
            Z_image_Turbo is not a checkpoint. It uses a diffusion model stack. Flux presets need dedicated workflow JSON before they are ready.
          </div>
        </section>

        <section class="panel-section settings-panel diagnostic-section diagnostic-scroll-safe" aria-label="Workflow health">
          <div class="section-heading">
            <span class="label">Workflow health</span>
            <span class="muted-label">Local ComfyUI</span>
          </div>
          <div class="diagnostic-summary-grid" id="settings-workflow-health-summary" aria-label="Workflow health summary"></div>
          <div class="workflow-health-list" id="settings-workflow-health-list">
            <div class="diagnostics-line">Click Check Workflow Health to inspect local workflow readiness.</div>
          </div>
        </section>

        <section class="panel-section settings-panel diagnostic-section diagnostic-scroll-safe" aria-label="Plugin settings">
          <div class="section-heading">
            <span class="label">Plugin</span>
            <span class="muted-label">MVP defaults</span>
          </div>
          <div class="settings-list diagnostic-list">
            <div><span>Version</span><strong>v${APP_VERSION}</strong></div>
            <div><span>Default workflow</span><strong>txt2img-basic</strong></div>
            <div><span>Server URL</span><strong id="settings-url-value">${DEFAULT_SERVER_URL}</strong></div>
            <div><span>Checkpoint count</span><strong id="settings-checkpoint-count">Fallback list</strong></div>
            <div><span>Last checkpoint</span><strong id="settings-last-checkpoint">Not checked</strong></div>
            <div><span>Photoshop document</span><strong id="settings-document-status">Not checked</strong></div>
            <div><span>Workflow readiness</span><strong id="settings-workflow-readiness">Not checked</strong></div>
          </div>
        </section>
      </section>

      <section class="generator-view" id="generator-view" aria-label="Text to Image" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            <span class="screen-kicker">TXT</span>
            <span class="screen-title">Text to Image</span>
          </div>
        </div>

        <section class="panel-section generator-panel" aria-label="Prompt">
          <label class="field">
            <span class="label">Prompt</span>
            <textarea class="textarea" id="prompt" placeholder="Describe the image you want to generate..."></textarea>
          </label>
          <section class="negative-prompt-section" aria-label="Negative prompt">
            <button class="button disclosure-button action-control" id="negative-prompt-toggle" data-openlayer-action="toggleNegativePrompt" type="button">Show Negative Prompt</button>
            <label class="field negative-prompt-field" id="negative-prompt-field" hidden>
              <span class="label">Negative prompt</span>
              <textarea class="textarea" id="negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
            </label>
          </section>
          <label class="field">
            <span class="label">Workflow</span>
            <select class="select" id="workflow">
              ${listRunnableWorkflowPresets("txt2img").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span class="label">Model</span>
            <select class="select" id="checkpoint">
              ${FALLBACK_CHECKPOINTS.map((checkpoint) => `<option value="${checkpoint}">${checkpoint}</option>`).join("")}
            </select>
          </label>
          <div class="settings-grid" aria-label="Generation settings">
            <label class="field">
              <span class="label">Width</span>
              <input class="input input-compact" id="width" type="number" min="64" step="64" value="${DEFAULT_WIDTH}" />
            </label>
            <label class="field">
              <span class="label">Height</span>
              <input class="input input-compact" id="height" type="number" min="64" step="64" value="${DEFAULT_HEIGHT}" />
            </label>
            <label class="field">
              <span class="label">Steps</span>
              <input class="input input-compact" id="steps" type="number" min="1" max="150" step="1" value="${DEFAULT_STEPS}" />
            </label>
            <label class="field">
              <span class="label">CFG</span>
              <input class="input input-compact" id="cfg" type="number" min="1" max="30" step="0.5" value="${DEFAULT_CFG}" />
            </label>
            <label class="field settings-seed">
              <span class="label">Seed</span>
              <input class="input input-compact" id="seed" type="number" min="0" placeholder="Random" />
            </label>
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate" data-openlayer-action="generate" type="button">Generate</button>
        </section>

        <section class="generation-status-panel" aria-label="Generation status">
          <div class="status-bar" role="status">
            <span class="status-text" id="status-text">Ready.</span>
            <span class="status-pill idle" id="status-pill">Status</span>
          </div>
          <div class="diagnostics-line" id="diagnostics-text">Click test ready for v${APP_VERSION}.</div>
          <div class="error-message" id="error-message" hidden></div>
        </section>

        <section class="panel-section result-panel" aria-label="Result">
          <div class="section-heading">
            <span class="label">Preview</span>
            <span class="muted-label">Result appears here after generation</span>
          </div>
          <div class="preview-panel" id="preview-panel">
            <span class="preview-empty">No result yet</span>
          </div>
          <div class="import-actions">
            <button class="button button-import action-control is-disabled" id="import-result" data-openlayer-action="import" type="button" tabindex="-1" aria-disabled="true">Import Result as New Layer</button>
            <button class="button auto-import-toggle action-control" id="auto-import-toggle" data-openlayer-action="toggleAutoImport" type="button" aria-pressed="false">Import Result Automatically</button>
          </div>
        </section>

        <section class="text-image-shortcuts" aria-label="Shortcuts">
          <div class="settings-shortcut" role="button" tabindex="0" data-openlayer-view="settings">
            <span class="shortcut-label">Settings</span>
            <span class="shortcut-note">ComfyUI URL, status, and diagnostics</span>
          </div>
        </section>
      </section>

      <section class="image-to-image-view" id="image-to-image-view" aria-label="Image to Image" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            <span class="screen-kicker">IMG</span>
            <span class="screen-title">Image to Image</span>
          </div>
        </div>

        <section class="panel-section generator-panel source-panel" aria-label="Image source">
          <div class="section-heading">
            <span class="label">Source layer</span>
            <span class="muted-label">Input image</span>
          </div>
          <div class="source-action-row" aria-label="Source capture actions">
            <button class="button source-action-button action-control" id="capture-image-source" data-openlayer-action="captureImageSource" type="button">Capture Active Layer</button>
            <button class="button source-action-button action-control" id="capture-canvas-source" data-openlayer-action="captureCanvasSource" type="button">Capture Canvas</button>
          </div>
          <div class="source-card">
            <div class="source-thumb-frame" id="image-source-preview-panel">
              <span class="source-empty">None</span>
            </div>
            <div class="source-card-body">
              <span class="source-title" id="image-source-title">No source captured</span>
              <span class="source-card-meta" id="image-source-meta">Choose active layer or full canvas.</span>
            </div>
          </div>
        </section>

        <section class="panel-section generator-panel img2img-form-panel" aria-label="Image to Image prompt">
          <div class="field img2img-field">
            <span class="label">Prompt</span>
            <textarea class="textarea compact-textarea" id="img-prompt" placeholder="Describe how to reinterpret the active layer..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Negative prompt</span>
            <textarea class="textarea compact-textarea" id="img-negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Workflow</span>
            <select class="select" id="img-workflow">
              ${listRunnableWorkflowPresets("img2img").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <span class="label">Model</span>
            <select class="select" id="img-checkpoint">
              ${FALLBACK_CHECKPOINTS.map((checkpoint) => `<option value="${checkpoint}">${checkpoint}</option>`).join("")}
            </select>
            <span class="compatibility-note" id="img-compatibility-note">img2img-basic is safest with SD 1.x and SDXL checkpoints. SD3 and Flux are experimental.</span>
          </div>
          <button class="button experimental-toggle action-control" id="experimental-checkpoint-toggle" data-openlayer-action="toggleExperimentalCheckpoints" type="button" aria-pressed="false">Experimental Checkpoints Off</button>
          <div class="settings-grid img2img-settings-grid" aria-label="Image to Image settings">
            <div class="field">
              <span class="label">Steps</span>
              <input class="input input-compact" id="img-steps" type="number" min="1" max="150" step="1" value="${DEFAULT_IMG2IMG_STEPS}" />
            </div>
            <div class="field">
              <span class="label">CFG</span>
              <input class="input input-compact" id="img-cfg" type="number" min="1" max="30" step="0.5" value="${DEFAULT_CFG}" />
            </div>
            <div class="field">
              <span class="label">Denoise</span>
              <input class="input input-compact" id="img-denoise" type="number" min="0.05" max="1" step="0.05" value="${DEFAULT_IMG2IMG_DENOISE}" />
            </div>
            <div class="field settings-seed">
              <span class="label">Seed</span>
              <input class="input input-compact" id="img-seed" type="number" min="0" placeholder="Random" />
            </div>
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate-img2img" data-openlayer-action="generateImg2Img" type="button">Generate Image to Image</button>
        </section>

        <section class="generation-status-panel img2img-status-panel" aria-label="Image to Image status">
          <div class="status-bar" role="status">
            <span class="status-text" id="img-status-text">Ready.</span>
            <span class="status-pill idle" id="img-status-pill">Status</span>
          </div>
          <div class="diagnostics-line" id="img-diagnostics-text">Capture an active layer, then generate with img2img-basic.</div>
          <div class="error-message" id="img-error-message" hidden></div>
        </section>

        <section class="panel-section result-panel img2img-result-panel" aria-label="Image to Image result">
          <div class="section-heading">
            <span class="label">Result preview</span>
            <span class="muted-label">Generated result appears here</span>
          </div>
          <div class="preview-panel" id="image-result-preview-panel">
            <span class="preview-empty">No Image to Image result yet</span>
          </div>
          <div class="import-actions">
            <button class="button button-import button-import-blue action-control is-disabled" id="import-img2img-result" data-openlayer-action="importImg2Img" type="button" tabindex="-1" aria-disabled="true">Import to Layers</button>
          </div>
        </section>

      </section>

      <section class="sketch-to-image-view image-to-image-view" id="sketch-to-image-view" aria-label="Sketch to Image" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            <span class="screen-kicker">SK</span>
            <span class="screen-title">Sketch to Image</span>
          </div>
        </div>

        <section class="panel-section generator-panel source-panel" aria-label="Sketch source">
          <div class="section-heading">
            <span class="label">Source layer</span>
            <span class="muted-label">LINECN input</span>
          </div>
          <div class="source-action-row" aria-label="Sketch source capture actions">
            <button class="button source-action-button action-control" id="capture-sketch-source" data-openlayer-action="captureSketchSource" type="button">Capture Active Layer</button>
            <button class="button source-action-button action-control" id="capture-sketch-canvas-source" data-openlayer-action="captureSketchCanvasSource" type="button">Capture Canvas</button>
          </div>
          <div class="source-card">
            <div class="source-thumb-frame" id="sketch-source-preview-panel">
              <span class="source-empty">None</span>
            </div>
            <div class="source-card-body">
              <span class="source-title" id="sketch-source-title">No source captured</span>
              <span class="source-card-meta" id="sketch-source-meta">ComfyUI LineArtPreprocessor creates the guide.</span>
            </div>
          </div>
        </section>

        <section class="panel-section generator-panel img2img-form-panel" aria-label="Sketch to Image prompt">
          <div class="field img2img-field">
            <span class="label">Prompt</span>
            <textarea class="textarea compact-textarea" id="sketch-prompt" placeholder="Describe the final image guided by the lineart..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Negative prompt</span>
            <textarea class="textarea compact-textarea" id="sketch-negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Workflow</span>
            <select class="select" id="sketch-workflow">
              ${listRunnableWorkflowPresets("sketch2img").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <span class="label">Checkpoint</span>
            <select class="select" id="sketch-checkpoint">
              ${FALLBACK_CHECKPOINTS.map((checkpoint) => `<option value="${checkpoint}">${checkpoint}</option>`).join("")}
            </select>
            <span class="compatibility-note" id="sketch-compatibility-note">Recommended: epicrealism_naturalSinRC1VAE.safetensors with an SD 1.5 LineArt ControlNet workflow.</span>
          </div>
          <div class="settings-grid img2img-settings-grid" aria-label="Sketch to Image settings">
            <div class="field">
              <span class="label">Steps</span>
              <input class="input input-compact" id="sketch-steps" type="number" min="1" max="150" step="1" value="${DEFAULT_SKETCH_STEPS}" />
            </div>
            <div class="field">
              <span class="label">CFG</span>
              <input class="input input-compact" id="sketch-cfg" type="number" min="1" max="30" step="0.5" value="${DEFAULT_CFG}" />
            </div>
            <div class="field">
              <span class="label">Denoise</span>
              <input class="input input-compact" id="sketch-denoise" type="number" min="0.05" max="1" step="0.05" value="${DEFAULT_SKETCH_DENOISE}" />
            </div>
            <div class="field">
              <span class="label">Strength</span>
              <input class="input input-compact" id="sketch-control-strength" type="number" min="0" max="2" step="0.05" value="${DEFAULT_SKETCH_CONTROL_STRENGTH}" />
            </div>
            <div class="field settings-seed">
              <span class="label">Seed</span>
              <input class="input input-compact" id="sketch-seed" type="number" min="0" placeholder="Random" />
            </div>
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate-sketch" data-openlayer-action="generateSketch" type="button">Generate Sketch to Image</button>
        </section>

        <section class="generation-status-panel img2img-status-panel" aria-label="Sketch to Image status">
          <div class="status-bar" role="status">
            <span class="status-text" id="sketch-status-text">Ready.</span>
            <span class="status-pill idle" id="sketch-status-pill">Status</span>
          </div>
          <div class="diagnostics-line" id="sketch-diagnostics-text">Capture a source, then use a LINECN workflow preset.</div>
          <div class="error-message" id="sketch-error-message" hidden></div>
        </section>

        <section class="panel-section result-panel img2img-result-panel" aria-label="Sketch to Image result">
          <div class="section-heading">
            <span class="label">Result preview</span>
            <span class="muted-label">Generated result appears here</span>
          </div>
          <div class="preview-panel" id="sketch-result-preview-panel">
            <span class="preview-empty">No Sketch to Image result yet</span>
          </div>
          <div class="import-actions">
            <button class="button button-import button-import-blue action-control is-disabled" id="import-sketch-result" data-openlayer-action="importSketch" type="button" tabindex="-1" aria-disabled="true">Import to Layers</button>
          </div>
        </section>
      </section>

      <section class="inpaint-view image-to-image-view" id="inpaint-view" aria-label="Inpaint" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            <span class="screen-kicker">INP</span>
            <span class="screen-title">Inpaint</span>
          </div>
        </div>

        <div class="tool-warning" role="note">
          Experimental: Inpaint output quality and Photoshop alignment are still being tested. Use this for debugging, not production work yet.
        </div>

        <section class="panel-section generator-panel source-panel" aria-label="Inpaint selection source">
          <div class="section-heading">
            <span class="label">Selection source</span>
            <span class="muted-label">Photoshop selection</span>
          </div>
          <div class="source-action-row" aria-label="Selection capture actions">
            <button class="button source-action-button action-control" id="capture-inpaint-selection" data-openlayer-action="captureInpaintSelection" type="button">Capture Selection</button>
          </div>
          <div class="source-card">
            <div class="source-thumb-frame" id="inpaint-source-preview-panel">
              <span class="source-empty">None</span>
            </div>
            <div class="source-card-body">
              <span class="source-title" id="inpaint-source-title">No selection captured</span>
              <span class="source-card-meta" id="inpaint-source-meta">Make a Photoshop selection first.</span>
            </div>
          </div>
          <div class="source-card">
            <div class="source-thumb-frame" id="inpaint-mask-preview-panel">
              <span class="source-empty">Mask</span>
            </div>
            <div class="source-card-body">
              <span class="source-title">Mask preview</span>
              <span class="source-card-meta" id="inpaint-mask-meta">Mask export not available yet.</span>
            </div>
          </div>
        </section>

        <section class="panel-section generator-panel img2img-form-panel" aria-label="Inpaint prompt">
          <div class="field img2img-field">
            <span class="label">Prompt</span>
            <textarea class="textarea compact-textarea" id="inpaint-prompt" placeholder="Describe what should replace the selected area..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Negative prompt</span>
            <textarea class="textarea compact-textarea" id="inpaint-negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Workflow</span>
            <select class="select" id="inpaint-workflow">
              ${listWorkflowPresets("inpaint").map((preset) => `<option value="${preset.id}">${preset.label}${preset.status === "todo" ? " (setup required)" : ""}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <span class="label">Checkpoint</span>
            <select class="select" id="inpaint-checkpoint">
              ${FALLBACK_CHECKPOINTS.map((checkpoint) => `<option value="${checkpoint}">${checkpoint}</option>`).join("")}
            </select>
            <span class="compatibility-note" id="inpaint-compatibility-note">Selection capture is available. Generation needs a mapped inpaint-basic API workflow.</span>
          </div>
          <div class="settings-grid img2img-settings-grid" aria-label="Inpaint settings">
            <div class="field">
              <span class="label">Steps</span>
              <input class="input input-compact" id="inpaint-steps" type="number" min="1" max="150" step="1" value="${DEFAULT_INPAINT_STEPS}" />
            </div>
            <div class="field">
              <span class="label">CFG</span>
              <input class="input input-compact" id="inpaint-cfg" type="number" min="1" max="30" step="0.5" value="${DEFAULT_CFG}" />
            </div>
            <div class="field">
              <span class="label">Denoise</span>
              <input class="input input-compact" id="inpaint-denoise" type="number" min="0.05" max="1" step="0.05" value="${DEFAULT_INPAINT_DENOISE}" />
            </div>
            <div class="field settings-seed">
              <span class="label">Seed</span>
              <input class="input input-compact" id="inpaint-seed" type="number" min="0" placeholder="Random" />
            </div>
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate-inpaint" data-openlayer-action="generateInpaint" type="button">Generate Inpaint</button>
        </section>

        <section class="generation-status-panel img2img-status-panel" aria-label="Inpaint status">
          <div class="status-bar" role="status">
            <span class="status-text" id="inpaint-status-text">Ready.</span>
            <span class="status-pill idle" id="inpaint-status-pill">Status</span>
          </div>
          <div class="diagnostics-line" id="inpaint-diagnostics-text">Capture a Photoshop selection to prepare inpainting.</div>
          <div class="error-message" id="inpaint-error-message" hidden></div>
        </section>

        <section class="panel-section result-panel img2img-result-panel" aria-label="Inpaint result">
          <div class="section-heading">
            <span class="label">Result preview</span>
            <span class="muted-label">Generated result appears here</span>
          </div>
          <div class="preview-panel" id="inpaint-result-preview-panel">
            <span class="preview-empty">No Inpaint result yet</span>
          </div>
          <div class="import-actions">
            <button class="button button-import button-import-blue action-control is-disabled" id="import-inpaint-result" data-openlayer-action="importInpaint" type="button" tabindex="-1" aria-disabled="true">Import to Layers</button>
          </div>
        </section>
      </section>

      <section class="history-view" id="history-view" aria-label="History" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            <span class="screen-kicker">HI</span>
            <span class="screen-title">History</span>
          </div>
        </div>

        <section class="panel-section history-panel" aria-label="Recent generations">
          <div class="section-heading">
            <span class="label">Recent generations</span>
            <span class="muted-label">Current session</span>
          </div>
          <div class="history-list" id="history-list"></div>
          <button class="button action-control" id="clear-history" data-openlayer-action="clearHistory" type="button">Clear History</button>
        </section>
      </section>

      <footer class="app-footer">
        <span>OpenLayer v${APP_VERSION}</span>
        <span>Developer: Mehran Ahmadi 2026</span>
        <button class="footer-link" data-openlayer-external="${DEVELOPER_GITHUB}" type="button">GitHub</button>
      </footer>
    </main>
  `;
}

function createBrandHeaderMarkup() {
  return `
    <header class="app-header">
      <div class="brand-lockup">
        <img class="brand-icon" src="icons/openlayer.png" alt="" width="48" height="48" />
        <div>
          <h1 class="app-title">OpenLayer</h1>
          <p class="app-subtitle">Local AI layers for Photoshop</p>
        </div>
      </div>
      <span class="version-badge">v${APP_VERSION}</span>
    </header>
  `;
}

function createToolCardMarkup(card: ToolCard) {
  const isEnabled = card.status !== "coming-soon";
  const statusLabel =
    card.status === "available" ? "Available" : card.status === "experimental" ? "Experimental" : "Coming Soon";
  const viewAttribute = isEnabled && card.view ? ` data-openlayer-view="${card.view}"` : "";
  const disabledAttributes = isEnabled ? "" : ` aria-disabled="true" tabindex="-1"`;
  const statusMarkup = `<span class="tool-status ${card.status}">${statusLabel}</span>`;

  return `
    <div
      class="tool-card is-${card.status}"
      role="button"
      tabindex="${isEnabled ? "0" : "-1"}"
      data-tool-id="${card.id}"
      ${viewAttribute}
      ${disabledAttributes}
    >
      <div class="tool-card-header">
        <span class="tool-icon" aria-hidden="true">${createToolIconMarkup(card.icon)}</span>
        <span class="tool-title">${card.title}</span>
      </div>
      <div class="tool-card-body">
        <div class="tool-subtitle">${card.subtitle}</div>
        ${statusMarkup}
      </div>
    </div>
  `;
}

function createToolIconMarkup(icon: ToolIconName) {
  const labels: Record<ToolIconName, string> = {
    image: "IMG",
    imagePlus: "TXT",
    brush: "INP",
    expand: "OUT",
    lineart: "SK",
    promptFromLayer: "PFL",
    upscale: "UP",
    style: "ST",
    control: "WFP",
    workflow: "WF",
    layers: "LY",
    history: "HI",
    settings: "SET"
  };

  return `<span class="icon-glyph">${labels[icon]}</span>`;
}

function getAppElements(rootElement: HTMLElement): AppElements {
  return {
    homeView: getElement<HTMLElement>(rootElement, "home-view"),
    generatorView: getElement<HTMLElement>(rootElement, "generator-view"),
    imageToImageView: getElement<HTMLElement>(rootElement, "image-to-image-view"),
    sketchToImageView: getElement<HTMLElement>(rootElement, "sketch-to-image-view"),
    inpaintView: getElement<HTMLElement>(rootElement, "inpaint-view"),
    promptFromLayerView: getElement<HTMLElement>(rootElement, "prompt-from-layer-view"),
    settingsView: getElement<HTMLElement>(rootElement, "settings-view"),
    historyView: getElement<HTMLElement>(rootElement, "history-view"),
    homeStatusText: getElement<HTMLElement>(rootElement, "home-status-text"),
    homeStatusDot: getElement<HTMLElement>(rootElement, "home-status-dot"),
    serverUrl: getElement<HTMLInputElement>(rootElement, "server-url"),
    prompt: getElement<HTMLTextAreaElement>(rootElement, "prompt"),
    negativePrompt: getElement<HTMLTextAreaElement>(rootElement, "negative-prompt"),
    workflow: getElement<HTMLSelectElement>(rootElement, "workflow"),
    checkpoint: getElement<HTMLSelectElement>(rootElement, "checkpoint"),
    width: getElement<HTMLInputElement>(rootElement, "width"),
    height: getElement<HTMLInputElement>(rootElement, "height"),
    steps: getElement<HTMLInputElement>(rootElement, "steps"),
    cfg: getElement<HTMLInputElement>(rootElement, "cfg"),
    seed: getElement<HTMLInputElement>(rootElement, "seed"),
    checkButton: getElement<HTMLElement>(rootElement, "check-comfy"),
    findPortButton: getElement<HTMLElement>(rootElement, "find-comfy-port"),
    detectHardwareButton: getElement<HTMLElement>(rootElement, "detect-gpu"),
    checkWorkflowHealthButton: getElement<HTMLElement>(rootElement, "check-workflow-health"),
    copyDiagnosticsButton: getElement<HTMLElement>(rootElement, "copy-diagnostics"),
    saveSettingsButton: getElement<HTMLElement>(rootElement, "save-settings"),
    resetSettingsButton: getElement<HTMLElement>(rootElement, "reset-settings"),
    generateButton: getElement<HTMLElement>(rootElement, "generate"),
    importButton: getElement<HTMLElement>(rootElement, "import-result"),
    autoImportToggle: getElement<HTMLElement>(rootElement, "auto-import-toggle"),
    imgPrompt: getElement<HTMLTextAreaElement>(rootElement, "img-prompt"),
    imgNegativePrompt: getElement<HTMLTextAreaElement>(rootElement, "img-negative-prompt"),
    imgWorkflow: getElement<HTMLSelectElement>(rootElement, "img-workflow"),
    imgCheckpoint: getElement<HTMLSelectElement>(rootElement, "img-checkpoint"),
    imgSteps: getElement<HTMLInputElement>(rootElement, "img-steps"),
    imgCfg: getElement<HTMLInputElement>(rootElement, "img-cfg"),
    imgSeed: getElement<HTMLInputElement>(rootElement, "img-seed"),
    imgDenoise: getElement<HTMLInputElement>(rootElement, "img-denoise"),
    captureLayerButton: getElement<HTMLElement>(rootElement, "capture-image-source"),
    captureCanvasButton: getElement<HTMLElement>(rootElement, "capture-canvas-source"),
    generateImg2ImgButton: getElement<HTMLElement>(rootElement, "generate-img2img"),
    importImg2ImgButton: getElement<HTMLElement>(rootElement, "import-img2img-result"),
    sketchPrompt: getElement<HTMLTextAreaElement>(rootElement, "sketch-prompt"),
    sketchNegativePrompt: getElement<HTMLTextAreaElement>(rootElement, "sketch-negative-prompt"),
    sketchWorkflow: getElement<HTMLSelectElement>(rootElement, "sketch-workflow"),
    sketchCheckpoint: getElement<HTMLSelectElement>(rootElement, "sketch-checkpoint"),
    sketchSteps: getElement<HTMLInputElement>(rootElement, "sketch-steps"),
    sketchCfg: getElement<HTMLInputElement>(rootElement, "sketch-cfg"),
    sketchSeed: getElement<HTMLInputElement>(rootElement, "sketch-seed"),
    sketchDenoise: getElement<HTMLInputElement>(rootElement, "sketch-denoise"),
    sketchControlStrength: getElement<HTMLInputElement>(rootElement, "sketch-control-strength"),
    captureSketchLayerButton: getElement<HTMLElement>(rootElement, "capture-sketch-source"),
    captureSketchCanvasButton: getElement<HTMLElement>(rootElement, "capture-sketch-canvas-source"),
    generateSketchButton: getElement<HTMLElement>(rootElement, "generate-sketch"),
    importSketchButton: getElement<HTMLElement>(rootElement, "import-sketch-result"),
    inpaintPrompt: getElement<HTMLTextAreaElement>(rootElement, "inpaint-prompt"),
    inpaintNegativePrompt: getElement<HTMLTextAreaElement>(rootElement, "inpaint-negative-prompt"),
    inpaintWorkflow: getElement<HTMLSelectElement>(rootElement, "inpaint-workflow"),
    inpaintCheckpoint: getElement<HTMLSelectElement>(rootElement, "inpaint-checkpoint"),
    inpaintSteps: getElement<HTMLInputElement>(rootElement, "inpaint-steps"),
    inpaintCfg: getElement<HTMLInputElement>(rootElement, "inpaint-cfg"),
    inpaintSeed: getElement<HTMLInputElement>(rootElement, "inpaint-seed"),
    inpaintDenoise: getElement<HTMLInputElement>(rootElement, "inpaint-denoise"),
    captureInpaintSelectionButton: getElement<HTMLElement>(rootElement, "capture-inpaint-selection"),
    generateInpaintButton: getElement<HTMLElement>(rootElement, "generate-inpaint"),
    importInpaintButton: getElement<HTMLElement>(rootElement, "import-inpaint-result"),
    capturePromptLayerButton: getElement<HTMLElement>(rootElement, "capture-prompt-layer-source"),
    capturePromptCanvasButton: getElement<HTMLElement>(rootElement, "capture-prompt-canvas-source"),
    generatePromptLayerButton: getElement<HTMLElement>(rootElement, "generate-prompt-from-layer"),
    copyPromptLayerButton: getElement<HTMLElement>(rootElement, "copy-prompt-from-layer"),
    sendPromptLayerButton: getElement<HTMLElement>(rootElement, "send-prompt-to-text-to-image"),
    experimentalCheckpointToggle: getElement<HTMLElement>(rootElement, "experimental-checkpoint-toggle"),
    negativePromptToggle: getElement<HTMLElement>(rootElement, "negative-prompt-toggle"),
    negativePromptField: getElement<HTMLElement>(rootElement, "negative-prompt-field"),
    clearHistoryButton: getElement<HTMLElement>(rootElement, "clear-history"),
    statusText: getElement<HTMLElement>(rootElement, "status-text"),
    statusPill: getElement<HTMLElement>(rootElement, "status-pill"),
    imgStatusText: getElement<HTMLElement>(rootElement, "img-status-text"),
    imgStatusPill: getElement<HTMLElement>(rootElement, "img-status-pill"),
    sketchStatusText: getElement<HTMLElement>(rootElement, "sketch-status-text"),
    sketchStatusPill: getElement<HTMLElement>(rootElement, "sketch-status-pill"),
    inpaintStatusText: getElement<HTMLElement>(rootElement, "inpaint-status-text"),
    inpaintStatusPill: getElement<HTMLElement>(rootElement, "inpaint-status-pill"),
    promptLayerStatusText: getElement<HTMLElement>(rootElement, "prompt-layer-status-text"),
    promptLayerStatusPill: getElement<HTMLElement>(rootElement, "prompt-layer-status-pill"),
    settingsStatusText: getElement<HTMLElement>(rootElement, "settings-status-text"),
    settingsStatusPill: getElement<HTMLElement>(rootElement, "settings-status-pill"),
    diagnosticsText: getElement<HTMLElement>(rootElement, "diagnostics-text"),
    imgDiagnosticsText: getElement<HTMLElement>(rootElement, "img-diagnostics-text"),
    imgCompatibilityNote: getElement<HTMLElement>(rootElement, "img-compatibility-note"),
    sketchDiagnosticsText: getElement<HTMLElement>(rootElement, "sketch-diagnostics-text"),
    sketchCompatibilityNote: getElement<HTMLElement>(rootElement, "sketch-compatibility-note"),
    inpaintDiagnosticsText: getElement<HTMLElement>(rootElement, "inpaint-diagnostics-text"),
    inpaintCompatibilityNote: getElement<HTMLElement>(rootElement, "inpaint-compatibility-note"),
    promptLayerDiagnosticsText: getElement<HTMLElement>(rootElement, "prompt-layer-diagnostics-text"),
    settingsDiagnosticsText: getElement<HTMLElement>(rootElement, "settings-diagnostics-text"),
    errorMessage: getElement<HTMLElement>(rootElement, "error-message"),
    imgErrorMessage: getElement<HTMLElement>(rootElement, "img-error-message"),
    sketchErrorMessage: getElement<HTMLElement>(rootElement, "sketch-error-message"),
    inpaintErrorMessage: getElement<HTMLElement>(rootElement, "inpaint-error-message"),
    promptLayerErrorMessage: getElement<HTMLElement>(rootElement, "prompt-layer-error-message"),
    settingsErrorMessage: getElement<HTMLElement>(rootElement, "settings-error-message"),
    previewPanel: getElement<HTMLElement>(rootElement, "preview-panel"),
    imageSourcePreviewPanel: getElement<HTMLElement>(rootElement, "image-source-preview-panel"),
    imageSourceTitle: getElement<HTMLElement>(rootElement, "image-source-title"),
    imageSourceMeta: getElement<HTMLElement>(rootElement, "image-source-meta"),
    imageResultPreviewPanel: getElement<HTMLElement>(rootElement, "image-result-preview-panel"),
    sketchSourcePreviewPanel: getElement<HTMLElement>(rootElement, "sketch-source-preview-panel"),
    sketchSourceTitle: getElement<HTMLElement>(rootElement, "sketch-source-title"),
    sketchSourceMeta: getElement<HTMLElement>(rootElement, "sketch-source-meta"),
    sketchResultPreviewPanel: getElement<HTMLElement>(rootElement, "sketch-result-preview-panel"),
    inpaintSourcePreviewPanel: getElement<HTMLElement>(rootElement, "inpaint-source-preview-panel"),
    inpaintSourceTitle: getElement<HTMLElement>(rootElement, "inpaint-source-title"),
    inpaintSourceMeta: getElement<HTMLElement>(rootElement, "inpaint-source-meta"),
    inpaintMaskPreviewPanel: getElement<HTMLElement>(rootElement, "inpaint-mask-preview-panel"),
    inpaintMaskMeta: getElement<HTMLElement>(rootElement, "inpaint-mask-meta"),
    inpaintResultPreviewPanel: getElement<HTMLElement>(rootElement, "inpaint-result-preview-panel"),
    promptLayerSourcePreviewPanel: getElement<HTMLElement>(rootElement, "prompt-layer-source-preview-panel"),
    promptLayerSourceTitle: getElement<HTMLElement>(rootElement, "prompt-layer-source-title"),
    promptLayerSourceMeta: getElement<HTMLElement>(rootElement, "prompt-layer-source-meta"),
    promptLayerGeneratedText: getElement<HTMLTextAreaElement>(rootElement, "prompt-layer-generated-text"),
    historyList: getElement<HTMLElement>(rootElement, "history-list"),
    settingsUrlValue: getElement<HTMLElement>(rootElement, "settings-url-value"),
    settingsCheckpointCount: getElement<HTMLElement>(rootElement, "settings-checkpoint-count"),
    settingsLastCheckpoint: getElement<HTMLElement>(rootElement, "settings-last-checkpoint"),
    settingsDocumentStatus: getElement<HTMLElement>(rootElement, "settings-document-status"),
    settingsWorkflowReadiness: getElement<HTMLElement>(rootElement, "settings-workflow-readiness"),
    settingsGpuName: getElement<HTMLElement>(rootElement, "settings-gpu-name"),
    settingsVramTotal: getElement<HTMLElement>(rootElement, "settings-vram-total"),
    settingsVramFree: getElement<HTMLElement>(rootElement, "settings-vram-free"),
    settingsVramTier: getElement<HTMLElement>(rootElement, "settings-vram-tier"),
    settingsModelFamilies: getElement<HTMLElement>(rootElement, "settings-model-families"),
    settingsZImageTurbo: getElement<HTMLElement>(rootElement, "settings-z-image-turbo"),
    settingsModelRecommendations: getElement<HTMLElement>(rootElement, "settings-model-recommendations"),
    settingsWorkflowHealthSummary: getElement<HTMLElement>(rootElement, "settings-workflow-health-summary"),
    settingsWorkflowHealthList: getElement<HTMLElement>(rootElement, "settings-workflow-health-list"),
    settingsDiagnosticsReport: getElement<HTMLTextAreaElement>(rootElement, "settings-diagnostics-report")
  };
}

function getElement<T extends HTMLElement>(rootElement: HTMLElement, id: string) {
  const element = rootElement.querySelector(`#${id}`);

  if (!element || typeof (element as HTMLElement).setAttribute !== "function") {
    throw new Error(`OpenLayer UI element #${id} was not found.`);
  }

  return element as T;
}

function setBusy(
  elements: AppElements,
  isBusy: boolean,
  result: GeneratedImageResult | null,
  imageResult: GeneratedImageResult | null = null,
  imageSource: ImageSourceState | null = null,
  sketchResult: GeneratedImageResult | null = null,
  sketchSource: ImageSourceState | null = null,
  inpaintResult: GeneratedImageResult | null = null,
  inpaintSource: InpaintSourceState | null = null
) {
  elements.serverUrl.disabled = isBusy;
  elements.prompt.disabled = isBusy;
  elements.negativePrompt.disabled = isBusy;
  elements.workflow.disabled = isBusy;
  elements.checkpoint.disabled = isBusy;
  elements.width.disabled = isBusy;
  elements.height.disabled = isBusy;
  elements.steps.disabled = isBusy;
  elements.cfg.disabled = isBusy;
  elements.seed.disabled = isBusy;
  elements.imgPrompt.disabled = isBusy;
  elements.imgNegativePrompt.disabled = isBusy;
  elements.imgWorkflow.disabled = isBusy;
  elements.imgCheckpoint.disabled = isBusy;
  elements.imgSteps.disabled = isBusy;
  elements.imgCfg.disabled = isBusy;
  elements.imgSeed.disabled = isBusy;
  elements.imgDenoise.disabled = isBusy;
  elements.sketchPrompt.disabled = isBusy;
  elements.sketchNegativePrompt.disabled = isBusy;
  elements.sketchWorkflow.disabled = isBusy;
  elements.sketchCheckpoint.disabled = isBusy;
  elements.sketchSteps.disabled = isBusy;
  elements.sketchCfg.disabled = isBusy;
  elements.sketchSeed.disabled = isBusy;
  elements.sketchDenoise.disabled = isBusy;
  elements.sketchControlStrength.disabled = isBusy;
  elements.inpaintPrompt.disabled = isBusy;
  elements.inpaintNegativePrompt.disabled = isBusy;
  elements.inpaintWorkflow.disabled = isBusy;
  elements.inpaintCheckpoint.disabled = isBusy;
  elements.inpaintSteps.disabled = isBusy;
  elements.inpaintCfg.disabled = isBusy;
  elements.inpaintSeed.disabled = isBusy;
  elements.inpaintDenoise.disabled = isBusy;
  elements.promptLayerGeneratedText.disabled = isBusy;
  setActionDisabled(elements.checkButton, isBusy);
  setActionDisabled(elements.findPortButton, isBusy);
  setActionDisabled(elements.detectHardwareButton, isBusy);
  setActionDisabled(elements.checkWorkflowHealthButton, isBusy);
  setActionDisabled(elements.copyDiagnosticsButton, isBusy);
  setActionDisabled(elements.saveSettingsButton, isBusy);
  setActionDisabled(elements.resetSettingsButton, isBusy);
  setActionDisabled(elements.negativePromptToggle, isBusy);
  setActionDisabled(elements.autoImportToggle, isBusy);
  setActionDisabled(elements.generateButton, isBusy);
  setActionDisabled(elements.importButton, isBusy || !result);
  setActionDisabled(elements.captureLayerButton, isBusy);
  setActionDisabled(elements.captureCanvasButton, isBusy);
  setActionDisabled(elements.experimentalCheckpointToggle, isBusy);
  setActionDisabled(elements.generateImg2ImgButton, isBusy || !imageSource);
  setActionDisabled(elements.importImg2ImgButton, isBusy || !imageResult);
  setActionDisabled(elements.captureSketchLayerButton, isBusy);
  setActionDisabled(elements.captureSketchCanvasButton, isBusy);
  setActionDisabled(elements.generateSketchButton, isBusy || !sketchSource);
  setActionDisabled(elements.importSketchButton, isBusy || !sketchResult);
  setActionDisabled(elements.captureInpaintSelectionButton, isBusy);
  setActionDisabled(elements.generateInpaintButton, isBusy || !inpaintSource);
  setActionDisabled(elements.importInpaintButton, isBusy || !inpaintResult);
  setActionDisabled(elements.capturePromptLayerButton, isBusy);
  setActionDisabled(elements.capturePromptCanvasButton, isBusy);
  setActionDisabled(elements.generatePromptLayerButton, isBusy);
  setActionDisabled(elements.copyPromptLayerButton, isBusy);
  setActionDisabled(elements.sendPromptLayerButton, isBusy);
  setActionDisabled(elements.clearHistoryButton, isBusy);
}

function setStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.statusText.textContent = status;
  elements.statusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.statusPill.className = `status-pill ${tone}`;
  elements.imgStatusText.textContent = status;
  elements.imgStatusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.imgStatusPill.className = `status-pill ${tone}`;
  elements.sketchStatusText.textContent = status;
  elements.sketchStatusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.sketchStatusPill.className = `status-pill ${tone}`;
  elements.inpaintStatusText.textContent = status;
  elements.inpaintStatusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.inpaintStatusPill.className = `status-pill ${tone}`;
  elements.promptLayerStatusText.textContent = status;
  elements.promptLayerStatusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.promptLayerStatusPill.className = `status-pill ${tone}`;
  elements.settingsStatusText.textContent = status;
  elements.settingsStatusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.settingsStatusPill.className = `status-pill ${tone}`;
  elements.homeStatusText.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : status.replace(/\.$/, "");
  elements.homeStatusDot.className = `home-status-dot ${tone}`;
}

function setImageStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.imgStatusText.textContent = status;
  elements.imgStatusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.imgStatusPill.className = `status-pill ${tone}`;
  elements.homeStatusText.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : status.replace(/\.$/, "");
  elements.homeStatusDot.className = `home-status-dot ${tone}`;
}

function setSketchStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.sketchStatusText.textContent = status;
  elements.sketchStatusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.sketchStatusPill.className = `status-pill ${tone}`;
  elements.homeStatusText.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : status.replace(/\.$/, "");
  elements.homeStatusDot.className = `home-status-dot ${tone}`;
}

function setInpaintStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.inpaintStatusText.textContent = status;
  elements.inpaintStatusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.inpaintStatusPill.className = `status-pill ${tone}`;
  elements.homeStatusText.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : status.replace(/\.$/, "");
  elements.homeStatusDot.className = `home-status-dot ${tone}`;
}

function setPromptLayerStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.promptLayerStatusText.textContent = status;
  elements.promptLayerStatusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.promptLayerStatusPill.className = `status-pill ${tone}`;
  elements.homeStatusText.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : status.replace(/\.$/, "");
  elements.homeStatusDot.className = `home-status-dot ${tone}`;
}

function setError(elements: AppElements, message: string) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = !message;
  elements.settingsErrorMessage.textContent = message;
  elements.settingsErrorMessage.hidden = !message;
}

function setImageError(elements: AppElements, message: string) {
  elements.imgErrorMessage.textContent = message;
  elements.imgErrorMessage.hidden = !message;
}

function setSketchError(elements: AppElements, message: string) {
  elements.sketchErrorMessage.textContent = message;
  elements.sketchErrorMessage.hidden = !message;
}

function setInpaintError(elements: AppElements, message: string) {
  elements.inpaintErrorMessage.textContent = message;
  elements.inpaintErrorMessage.hidden = !message;
}

function setPromptLayerError(elements: AppElements, message: string) {
  elements.promptLayerErrorMessage.textContent = message;
  elements.promptLayerErrorMessage.hidden = !message;
}

function setDiagnostics(elements: AppElements, message: string) {
  elements.diagnosticsText.textContent = message;
  elements.imgDiagnosticsText.textContent = message;
  elements.sketchDiagnosticsText.textContent = message;
  elements.inpaintDiagnosticsText.textContent = message;
  elements.promptLayerDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

function setImageDiagnostics(elements: AppElements, message: string) {
  elements.imgDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

function setSketchDiagnostics(elements: AppElements, message: string) {
  elements.sketchDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

function setInpaintDiagnostics(elements: AppElements, message: string) {
  elements.inpaintDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

function setPromptLayerDiagnostics(elements: AppElements, message: string) {
  elements.promptLayerDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

function updateNegativePromptDisclosure(elements: AppElements, isOpen: boolean) {
  elements.negativePromptField.hidden = !isOpen;
  elements.negativePromptToggle.textContent = isOpen ? "Hide Negative Prompt" : "Show Negative Prompt";
  elements.negativePromptToggle.setAttribute("aria-expanded", String(isOpen));
  elements.negativePromptToggle.classList.toggle("is-active", isOpen);
}

function updateAutoImportToggle(elements: AppElements, isEnabled: boolean) {
  elements.autoImportToggle.textContent = isEnabled ? "Auto Import On" : "Import Result Automatically";
  elements.autoImportToggle.setAttribute("aria-pressed", String(isEnabled));
  elements.autoImportToggle.classList.toggle("is-active", isEnabled);
}

function updateExperimentalCheckpointToggle(elements: AppElements, isEnabled: boolean) {
  elements.experimentalCheckpointToggle.textContent = isEnabled
    ? "Experimental Checkpoints On"
    : "Experimental Checkpoints Off";
  elements.experimentalCheckpointToggle.setAttribute("aria-pressed", String(isEnabled));
  elements.experimentalCheckpointToggle.classList.toggle("is-active", isEnabled);
}

function updateTextCheckpointCompatibility(elements: AppElements) {
  try {
    const preset = getWorkflowPreset(readSelectValue(elements.workflow, DEFAULT_WORKFLOW));
    const checkpointName = readSelectValue(elements.checkpoint);
    const message = createWorkflowDiagnosticMessage(preset, { selectedModelName: checkpointName });

    setDiagnostics(elements, formatWorkflowDiagnosticMessage(message));
    updateSettingsReport(elements);
  } catch {
    // Selection-change diagnostics should never break the panel.
  }
}

function updateImageCheckpointCompatibility(
  elements: AppElements,
  allowExperimentalCheckpoints: boolean,
  source: ImageSourceState | null = null
) {
  const checkpointName = readSelectValue(elements.imgCheckpoint);
  const preset = getWorkflowPreset(readSelectValue(elements.imgWorkflow, DEFAULT_IMAGE_WORKFLOW));
  const message = createWorkflowDiagnosticMessage(preset, {
    selectedModelName: checkpointName,
    photoshopInputs: createSourceInputAvailability(source)
  });

  elements.imgCompatibilityNote.textContent = allowExperimentalCheckpoints
    ? `${formatWorkflowDiagnosticMessage(message)} Experimental model families may still need dedicated presets.`
    : formatWorkflowDiagnosticMessage(message);
  elements.imgCompatibilityNote.classList.toggle("is-warning", message.isWarning);
  updateSettingsReport(elements);
}

function updateSketchCheckpointCompatibility(elements: AppElements, source: ImageSourceState | null = null) {
  const checkpointName = readSelectValue(elements.sketchCheckpoint);
  const preset = getWorkflowPreset(readSelectValue(elements.sketchWorkflow, DEFAULT_SKETCH_WORKFLOW));
  const message = createWorkflowDiagnosticMessage(preset, {
    selectedModelName: checkpointName,
    photoshopInputs: createSourceInputAvailability(source)
  });

  elements.sketchCompatibilityNote.textContent = checkpointName === RECOMMENDED_SKETCH_CHECKPOINT
    ? `${formatWorkflowDiagnosticMessage(message)} Recommended SD 1.x checkpoint for LINECN.`
    : formatWorkflowDiagnosticMessage(message);
  elements.sketchCompatibilityNote.classList.toggle("is-warning", message.isWarning);
  updateSettingsReport(elements);
}

function updateInpaintCheckpointCompatibility(elements: AppElements, source: InpaintSourceState | null = null) {
  const checkpointName = readSelectValue(elements.inpaintCheckpoint);
  const preset = getWorkflowPreset(readSelectValue(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW));
  const message = createWorkflowDiagnosticMessage(preset, {
    selectedModelName: checkpointName,
    photoshopInputs: {
      selection: Boolean(source),
      "selection-mask": Boolean(source?.mask)
    }
  });

  elements.inpaintCompatibilityNote.textContent = formatWorkflowDiagnosticMessage(message);
  elements.inpaintCompatibilityNote.classList.toggle("is-warning", true);
  updateSettingsReport(elements);
}

function createWorkflowDiagnostics(
  preset: WorkflowPresetDefinition,
  checkpointName: string,
  photoshopInputs?: WorkflowPhotoshopInputAvailability
) {
  return formatWorkflowDiagnosticMessage(createWorkflowDiagnosticMessage(preset, {
    selectedModelName: checkpointName,
    photoshopInputs
  }));
}

function formatWorkflowDiagnosticMessage(message: WorkflowDiagnosticMessage) {
  return `${message.summary} ${message.detail}`.trim();
}

function createSourceInputAvailability(source: ImageSourceState | null): WorkflowPhotoshopInputAvailability {
  return {
    "active-layer": Boolean(source),
    canvas: Boolean(source)
  };
}

function createSourceCaptureMessage(source: ExportedSourceImage, suffix = "") {
  const baseMessage = `Captured ${source.sourceName} (${Math.round(source.width)} x ${Math.round(source.height)}) as ${formatSourceCaptureLabel(source)} source${suffix}.`;
  return baseMessage;
}

function createSourceMetaText(source: ExportedSourceImage) {
  const size = `${Math.round(source.width)} x ${Math.round(source.height)}`;
  return `${size} | ${formatSourceCaptureLabel(source)} source`;
}

function dimensionsMatchForUi(first: ImageDimensions, second: ImageDimensions) {
  return Math.round(first.width) === Math.round(second.width) && Math.round(first.height) === Math.round(second.height);
}

function getSaveImageNodeId(preset: WorkflowPresetDefinition) {
  return preset.requiredNodes.find((node) => node.classType === "SaveImage")?.id;
}

function formatSourceCaptureLabel(_source: ExportedSourceImage) {
  return "PNG/lossless";
}

type ActionName =
  | "check"
  | "findPort"
  | "detectHardware"
  | "checkWorkflowHealth"
  | "copyDiagnostics"
  | "saveSettings"
  | "resetSettings"
  | "toggleNegativePrompt"
  | "toggleAutoImport"
  | "generate"
  | "import"
  | "captureImageSource"
  | "captureCanvasSource"
  | "toggleExperimentalCheckpoints"
  | "generateImg2Img"
  | "importImg2Img"
  | "captureSketchSource"
  | "captureSketchCanvasSource"
  | "generateSketch"
  | "importSketch"
  | "captureInpaintSelection"
  | "generateInpaint"
  | "importInpaint"
  | "capturePromptLayerSource"
  | "capturePromptCanvasSource"
  | "generatePromptFromLayer"
  | "copyPromptFromLayer"
  | "sendPromptToTextToImage"
  | "clearHistory";
type HistoryActionName = "preview" | "import";
type ActionRunner = (eventName: string) => void;
type ActionHandlers = Record<ActionName, ActionRunner>;

function createActionRunner(
  elements: AppElements,
  actionName: ActionName,
  handler: () => void | Promise<void>
): ActionRunner {
  let lastRunAt = 0;

  return (eventName: string) => {
    const now = Date.now();

    if (now - lastRunAt < 350) {
      return;
    }

    lastRunAt = now;
    console.log(`[OpenLayer] action ${actionName} from ${eventName}`);
    setDiagnostics(elements, `Event received: ${actionName} (${eventName}).`);
    void handler();
  };
}

function bindActionControl(element: HTMLElement, run: ActionRunner) {
  const runFromEvent = (eventName: string, event: Event) => {
    if (isActionDisabled(element)) {
      return;
    }

    event.preventDefault();
    run(eventName);
  };

  element.onmousedown = (event) => runFromEvent("onmousedown", event);
  element.onmouseup = (event) => runFromEvent("onmouseup", event);
  element.onclick = (event) => runFromEvent("onclick", event);

  for (const eventName of ["click", "mousedown", "mouseup", "pointerup", "touchend"]) {
    element.addEventListener(eventName, (event) => runFromEvent(eventName, event));
  }

  element.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if ((key === "Enter" || key === " ") && !isActionDisabled(element)) {
      event.preventDefault();
      run(`keyboard:${key === " " ? "space" : key}`);
    }
  });
}

function bindDelegatedActions(rootElement: HTMLElement, actionHandlers: ActionHandlers) {
  for (const eventName of ["click", "mousedown", "mouseup", "pointerup", "touchend"]) {
    rootElement.addEventListener(
      eventName,
      (event) => {
        const actionElement = findActionElement(event.target, rootElement);

        if (!actionElement || isActionDisabled(actionElement)) {
          return;
        }

        const actionName = actionElement.getAttribute("data-openlayer-action") as ActionName | null;

        if (!actionName || !(actionName in actionHandlers)) {
          return;
        }

        event.preventDefault();
        actionHandlers[actionName](eventName);
      },
      true
    );
  }
}

function bindDocumentActions(rootElement: HTMLElement, actionHandlers: ActionHandlers) {
  for (const eventName of ["click", "mousedown", "mouseup", "pointerup", "touchend"]) {
    document.addEventListener(
      eventName,
      (event) => {
        const actionElement = findActionElement(event.target, rootElement);

        if (!actionElement || isActionDisabled(actionElement)) {
          return;
        }

        const actionName = actionElement.getAttribute("data-openlayer-action") as ActionName | null;

        if (!actionName || !(actionName in actionHandlers)) {
          return;
        }

        event.preventDefault();
        actionHandlers[actionName](`document:${eventName}`);
      },
      true
    );
  }
}

function bindToolCards(rootElement: HTMLElement, setView: (view: AppView) => void) {
  let lastRunAt = 0;

  const runFromEvent = (eventName: string, event: Event) => {
    const viewElement = findViewElement(event.target, rootElement);

    if (!viewElement || viewElement.getAttribute("aria-disabled") === "true") {
      return;
    }

    const nextView = viewElement.getAttribute("data-openlayer-view") as AppView | null;

    if (!nextView) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 350) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();
    setView(nextView);
  };

  for (const eventName of ["click", "mousedown", "mouseup", "pointerup", "touchend"]) {
    rootElement.addEventListener(eventName, (event) => runFromEvent(eventName, event), true);
  }

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(`keyboard:${key === " " ? "space" : key}`, event);
    }
  });
}

function bindHistoryActions(
  rootElement: HTMLElement,
  handleHistoryAction: (action: HistoryActionName, historyId: string) => void
) {
  let lastRunAt = 0;

  const runFromEvent = (eventName: string, event: Event) => {
    const historyElement = findHistoryActionElement(event.target, rootElement);

    if (!historyElement) {
      return;
    }

    const action = historyElement.getAttribute("data-openlayer-history-action") as HistoryActionName | null;
    const historyId = historyElement.getAttribute("data-openlayer-history-id") ?? "";

    if (!action || !historyId) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 350) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();
    handleHistoryAction(action, historyId);
  };

  for (const eventName of ["click", "mousedown", "mouseup", "pointerup", "touchend"]) {
    rootElement.addEventListener(eventName, (event) => runFromEvent(eventName, event), true);
  }

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(`keyboard:${key === " " ? "space" : key}`, event);
    }
  });
}

function bindExternalLinks(rootElement: HTMLElement) {
  let lastRunAt = 0;

  const runFromEvent = (eventName: string, event: Event) => {
    const externalElement = findExternalLinkElement(event.target, rootElement);

    if (!externalElement) {
      return;
    }

    const url = externalElement.getAttribute("data-openlayer-external");

    if (!url) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 350) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();
    openExternalUrl(url);
    console.log(`[OpenLayer] external link opened from ${eventName}: ${url}`);
  };

  for (const eventName of ["click", "mousedown", "mouseup", "pointerup", "touchend"]) {
    rootElement.addEventListener(eventName, (event) => runFromEvent(eventName, event), true);
  }

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(`keyboard:${key === " " ? "space" : key}`, event);
    }
  });
}

function findActionElement(target: EventTarget | null, rootElement: HTMLElement) {
  let element = getEventElement(target);

  while (element && element !== rootElement) {
    if (element.getAttribute("data-openlayer-action")) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

function findViewElement(target: EventTarget | null, rootElement: HTMLElement) {
  let element = getEventElement(target);

  while (element && element !== rootElement) {
    if (element.getAttribute("data-openlayer-view")) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

function findExternalLinkElement(target: EventTarget | null, rootElement: HTMLElement) {
  let element = getEventElement(target);

  while (element && element !== rootElement) {
    if (element.getAttribute("data-openlayer-external")) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

function findHistoryActionElement(target: EventTarget | null, rootElement: HTMLElement) {
  let element = getEventElement(target);

  while (element && element !== rootElement) {
    if (element.getAttribute("data-openlayer-history-action")) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

function openExternalUrl(url: string) {
  try {
    const uxp = require("uxp") as UxpModule;

    if (uxp.shell?.openExternal) {
      void uxp.shell.openExternal(url);
      return;
    }
  } catch {
    // Browser preview builds do not expose UXP's shell module.
  }

  if (typeof window.open === "function") {
    window.open(url, "_blank", "noopener");
  }
}

function getEventElement(target: EventTarget | null) {
  if (!target) {
    return null;
  }

  if (typeof (target as HTMLElement).getAttribute === "function") {
    return target as HTMLElement;
  }

  if ((target as Node).parentElement) {
    return (target as Node).parentElement;
  }

  return null;
}

function isActionDisabled(element: HTMLElement) {
  return element.classList.contains("is-disabled") || element.getAttribute("aria-disabled") === "true";
}

function setActionDisabled(element: HTMLElement, isDisabled: boolean) {
  element.classList.toggle("is-disabled", isDisabled);
  element.setAttribute("aria-disabled", String(isDisabled));
  element.setAttribute("tabindex", isDisabled ? "-1" : "0");
}

async function loadCheckpoints(client: ComfyClient, elements: AppElements, preferredValue = readSelectValue(elements.checkpoint)) {
  const checkpoints = await client.getCheckpointNames();

  if (checkpoints.length === 0) {
    throw createOpenLayerError("COMFY_CHECKPOINTS_EMPTY", "No ComfyUI checkpoints were found.");
  }

  fillCheckpointOptions(elements, checkpoints, preferredValue);
}

async function refreshTextModelOptionsForSelectedPreset(
  elements: AppElements,
  client = new ComfyClient(elements.serverUrl.value),
  preferredValue = readSelectValue(elements.checkpoint)
) {
  await refreshModelOptionsForSelectedPreset(
    elements.workflow,
    elements.checkpoint,
    DEFAULT_WORKFLOW,
    client,
    preferredValue
  );
}

async function refreshImageModelOptionsForSelectedPreset(
  elements: AppElements,
  client = new ComfyClient(elements.serverUrl.value),
  preferredValue = readSelectValue(elements.imgCheckpoint)
) {
  await refreshModelOptionsForSelectedPreset(
    elements.imgWorkflow,
    elements.imgCheckpoint,
    DEFAULT_IMAGE_WORKFLOW,
    client,
    preferredValue
  );
}

async function refreshModelOptionsForSelectedPreset(
  workflowSelect: HTMLSelectElement,
  modelSelect: HTMLSelectElement,
  defaultPresetId: string,
  client: ComfyClient,
  preferredValue: string
) {
  const preset = getWorkflowPreset(readSelectValue(workflowSelect, defaultPresetId));

  try {
    const modelNames = await client.getModelNamesForPreset(preset);

    if (modelNames.length > 0) {
      const preferredPresetModel = preset.modelStack?.find(
        (model) => model.kind === preset.modelSource.kind && modelNames.includes(model.modelName)
      )?.modelName;
      const preferredModel = modelNames.includes(preferredValue) ? preferredValue : preferredPresetModel;

      fillSingleCheckpointSelect(modelSelect, modelNames, preferredModel);
    }
  } catch {
    // Keep the existing list if ComfyUI is offline or this model source is unavailable.
  }
}

async function refreshInpaintModelOptionsForSelectedPreset(
  elements: AppElements,
  client = new ComfyClient(elements.serverUrl.value),
  preferredValue = readSelectValue(elements.inpaintCheckpoint)
) {
  const preset = getWorkflowPreset(readSelectValue(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW));

  try {
    const modelNames = await client.getModelNamesForPreset(preset);

    if (modelNames.length > 0) {
      const preferredPresetModel = preset.modelStack?.find(
        (model) => model.kind === preset.modelSource.kind && modelNames.includes(model.modelName)
      )?.modelName;
      const preferredModel = modelNames.includes(preferredValue) ? preferredValue : preferredPresetModel;

      fillSingleCheckpointSelect(elements.inpaintCheckpoint, modelNames, preferredModel);
    }
  } catch {
    // Keep the existing list if ComfyUI is offline or the model source is unavailable.
  }

  updateInpaintCheckpointCompatibility(elements);
}

function fillCheckpointOptions(elements: AppElements, checkpoints: string[], preferredValue?: string) {
  fillSingleCheckpointSelect(elements.checkpoint, checkpoints, preferredValue);
  fillSingleCheckpointSelect(elements.imgCheckpoint, checkpoints, preferredValue);
  fillSingleCheckpointSelect(
    elements.sketchCheckpoint,
    checkpoints,
    checkpoints.includes(RECOMMENDED_SKETCH_CHECKPOINT) ? RECOMMENDED_SKETCH_CHECKPOINT : preferredValue
  );
  fillSingleCheckpointSelect(elements.inpaintCheckpoint, checkpoints, preferredValue);
}

function fillSingleCheckpointSelect(select: HTMLSelectElement, checkpoints: string[], preferredValue?: string) {
  select.innerHTML = "";

  for (const checkpoint of checkpoints) {
    const option = document.createElement("option");
    option.value = checkpoint;
    option.textContent = checkpoint;
    select.append(option);
  }

  if (preferredValue && checkpoints.includes(preferredValue)) {
    select.value = preferredValue;
  } else {
    select.value = checkpoints[0] ?? "";
  }
}

function getImageToImageFailureHint(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "This looks like a workflow/model mismatch. img2img-basic is safest with SD 1.x and SDXL checkpoints; SD3, Flux, and Z_image_Turbo usually need dedicated loader nodes.";
  }

  if (
    details.includes("vae") ||
    details.includes("loader") ||
    details.includes("missing node") ||
    details.includes("invalid prompt")
  ) {
    return "ComfyUI rejected part of the workflow. Try an SD 1.x or SDXL checkpoint with img2img-basic, or use Experimental mode only with a matching custom workflow.";
  }

  const message = getTechnicalErrorDetails(error);
  return message.length > 160 ? `${message.slice(0, 160)}...` : message;
}

function getFriendlyImageToImageErrorMessage(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "The selected checkpoint needs a different Image to Image workflow preset.";
  }

  if (
    details.includes("vae") ||
    details.includes("loader") ||
    details.includes("missing node") ||
    details.includes("invalid prompt")
  ) {
    return "ComfyUI rejected this workflow for the selected checkpoint.";
  }

  return getErrorMessage(error);
}

function getSketchFailureHint(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("sketch2img-linecn-basic.json") || details.includes("linecn workflow json")) {
    return "The bundled LINECN workflow file was not found in this build. Rebuild OpenLayer and reload the plugin.";
  }

  if (details.includes("comfy_setup_missing") || details.includes("missing lineart controlnet")) {
    return "Install the SD 1.5 LineArt ControlNet model and required LineArt preprocessor nodes, then click Check ComfyUI again.";
  }

  if (
    details.includes("lineartpreprocessor") ||
    details.includes("controlnet") ||
    details.includes("aio aux preprocessor") ||
    details.includes("missing node")
  ) {
    return "This LINECN workflow needs the matching LineArt preprocessor and ControlNet custom nodes installed in ComfyUI.";
  }

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "This looks like a checkpoint/workflow mismatch. The first LINECN preset is intended for SD 1.x checkpoints such as epicrealism_naturalSinRC1VAE.safetensors.";
  }

  if (details.includes("vae") || details.includes("loader") || details.includes("invalid prompt")) {
    return "ComfyUI rejected part of the LINECN workflow. Check that the preset node IDs match the exported API workflow.";
  }

  const message = getTechnicalErrorDetails(error);
  return message.length > 160 ? `${message.slice(0, 160)}...` : message;
}

function getFriendlySketchErrorMessage(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("sketch2img-linecn-basic.json") || details.includes("linecn workflow json")) {
    return "LINECN workflow file missing from this build.";
  }

  if (details.includes("comfy_setup_missing") || details.includes("missing lineart controlnet")) {
    return "Required LINECN setup is missing in ComfyUI.";
  }

  if (
    details.includes("lineartpreprocessor") ||
    details.includes("controlnet") ||
    details.includes("aio aux preprocessor") ||
    details.includes("missing node")
  ) {
    return "The LINECN workflow needs matching ComfyUI LineArt/ControlNet nodes.";
  }

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "The selected checkpoint needs a matching SD 1.x LINECN workflow.";
  }

  return getErrorMessage(error);
}

function getInpaintFailureHint(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("inpaint-basic.json") || details.includes("inpaint workflow json")) {
    return "The bundled inpaint-basic workflow file was not found in this build. Rebuild OpenLayer and reload the plugin.";
  }

  if (
    details.includes("vaeencodeforinpaint") ||
    details.includes("inpaintmodelconditioning") ||
    details.includes("imagetomask") ||
    details.includes("loadimage") ||
    details.includes("missing node")
  ) {
    return "This Inpaint workflow needs ComfyUI's standard LoadImage, ImageToMask, and InpaintModelConditioning nodes. Rebuild or remap the inpaint-basic workflow if node IDs changed.";
  }

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "This looks like a checkpoint/workflow mismatch. inpaint-basic is intended for SD 1.x checkpoints first.";
  }

  if (details.includes("mask") || details.includes("vae") || details.includes("invalid prompt")) {
    return "ComfyUI rejected part of the inpaint workflow. Check that the source image, mask image, and selected checkpoint match inpaint-basic.";
  }

  const message = getTechnicalErrorDetails(error);
  return message.length > 160 ? `${message.slice(0, 160)}...` : message;
}

function getFriendlyInpaintErrorMessage(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("inpaint-basic.json") || details.includes("inpaint workflow json")) {
    return "Inpaint workflow file missing from this build.";
  }

  if (
    details.includes("vaeencodeforinpaint") ||
    details.includes("inpaintmodelconditioning") ||
    details.includes("imagetomask") ||
    details.includes("loadimage") ||
    details.includes("missing node")
  ) {
    return "The Inpaint workflow needs matching ComfyUI inpaint nodes.";
  }

  if (
    details.includes("clip input is invalid") ||
    details.includes("does not contain a valid clip") ||
    details.includes("text encoder")
  ) {
    return "The selected checkpoint needs a matching SD 1.x Inpaint workflow.";
  }

  return getErrorMessage(error);
}

function readSelectValue(select: HTMLSelectElement, fallback = "") {
  const directValue = typeof select.value === "string" ? select.value.trim() : "";

  if (directValue) {
    return directValue;
  }

  const option = select.options?.[select.selectedIndex] ?? select.options?.[0];
  const optionValue = option?.value?.trim() || option?.textContent?.trim() || "";

  return optionValue || fallback;
}

function applyValidatedSettings(elements: AppElements, settings: {
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
}) {
  elements.width.value = String(settings.width);
  elements.height.value = String(settings.height);
  elements.steps.value = String(settings.steps);
  elements.cfg.value = String(settings.cfg);
  elements.seed.value = String(settings.seed);
}

function applyValidatedImageToImageSettings(elements: AppElements, settings: {
  steps: number;
  cfg: number;
  seed: number;
  denoise: number;
}) {
  elements.imgSteps.value = String(settings.steps);
  elements.imgCfg.value = String(settings.cfg);
  elements.imgSeed.value = String(settings.seed);
  elements.imgDenoise.value = String(settings.denoise);
}

function applyValidatedSketchToImageSettings(elements: AppElements, settings: {
  steps: number;
  cfg: number;
  seed: number;
  denoise: number;
  controlStrength: number;
}) {
  elements.sketchSteps.value = String(settings.steps);
  elements.sketchCfg.value = String(settings.cfg);
  elements.sketchSeed.value = String(settings.seed);
  elements.sketchDenoise.value = String(settings.denoise);
  elements.sketchControlStrength.value = String(settings.controlStrength);
}

function applyValidatedInpaintSettings(elements: AppElements, settings: {
  steps: number;
  cfg: number;
  seed: number;
  denoise: number;
}) {
  elements.inpaintSteps.value = String(settings.steps);
  elements.inpaintCfg.value = String(settings.cfg);
  elements.inpaintSeed.value = String(settings.seed);
  elements.inpaintDenoise.value = String(settings.denoise);
}

function applyPreferences(elements: AppElements, preferences: Partial<OpenLayerPreferences>) {
  if (preferences.serverUrl) {
    elements.serverUrl.value = preferences.serverUrl;
  }

  if (preferences.workflow) {
    elements.workflow.value = preferences.workflow;
  }

  elements.imgWorkflow.value = DEFAULT_IMAGE_WORKFLOW;
  elements.sketchWorkflow.value = DEFAULT_SKETCH_WORKFLOW;
  elements.inpaintWorkflow.value = DEFAULT_INPAINT_WORKFLOW;

  if (preferences.width) {
    elements.width.value = preferences.width;
  }

  if (preferences.height) {
    elements.height.value = preferences.height;
  }

  if (preferences.steps) {
    elements.steps.value = preferences.steps;
  }

  if (preferences.cfg) {
    elements.cfg.value = preferences.cfg;
    elements.imgCfg.value = preferences.cfg;
    elements.sketchCfg.value = preferences.cfg;
    elements.inpaintCfg.value = preferences.cfg;
  }

  if (preferences.seed) {
    elements.seed.value = preferences.seed;
  }
}

function applyDefaultSettings(elements: AppElements) {
  elements.serverUrl.value = DEFAULT_SERVER_URL;
  elements.workflow.value = DEFAULT_WORKFLOW;
  elements.imgWorkflow.value = DEFAULT_IMAGE_WORKFLOW;
  elements.width.value = DEFAULT_WIDTH;
  elements.height.value = DEFAULT_HEIGHT;
  elements.steps.value = DEFAULT_STEPS;
  elements.cfg.value = DEFAULT_CFG;
  elements.seed.value = "";
  elements.imgSteps.value = DEFAULT_IMG2IMG_STEPS;
  elements.imgCfg.value = DEFAULT_CFG;
  elements.imgSeed.value = "";
  elements.imgDenoise.value = DEFAULT_IMG2IMG_DENOISE;
  elements.sketchWorkflow.value = DEFAULT_SKETCH_WORKFLOW;
  elements.sketchSteps.value = DEFAULT_SKETCH_STEPS;
  elements.sketchCfg.value = DEFAULT_CFG;
  elements.sketchSeed.value = "";
  elements.sketchDenoise.value = DEFAULT_SKETCH_DENOISE;
  elements.sketchControlStrength.value = DEFAULT_SKETCH_CONTROL_STRENGTH;
  elements.inpaintWorkflow.value = DEFAULT_INPAINT_WORKFLOW;
  elements.inpaintSteps.value = DEFAULT_INPAINT_STEPS;
  elements.inpaintCfg.value = DEFAULT_CFG;
  elements.inpaintSeed.value = "";
  elements.inpaintDenoise.value = DEFAULT_INPAINT_DENOISE;
}

function savePreferencesFromElements(
  elements: AppElements,
  overrides: Partial<OpenLayerPreferences> = {}
) {
  return saveOpenLayerPreferences({
    serverUrl: elements.serverUrl.value.trim() || DEFAULT_SERVER_URL,
    workflow: readSelectValue(elements.workflow, DEFAULT_WORKFLOW),
    checkpointName: readSelectValue(elements.checkpoint),
    width: elements.width.value,
    height: elements.height.value,
    steps: elements.steps.value,
    cfg: elements.cfg.value,
    seed: elements.seed.value,
    ...overrides
  });
}

function updateSettingsReport(elements: AppElements) {
  const checkpointCount = elements.checkpoint.options.length;

  elements.settingsUrlValue.textContent = elements.serverUrl.value.trim() || DEFAULT_SERVER_URL;
  elements.settingsCheckpointCount.textContent = checkpointCount > 0 ? `${checkpointCount} listed` : "None";
  elements.settingsLastCheckpoint.textContent = readSelectValue(elements.checkpoint) || "None";
  elements.settingsWorkflowReadiness.textContent = createSettingsWorkflowReadiness(elements);
}

function createSettingsWorkflowReadiness(elements: AppElements) {
  const messages = [
    createWorkflowDiagnosticMessage(getWorkflowPreset(readSelectValue(elements.workflow, DEFAULT_WORKFLOW)), {
      selectedModelName: readSelectValue(elements.checkpoint)
    }),
    createWorkflowDiagnosticMessage(getWorkflowPreset(readSelectValue(elements.imgWorkflow, DEFAULT_IMAGE_WORKFLOW)), {
      selectedModelName: readSelectValue(elements.imgCheckpoint)
    }),
    createWorkflowDiagnosticMessage(getWorkflowPreset(readSelectValue(elements.sketchWorkflow, DEFAULT_SKETCH_WORKFLOW)), {
      selectedModelName: readSelectValue(elements.sketchCheckpoint)
    }),
    createWorkflowDiagnosticMessage(getWorkflowPreset(readSelectValue(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW)), {
      selectedModelName: readSelectValue(elements.inpaintCheckpoint)
    })
  ];
  const warnings = messages.filter((message) => message.isWarning);

  if (warnings.length === 0) {
    return "Selected workflows look ready.";
  }

  return createWorkflowReadinessSummary(warnings);
}

function renderHardwareReport(elements: AppElements, report: HardwareRecommendationReport | null) {
  if (!report) {
    elements.settingsGpuName.textContent = "Not detected";
    elements.settingsVramTotal.textContent = "Not detected";
    elements.settingsVramFree.textContent = "Not detected";
    elements.settingsVramTier.textContent = "Run detection";
    elements.settingsModelFamilies.textContent = "Run detection";
    elements.settingsZImageTurbo.textContent = "Run detection";
    elements.settingsModelRecommendations.textContent =
      "Click Detect GPU & Recommend Models to get local hardware-aware suggestions.";
    return;
  }

  elements.settingsGpuName.textContent = `${report.deviceName} (${report.deviceType})`;
  elements.settingsVramTotal.textContent = report.vramTotalLabel;
  elements.settingsVramFree.textContent = report.vramFreeLabel;
  elements.settingsVramTier.textContent = report.tierLabel;
  elements.settingsModelFamilies.textContent = formatDetectedFamilySummary(report);
  elements.settingsZImageTurbo.textContent = formatZImageTurboSettingsNote(report);
  elements.settingsModelRecommendations.textContent = report.recommendations
    .map((item) => `${item.task}: ${item.recommendation}`)
    .join(" ");
}

function renderWorkflowHealthReport(elements: AppElements, report: WorkflowHealthReport | null) {
  elements.settingsWorkflowHealthList.innerHTML = "";
  renderWorkflowHealthSummary(elements, report);

  if (!report) {
    const empty = document.createElement("div");
    empty.className = "diagnostics-line";
    empty.textContent = "Click Check Workflow Health to inspect local workflow readiness.";
    elements.settingsWorkflowHealthList.append(empty);
    return;
  }

  for (const group of createWorkflowHealthGroups(report.items)) {
    const groupElement = document.createElement("div");
    groupElement.className = "workflow-health-group";

    const groupTitle = document.createElement("div");
    groupTitle.className = "workflow-health-group-title";
    groupTitle.textContent = `${group.label} (${group.items.length})`;
    groupElement.append(groupTitle);

    for (const item of group.items) {
      groupElement.append(createWorkflowHealthCard(item));
    }

    elements.settingsWorkflowHealthList.append(groupElement);
  }
}

function renderWorkflowHealthSummary(elements: AppElements, report: WorkflowHealthReport | null) {
  elements.settingsWorkflowHealthSummary.innerHTML = "";

  const readyCount = report?.stateCounts.ready ?? 0;
  const experimentalCount = report?.stateCounts.experimental ?? 0;
  const missingSetupCount = report
    ? report.stateCounts["missing-model"] + report.stateCounts["missing-node"] + report.stateCounts["setup-required"]
    : 0;
  const missingWorkflowCount = report?.stateCounts["missing-workflow"] ?? 0;

  const cards = [
    { label: "Ready", value: readyCount, state: "ready" },
    { label: "Experimental", value: experimentalCount, state: "experimental" },
    { label: "Missing setup", value: missingSetupCount, state: "setup" },
    { label: "Needs workflow", value: missingWorkflowCount, state: "future" }
  ];

  for (const card of cards) {
    const cardElement = document.createElement("div");
    cardElement.className = `diagnostic-summary-card is-${card.state}`;

    const label = document.createElement("span");
    label.textContent = card.label;
    cardElement.append(label);

    const value = document.createElement("strong");
    value.textContent = report ? String(card.value) : "-";
    cardElement.append(value);

    elements.settingsWorkflowHealthSummary.append(cardElement);
  }
}

function createWorkflowHealthGroups(items: readonly WorkflowHealthItem[]) {
  return [
    {
      label: "Ready",
      items: items.filter((item) => item.state === "ready")
    },
    {
      label: "Experimental",
      items: items.filter((item) => item.state === "experimental")
    },
    {
      label: "Missing setup",
      items: items.filter((item) => (
        item.state === "missing-model" ||
        item.state === "missing-node" ||
        item.state === "setup-required"
      ))
    },
    {
      label: "Future / workflow JSON needed",
      items: items.filter((item) => item.state === "missing-workflow")
    }
  ].filter((group) => group.items.length > 0);
}

function createWorkflowHealthCard(item: WorkflowHealthItem) {
  const row = document.createElement("div");
  row.className = `workflow-health-item is-${item.state}`;

  const heading = document.createElement("div");
  heading.className = "workflow-health-heading";

  const titleBlock = document.createElement("div");
  titleBlock.className = "workflow-health-title-block";

  const title = document.createElement("div");
  title.className = "workflow-health-title";
  title.textContent = item.label;
  titleBlock.append(title);

  const tool = document.createElement("div");
  tool.className = "workflow-health-tool";
  tool.textContent = item.toolLabel;
  titleBlock.append(tool);

  heading.append(titleBlock);

  const badge = document.createElement("div");
  badge.className = `workflow-health-state is-${item.state}`;
  badge.textContent = item.stateLabel;
  heading.append(badge);

  row.append(heading);

  const summary = document.createElement("div");
  summary.className = "workflow-health-summary";
  summary.textContent = item.summary;
  row.append(summary);

  if (item.detail) {
    const toggle = document.createElement("button");
    toggle.className = "button diagnostic-detail-toggle";
    toggle.type = "button";
    toggle.textContent = "Show details";
    row.append(toggle);

    const detail = document.createElement("div");
    detail.className = "workflow-health-detail diagnostic-muted";
    detail.textContent = item.detail;
    detail.hidden = true;
    row.append(detail);

    toggle.addEventListener("click", () => {
      const shouldShow = detail.hidden;
      detail.hidden = !shouldShow;
      toggle.textContent = shouldShow ? "Hide details" : "Show details";
    });
  }

  return row;
}

function createDiagnosticsReport(
  elements: AppElements,
  hardwareReport: HardwareRecommendationReport | null,
  workflowHealthReport: WorkflowHealthReport | null
) {
  const lines = [
    "OpenLayer Diagnostics",
    `Version: v${APP_VERSION}`,
    `Server URL: ${elements.serverUrl.value.trim() || DEFAULT_SERVER_URL}`,
    `Checkpoint count: ${elements.checkpoint.options.length}`,
    `Text to Image model: ${readSelectValue(elements.checkpoint) || "None"}`,
    `Image to Image model: ${readSelectValue(elements.imgCheckpoint) || "None"}`,
    `Sketch to Image model: ${readSelectValue(elements.sketchCheckpoint) || "None"}`,
    `Inpaint model: ${readSelectValue(elements.inpaintCheckpoint) || "None"}`,
    "",
    "Workflow health:",
    workflowHealthReport?.summary ?? "Workflow health has not been checked yet.",
    ...formatWorkflowHealthReportLines(workflowHealthReport),
    "",
    "Hardware advisor:",
    ...formatHardwareReportLines(hardwareReport),
    "",
    "Model stack note:",
    "Z_image_Turbo is not a checkpoint. It appears through diffusion model loaders such as UNETLoader. Flux presets need matching workflow JSON before they are ready."
  ];

  return lines.join("\n");
}

function formatWorkflowHealthReportLines(report: WorkflowHealthReport | null) {
  if (!report) {
    return ["- Not checked"];
  }

  return report.items.map((item) => `- ${item.label}: ${item.stateLabel} | ${item.summary}`);
}

function formatHardwareReportLines(report: HardwareRecommendationReport | null) {
  if (!report) {
    return ["- Not checked"];
  }

  return [
    `- GPU: ${report.deviceName} (${report.deviceType})`,
    `- Total VRAM: ${report.vramTotalLabel}`,
    `- Free VRAM: ${report.vramFreeLabel}`,
    `- Tier: ${report.tierLabel}`,
    `- Z_image_Turbo: ${report.zImageTurboMessage}`
  ];
}

function formatDetectedFamilySummary(report: HardwareRecommendationReport) {
  if (report.detectedFamilies.length === 0) {
    return "No known families detected";
  }

  return report.detectedFamilies
    .map((family) => `${family.label}: ${family.count}`)
    .join(", ");
}

function formatZImageTurboSettingsNote(report: HardwareRecommendationReport) {
  const message = report.zImageTurboMessage.toLowerCase();

  if (message.includes("stack detected")) {
    return "Detected as a diffusion model stack.";
  }

  if (message.includes("diffusion model detected")) {
    return "Diffusion model found; stack setup needs checking.";
  }

  return "Not found in diffusion model loaders.";
}

async function refreshDocumentStatus(elements: AppElements) {
  try {
    const documentInfo = await getActiveDocumentInfo();
    elements.settingsDocumentStatus.textContent = `${documentInfo.name} (${Math.round(documentInfo.width)} x ${Math.round(documentInfo.height)})`;
  } catch {
    elements.settingsDocumentStatus.textContent = "No document open";
  }
}

function addHistoryEntry(
  elements: AppElements,
  historyEntries: HistoryEntry[],
  result: GeneratedImageResult,
  details: {
    prompt: string;
    checkpointName: string;
    seed: number;
    sizeLabel: string;
  }
) {
  historyEntries.unshift({
    id: createHistoryId(),
    result,
    previewUrl: URL.createObjectURL(result.blob),
    prompt: details.prompt.trim() || "Untitled prompt",
    checkpointName: details.checkpointName,
    seed: details.seed,
    sizeLabel: details.sizeLabel,
    createdAt: new Date().toLocaleString()
  });

  while (historyEntries.length > HISTORY_LIMIT) {
    const removedEntry = historyEntries.pop();

    if (removedEntry) {
      URL.revokeObjectURL(removedEntry.previewUrl);
    }
  }

  renderHistory(elements, historyEntries);
}

function renderHistory(elements: AppElements, historyEntries: HistoryEntry[]) {
  elements.historyList.innerHTML = "";

  if (historyEntries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "No recent generations yet.";
    elements.historyList.append(empty);
    return;
  }

  for (const entry of historyEntries) {
    const card = document.createElement("div");
    card.className = "history-card";

    const image = document.createElement("img");
    image.className = "history-thumb";
    image.src = entry.previewUrl;
    image.alt = "OpenLayer history preview";
    card.append(image);

    const body = document.createElement("div");
    body.className = "history-body";

    const title = document.createElement("div");
    title.className = "history-title";
    title.textContent = entry.prompt;
    body.append(title);

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent = `${entry.sizeLabel} | Seed ${entry.seed}`;
    body.append(meta);

    const checkpoint = document.createElement("div");
    checkpoint.className = "history-meta";
    checkpoint.textContent = entry.checkpointName;
    body.append(checkpoint);

    const createdAt = document.createElement("div");
    createdAt.className = "history-time";
    createdAt.textContent = entry.createdAt;
    body.append(createdAt);

    const actions = document.createElement("div");
    actions.className = "history-actions";
    actions.append(createHistoryButton("Preview", "preview", entry.id));
    actions.append(createHistoryButton("Import", "import", entry.id));
    body.append(actions);

    card.append(body);
    elements.historyList.append(card);
  }
}

function createHistoryButton(label: string, action: HistoryActionName, historyId: string) {
  const button = document.createElement("button");
  button.className = "button history-button";
  button.type = "button";
  button.textContent = label;
  button.setAttribute("data-openlayer-history-action", action);
  button.setAttribute("data-openlayer-history-id", historyId);
  return button;
}

function clearHistoryEntries(historyEntries: HistoryEntry[]) {
  for (const entry of historyEntries) {
    URL.revokeObjectURL(entry.previewUrl);
  }

  historyEntries.splice(0, historyEntries.length);
}

async function findActiveComfyUrl(currentUrl: string, onProgress: (message: string) => void) {
  const candidates = buildComfyCandidateUrls(currentUrl);

  for (const candidate of candidates) {
    onProgress(`Checking ${candidate}...`);

    if (await isComfyServerOnline(candidate)) {
      return candidate;
    }
  }

  return "";
}

function buildComfyCandidateUrls(currentUrl: string) {
  const candidates = [
    normalizeCandidateUrl(currentUrl),
    ...COMFY_PORT_CANDIDATES.map((port) => `http://127.0.0.1:${port}`)
  ].filter(Boolean);

  return Array.from(new Set(candidates));
}

function normalizeCandidateUrl(url: string) {
  const trimmed = url.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

async function isComfyServerOnline(serverUrl: string) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = window.setTimeout(() => {
    controller?.abort();
  }, 1200);

  try {
    const requestOptions: RequestInit = controller ? { signal: controller.signal } : {};
    const response = await fetch(`${serverUrl}/system_stats`, requestOptions);
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function createHistoryId() {
  return `history-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
