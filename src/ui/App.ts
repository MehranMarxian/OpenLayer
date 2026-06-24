import { ComfyClient } from "../comfy/comfyClient";
import {
  createHardwareRecommendationReport,
  formatHardwareReport,
  HardwareRecommendationReport
} from "../comfy/hardwareAdvisor";
import { getCheckpointCompatibility, getPresetCompatibilityNote } from "../comfy/modelCompatibility";
import { getWorkflowPreset, listWorkflowPresets } from "../comfy/presetRegistry";
import { validateGenerationSettings, validateImageToImageSettings, validateSketchToImageSettings } from "../comfy/settings";
import { buildImg2ImgWorkflow, buildSketchToImageWorkflow, buildTxt2ImgWorkflow } from "../comfy/workflowBuilder";
import { GeneratedImageResult, WorkflowPresetDefinition } from "../comfy/types";
import {
  ExportedSourceImage,
  exportActiveLayerForImageToImage,
  exportCanvasForImageToImage,
  getActiveDocumentInfo,
  importGeneratedImageAsLayer
} from "../photoshop/photoshopAdapter";
import { createOpenLayerError, getErrorMessage, getTechnicalErrorDetails } from "../utils/errors";
import { createLayerName } from "../utils/fileUtils";
import {
  clearOpenLayerPreferences,
  loadOpenLayerPreferences,
  OpenLayerPreferences,
  saveOpenLayerPreferences
} from "../utils/preferences";

const DEFAULT_SERVER_URL = "http://127.0.0.1:8190";
const APP_VERSION = "0.2.1";
const DEVELOPER_GITHUB = "https://github.com/MehranMarxian";
const HISTORY_LIMIT = 5;
const COMFY_PORT_CANDIDATES = [8190, 8188, 8189, 8191, 8192, 8193, 7860];
const DEFAULT_WORKFLOW = "txt2img-basic";
const DEFAULT_IMAGE_WORKFLOW = "img2img-basic";
const DEFAULT_SKETCH_WORKFLOW = "sketch2img-linecn-basic";
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
type AppView = "home" | "text-to-image" | "image-to-image" | "sketch-to-image" | "settings" | "history";
type ToolCardStatus = "available" | "coming-soon";

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
    subtitle: "Regenerate inside a selected area",
    icon: "brush",
    status: "coming-soon"
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
  settingsStatusText: HTMLElement;
  settingsStatusPill: HTMLElement;
  diagnosticsText: HTMLElement;
  imgDiagnosticsText: HTMLElement;
  imgCompatibilityNote: HTMLElement;
  sketchDiagnosticsText: HTMLElement;
  sketchCompatibilityNote: HTMLElement;
  settingsDiagnosticsText: HTMLElement;
  errorMessage: HTMLElement;
  imgErrorMessage: HTMLElement;
  sketchErrorMessage: HTMLElement;
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
  historyList: HTMLElement;
  settingsUrlValue: HTMLElement;
  settingsCheckpointCount: HTMLElement;
  settingsLastCheckpoint: HTMLElement;
  settingsDocumentStatus: HTMLElement;
  settingsGpuName: HTMLElement;
  settingsVramTotal: HTMLElement;
  settingsVramFree: HTMLElement;
  settingsVramTier: HTMLElement;
  settingsModelFamilies: HTMLElement;
  settingsZImageTurbo: HTMLElement;
  settingsModelRecommendations: HTMLElement;
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
  let importAutomatically = false;
  let isNegativePromptOpen = false;
  let allowExperimentalCheckpoints = false;
  let hardwareReport: HardwareRecommendationReport | null = null;
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
    clearHistory: createActionRunner(elements, "clearHistory", handleClearHistory)
  };

  bindActionControl(elements.checkButton, actionHandlers.check);
  bindActionControl(elements.findPortButton, actionHandlers.findPort);
  bindActionControl(elements.detectHardwareButton, actionHandlers.detectHardware);
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
  bindActionControl(elements.clearHistoryButton, actionHandlers.clearHistory);
  bindDelegatedActions(rootElement, actionHandlers);
  bindDocumentActions(rootElement, actionHandlers);
  bindToolCards(rootElement, (view) => setView(view));
  bindHistoryActions(rootElement, handleHistoryAction);
  bindExternalLinks(rootElement);

  setStatus(elements, "Ready.", "idle");
  setView(currentView);
  setError(elements, "");
  setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
  updateNegativePromptDisclosure(elements, isNegativePromptOpen);
  updateAutoImportToggle(elements, importAutomatically);
  updateExperimentalCheckpointToggle(elements, allowExperimentalCheckpoints);
  updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints);
  setImageSource(null);
  setImageResult(null);
  updateSketchCheckpointCompatibility(elements);
  setSketchSource(null);
  setSketchResult(null);
  updateSettingsReport(elements);
  renderHardwareReport(elements, hardwareReport);
  renderHistory(elements, historyEntries);
  void loadInitialCheckpoints();

  elements.workflow.addEventListener("change", () => {
    updateTextCheckpointCompatibility(elements);
  });

  elements.checkpoint.addEventListener("change", () => {
    updateTextCheckpointCompatibility(elements);
  });

  elements.imgWorkflow.addEventListener("change", () => {
    updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints);
  });

  elements.imgCheckpoint.addEventListener("change", () => {
    updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints);
  });

  elements.sketchWorkflow.addEventListener("change", () => {
    updateSketchCheckpointCompatibility(elements);
  });

  elements.sketchCheckpoint.addEventListener("change", () => {
    updateSketchCheckpointCompatibility(elements);
  });

  async function loadInitialCheckpoints() {
    setStatus(elements, "Loading ComfyUI models...", "idle");

    try {
      const client = new ComfyClient(elements.serverUrl.value);
      await client.checkOnline();
      await loadCheckpoints(client, elements, preferences.checkpointName || readSelectValue(elements.checkpoint));
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints);
      updateSketchCheckpointCompatibility(elements);
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
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints);
      updateSketchCheckpointCompatibility(elements);
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
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints);
      updateSketchCheckpointCompatibility(elements);
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
    updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints);
    updateSketchCheckpointCompatibility(elements);
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
    updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints);
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
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
      const generatedResult = await client.retrieveFirstOutputImage(promptId, history);
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
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);

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
        `Captured ${exportedSource.sourceName} (${Math.round(exportedSource.width)} x ${Math.round(exportedSource.height)}) as JPEG source.`
      );
    } catch (caughtError) {
      setImageStatus(elements, "Source capture failed.", "error");
      setImageError(elements, getErrorMessage(caughtError));
      setImageDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
    }
  }

  async function handleGenerateImg2Img() {
    setImageDiagnostics(elements, `Image to Image generate pressed at ${new Date().toLocaleTimeString()}.`);

    if (!imageSource) {
      setImageError(elements, "Capture the active Photoshop layer before generating Image to Image.");
      setImageStatus(elements, "Source required.", "error");
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
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
          : createWorkflowDiagnostics(preset, checkpointName)
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
      const generatedResult = await client.retrieveFirstOutputImage(promptId, history);
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
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);

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
        `Captured ${exportedSource.sourceName} (${Math.round(exportedSource.width)} x ${Math.round(exportedSource.height)}) for LINECN guidance.`
      );
    } catch (caughtError) {
      setSketchStatus(elements, "Sketch source capture failed.", "error");
      setSketchError(elements, getErrorMessage(caughtError));
      setSketchDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      isBusy = false;
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
    }
  }

  async function handleGenerateSketch() {
    setSketchDiagnostics(elements, `Sketch to Image generate pressed at ${new Date().toLocaleTimeString()}.`);

    if (!sketchSource) {
      setSketchError(elements, "Capture the active Photoshop layer or canvas before generating Sketch to Image.");
      setSketchStatus(elements, "Source required.", "error");
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
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
          : createWorkflowDiagnostics(preset, checkpointName)
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
      const generatedResult = await client.retrieveFirstOutputImage(promptId, history);
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
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
    }
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
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
      return;
    }

    previewUrl = URL.createObjectURL(result.blob);
    const image = document.createElement("img");
    image.src = previewUrl;
    image.alt = "Generated OpenLayer preview";
    elements.previewPanel.append(image);
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
      return;
    }

    imageSourcePreviewUrl = imageSource.previewUrl;
    const image = document.createElement("img");
    image.src = imageSourcePreviewUrl;
    image.alt = "Captured active Photoshop layer";
    elements.imageSourcePreviewPanel.append(image);
    elements.imageSourceTitle.textContent = imageSource.sourceName;
    elements.imageSourceMeta.textContent = `${Math.round(imageSource.width)} x ${Math.round(imageSource.height)} | JPEG source`;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
      return;
    }

    imageResultPreviewUrl = URL.createObjectURL(imageResult.blob);
    const image = document.createElement("img");
    image.src = imageResultPreviewUrl;
    image.alt = "Generated Image to Image preview";
    elements.imageResultPreviewPanel.append(image);
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
      return;
    }

    sketchSourcePreviewUrl = sketchSource.previewUrl;
    const image = document.createElement("img");
    image.src = sketchSourcePreviewUrl;
    image.alt = "Captured Photoshop source for Sketch to Image";
    elements.sketchSourcePreviewPanel.append(image);
    elements.sketchSourceTitle.textContent = sketchSource.sourceName;
    elements.sketchSourceMeta.textContent = `${Math.round(sketchSource.width)} x ${Math.round(sketchSource.height)} | LINECN source`;
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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
      setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
      return;
    }

    sketchResultPreviewUrl = URL.createObjectURL(sketchResult.blob);
    const image = document.createElement("img");
    image.src = sketchResultPreviewUrl;
    image.alt = "Generated Sketch to Image preview";
    elements.sketchResultPreviewPanel.append(image);
    setBusy(elements, isBusy, result, imageResult, imageSource, sketchResult, sketchSource);
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

  function setView(view: AppView) {
    currentView = view;
    elements.homeView.hidden = currentView !== "home";
    elements.generatorView.hidden = currentView !== "text-to-image";
    elements.imageToImageView.hidden = currentView !== "image-to-image";
    elements.sketchToImageView.hidden = currentView !== "sketch-to-image";
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

      <section class="settings-view" id="settings-view" aria-label="Settings" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            <span class="screen-kicker">SET</span>
            <span class="screen-title">Settings</span>
          </div>
        </div>

        <section class="panel-section settings-panel" aria-label="ComfyUI settings">
          <div class="section-heading">
            <span class="label">ComfyUI</span>
            <span class="muted-label">Local server</span>
          </div>
          <label class="field">
            <span class="label">ComfyUI server URL</span>
            <input class="input" id="server-url" value="${DEFAULT_SERVER_URL}" placeholder="${DEFAULT_SERVER_URL}" />
          </label>
          <button class="button action-control" id="check-comfy" data-openlayer-action="check" type="button">Check ComfyUI</button>
          <button class="button action-control" id="find-comfy-port" data-openlayer-action="findPort" type="button">Find ComfyUI Active Port</button>
          <button class="button action-control" id="detect-gpu" data-openlayer-action="detectHardware" type="button">Detect GPU &amp; Recommend Models</button>
          <div class="settings-actions">
            <button class="button action-control" id="save-settings" data-openlayer-action="saveSettings" type="button">Save Settings</button>
            <button class="button action-control" id="reset-settings" data-openlayer-action="resetSettings" type="button">Reset Defaults</button>
          </div>
        </section>

        <section class="panel-section settings-panel" aria-label="Status report">
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

        <section class="panel-section settings-panel" aria-label="Hardware advisor">
          <div class="section-heading">
            <span class="label">Hardware advisor</span>
            <span class="muted-label">Model guidance</span>
          </div>
          <div class="settings-list hardware-list">
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
        </section>

        <section class="panel-section settings-panel" aria-label="Plugin settings">
          <div class="section-heading">
            <span class="label">Plugin</span>
            <span class="muted-label">MVP defaults</span>
          </div>
          <div class="settings-list">
            <div><span>Version</span><strong>v${APP_VERSION}</strong></div>
            <div><span>Default workflow</span><strong>txt2img-basic</strong></div>
            <div><span>Server URL</span><strong id="settings-url-value">${DEFAULT_SERVER_URL}</strong></div>
            <div><span>Checkpoint count</span><strong id="settings-checkpoint-count">Fallback list</strong></div>
            <div><span>Last checkpoint</span><strong id="settings-last-checkpoint">Not checked</strong></div>
            <div><span>Photoshop document</span><strong id="settings-document-status">Not checked</strong></div>
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
              ${listWorkflowPresets("txt2img").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span class="label">Checkpoint</span>
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
              ${listWorkflowPresets("img2img").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <span class="label">Checkpoint</span>
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
              ${listWorkflowPresets("sketch2img").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
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
  const isAvailable = card.status === "available";
  const viewAttribute = isAvailable && card.view ? ` data-openlayer-view="${card.view}"` : "";
  const disabledAttributes = isAvailable ? "" : ` aria-disabled="true" tabindex="-1"`;
  const statusMarkup = isAvailable
    ? `<span class="tool-status available">Available</span>`
    : `<span class="tool-status coming-soon">Coming Soon</span>`;

  return `
    <div
      class="tool-card ${isAvailable ? "is-available" : "is-coming-soon"}"
      role="button"
      tabindex="${isAvailable ? "0" : "-1"}"
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
    settingsStatusText: getElement<HTMLElement>(rootElement, "settings-status-text"),
    settingsStatusPill: getElement<HTMLElement>(rootElement, "settings-status-pill"),
    diagnosticsText: getElement<HTMLElement>(rootElement, "diagnostics-text"),
    imgDiagnosticsText: getElement<HTMLElement>(rootElement, "img-diagnostics-text"),
    imgCompatibilityNote: getElement<HTMLElement>(rootElement, "img-compatibility-note"),
    sketchDiagnosticsText: getElement<HTMLElement>(rootElement, "sketch-diagnostics-text"),
    sketchCompatibilityNote: getElement<HTMLElement>(rootElement, "sketch-compatibility-note"),
    settingsDiagnosticsText: getElement<HTMLElement>(rootElement, "settings-diagnostics-text"),
    errorMessage: getElement<HTMLElement>(rootElement, "error-message"),
    imgErrorMessage: getElement<HTMLElement>(rootElement, "img-error-message"),
    sketchErrorMessage: getElement<HTMLElement>(rootElement, "sketch-error-message"),
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
    historyList: getElement<HTMLElement>(rootElement, "history-list"),
    settingsUrlValue: getElement<HTMLElement>(rootElement, "settings-url-value"),
    settingsCheckpointCount: getElement<HTMLElement>(rootElement, "settings-checkpoint-count"),
    settingsLastCheckpoint: getElement<HTMLElement>(rootElement, "settings-last-checkpoint"),
    settingsDocumentStatus: getElement<HTMLElement>(rootElement, "settings-document-status"),
    settingsGpuName: getElement<HTMLElement>(rootElement, "settings-gpu-name"),
    settingsVramTotal: getElement<HTMLElement>(rootElement, "settings-vram-total"),
    settingsVramFree: getElement<HTMLElement>(rootElement, "settings-vram-free"),
    settingsVramTier: getElement<HTMLElement>(rootElement, "settings-vram-tier"),
    settingsModelFamilies: getElement<HTMLElement>(rootElement, "settings-model-families"),
    settingsZImageTurbo: getElement<HTMLElement>(rootElement, "settings-z-image-turbo"),
    settingsModelRecommendations: getElement<HTMLElement>(rootElement, "settings-model-recommendations")
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
  sketchSource: ImageSourceState | null = null
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
  setActionDisabled(elements.checkButton, isBusy);
  setActionDisabled(elements.findPortButton, isBusy);
  setActionDisabled(elements.detectHardwareButton, isBusy);
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

function setDiagnostics(elements: AppElements, message: string) {
  elements.diagnosticsText.textContent = message;
  elements.imgDiagnosticsText.textContent = message;
  elements.sketchDiagnosticsText.textContent = message;
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
    const note = getPresetCompatibilityNote(checkpointName, preset);

    if (note) {
      setDiagnostics(elements, note);
    }
  } catch {
    // Selection-change diagnostics should never break the panel.
  }
}

function updateImageCheckpointCompatibility(elements: AppElements, allowExperimentalCheckpoints: boolean) {
  const checkpointName = readSelectValue(elements.imgCheckpoint);
  const preset = getWorkflowPreset(readSelectValue(elements.imgWorkflow, DEFAULT_IMAGE_WORKFLOW));
  const compatibility = getCheckpointCompatibility(checkpointName, preset);

  elements.imgCompatibilityNote.textContent = allowExperimentalCheckpoints
    ? `${compatibility.label}. ${compatibility.experimentalNote}`
    : compatibility.label;
  elements.imgCompatibilityNote.classList.toggle("is-warning", compatibility.isExperimental);
}

function updateSketchCheckpointCompatibility(elements: AppElements) {
  const checkpointName = readSelectValue(elements.sketchCheckpoint);
  const preset = getWorkflowPreset(readSelectValue(elements.sketchWorkflow, DEFAULT_SKETCH_WORKFLOW));
  const compatibility = getCheckpointCompatibility(checkpointName, preset);

  elements.sketchCompatibilityNote.textContent =
    checkpointName === RECOMMENDED_SKETCH_CHECKPOINT
      ? "Recommended SD 1.x checkpoint selected for LINECN."
      : `${compatibility.label} ${compatibility.warning || "Use an SD 1.x checkpoint for the first LINECN preset."}`;
  elements.sketchCompatibilityNote.classList.toggle("is-warning", compatibility.isExperimental);
}

function createWorkflowDiagnostics(preset: WorkflowPresetDefinition, checkpointName: string) {
  return getPresetCompatibilityNote(checkpointName, preset) || `Using workflow ${preset.id}, checkpoint: ${checkpointName || "none"}`;
}

type ActionName =
  | "check"
  | "findPort"
  | "detectHardware"
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

function fillCheckpointOptions(elements: AppElements, checkpoints: string[], preferredValue?: string) {
  fillSingleCheckpointSelect(elements.checkpoint, checkpoints, preferredValue);
  fillSingleCheckpointSelect(elements.imgCheckpoint, checkpoints, preferredValue);
  fillSingleCheckpointSelect(
    elements.sketchCheckpoint,
    checkpoints,
    checkpoints.includes(RECOMMENDED_SKETCH_CHECKPOINT) ? RECOMMENDED_SKETCH_CHECKPOINT : preferredValue
  );
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

function applyPreferences(elements: AppElements, preferences: Partial<OpenLayerPreferences>) {
  if (preferences.serverUrl) {
    elements.serverUrl.value = preferences.serverUrl;
  }

  if (preferences.workflow) {
    elements.workflow.value = preferences.workflow;
  }

  elements.imgWorkflow.value = DEFAULT_IMAGE_WORKFLOW;
  elements.sketchWorkflow.value = DEFAULT_SKETCH_WORKFLOW;

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
  elements.settingsModelFamilies.textContent = formatDetectedFamilies(report);
  elements.settingsZImageTurbo.textContent = report.zImageTurboMessage;
  elements.settingsModelRecommendations.textContent = report.recommendations
    .map((item) => `${item.task}: ${item.recommendation}`)
    .join(" ");
}

function formatDetectedFamilies(report: HardwareRecommendationReport) {
  if (report.detectedFamilies.length === 0) {
    return "No known families detected";
  }

  return report.detectedFamilies
    .map((family) => {
      const examples = family.examples.length > 0 ? ` (${family.examples.join(", ")})` : "";
      return `${family.label}: ${family.count}${examples}`;
    })
    .join("; ");
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
