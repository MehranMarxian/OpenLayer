import { ComfyClient } from "../comfy/comfyClient";
import {
  createHardwareRecommendationReport,
  formatHardwareReport,
  HardwareRecommendationReport
} from "../comfy/hardwareAdvisor";
import { createFluxFillInpaintDebugSummary } from "../comfy/inpaintValidation";
import { createFluxFillEmbeddedMaskSource } from "../comfy/fluxFillMaskBridge";
import {
  FLUX_FILL_PRESET_ID,
  formatFluxFillLockedControlsNote,
  formatFluxFillReferenceDefaults,
  presetLocksSamplerControls
} from "../comfy/fluxFillDefaults";
import {
  formatCancelDiagnostic,
  formatCancelResultDiagnostic,
  isGenerationCancelledError
} from "../comfy/generationCancel";
import { createObjectUrlRegistry, ObjectUrlRegistry } from "./objectUrlRegistry";
import {
  createGenerationController,
  GenerationPipelineUi,
  GenerationRunHandle
} from "./generationController";
import {
  BUSY_ALWAYS_DISABLED_ACTIONS,
  BUSY_DISABLED_FIELD_GROUPS,
  BUSY_GATED_ACTIONS,
  BusyGateName
} from "./toolDescriptors";
import {
  createOwnedObjectUrl,
  createResultPreviewPanel,
  createSourcePreviewPanel,
  renderPreviewImage,
  renderPreviewMessage
} from "./previewState";
import {
  evaluateInpaintReadiness,
  formatInpaintReadinessDiagnostic,
  getInpaintReadinessStatusLabel,
  InpaintReadiness
} from "./inpaintReadiness";
import {
  formatInpaintOutputDiagnostics,
  ImageDimensions,
  InpaintImportMode,
  readImageDimensionsFromBlob,
  saveInpaintDebugBlobsToTemporaryFiles
} from "../comfy/inpaintOutput";
import { formatInpaintOutpaintDebugContract } from "../metadata/inpaintDebugContract";
import {
  createOpenLayerLayerMetadata,
  OpenLayerLayerBounds,
  OpenLayerLayerMetadata,
  sanitizeOpenLayerLayerMetadata
} from "../metadata/layerMetadata";
import { getCheckpointCompatibility } from "../comfy/modelCompatibility";
import {
  getRecommendedPresetSettings,
  getWorkflowPreset,
  listRunnableWorkflowPresets,
  listWorkflowPresets
} from "../comfy/presetRegistry";
import {
  validateGenerationSettings,
  validateImageToImageSettings,
  validateOutpaintSettings,
  validateSketchToImageSettings
} from "../comfy/settings";
import {
  buildImg2ImgWorkflow,
  buildInpaintWorkflow,
  buildOutpaintWorkflow,
  buildPromptFromLayerWorkflow,
  buildSketchToImageWorkflow,
  buildTxt2ImgWorkflow,
  buildUpscaleWorkflow
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
  getActiveDocumentIdentity,
  getActiveDocumentInfo,
  importGeneratedImageAsLayer,
  importImageAlignedToSelectionWithLayerMask,
  importOutpaintResultExpandingCanvas
} from "../photoshop/photoshopAdapter";
import {
  bindDocumentContext,
  DocumentContextBound,
  PhotoshopDocumentIdentity
} from "../photoshop/documentContext";
import { captureCanvasForLivePainting } from "../photoshop/livePaintingCapture";
import {
  createInpaintSourceModeDiagnostic,
  getInpaintSourceModeLabel,
  InpaintSourceMode
} from "../photoshop/inpaintSourceMode";
import { writeOpenLayerLayerMetadata } from "../photoshop/layerMetadata";
import { formatSelectionBounds } from "../photoshop/selectionUtils";
import {
  createOutpaintExpansionPlan,
  OutpaintPads,
  snapOutpaintPads,
  validateOutpaintResultDimensions
} from "../photoshop/outpaintExpansion";
import { createOpenLayerError, getErrorMessage, getTechnicalErrorDetails } from "../utils/errors";
import { createLayerName, sweepStaleTemporaryFiles } from "../utils/fileUtils";
import {
  clearOpenLayerPreferences,
  loadOpenLayerPreferences,
  OpenLayerTheme,
  OpenLayerPreferences,
  saveOpenLayerPreferences
} from "../utils/preferences";
import {
  createHistoryMetadataLine,
  createHistoryReuseMessage,
  formatHistoryImportStatus,
  formatHistoryToolLabel,
  HistoryImportStatus,
  HistoryToolType
} from "./historyMetadata";
import {
  getLivePaintingStateBadgeLabel,
  LivePaintingSessionV2,
  type LivePaintingState
} from "./tools/livePainting";
import {
  createInpaintImportContext,
  createInpaintSourceSnapshot,
  InpaintImportContext,
  resolveInpaintImportContext
} from "./inpaintImportContext";
import {
  APP_VERSION,
  AppView,
  COMFY_PORT_CANDIDATES,
  DEFAULT_CFG,
  DEFAULT_HEIGHT,
  DEFAULT_IMAGE_WORKFLOW,
  DEFAULT_IMG2IMG_DENOISE,
  DEFAULT_IMG2IMG_STEPS,
  DEFAULT_INPAINT_DENOISE,
  DEFAULT_INPAINT_STEPS,
  DEFAULT_INPAINT_WORKFLOW,
  DEFAULT_OUTPAINT_BOTTOM,
  DEFAULT_OUTPAINT_DENOISE,
  DEFAULT_OUTPAINT_FEATHERING,
  DEFAULT_OUTPAINT_GUIDANCE,
  DEFAULT_OUTPAINT_LEFT,
  DEFAULT_OUTPAINT_RIGHT,
  DEFAULT_OUTPAINT_STEPS,
  DEFAULT_OUTPAINT_TOP,
  DEFAULT_OUTPAINT_WORKFLOW,
  DEFAULT_PROMPT_LAYER_NUM_BEAMS,
  DEFAULT_PROMPT_LAYER_TASK,
  DEFAULT_SERVER_URL,
  DEFAULT_SKETCH_CONTROL_STRENGTH,
  DEFAULT_SKETCH_DENOISE,
  DEFAULT_SKETCH_STEPS,
  DEFAULT_SKETCH_WORKFLOW,
  DEFAULT_STEPS,
  DEFAULT_THEME,
  DEFAULT_UPSCALE_WORKFLOW,
  DEFAULT_WIDTH,
  DEFAULT_WORKFLOW,
  FALLBACK_CHECKPOINTS,
  FALLBACK_UPSCALE_MODELS,
  HISTORY_LIMIT,
  PROMPT_LAYER_TASKS,
  RECOMMENDED_SKETCH_CHECKPOINT
} from "./appConstants";
import { AppElements, createAppMarkup, getAppElements } from "./appMarkup";


type StatusTone = "idle" | "ready" | "error";


type HistoryEntry = {
  id: string;
  result: AppGeneratedImageResult;
  originatingDocument: PhotoshopDocumentIdentity | null;
  inpaintImportContext?: AppInpaintImportContext;
  outpaintImportContext?: AppOutpaintImportContext;
  previewUrl: string;
  prompt: string;
  checkpointName: string;
  modelName: string;
  workflowPreset: string;
  toolType: HistoryToolType;
  seed: number;
  sizeLabel: string;
  dimensions: string;
  sourceMode: string;
  importStatus: HistoryImportStatus;
  importedLayerName?: string;
  importedAt?: string;
  createdAt: string;
  metadata: OpenLayerLayerMetadata;
};

type ImageSourceState = ExportedSourceImage & {
  previewUrl: string;
};

type InpaintSourceState = SelectedRegionSourceImage & {
  previewUrl: string;
};

type AppGeneratedImageResult = DocumentContextBound<GeneratedImageResult>;
type AppInpaintImportContext = InpaintImportContext<SelectedRegionSourceImage, AppGeneratedImageResult>;
type OutpaintCaptureKind = "layer" | "canvas";
// What the canvas-expansion import needs, frozen at submission time: the pads
// actually sent to ComfyUI (after /8 snapping) and the canvas size they padded.
type OutpaintExpansionSource = Readonly<{
  pads: OutpaintPads;
  sourceDimensions: Readonly<{ width: number; height: number }>;
  captureKind: OutpaintCaptureKind;
}>;
type AppOutpaintImportContext = InpaintImportContext<OutpaintExpansionSource, AppGeneratedImageResult>;
type LiveGeneratedImageResult = DocumentContextBound<{ blob: Blob }>;

const statusProgressTimers = new WeakMap<HTMLElement, number>();
// Remembers the last real step percentage per progress bar so percent-less
// status updates (e.g. the history poll tick) cannot reset a determinate bar
// back to the indeterminate warm-up animation mid-run.
const statusProgressLastPercent = new WeakMap<HTMLElement, number>();

export function renderApp(rootElement: HTMLElement) {
  let currentView: AppView = "home";
  let isBusy = false;
  let busyTool: HistoryToolType | null = null;
  let result: AppGeneratedImageResult | null = null;
  let imageSource: ImageSourceState | null = null;
  let imageResult: AppGeneratedImageResult | null = null;
  let sketchSource: ImageSourceState | null = null;
  let sketchResult: AppGeneratedImageResult | null = null;
  let inpaintSource: InpaintSourceState | null = null;
  let inpaintResult: AppGeneratedImageResult | null = null;
  let activeInpaintImportContext: AppInpaintImportContext | null = null;
  let activeOutpaintImportContext: AppOutpaintImportContext | null = null;
  let outpaintCaptureKind: OutpaintCaptureKind | null = null;
  let outpaintSource: ImageSourceState | null = null;
  let outpaintResult: AppGeneratedImageResult | null = null;
  let upscaleSource: ImageSourceState | null = null;
  let upscaleResult: AppGeneratedImageResult | null = null;
  let promptLayerSource: ImageSourceState | null = null;
  let importAutomatically = false;
  let imageImportAutomatically = false;
  let upscaleImportAutomatically = false;
  let isNegativePromptOpen = false;
  let allowExperimentalCheckpoints = false;
  let livePaintingSession: LivePaintingSessionV2 | null = null;
  let livePreviewImage: HTMLImageElement | null = null;
  let livePreviewObjectUrl = "";
  let liveLastResult: LiveGeneratedImageResult | null = null;
  let liveRefinedResult: LiveGeneratedImageResult | null = null;
  let liveImportAutomatically = false;
  let liveAutoRefine = false;
  let livePreviewZoomed = false;
  let hardwareReport: HardwareRecommendationReport | null = null;
  let workflowHealthReport: WorkflowHealthReport | null = null;
  const historyEntries: HistoryEntry[] = [];
  const objectUrls = createObjectUrlRegistry();

  function syncBusy() {
    setBusy(elements, isBusy, busyTool, {
      result,
      imageResult,
      imageSource,
      sketchResult,
      sketchSource,
      inpaintResult,
      inpaintSource,
      outpaintResult,
      outpaintSource,
      upscaleResult,
      upscaleSource
    });
    updateInpaintReferenceControlLock(elements, isBusy && busyTool === "inpaint");
  }

  rootElement.innerHTML = createAppMarkup();

  const elements = getAppElements(rootElement);
  const resultPanel = createResultPreviewPanel({
    urls: objectUrls,
    panel: elements.previewPanel,
    emptyText: "No result yet",
    resultAlt: "Generated OpenLayer preview",
    liveAlt: "Live ComfyUI generation preview"
  });
  const imageResultPanel = createResultPreviewPanel({
    urls: objectUrls,
    panel: elements.imageResultPreviewPanel,
    emptyText: "No Image to Image result yet",
    resultAlt: "Generated Image to Image preview",
    liveAlt: "Live ComfyUI Image to Image preview"
  });
  const sketchResultPanel = createResultPreviewPanel({
    urls: objectUrls,
    panel: elements.sketchResultPreviewPanel,
    emptyText: "No Sketch to Image result yet",
    resultAlt: "Generated Sketch to Image preview",
    liveAlt: "Live ComfyUI Sketch to Image preview"
  });
  const inpaintResultPanel = createResultPreviewPanel({
    urls: objectUrls,
    panel: elements.inpaintResultPreviewPanel,
    emptyText: "No Inpaint result yet",
    resultAlt: "Generated Inpaint preview",
    liveAlt: "Live ComfyUI Inpaint preview"
  });
  const outpaintResultPanel = createResultPreviewPanel({
    urls: objectUrls,
    panel: elements.outpaintResultPreviewPanel,
    emptyText: "No Outpaint result yet",
    resultAlt: "Generated Outpaint preview",
    liveAlt: "Live ComfyUI Outpaint preview"
  });
  const upscaleResultPanel = createResultPreviewPanel({
    urls: objectUrls,
    panel: elements.upscaleResultPreviewPanel,
    emptyText: "No Upscale result yet",
    resultAlt: "Generated Upscale preview",
    liveAlt: "Live ComfyUI Upscale preview"
  });
  const imageSourcePanel = createSourcePreviewPanel({
    urls: objectUrls,
    panel: elements.imageSourcePreviewPanel,
    titleElement: elements.imageSourceTitle,
    metaElement: elements.imageSourceMeta,
    imageAlt: "Captured active Photoshop layer"
  });
  const sketchSourcePanel = createSourcePreviewPanel({
    urls: objectUrls,
    panel: elements.sketchSourcePreviewPanel,
    titleElement: elements.sketchSourceTitle,
    metaElement: elements.sketchSourceMeta,
    imageAlt: "Captured Photoshop source for Sketch to Image"
  });
  const inpaintSourcePanel = createSourcePreviewPanel({
    urls: objectUrls,
    panel: elements.inpaintSourcePreviewPanel,
    titleElement: elements.inpaintSourceTitle,
    metaElement: elements.inpaintSourceMeta,
    imageAlt: "Captured Photoshop selection for Inpaint",
    emptyTitle: "No selection captured",
    emptyMeta: "Make a Photoshop selection first."
  });
  const outpaintSourcePanel = createSourcePreviewPanel({
    urls: objectUrls,
    panel: elements.outpaintSourcePreviewPanel,
    titleElement: elements.outpaintSourceTitle,
    metaElement: elements.outpaintSourceMeta,
    imageAlt: "Captured Photoshop source for Outpaint"
  });
  const upscaleSourcePanel = createSourcePreviewPanel({
    urls: objectUrls,
    panel: elements.upscaleSourcePreviewPanel,
    titleElement: elements.upscaleSourceTitle,
    metaElement: elements.upscaleSourceMeta,
    imageAlt: "Captured Photoshop source for Upscale"
  });
  const promptLayerSourcePanel = createSourcePreviewPanel({
    urls: objectUrls,
    panel: elements.promptLayerSourcePreviewPanel,
    titleElement: elements.promptLayerSourceTitle,
    metaElement: elements.promptLayerSourceMeta,
    imageAlt: "Captured Photoshop source for Prompt from Layer"
  });
  const inpaintMaskUrl = createOwnedObjectUrl(objectUrls);
  const generation = createGenerationController({
    onRunStarted: () => setCancelGenerationVisible(elements, true),
    onRunFinished: (toolType) => {
      releaseGenerationLivePreview(toolType);
      setCancelGenerationVisible(elements, false);
    }
  });

  // Adapts one tool's reporting surfaces to the pipeline's hooks. The
  // controller gates every call on run currency before it reaches these.
  function createPipelineUi(toolType: HistoryToolType, stepProgressElement: HTMLElement): GenerationPipelineUi {
    const toolUi = generationToolUi[toolType];

    return {
      status: (message, tone) => toolUi.status(elements, message, tone),
      progressPreview: (message, blob) => toolUi.progress?.(elements, message, blob),
      stepProgress: (value, max) => applyDeterminateProgress(stepProgressElement, value, max),
      diagnostics: (message) => toolUi.diagnostics(elements, message),
      cancelled: (promptId) => showGenerationCancelled(toolType, promptId)
    };
  }
  let resourceObserver: MutationObserver | null = null;
  let resourcesDisposed = false;
  const disposeAppResources = () => {
    if (resourcesDisposed) return;
    resourcesDisposed = true;
    // Cancelling before the watcher closes matters: pollUntilComplete only
    // checks isCancelled() between polls, so closing the watcher alone leaves an
    // in-flight poll loop running against ComfyUI after the panel is gone.
    generation.disposeActive();
    livePaintingSession?.stop("Live session stopped because the OpenLayer panel closed.");
    for (const progressElement of [
      elements.statusProgress,
      elements.imgStatusProgress,
      elements.sketchStatusProgress,
      elements.inpaintStatusProgress,
      elements.outpaintStatusProgress,
      elements.upscaleStatusProgress
    ]) {
      setStatusProgress(progressElement, "Panel closed.", "ready");
    }
    objectUrls.revokeAll();
    livePreviewObjectUrl = "";
    window.removeEventListener("unload", disposeAppResources);
    resourceObserver?.disconnect();
    resourceObserver = null;
  };
  window.addEventListener("unload", disposeAppResources, { once: true });
  if (typeof MutationObserver === "function") {
    resourceObserver = new MutationObserver(() => {
      if (!rootElement.isConnected) disposeAppResources();
    });
    resourceObserver.observe(document, { childList: true, subtree: true });
  }
  // Runs once per panel session, in the background. Import-flow temp files are
  // already deleted right after use; this only catches what an earlier session
  // left behind (a crash, a force-quit) plus this session's own Inpaint debug
  // copies, which stay around deliberately so an artist can open them after a
  // generation and only get swept up the next time the panel starts.
  void sweepStaleTemporaryFiles().then((result) => {
    if (result.removed.length > 0 || result.failed.length > 0) {
      console.log(
        `[OpenLayer] Startup temporary file sweep removed ${result.removed.length}, failed ${result.failed.length}.`
      );
    }
  });
  const preferences = loadOpenLayerPreferences();
  applyPreferences(elements, preferences);
  applyTheme(elements, preferences.theme || DEFAULT_THEME);
  fillCheckpointOptions(elements, FALLBACK_CHECKPOINTS, preferences.checkpointName || FALLBACK_CHECKPOINTS[0]);
  ensureCoreSelectDefaults(elements);

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
    cancelGeneration: createActionRunner(elements, "cancelGeneration", handleCancelGeneration),
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
    toggleImg2ImgAutoImport: createActionRunner(elements, "toggleImg2ImgAutoImport", handleToggleImg2ImgAutoImport),
    captureSketchSource: createActionRunner(elements, "captureSketchSource", handleCaptureSketchSource),
    captureSketchCanvasSource: createActionRunner(elements, "captureSketchCanvasSource", handleCaptureSketchCanvasSource),
    generateSketch: createActionRunner(elements, "generateSketch", handleGenerateSketch),
    importSketch: createActionRunner(elements, "importSketch", handleImportSketch),
    captureInpaintSelection: createActionRunner(
      elements,
      "captureInpaintSelection",
      () => handleCaptureInpaintSelection("visible-canvas")
    ),
    captureInpaintActiveLayer: createActionRunner(
      elements,
      "captureInpaintActiveLayer",
      () => handleCaptureInpaintSelection("active-layer")
    ),
    generateInpaint: createActionRunner(elements, "generateInpaint", handleGenerateInpaint),
    importInpaint: createActionRunner(elements, "importInpaint", handleImportInpaint),
    captureOutpaintSource: createActionRunner(elements, "captureOutpaintSource", handleCaptureOutpaintSource),
    captureOutpaintCanvasSource: createActionRunner(
      elements,
      "captureOutpaintCanvasSource",
      handleCaptureOutpaintCanvasSource
    ),
    generateOutpaint: createActionRunner(elements, "generateOutpaint", handleGenerateOutpaint),
    importOutpaint: createActionRunner(elements, "importOutpaint", handleImportOutpaint),
    capturePromptLayerSource: createActionRunner(elements, "capturePromptLayerSource", handleCapturePromptLayerSource),
    capturePromptCanvasSource: createActionRunner(elements, "capturePromptCanvasSource", handleCapturePromptCanvasSource),
    generatePromptFromLayer: createActionRunner(elements, "generatePromptFromLayer", handleGeneratePromptFromLayer),
    copyPromptFromLayer: createActionRunner(elements, "copyPromptFromLayer", handleCopyPromptFromLayer),
    sendPromptToTextToImage: createActionRunner(elements, "sendPromptToTextToImage", handleSendPromptToTextToImage),
    captureUpscaleSource: createActionRunner(elements, "captureUpscaleSource", handleCaptureUpscaleSource),
    captureUpscaleCanvasSource: createActionRunner(elements, "captureUpscaleCanvasSource", handleCaptureUpscaleCanvasSource),
    generateUpscale: createActionRunner(elements, "generateUpscale", handleGenerateUpscale),
    importUpscale: createActionRunner(elements, "importUpscale", handleImportUpscale),
    toggleUpscaleAutoImport: createActionRunner(elements, "toggleUpscaleAutoImport", handleToggleUpscaleAutoImport),
    clearHistory: createActionRunner(elements, "clearHistory", handleClearHistory),
    startLivePainting: createActionRunner(elements, "startLivePainting", handleStartLivePainting),
    stopLivePainting: createActionRunner(elements, "stopLivePainting", handleStopLivePainting),
    refineLivePainting: createActionRunner(elements, "refineLivePainting", handleRefineLivePainting),
    toggleLiveZoom: createActionRunner(elements, "toggleLiveZoom", handleToggleLiveZoom),
    importLiveResult: createActionRunner(elements, "importLiveResult", handleImportLiveResult),
    importLiveRefined: createActionRunner(elements, "importLiveRefined", handleImportLiveRefined),
    toggleLiveAutoImport: createActionRunner(elements, "toggleLiveAutoImport", handleToggleLiveAutoImport),
    toggleLiveAutoRefine: createActionRunner(elements, "toggleLiveAutoRefine", handleToggleLiveAutoRefine)
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
  bindActionControl(elements.cancelGenerateButton, actionHandlers.cancelGeneration);
  bindActionControl(elements.importButton, actionHandlers.import);
  bindActionControl(elements.captureLayerButton, actionHandlers.captureImageSource);
  bindActionControl(elements.captureCanvasButton, actionHandlers.captureCanvasSource);
  bindActionControl(elements.experimentalCheckpointToggle, actionHandlers.toggleExperimentalCheckpoints);
  bindActionControl(elements.generateImg2ImgButton, actionHandlers.generateImg2Img);
  bindActionControl(elements.importImg2ImgButton, actionHandlers.importImg2Img);
  bindActionControl(elements.imgAutoImportToggle, actionHandlers.toggleImg2ImgAutoImport);
  bindActionControl(elements.captureSketchLayerButton, actionHandlers.captureSketchSource);
  bindActionControl(elements.captureSketchCanvasButton, actionHandlers.captureSketchCanvasSource);
  bindActionControl(elements.generateSketchButton, actionHandlers.generateSketch);
  bindActionControl(elements.importSketchButton, actionHandlers.importSketch);
  bindActionControl(elements.captureInpaintSelectionButton, actionHandlers.captureInpaintSelection);
  bindActionControl(elements.captureInpaintActiveLayerButton, actionHandlers.captureInpaintActiveLayer);
  bindActionControl(elements.generateInpaintButton, actionHandlers.generateInpaint);
  bindActionControl(elements.importInpaintButton, actionHandlers.importInpaint);
  bindActionControl(elements.captureOutpaintLayerButton, actionHandlers.captureOutpaintSource);
  bindActionControl(elements.captureOutpaintCanvasButton, actionHandlers.captureOutpaintCanvasSource);
  bindActionControl(elements.generateOutpaintButton, actionHandlers.generateOutpaint);
  bindActionControl(elements.importOutpaintButton, actionHandlers.importOutpaint);
  bindActionControl(elements.capturePromptLayerButton, actionHandlers.capturePromptLayerSource);
  bindActionControl(elements.capturePromptCanvasButton, actionHandlers.capturePromptCanvasSource);
  bindActionControl(elements.generatePromptLayerButton, actionHandlers.generatePromptFromLayer);
  bindActionControl(elements.copyPromptLayerButton, actionHandlers.copyPromptFromLayer);
  bindActionControl(elements.sendPromptLayerButton, actionHandlers.sendPromptToTextToImage);
  bindActionControl(elements.captureUpscaleLayerButton, actionHandlers.captureUpscaleSource);
  bindActionControl(elements.captureUpscaleCanvasButton, actionHandlers.captureUpscaleCanvasSource);
  bindActionControl(elements.generateUpscaleButton, actionHandlers.generateUpscale);
  bindActionControl(elements.importUpscaleButton, actionHandlers.importUpscale);
  bindActionControl(elements.upscaleAutoImportToggle, actionHandlers.toggleUpscaleAutoImport);
  bindActionControl(elements.clearHistoryButton, actionHandlers.clearHistory);
  bindActionControl(elements.liveStartButton, actionHandlers.startLivePainting);
  bindActionControl(elements.liveStopButton, actionHandlers.stopLivePainting);
  bindActionControl(elements.liveRefineButton, actionHandlers.refineLivePainting);
  bindActionControl(elements.liveZoomToggle, actionHandlers.toggleLiveZoom);
  bindActionControl(elements.importLiveButton, actionHandlers.importLiveResult);
  bindActionControl(elements.importLiveRefinedButton, actionHandlers.importLiveRefined);
  bindActionControl(elements.liveAutoImportToggle, actionHandlers.toggleLiveAutoImport);
  bindActionControl(elements.liveAutoRefineToggle, actionHandlers.toggleLiveAutoRefine);
  bindDelegatedActions(rootElement, actionHandlers);
  bindDocumentActions(rootElement, actionHandlers);
  bindHomeSectionToggles(rootElement);
  bindDetailSectionToggles(rootElement);
  bindInfoToggles(rootElement);
  bindToolCards(rootElement, (view) => setView(view));
  bindHistoryActions(rootElement, handleHistoryAction);
  bindExternalLinks(rootElement);
  bindAdvancedToggles(rootElement);
  bindToolWarnings(rootElement);
  bindStickyProgress(rootElement);
  elements.settingsThemeSelect.addEventListener("change", () => {
    applyTheme(elements, readThemeSelection(elements));
    savePreferencesFromElements(elements);
    updateSettingsReport(elements);
    setDiagnostics(elements, `Panel theme set to ${getThemeLabel(readThemeSelection(elements))}.`);
  });

  setStatus(elements, "Ready.", "idle");
  setView(currentView);
  setError(elements, "");
  syncBusy();
  updateNegativePromptDisclosure(elements, isNegativePromptOpen);
  updateAutoImportToggle(elements, importAutomatically);
  updateImg2ImgAutoImportToggle(elements, imageImportAutomatically);
  updateUpscaleAutoImportToggle(elements, upscaleImportAutomatically);
  updateExperimentalCheckpointToggle(elements, allowExperimentalCheckpoints);
  updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
  setImageSource(null);
  setImageResult(null);
  updateSketchCheckpointCompatibility(elements, sketchSource);
  setSketchSource(null);
  setSketchResult(null);
  updateInpaintCheckpointCompatibility(elements, inpaintSource);
  updateInpaintReferenceControlLock(elements);
  setInpaintSource(null);
  setInpaintResult(null);
  updateOutpaintCheckpointCompatibility(elements, outpaintSource);
  setOutpaintSource(null);
  setOutpaintResult(null);
  updateUpscaleCompatibility(elements, upscaleSource);
  setUpscaleSource(null);
  setUpscaleResult(null);
  setPromptLayerSource(null);
  updateSettingsReport(elements);
  renderHardwareReport(elements, hardwareReport);
  renderWorkflowHealthReport(elements, workflowHealthReport);
  renderHistory(elements, historyEntries);
  updateLiveButtons(false);
  setActionDisabled(elements.importLiveButton, true);
  updateLiveAutoImportToggle(liveImportAutomatically);
  updateLiveAutoRefineToggle(liveAutoRefine);
  updateLiveStateBadge("idle");
  void loadInitialCheckpoints();

  elements.workflow.addEventListener("change", () => {
    applyRecommendedPresetSettings(elements.workflow, DEFAULT_WORKFLOW, elements.steps, elements.cfg);
    void refreshTextModelOptionsForSelectedPreset(elements).then(() => updateTextCheckpointCompatibility(elements));
  });

  elements.checkpoint.addEventListener("change", () => {
    updateTextCheckpointCompatibility(elements);
  });

  elements.imgWorkflow.addEventListener("change", () => {
    applyRecommendedPresetSettings(elements.imgWorkflow, DEFAULT_IMAGE_WORKFLOW, elements.imgSteps, elements.imgCfg);
    void refreshImageModelOptionsForSelectedPreset(elements).then(() => (
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource)
    ));
  });

  elements.imgCheckpoint.addEventListener("change", () => {
    updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
  });

  elements.sketchWorkflow.addEventListener("change", () => {
    applyRecommendedPresetSettings(elements.sketchWorkflow, DEFAULT_SKETCH_WORKFLOW, elements.sketchSteps, elements.sketchCfg);
    updateSketchCheckpointCompatibility(elements, sketchSource);
  });

  elements.sketchCheckpoint.addEventListener("change", () => {
    updateSketchCheckpointCompatibility(elements, sketchSource);
  });

  elements.inpaintWorkflow.addEventListener("change", () => {
    applyRecommendedPresetSettings(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW, elements.inpaintSteps, elements.inpaintCfg);
    updateInpaintReferenceControlLock(elements);
    void refreshInpaintModelOptionsForSelectedPreset(elements);
    updateInpaintCheckpointCompatibility(elements, inpaintSource);
  });

  elements.inpaintCheckpoint.addEventListener("change", () => {
    updateInpaintCheckpointCompatibility(elements, inpaintSource);
  });

  elements.outpaintWorkflow.addEventListener("change", () => {
    applyRecommendedPresetSettings(elements.outpaintWorkflow, DEFAULT_OUTPAINT_WORKFLOW, elements.outpaintSteps, elements.outpaintGuidance);
    void refreshOutpaintModelOptionsForSelectedPreset(elements);
    updateOutpaintCheckpointCompatibility(elements, outpaintSource);
  });

  elements.outpaintCheckpoint.addEventListener("change", () => {
    updateOutpaintCheckpointCompatibility(elements, outpaintSource);
  });

  elements.upscaleWorkflow.addEventListener("change", () => {
    void refreshUpscaleModelOptionsForSelectedPreset(elements).then(() => (
      updateUpscaleCompatibility(elements, upscaleSource)
    ));
  });

  elements.upscaleModel.addEventListener("change", () => {
    updateUpscaleCompatibility(elements, upscaleSource);
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
      await refreshOutpaintModelOptionsForSelectedPreset(elements, client);
      await refreshUpscaleModelOptionsForSelectedPreset(elements, client);
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
      updateSketchCheckpointCompatibility(elements, sketchSource);
      updateInpaintCheckpointCompatibility(elements, inpaintSource);
      updateOutpaintCheckpointCompatibility(elements, outpaintSource);
      updateUpscaleCompatibility(elements, upscaleSource);
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
      await refreshOutpaintModelOptionsForSelectedPreset(elements, client);
      await refreshUpscaleModelOptionsForSelectedPreset(elements, client);
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
      updateSketchCheckpointCompatibility(elements, sketchSource);
      updateInpaintCheckpointCompatibility(elements, inpaintSource);
      updateOutpaintCheckpointCompatibility(elements, outpaintSource);
      updateUpscaleCompatibility(elements, upscaleSource);
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
      await refreshOutpaintModelOptionsForSelectedPreset(elements, client);
      await refreshUpscaleModelOptionsForSelectedPreset(elements, client);
      updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
      updateSketchCheckpointCompatibility(elements, sketchSource);
      updateInpaintCheckpointCompatibility(elements, inpaintSource);
      updateOutpaintCheckpointCompatibility(elements, outpaintSource);
      updateUpscaleCompatibility(elements, upscaleSource);
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
        ? "Saved ComfyUI URL, checkpoint, generation defaults, and panel theme."
        : "Local storage is unavailable, so settings will reset when the panel reloads."
    );
  }

  function handleResetSettings() {
    clearOpenLayerPreferences();
    applyDefaultSettings(elements);
    updateInpaintReferenceControlLock(elements);
    applyTheme(elements, DEFAULT_THEME);
    fillCheckpointOptions(elements, FALLBACK_CHECKPOINTS, FALLBACK_CHECKPOINTS[0]);
    updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
    updateSketchCheckpointCompatibility(elements, sketchSource);
    updateInpaintCheckpointCompatibility(elements, inpaintSource);
    updateOutpaintCheckpointCompatibility(elements, outpaintSource);
    elements.upscaleWorkflow.value = DEFAULT_UPSCALE_WORKFLOW;
    fillSingleCheckpointSelect(elements.upscaleModel, FALLBACK_UPSCALE_MODELS, FALLBACK_UPSCALE_MODELS[0]);
    updateUpscaleCompatibility(elements, upscaleSource);
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

  function handleToggleImg2ImgAutoImport() {
    imageImportAutomatically = !imageImportAutomatically;
    updateImg2ImgAutoImportToggle(elements, imageImportAutomatically);
    setImageDiagnostics(elements, imageImportAutomatically ? "Image to Image auto import is on." : "Image to Image auto import is off.");
  }

  function handleToggleUpscaleAutoImport() {
    upscaleImportAutomatically = !upscaleImportAutomatically;
    updateUpscaleAutoImportToggle(elements, upscaleImportAutomatically);
    setUpscaleDiagnostics(elements, upscaleImportAutomatically ? "Upscale auto import is on." : "Upscale auto import is off.");
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

  function releaseGenerationLivePreview(toolType: HistoryToolType) {
    switch (toolType) {
      case "image-to-image": imageResultPanel.releaseLivePreviewUrl(); return;
      case "sketch-to-image": sketchResultPanel.releaseLivePreviewUrl(); return;
      case "inpaint": inpaintResultPanel.releaseLivePreviewUrl(); return;
      case "outpaint": outpaintResultPanel.releaseLivePreviewUrl(); return;
      case "upscale": upscaleResultPanel.releaseLivePreviewUrl(); return;
      case "text-to-image": resultPanel.releaseLivePreviewUrl(); return;
      case "prompt-from-layer": return;
    }
  }

  // One row per tool: how each generation surface reports status, diagnostics,
  // progress, and errors. The switch dispatchers this replaces restated these
  // pairings four times.
  const generationToolUi: Record<HistoryToolType, {
    status: (elements: AppElements, status: string, tone: StatusTone) => void;
    diagnostics: (elements: AppElements, message: string) => void;
    error: (elements: AppElements, message: string) => void;
    progress?: (elements: AppElements, message: string, blob?: Blob) => void;
  }> = {
    "text-to-image": { status: setStatus, diagnostics: setDiagnostics, error: setError, progress: setProgressPreview },
    "image-to-image": { status: setImageStatus, diagnostics: setImageDiagnostics, error: setImageError, progress: setImageProgressPreview },
    "sketch-to-image": { status: setSketchStatus, diagnostics: setSketchDiagnostics, error: setSketchError, progress: setSketchProgressPreview },
    inpaint: { status: setInpaintStatus, diagnostics: setInpaintDiagnostics, error: setInpaintError, progress: setInpaintProgressPreview },
    outpaint: { status: setOutpaintStatus, diagnostics: setOutpaintDiagnostics, error: setOutpaintError, progress: setOutpaintProgressPreview },
    upscale: { status: setUpscaleStatus, diagnostics: setUpscaleDiagnostics, error: setUpscaleError, progress: setUpscaleProgressPreview },
    "prompt-from-layer": { status: setPromptLayerStatus, diagnostics: setPromptLayerDiagnostics, error: setPromptLayerError }
  };

  function setGenerationToolStatus(toolType: HistoryToolType, status: string, tone: StatusTone) {
    generationToolUi[toolType].status(elements, status, tone);
  }

  function setGenerationToolDiagnostics(toolType: HistoryToolType, message: string) {
    generationToolUi[toolType].diagnostics(elements, message);
  }

  function setGenerationToolProgress(toolType: HistoryToolType, message: string) {
    generationToolUi[toolType].progress?.(elements, message);
  }

  function clearGenerationToolError(toolType: HistoryToolType) {
    generationToolUi[toolType].error(elements, "");
  }

  function showGenerationCancelled(toolType: HistoryToolType, promptId?: string) {
    setGenerationToolStatus(toolType, "Generation cancelled.", "idle");
    clearGenerationToolError(toolType);
    setGenerationToolDiagnostics(toolType, formatCancelDiagnostic(promptId));
    setGenerationToolProgress(toolType, "Generation cancelled.");
  }

  async function handleCancelGeneration() {
    const active = generation.cancelActive();

    if (!active) {
      setDiagnostics(elements, "No active generation to cancel.");
      return;
    }

    setGenerationToolStatus(active.toolType, "Cancelling generation...", "idle");
    setGenerationToolProgress(active.toolType, "Cancelling generation...");
    setCancelGenerationVisible(elements, false);

    try {
      const cancelResult = await active.client.cancelPrompt(active.promptId);
      if (active.isCurrent()) {
        setGenerationToolDiagnostics(
          active.toolType,
          formatCancelResultDiagnostic(cancelResult, active.promptId)
        );
      }
    } catch (caughtError) {
      if (active.isCurrent()) {
        setGenerationToolDiagnostics(
          active.toolType,
          `Cancel requested locally. ComfyUI interrupt may already be complete or unavailable. ${getTechnicalErrorDetails(caughtError)}`
        );
      }
    }
  }

  function blockRegularGenerationDuringLivePainting(reportStatus: (message: string) => void) {
    if (!livePaintingSession?.isRunning()) {
      return false;
    }

    reportStatus("Stop the live session before generating.");
    return true;
  }

  async function handleGenerate() {
    if (blockRegularGenerationDuringLivePainting((message) => setStatus(elements, message, "error"))) {
      return;
    }

    setDiagnostics(elements, `Generate pressed at ${new Date().toLocaleTimeString()}.`);

    if (!elements.prompt.value.trim()) {
      setError(elements, getErrorMessage(createOpenLayerError("PROMPT_REQUIRED", "Enter a prompt before generating.")));
      setStatus(elements, "Prompt required.", "error");
      return;
    }

    setError(elements, "");
    setResult(null);
    busyTool = "text-to-image";
    isBusy = true;
    syncBusy();
    setStatus(elements, "Preparing workflow...", "idle");
    setProgressPreview(elements, "Preparing workflow...");

    try {
      const originatingDocument = getActiveDocumentIdentity();
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

      const generatedResult = await generation.runPipeline({
        toolType: "text-to-image",
        client,
        workflow: buildResult.workflow,
        preferredNodeId: getSaveImageNodeId(buildResult.preset),
        originatingDocument: originatingDocument,
        ui: createPipelineUi("text-to-image", elements.statusProgress),
        messages: {
          submitStatus: "Submitting prompt to ComfyUI...",
          submitPreview: "Submitting prompt to ComfyUI...",
          generateStatus: "Generating image...",
          generatePreview: "Generating image...",
          retrieveStatus: "Retrieving image...",
          retrievePreview: "Retrieving final image...",
          livePreview: "Live ComfyUI preview..."
        },
        commit: (generatedResult) => {
        setResult(generatedResult);
        addHistoryEntry(elements, historyEntries, objectUrls, generatedResult, {
          prompt: elements.prompt.value,
          negativePrompt: elements.negativePrompt.value,
          checkpointName,
          modelName: checkpointName,
          workflowPreset: buildResult.preset.id,
          toolType: "text-to-image",
          seed: buildResult.seed,
          sizeLabel: `${settings.width} x ${settings.height}`,
          dimensions: `${settings.width} x ${settings.height}`,
          sourceMode: "Prompt only",
          experimental: buildResult.preset.status === "experimental"
        });
        }
      });

      if (!generatedResult) {
        return;
      }

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
      if (isGenerationCancelledError(caughtError)) {
        showGenerationCancelled("text-to-image");
        return;
      }

      setStatus(elements, "Generation failed.", "error");
      setError(elements, getErrorMessage(caughtError));
      setDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
  }

  function handleClearHistory() {
    clearHistoryEntries(historyEntries, objectUrls);
    renderHistory(elements, historyEntries);
    setStatus(elements, "History cleared.", "ready");
    setDiagnostics(elements, "Recent session history cleared.");
  }

  function handleHistoryAction(action: HistoryActionName, historyId: string) {
    if (isBusy && action !== "preview") {
      setDiagnostics(elements, "Finish the current operation before using history.");
      return;
    }

    const entry = historyEntries.find((item) => item.id === historyId);

    if (!entry) {
      setStatus(elements, "History item not found.", "error");
      setError(elements, "That history item is no longer available in this session.");
      return;
    }

    if (action === "preview") {
      loadHistoryResultIntoTool(entry);
      setGenerationToolStatus(entry.toolType, "Loaded history item into preview.", "ready");
      setGenerationToolDiagnostics(entry.toolType, `History item loaded: seed ${entry.seed}, ${entry.dimensions}.`);
      return;
    }

    if (action === "reuse") {
      reuseHistorySettings(entry);
      return;
    }

    loadHistoryResultIntoTool(entry);
    void importHistoryEntry(entry);
  }

  function loadHistoryResultIntoTool(entry: HistoryEntry) {
    setError(elements, "");
    setImageError(elements, "");
    setSketchError(elements, "");
    setInpaintError(elements, "");
    setOutpaintError(elements, "");
    setUpscaleError(elements, "");

    switch (entry.toolType) {
      case "image-to-image":
        setImageResult(entry.result);
        setView("image-to-image");
        return;
      case "sketch-to-image":
        setSketchResult(entry.result);
        setView("sketch-to-image");
        return;
      case "inpaint":
        activeInpaintImportContext = entry.inpaintImportContext ?? null;
        setInpaintResult(entry.result);
        setView("inpaint");
        return;
      case "outpaint":
        activeOutpaintImportContext = entry.outpaintImportContext ?? null;
        setOutpaintResult(entry.result);
        setView("outpaint");
        return;
      case "upscale":
        setUpscaleResult(entry.result);
        setView("upscale");
        return;
      case "text-to-image":
      default:
        setResult(entry.result);
        setView("text-to-image");
    }
  }

  async function importHistoryEntry(entry: HistoryEntry) {
    switch (entry.toolType) {
      case "image-to-image":
        await handleImportImg2Img();
        return;
      case "sketch-to-image":
        await handleImportSketch();
        return;
      case "inpaint":
        await handleImportInpaint(entry.inpaintImportContext);
        return;
      case "outpaint":
        await handleImportOutpaint(entry.outpaintImportContext);
        return;
      case "upscale":
        await handleImportUpscale();
        return;
      case "text-to-image":
      default:
        await handleImport();
    }
  }

  function reuseHistorySettings(entry: HistoryEntry) {
    switch (entry.toolType) {
      case "image-to-image":
        elements.imgPrompt.value = entry.prompt;
        setSelectValueIfPresent(elements.imgWorkflow, entry.workflowPreset);
        setSelectValueIfPresent(elements.imgCheckpoint, entry.modelName);
        elements.imgSeed.value = String(entry.seed);
        setView("image-to-image");
        break;
      case "sketch-to-image":
        elements.sketchPrompt.value = entry.prompt;
        setSelectValueIfPresent(elements.sketchWorkflow, entry.workflowPreset);
        setSelectValueIfPresent(elements.sketchCheckpoint, entry.modelName);
        elements.sketchSeed.value = String(entry.seed);
        setView("sketch-to-image");
        break;
      case "inpaint":
        elements.inpaintPrompt.value = entry.prompt;
        setSelectValueIfPresent(elements.inpaintWorkflow, entry.workflowPreset);
        updateInpaintReferenceControlLock(elements);
        setSelectValueIfPresent(elements.inpaintCheckpoint, entry.modelName);
        elements.inpaintSeed.value = String(entry.seed);
        setView("inpaint");
        break;
      case "outpaint":
        elements.outpaintPrompt.value = entry.prompt;
        setSelectValueIfPresent(elements.outpaintWorkflow, entry.workflowPreset);
        setSelectValueIfPresent(elements.outpaintCheckpoint, entry.modelName);
        elements.outpaintSeed.value = String(entry.seed);
        setView("outpaint");
        break;
      case "upscale":
        setSelectValueIfPresent(elements.upscaleWorkflow, entry.workflowPreset);
        setSelectValueIfPresent(elements.upscaleModel, entry.modelName);
        setView("upscale");
        break;
      case "text-to-image":
      default:
        elements.prompt.value = entry.prompt;
        setSelectValueIfPresent(elements.workflow, entry.workflowPreset);
        setSelectValueIfPresent(elements.checkpoint, entry.modelName);
        elements.seed.value = String(entry.seed);
        setView("text-to-image");
        updateTextCheckpointCompatibility(elements);
        break;
    }

    setGenerationToolStatus(entry.toolType, "Settings reused.", "ready");
    setGenerationToolDiagnostics(entry.toolType, createHistoryReuseMessage(entry.toolType));
  }

  async function handleImport(source: "manual" | "auto" = "manual") {
    setDiagnostics(elements, source === "auto" ? "Auto import started." : "Import pressed.");

    if (!result) {
      setError(elements, "Generate an image before importing.");
      return;
    }

    setError(elements, "");
    busyTool = "text-to-image";
    isBusy = true;
    syncBusy();
    setStatus(elements, "Importing image into Photoshop...", "idle");

    try {
      const layerName = createLayerName("OpenLayer_Generated");

      setDiagnostics(elements, `Importing into ${result.originatingDocument?.name || "the originating document"}...`);
      const importedLayerName = await importGeneratedImageAsLayer({
        blob: result.blob,
        originatingDocument: result.originatingDocument,
        layerName,
        onProgress: (message) => {
          setStatus(elements, message, "idle");
          setDiagnostics(elements, message);
        }
      });
      setStatus(elements, `Imported layer: ${importedLayerName}`, "ready");
      flashImported(elements.statusText);
      markHistoryImported(elements, historyEntries, result, importedLayerName);
      const metadataMessage = await writeMetadataForImportedResult(historyEntries, result, importedLayerName, (message) => {
        setDiagnostics(elements, message);
      });
      setDiagnostics(elements, `Layer created: ${importedLayerName}. ${metadataMessage}`);
    } catch (caughtError) {
      setStatus(elements, "Import failed.", "error");
      setError(elements, getErrorMessage(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
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
    busyTool = "image-to-image";
    isBusy = true;
    syncBusy();

    try {
      const exportedSource = await options.capture();
      const sourcePreview = objectUrls.create(exportedSource.blob);
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
      busyTool = null;
      syncBusy();
    }
  }

  async function handleGenerateImg2Img() {
    if (blockRegularGenerationDuringLivePainting((message) => setImageStatus(elements, message, "error"))) {
      return;
    }

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
    busyTool = "image-to-image";
    isBusy = true;
    syncBusy();
    setImageStatus(elements, "Preparing Image to Image workflow...", "idle");
    setImageProgressPreview(elements, "Preparing Image to Image workflow...");

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

      // The commit closure runs after awaits; a const keeps the null-checked
      // source from the top of the handler rather than re-reading mutable state.
      const capturedSource = imageSource;
      const generatedResult = await generation.runPipeline({
        toolType: "image-to-image",
        client,
        workflow: buildResult.workflow,
        preferredNodeId: getSaveImageNodeId(buildResult.preset),
        originatingDocument: capturedSource.originatingDocument,
        ui: createPipelineUi("image-to-image", elements.imgStatusProgress),
        messages: {
          submitStatus: "Submitting Image to Image prompt...",
          submitPreview: "Submitting prompt to ComfyUI...",
          generateStatus: "Generating Image to Image result...",
          generatePreview: "Generating image...",
          retrieveStatus: "Retrieving Image to Image result...",
          retrievePreview: "Retrieving final image...",
          livePreview: "Live ComfyUI preview..."
        },
        commit: (generatedResult) => {
        setImageResult(generatedResult);
        addHistoryEntry(elements, historyEntries, objectUrls, generatedResult, {
          prompt: elements.imgPrompt.value,
          negativePrompt: elements.imgNegativePrompt.value,
          checkpointName,
          modelName: checkpointName,
          workflowPreset: buildResult.preset.id,
          toolType: "image-to-image",
          seed: buildResult.seed,
          sizeLabel: "Image to Image",
          dimensions: `${capturedSource.width} x ${capturedSource.height}`,
          sourceMode: capturedSource.sourceName,
          experimental: buildResult.preset.status === "experimental"
        });
        }
      });

      if (!generatedResult) {
        return;
      }
      setImageStatus(elements, "Image to Image generation complete.", "ready");
      setImageDiagnostics(
        elements,
        `Seed used: ${buildResult.seed}. Source uploaded as ${sourceImageName}. Workflow: ${buildResult.preset.id}.`
      );

      if (imageImportAutomatically) {
        setImageStatus(elements, "Image to Image complete. Auto-importing...", "idle");
        setImageDiagnostics(elements, `Seed used: ${buildResult.seed}. Auto import is on.`);
        await importImg2ImgResult("auto", false);
      }
    } catch (caughtError) {
      if (isGenerationCancelledError(caughtError)) {
        showGenerationCancelled("image-to-image");
        return;
      }

      setImageStatus(elements, "Image to Image generation failed.", "error");
      setImageError(elements, getFriendlyImageToImageErrorMessage(caughtError));
      console.error("[OpenLayer] Image to Image generation failed", getTechnicalErrorDetails(caughtError));
      setImageDiagnostics(elements, getImageToImageFailureHint(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
  }

  async function handleImportImg2Img() {
    await importImg2ImgResult("manual", true);
  }

  async function importImg2ImgResult(source: "manual" | "auto", manageBusy: boolean) {
    setImageDiagnostics(elements, source === "auto" ? "Image to Image auto import started." : "Image to Image import pressed.");

    if (!imageResult) {
      setImageError(elements, "Generate an Image to Image result before importing.");
      return;
    }

    setImageError(elements, "");
    if (manageBusy) {
      busyTool = "image-to-image";
      isBusy = true;
      syncBusy();
    }
    setImageStatus(elements, "Importing Image to Image result into Photoshop...", "idle");

    try {
      const layerName = createLayerName("OpenLayer_Img2Img");

      setImageDiagnostics(elements, `Importing into ${imageResult.originatingDocument?.name || "the originating document"}...`);
      const importedLayerName = await importGeneratedImageAsLayer({
        blob: imageResult.blob,
        originatingDocument: imageResult.originatingDocument,
        layerName,
        onProgress: (message) => {
          setImageStatus(elements, message, "idle");
          setImageDiagnostics(elements, message);
        }
      });
      setImageStatus(elements, `Imported layer: ${importedLayerName}`, "ready");
      flashImported(elements.imgStatusText);
      markHistoryImported(elements, historyEntries, imageResult, importedLayerName);
      const metadataMessage = await writeMetadataForImportedResult(historyEntries, imageResult, importedLayerName, (message) => {
        setImageDiagnostics(elements, message);
      });
      setImageDiagnostics(elements, `Layer created: ${importedLayerName}. ${metadataMessage}`);
    } catch (caughtError) {
      setImageStatus(elements, "Import failed.", "error");
      setImageError(elements, getErrorMessage(caughtError));
    } finally {
      if (manageBusy) {
        isBusy = false;
        busyTool = null;
        syncBusy();
      }
    }
  }

  async function handleCaptureUpscaleSource() {
    await captureUpscaleSourceImage({
      progressMessage: "Capturing active Photoshop layer for Upscale...",
      statusMessage: "Capturing active layer...",
      successMessage: "Upscale source captured.",
      capture: exportActiveLayerForImageToImage
    });
  }

  async function handleCaptureUpscaleCanvasSource() {
    await captureUpscaleSourceImage({
      progressMessage: "Capturing Photoshop canvas for Upscale...",
      statusMessage: "Capturing canvas...",
      successMessage: "Upscale canvas captured.",
      capture: exportCanvasForImageToImage
    });
  }

  async function captureUpscaleSourceImage(options: {
    progressMessage: string;
    statusMessage: string;
    successMessage: string;
    capture: () => Promise<ExportedSourceImage>;
  }) {
    setUpscaleDiagnostics(elements, options.progressMessage);
    setUpscaleError(elements, "");
    setUpscaleStatus(elements, options.statusMessage, "idle");
    busyTool = "upscale";
    isBusy = true;
    syncBusy();

    try {
      const exportedSource = await options.capture();
      const sourcePreview = objectUrls.create(exportedSource.blob);
      setUpscaleSource({
        ...exportedSource,
        previewUrl: sourcePreview
      });
      setUpscaleStatus(elements, options.successMessage, "ready");
      setUpscaleDiagnostics(
        elements,
        `${createSourceCaptureMessage(exportedSource, " for pixel upscale")} Select an upscale model, then generate.`
      );
    } catch (caughtError) {
      setUpscaleStatus(elements, "Source capture failed.", "error");
      setUpscaleError(elements, getErrorMessage(caughtError));
      setUpscaleDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
  }

  async function handleGenerateUpscale() {
    if (blockRegularGenerationDuringLivePainting((message) => setUpscaleStatus(elements, message, "error"))) {
      return;
    }

    setUpscaleDiagnostics(elements, `Upscale generate pressed at ${new Date().toLocaleTimeString()}.`);

    if (!upscaleSource) {
      setUpscaleError(elements, "Capture the active Photoshop layer or canvas before upscaling.");
      setUpscaleStatus(elements, "Source required.", "error");
      setUpscaleDiagnostics(
        elements,
        createWorkflowDiagnostics(
          getWorkflowPreset(readSelectValue(elements.upscaleWorkflow, DEFAULT_UPSCALE_WORKFLOW)),
          readSelectValue(elements.upscaleModel),
          createSourceInputAvailability(upscaleSource)
        )
      );
      return;
    }

    setUpscaleError(elements, "");
    setUpscaleResult(null);
    busyTool = "upscale";
    isBusy = true;
    syncBusy();
    setUpscaleStatus(elements, "Preparing Upscale workflow...", "idle");
    setUpscaleProgressPreview(elements, "Preparing Upscale workflow...");

    try {
      const workflowPreset = readSelectValue(elements.upscaleWorkflow, DEFAULT_UPSCALE_WORKFLOW);
      const preset = getWorkflowPreset(workflowPreset);
      const modelName = readSelectValue(elements.upscaleModel);
      const client = new ComfyClient(elements.serverUrl.value);

      setUpscaleDiagnostics(elements, createWorkflowDiagnostics(preset, modelName, createSourceInputAvailability(upscaleSource)));
      await client.checkOnline();

      if (!modelName) {
        throw createOpenLayerError("CHECKPOINT_REQUIRED", "Choose a ComfyUI upscale model before generating.");
      }

      setUpscaleStatus(elements, "Checking selected upscale model...", "idle");
      setUpscaleProgressPreview(elements, "Checking selected upscale model...");

      if (!(await client.hasModelForPreset(modelName, preset))) {
        throw createOpenLayerError(
          "CHECKPOINT_REQUIRED",
          `The ${preset.modelSource.label.toLowerCase()} "${modelName}" was not found in ComfyUI. Click Check ComfyUI and choose an available upscale model.`
        );
      }

      setUpscaleStatus(elements, "Uploading source image to ComfyUI...", "idle");
      setUpscaleProgressPreview(elements, "Uploading source image...");
      const sourceImageName = await client.uploadImage(upscaleSource.blob, upscaleSource.filename);
      const buildResult = await buildUpscaleWorkflow({
        presetId: preset.id,
        sourceImageName,
        modelName
      });

      // The commit closure runs after awaits; a const keeps the null-checked
      // source from the top of the handler rather than re-reading mutable state.
      const capturedSource = upscaleSource;
      const generatedResult = await generation.runPipeline({
        toolType: "upscale",
        client,
        workflow: buildResult.workflow,
        preferredNodeId: getSaveImageNodeId(buildResult.preset),
        originatingDocument: capturedSource.originatingDocument,
        ui: createPipelineUi("upscale", elements.upscaleStatusProgress),
        messages: {
          submitStatus: "Submitting Upscale prompt...",
          submitPreview: "Submitting prompt to ComfyUI...",
          generateStatus: "Upscaling image...",
          generatePreview: "Upscaling image...",
          retrieveStatus: "Retrieving Upscale result...",
          retrievePreview: "Retrieving final image...",
          livePreview: "Live ComfyUI preview..."
        },
        commit: (generatedResult) => {
        setUpscaleResult(generatedResult);
        addHistoryEntry(elements, historyEntries, objectUrls, generatedResult, {
          prompt: `Upscale ${capturedSource.sourceName}`,
          checkpointName: modelName,
          modelName,
          workflowPreset: buildResult.preset.id,
          toolType: "upscale",
          seed: 0,
          sizeLabel: "Upscale",
          dimensions: `${capturedSource.width} x ${capturedSource.height} source`,
          sourceMode: capturedSource.sourceName,
          experimental: buildResult.preset.status === "experimental"
        });
        }
      });

      if (!generatedResult) {
        return;
      }
      setUpscaleStatus(elements, "Upscale generation complete.", "ready");
      setUpscaleDiagnostics(
        elements,
        `Source uploaded as ${sourceImageName}. Upscale model: ${modelName}. Workflow: ${buildResult.preset.id}.`
      );

      if (upscaleImportAutomatically) {
        setUpscaleStatus(elements, "Upscale complete. Auto-importing...", "idle");
        setUpscaleDiagnostics(elements, `Upscale model: ${modelName}. Auto import is on.`);
        await importUpscaleResult("auto", false);
      }
    } catch (caughtError) {
      if (isGenerationCancelledError(caughtError)) {
        showGenerationCancelled("upscale");
        return;
      }

      setUpscaleStatus(elements, "Upscale generation failed.", "error");
      setUpscaleError(elements, getFriendlyUpscaleErrorMessage(caughtError));
      console.error("[OpenLayer] Upscale generation failed", getTechnicalErrorDetails(caughtError));
      setUpscaleDiagnostics(elements, getUpscaleFailureHint(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
  }

  async function handleImportUpscale() {
    await importUpscaleResult("manual", true);
  }

  async function importUpscaleResult(source: "manual" | "auto", manageBusy: boolean) {
    setUpscaleDiagnostics(elements, source === "auto" ? "Upscale auto import started." : "Upscale import pressed.");

    if (!upscaleResult) {
      setUpscaleError(elements, "Generate an Upscale result before importing.");
      return;
    }

    setUpscaleError(elements, "");
    if (manageBusy) {
      busyTool = "upscale";
      isBusy = true;
      syncBusy();
    }
    setUpscaleStatus(elements, "Importing Upscale result into Photoshop...", "idle");

    try {
      const layerName = createLayerName("OpenLayer_Upscale");

      setUpscaleDiagnostics(elements, `Importing into ${upscaleResult.originatingDocument?.name || "the originating document"}...`);
      const importedLayerName = await importGeneratedImageAsLayer({
        blob: upscaleResult.blob,
        originatingDocument: upscaleResult.originatingDocument,
        layerName,
        onProgress: (message) => {
          setUpscaleStatus(elements, message, "idle");
          setUpscaleDiagnostics(elements, message);
        }
      });
      setUpscaleStatus(elements, `Imported layer: ${importedLayerName}`, "ready");
      flashImported(elements.upscaleStatusText);
      markHistoryImported(elements, historyEntries, upscaleResult, importedLayerName);
      const metadataMessage = await writeMetadataForImportedResult(historyEntries, upscaleResult, importedLayerName, (message) => {
        setUpscaleDiagnostics(elements, message);
      });
      setUpscaleDiagnostics(elements, `Layer created: ${importedLayerName}. ${metadataMessage}`);
    } catch (caughtError) {
      setUpscaleStatus(elements, "Import failed.", "error");
      setUpscaleError(elements, getErrorMessage(caughtError));
    } finally {
      if (manageBusy) {
        isBusy = false;
        busyTool = null;
        syncBusy();
      }
    }
  }

  async function handleCaptureOutpaintSource() {
    await captureOutpaintSourceImage({
      progressMessage: "Capturing active Photoshop layer for Outpaint...",
      statusMessage: "Capturing active layer...",
      successMessage: "Outpaint source captured.",
      captureKind: "layer",
      capture: exportActiveLayerForImageToImage
    });
  }

  async function handleCaptureOutpaintCanvasSource() {
    await captureOutpaintSourceImage({
      progressMessage: "Capturing Photoshop canvas for Outpaint...",
      statusMessage: "Capturing canvas...",
      successMessage: "Outpaint canvas captured.",
      captureKind: "canvas",
      capture: exportCanvasForImageToImage
    });
  }

  async function captureOutpaintSourceImage(options: {
    progressMessage: string;
    statusMessage: string;
    successMessage: string;
    captureKind: OutpaintCaptureKind;
    capture: () => Promise<ExportedSourceImage>;
  }) {
    setOutpaintDiagnostics(elements, options.progressMessage);
    setOutpaintError(elements, "");
    setOutpaintStatus(elements, options.statusMessage, "idle");
    busyTool = "outpaint";
    isBusy = true;
    syncBusy();

    try {
      const exportedSource = await options.capture();
      const sourcePreview = objectUrls.create(exportedSource.blob);
      setOutpaintSource({
        ...exportedSource,
        previewUrl: sourcePreview
      });
      outpaintCaptureKind = options.captureKind;
      setOutpaintStatus(elements, options.successMessage, "ready");
      setOutpaintDiagnostics(
        elements,
        `${createSourceCaptureMessage(exportedSource, " for Flux Fill outpainting")} Padding will be added in ComfyUI.`
      );
    } catch (caughtError) {
      setOutpaintStatus(elements, "Outpaint source capture failed.", "error");
      setOutpaintError(elements, getErrorMessage(caughtError));
      setOutpaintDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
  }

  async function handleGenerateOutpaint() {
    if (blockRegularGenerationDuringLivePainting((message) => setOutpaintStatus(elements, message, "error"))) {
      return;
    }

    setOutpaintDiagnostics(elements, `Outpaint generate pressed at ${new Date().toLocaleTimeString()}.`);

    if (!outpaintSource) {
      setOutpaintError(elements, "Capture the active Photoshop layer or canvas before generating Outpaint.");
      setOutpaintStatus(elements, "Source required.", "error");
      setOutpaintDiagnostics(
        elements,
        createWorkflowDiagnostics(
          getWorkflowPreset(readSelectValue(elements.outpaintWorkflow, DEFAULT_OUTPAINT_WORKFLOW)),
          readSelectValue(elements.outpaintCheckpoint),
          createSourceInputAvailability(outpaintSource)
        )
      );
      return;
    }

    if (!elements.outpaintPrompt.value.trim()) {
      setOutpaintError(
        elements,
        getErrorMessage(createOpenLayerError("PROMPT_REQUIRED", "Enter a prompt before generating Outpaint."))
      );
      setOutpaintStatus(elements, "Prompt required.", "error");
      return;
    }

    setOutpaintError(elements, "");
    setOutpaintResult(null);
    busyTool = "outpaint";
    isBusy = true;
    syncBusy();
    setOutpaintStatus(elements, "Preparing Outpaint workflow...", "idle");
    setOutpaintProgressPreview(elements, "Preparing Outpaint workflow...");

    try {
      const workflowPreset = readSelectValue(elements.outpaintWorkflow, DEFAULT_OUTPAINT_WORKFLOW);
      const preset = getWorkflowPreset(workflowPreset);
      const checkpointName = readSelectValue(elements.outpaintCheckpoint);
      const { settings, warnings } = validateOutpaintSettings({
        steps: elements.outpaintSteps.value,
        cfg: elements.outpaintGuidance.value,
        seed: elements.outpaintSeed.value,
        denoise: elements.outpaintDenoise.value,
        left: elements.outpaintLeft.value,
        top: elements.outpaintTop.value,
        right: elements.outpaintRight.value,
        bottom: elements.outpaintBottom.value,
        feathering: elements.outpaintFeathering.value
      });
      const client = new ComfyClient(elements.serverUrl.value);

      applyValidatedOutpaintSettings(elements, settings);
      setOutpaintDiagnostics(
        elements,
        warnings.length > 0
          ? warnings.join(" ")
          : createWorkflowDiagnostics(preset, checkpointName, createSourceInputAvailability(outpaintSource))
      );
      await client.checkOnline();

      if (!checkpointName) {
        throw createOpenLayerError("CHECKPOINT_REQUIRED", "Choose a Flux Fill model before generating Outpaint.");
      }

      setOutpaintStatus(elements, "Checking selected Flux Fill model...", "idle");
      setOutpaintProgressPreview(elements, "Checking selected model...");

      if (!(await client.hasModelForPreset(checkpointName, preset))) {
        throw createOpenLayerError(
          "CHECKPOINT_REQUIRED",
          `The ${preset.modelSource.label.toLowerCase()} "${checkpointName}" was not found in ComfyUI. Click Check ComfyUI and choose an available model.`
        );
      }

      setOutpaintStatus(elements, "Checking Outpaint nodes...", "idle");
      setOutpaintProgressPreview(elements, "Checking Flux Fill outpaint setup...");
      const requiredModelSelections = await client.validatePresetSetup(preset);

      setOutpaintStatus(elements, "Uploading source image to ComfyUI...", "idle");
      setOutpaintProgressPreview(elements, "Uploading source image...");
      const sourceImageName = await client.uploadImage(outpaintSource.blob, outpaintSource.filename);
      // ComfyUI's VAE rounds the padded image down to multiples of 8; snapping
      // the pads up-front keeps the result exactly the size the canvas
      // expansion import will create, instead of drifting by up to 7px.
      const snappedPads = snapOutpaintPads(
        { left: settings.left, top: settings.top, right: settings.right, bottom: settings.bottom },
        { width: outpaintSource.width, height: outpaintSource.height }
      );
      const buildResult = await buildOutpaintWorkflow({
        presetId: preset.id,
        prompt: elements.outpaintPrompt.value,
        checkpointName,
        sourceImageName,
        steps: settings.steps,
        cfg: settings.cfg,
        seed: settings.seed,
        denoise: settings.denoise,
        left: snappedPads.pads.left,
        top: snappedPads.pads.top,
        right: snappedPads.pads.right,
        bottom: snappedPads.pads.bottom,
        feathering: settings.feathering,
        requiredModelSelections
      });

      // The commit closure runs after awaits; a const keeps the null-checked
      // source from the top of the handler rather than re-reading mutable state.
      const capturedSource = outpaintSource;
      const capturedCaptureKind = outpaintCaptureKind ?? "layer";
      const generatedResult = await generation.runPipeline({
        toolType: "outpaint",
        client,
        workflow: buildResult.workflow,
        preferredNodeId: getSaveImageNodeId(buildResult.preset),
        originatingDocument: capturedSource.originatingDocument,
        ui: createPipelineUi("outpaint", elements.outpaintStatusProgress),
        messages: {
          submitStatus: "Submitting Outpaint prompt...",
          submitPreview: "Submitting prompt to ComfyUI...",
          generateStatus: "Generating Outpaint result...",
          generatePreview: "Generating outpaint...",
          retrieveStatus: "Retrieving Outpaint result...",
          retrievePreview: "Retrieving final image...",
          livePreview: "Live ComfyUI Outpaint preview..."
        },
        commit: (generatedResult) => {
        const generatedOutpaintContext = createInpaintImportContext<OutpaintExpansionSource, AppGeneratedImageResult>(
          {
            pads: snappedPads.pads,
            sourceDimensions: { width: capturedSource.width, height: capturedSource.height },
            captureKind: capturedCaptureKind
          },
          generatedResult
        );
        setOutpaintResult(generatedResult);
        activeOutpaintImportContext = generatedOutpaintContext;
        addHistoryEntry(elements, historyEntries, objectUrls, generatedResult, {
          prompt: elements.outpaintPrompt.value,
          checkpointName,
          modelName: checkpointName,
          workflowPreset: buildResult.preset.id,
          toolType: "outpaint",
          seed: buildResult.seed,
          sizeLabel: "Outpaint",
          dimensions: `${capturedSource.width} x ${capturedSource.height}`,
          sourceMode: capturedSource.sourceName,
          outpaintImportContext: generatedOutpaintContext,
          experimental: true,
          diagnosticsSummary: formatInpaintOutpaintDebugContract({
            toolType: "outpaint",
            presetId: buildResult.preset.id,
            sourceMode: capturedSource.sourceName,
            sourceDimensions: {
              width: capturedSource.width,
              height: capturedSource.height
            },
            outputKind: "expanded canvas",
            importMode: "new layer"
          })
        });
        }
      });

      if (!generatedResult) {
        return;
      }
      setOutpaintStatus(elements, "Outpaint generation complete.", "ready");
      setOutpaintDiagnostics(
        elements,
        [
          `Seed used: ${buildResult.seed}. Source uploaded as ${sourceImageName}. Workflow: ${buildResult.preset.id}.`,
          `Padding left ${snappedPads.pads.left}, top ${snappedPads.pads.top}, right ${snappedPads.pads.right}, bottom ${snappedPads.pads.bottom}, feather ${settings.feathering}.`,
          snappedPads.adjustedRight || snappedPads.adjustedBottom
            ? `Right/bottom padding grew by ${snappedPads.adjustedRight}/${snappedPads.adjustedBottom}px so the result size stays a multiple of 8.`
            : ""
        ].filter(Boolean).join(" ")
      );
    } catch (caughtError) {
      if (isGenerationCancelledError(caughtError)) {
        showGenerationCancelled("outpaint");
        return;
      }

      setOutpaintStatus(elements, "Outpaint generation failed.", "error");
      setOutpaintError(elements, getFriendlyOutpaintErrorMessage(caughtError));
      console.error("[OpenLayer] Outpaint generation failed", getTechnicalErrorDetails(caughtError));
      setOutpaintDiagnostics(elements, getOutpaintFailureHint(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
  }

  async function handleImportOutpaint(savedHistoryContext?: AppOutpaintImportContext) {
    setOutpaintDiagnostics(elements, "Outpaint import pressed.");
    const importContext = resolveInpaintImportContext(savedHistoryContext, activeOutpaintImportContext);
    const importResultImage = importContext?.result ?? outpaintResult;

    if (!importResultImage) {
      setOutpaintError(elements, "Generate an Outpaint result before importing.");
      return;
    }

    setOutpaintError(elements, "");
    busyTool = "outpaint";
    isBusy = true;
    syncBusy();
    setOutpaintStatus(elements, "Importing Outpaint result into Photoshop...", "idle");

    try {
      const layerName = createLayerName("OpenLayer_Outpaint");

      setOutpaintDiagnostics(elements, `Importing into ${importResultImage.originatingDocument?.name || "the originating document"}...`);

      // Canvas expansion needs the exact pads this result was generated with
      // and a canvas-covering source; both live in the saved context. Layer
      // captures carry no position, so they keep the floating-layer import.
      let expansionBlockedReason = "";

      if (importContext && importContext.source.captureKind === "canvas") {
        const plan = createOutpaintExpansionPlan(importContext.source.sourceDimensions, importContext.source.pads);
        const resultDimensions = await readImageDimensionsFromBlob(importResultImage.blob);
        expansionBlockedReason = validateOutpaintResultDimensions(resultDimensions, plan) ?? "";

        if (!expansionBlockedReason) {
          setOutpaintStatus(elements, "Expanding the canvas for the outpaint result...", "idle");
          const importedLayerName = await importOutpaintResultExpandingCanvas({
            blob: importResultImage.blob,
            originatingDocument: importResultImage.originatingDocument,
            plan,
            layerName,
            onProgress: (message) => {
              setOutpaintStatus(elements, message, "idle");
              setOutpaintDiagnostics(elements, message);
            }
          });
          setOutpaintStatus(elements, `Imported layer: ${importedLayerName}`, "ready");
          flashImported(elements.outpaintStatusText);
          markHistoryImported(elements, historyEntries, importResultImage, importedLayerName);
          const metadataMessage = await writeMetadataForImportedResult(historyEntries, importResultImage, importedLayerName, (message) => {
            setOutpaintDiagnostics(elements, message);
          });
          setOutpaintDiagnostics(
            elements,
            `Layer created: ${importedLayerName}. Canvas expanded to ${plan.expandedWidth} x ${plan.expandedHeight}; your original artwork now sits at ${plan.contentOffset.x}, ${plan.contentOffset.y}. ${metadataMessage}`
          );
          return;
        }
      } else if (importContext) {
        expansionBlockedReason = "This result was generated from a layer capture, which carries no canvas position; importing it as a floating layer instead.";
      } else {
        expansionBlockedReason = "This result predates canvas-expansion support; importing it as a floating layer.";
      }

      const importedLayerName = await importGeneratedImageAsLayer({
        blob: importResultImage.blob,
        originatingDocument: importResultImage.originatingDocument,
        layerName,
        onProgress: (message) => {
          setOutpaintStatus(elements, message, "idle");
          setOutpaintDiagnostics(elements, message);
        }
      });
      setOutpaintStatus(elements, `Imported layer: ${importedLayerName}`, "ready");
      flashImported(elements.outpaintStatusText);
      markHistoryImported(elements, historyEntries, importResultImage, importedLayerName);
      const metadataMessage = await writeMetadataForImportedResult(historyEntries, importResultImage, importedLayerName, (message) => {
        setOutpaintDiagnostics(elements, message);
      });
      setOutpaintDiagnostics(
        elements,
        [`Layer created: ${importedLayerName}.`, expansionBlockedReason, metadataMessage].filter(Boolean).join(" ")
      );
    } catch (caughtError) {
      setOutpaintStatus(elements, "Import failed.", "error");
      setOutpaintError(elements, getErrorMessage(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
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
    busyTool = "sketch-to-image";
    isBusy = true;
    syncBusy();

    try {
      const exportedSource = await options.capture();
      const sourcePreview = objectUrls.create(exportedSource.blob);
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
      busyTool = null;
      syncBusy();
    }
  }

  async function handleGenerateSketch() {
    if (blockRegularGenerationDuringLivePainting((message) => setSketchStatus(elements, message, "error"))) {
      return;
    }

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
    busyTool = "sketch-to-image";
    isBusy = true;
    syncBusy();
    setSketchStatus(elements, "Preparing LINECN workflow...", "idle");
    setSketchProgressPreview(elements, "Preparing LINECN workflow...");

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
        width: snapDimensionToLatentGrid(sketchSource.width),
        height: snapDimensionToLatentGrid(sketchSource.height),
        steps: settings.steps,
        cfg: settings.cfg,
        seed: settings.seed,
        denoise: settings.denoise,
        controlStrength: settings.controlStrength
      });

      // The commit closure runs after awaits; a const keeps the null-checked
      // source from the top of the handler rather than re-reading mutable state.
      const capturedSource = sketchSource;
      const generatedResult = await generation.runPipeline({
        toolType: "sketch-to-image",
        client,
        workflow: buildResult.workflow,
        preferredNodeId: getSaveImageNodeId(buildResult.preset),
        originatingDocument: capturedSource.originatingDocument,
        ui: createPipelineUi("sketch-to-image", elements.sketchStatusProgress),
        messages: {
          submitStatus: "Submitting Sketch to Image prompt...",
          submitPreview: "Submitting prompt to ComfyUI...",
          generateStatus: "Generating Sketch to Image result...",
          generatePreview: "Generating image...",
          retrieveStatus: "Retrieving Sketch to Image result...",
          retrievePreview: "Retrieving final image...",
          livePreview: "Live ComfyUI preview..."
        },
        commit: (generatedResult) => {
        setSketchResult(generatedResult);
        addHistoryEntry(elements, historyEntries, objectUrls, generatedResult, {
          prompt: elements.sketchPrompt.value,
          negativePrompt: elements.sketchNegativePrompt.value,
          checkpointName,
          modelName: checkpointName,
          workflowPreset: buildResult.preset.id,
          toolType: "sketch-to-image",
          seed: buildResult.seed,
          sizeLabel: "Sketch to Image",
          dimensions: `${capturedSource.width} x ${capturedSource.height}`,
          sourceMode: capturedSource.sourceName,
          experimental: buildResult.preset.status === "experimental"
        });
        }
      });

      if (!generatedResult) {
        return;
      }
      setSketchStatus(elements, "Sketch to Image generation complete.", "ready");
      setSketchDiagnostics(
        elements,
        `Seed used: ${buildResult.seed}. Source uploaded as ${sourceImageName}. Workflow: ${buildResult.preset.id}.`
      );
    } catch (caughtError) {
      if (isGenerationCancelledError(caughtError)) {
        showGenerationCancelled("sketch-to-image");
        return;
      }

      setSketchStatus(elements, "Sketch to Image generation failed.", "error");
      setSketchError(elements, getFriendlySketchErrorMessage(caughtError));
      console.error("[OpenLayer] Sketch to Image generation failed", getTechnicalErrorDetails(caughtError));
      setSketchDiagnostics(elements, getSketchFailureHint(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
  }

  async function handleImportSketch() {
    setSketchDiagnostics(elements, "Sketch to Image import pressed.");

    if (!sketchResult) {
      setSketchError(elements, "Generate a Sketch to Image result before importing.");
      return;
    }

    setSketchError(elements, "");
    busyTool = "sketch-to-image";
    isBusy = true;
    syncBusy();
    setSketchStatus(elements, "Importing Sketch to Image result into Photoshop...", "idle");

    try {
      const layerName = createLayerName("OpenLayer_Sketch");

      setSketchDiagnostics(elements, `Importing into ${sketchResult.originatingDocument?.name || "the originating document"}...`);
      const importedLayerName = await importGeneratedImageAsLayer({
        blob: sketchResult.blob,
        originatingDocument: sketchResult.originatingDocument,
        layerName,
        onProgress: (message) => {
          setSketchStatus(elements, message, "idle");
          setSketchDiagnostics(elements, message);
        }
      });
      setSketchStatus(elements, `Imported layer: ${importedLayerName}`, "ready");
      flashImported(elements.sketchStatusText);
      markHistoryImported(elements, historyEntries, sketchResult, importedLayerName);
      const metadataMessage = await writeMetadataForImportedResult(historyEntries, sketchResult, importedLayerName, (message) => {
        setSketchDiagnostics(elements, message);
      });
      setSketchDiagnostics(elements, `Layer created: ${importedLayerName}. ${metadataMessage}`);
    } catch (caughtError) {
      setSketchStatus(elements, "Import failed.", "error");
      setSketchError(elements, getErrorMessage(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
  }

  async function handleCaptureInpaintSelection(sourceMode: InpaintSourceMode) {
    const sourceModeLabel = getInpaintSourceModeLabel(sourceMode);
    setInpaintDiagnostics(elements, `Capturing Photoshop selection from ${sourceModeLabel}...`);
    setInpaintError(elements, "");
    setInpaintStatus(elements, `Capturing ${sourceModeLabel} selection...`, "idle");
    busyTool = "inpaint";
    isBusy = true;
    syncBusy();

    try {
      const exportedSource = await captureSelectionForInpainting(sourceMode);
      const sourcePreview = objectUrls.create(exportedSource.blob);
      setInpaintSource({
        ...exportedSource,
        previewUrl: sourcePreview
      });
      setInpaintResult(null);
      setInpaintStatus(elements, "Selection captured.", "ready");
      setInpaintDiagnostics(
        elements,
        [
          createInpaintSourceModeDiagnostic({
            mode: exportedSource.sourceMode,
            sourceName: exportedSource.sourceName,
            activeLayerName: exportedSource.activeLayerName,
            maskAvailable: exportedSource.maskAvailable
          }),
          `${createSourceCaptureMessage(exportedSource, " for inpainting")} Selection: ${formatSelectionBounds(exportedSource.selection.bounds)}. Context: ${formatSelectionBounds(exportedSource.selection.contextBounds)}. ${exportedSource.maskMessage}`,
          exportedSource.sourceWarning
        ].filter(Boolean).join(" ")
      );
    } catch (caughtError) {
      setInpaintStatus(elements, "Selection capture failed.", "error");
      setInpaintError(elements, getErrorMessage(caughtError));
      setInpaintDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
  }

  // One readiness gate for the whole panel: it names the single thing to fix and
  // reports it the same way whichever prerequisite is missing. Generate passes
  // the workflow context an artist needs to interpret the block; import has no
  // workflow, so it passes none.
  function reportInpaintNotReady(
    readiness: Extract<InpaintReadiness, { ok: false }>,
    workflowContext = ""
  ) {
    setInpaintError(elements, readiness.message);
    setInpaintStatus(elements, getInpaintReadinessStatusLabel(readiness.reason), "error");
    setInpaintDiagnostics(
      elements,
      [formatInpaintReadinessDiagnostic(readiness), workflowContext].filter(Boolean).join(" ")
    );
  }

  function createInpaintWorkflowContext() {
    const preset = resolveInpaintPreset(readSelectValue(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW));

    if (!preset) {
      return "";
    }

    return createWorkflowDiagnostics(preset, readSelectValue(elements.inpaintCheckpoint), {
      selection: Boolean(inpaintSource),
      "selection-mask": Boolean(inpaintSource?.mask)
    });
  }

  function resolveInpaintPreset(presetId: string) {
    try {
      return getWorkflowPreset(presetId);
    } catch {
      return null;
    }
  }

  async function handleGenerateInpaint() {
    if (blockRegularGenerationDuringLivePainting((message) => setInpaintStatus(elements, message, "error"))) {
      return;
    }

    setInpaintDiagnostics(elements, `Inpaint generate pressed at ${new Date().toLocaleTimeString()}.`);

    const presetId = readSelectValue(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW);
    // Evaluated before the client exists, so a missing selection or prompt is
    // reported instantly instead of behind a ComfyUI round trip.
    const localReadiness = evaluateInpaintReadiness({
      mode: "generate",
      source: inpaintSource,
      preset: resolveInpaintPreset(presetId),
      presetId,
      checkpointName: readSelectValue(elements.inpaintCheckpoint),
      prompt: elements.inpaintPrompt.value
    });

    if (!localReadiness.ok) {
      reportInpaintNotReady(localReadiness, createInpaintWorkflowContext());
      return;
    }

    // Snapshot the capture the moment it passes the gate. Everything downstream
    // reads this frozen copy, so a selection captured while ComfyUI is still
    // generating cannot pair a new source with this run's result.
    const submittedSource = createInpaintSourceSnapshot(inpaintSource!);
    const submittedMask = submittedSource.mask;

    // Readiness already proved the mask is present; this keeps the compiler
    // honest without a non-null assertion on every use below.
    if (!submittedMask) {
      reportInpaintNotReady({
        ok: false,
        reason: "mask-missing",
        message: "Capture Selection did not produce a mask image.",
        warnings: []
      }, createInpaintWorkflowContext());
      return;
    }

    setInpaintError(elements, "");
    setInpaintResult(null);
    busyTool = "inpaint";
    isBusy = true;
    syncBusy();
    setInpaintStatus(elements, "Preparing Inpaint workflow...", "idle");
    setInpaintProgressPreview(elements, "Preparing Inpaint workflow...");

    try {
      const preset = getWorkflowPreset(presetId);
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
        hasSourceImage: true,
        hasMaskImage: true,
        sourceWidth: submittedSource.width,
        sourceHeight: submittedSource.height,
        maskWidth: submittedMask.width,
        maskHeight: submittedMask.height,
        hasSelectionContextBounds: Boolean(submittedSource.selection.contextBounds),
        selectedFluxModelName: checkpointName
      });

      applyValidatedInpaintSettings(elements, settings);
      const workflowDiagnostics = warnings.length > 0
        ? warnings.join(" ")
        : createWorkflowDiagnostics(preset, checkpointName, {
          selection: true,
          "selection-mask": true
        });
      setInpaintDiagnostics(
        elements,
        [workflowDiagnostics, fluxDebugSummary].filter(Boolean).join(" ")
      );
      await client.checkOnline();

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
      // Re-run the contract now that the server can answer which models it has.
      // This replaces the ad hoc hasModelForPreset check with the same rule set
      // the local gate used, so both report failures identically.
      const serverReadiness = evaluateInpaintReadiness({
        mode: "generate",
        source: submittedSource,
        preset,
        presetId: preset.id,
        checkpointName,
        prompt: elements.inpaintPrompt.value,
        installedModelNames: await client.getModelNamesForPreset(preset)
      });

      if (!serverReadiness.ok) {
        reportInpaintNotReady(serverReadiness, workflowDiagnostics);
        return;
      }

      setInpaintStatus(elements, "Checking Inpaint nodes...", "idle");
      setInpaintProgressPreview(elements, "Checking Inpaint setup...");
      const requiredModelSelections = await client.validatePresetSetup(preset);

      setInpaintStatus(elements, "Uploading source and mask to ComfyUI...", "idle");
      setInpaintProgressPreview(elements, "Uploading source and mask...");
      let sourceUploadBlob = submittedSource.blob;
      let sourceUploadFilename = submittedSource.filename;
      let maskUploadBlob = submittedMask.blob;
      let maskUploadFilename = submittedMask.filename;
      let fluxEmbeddedMaskMessage = "";

      if (preset.id === "inpaint-flux-fill-basic") {
        setInpaintStatus(elements, "Preparing Flux Fill masked source...", "idle");
        setInpaintProgressPreview(elements, "Embedding mask into Flux Fill source...");
        const embeddedSource = await createFluxFillEmbeddedMaskSource(submittedSource.blob, submittedMask.blob);
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
        width: Math.round(submittedSource.width),
        height: Math.round(submittedSource.height),
        requiredModelSelections
      });

      const fluxDefaultsMessage =
        preset.id === FLUX_FILL_PRESET_ID ? formatFluxFillReferenceDefaults() : "";
      if (fluxDefaultsMessage) {
        setInpaintDiagnostics(
          elements,
          [workflowDiagnostics, fluxDebugSummary, fluxEmbeddedMaskMessage, fluxDefaultsMessage]
            .filter(Boolean)
            .join(" ")
        );
      }

      let inpaintOutputDiagnostics = "";
      let debugExportMessage = "";
      const generatedResult = await generation.runPipeline({
        toolType: "inpaint",
        client,
        workflow: buildResult.workflow,
        preferredNodeId: getSaveImageNodeId(buildResult.preset),
        originatingDocument: submittedSource.originatingDocument,
        ui: createPipelineUi("inpaint", elements.inpaintStatusProgress),
        messages: {
          submitStatus: "Submitting Inpaint prompt...",
          submitPreview: "Submitting prompt to ComfyUI...",
          generateStatus: "Generating Inpaint result...",
          generatePreview: "Generating image...",
          retrieveStatus: "Retrieving Inpaint result...",
          retrievePreview: "Retrieving final image...",
          livePreview: "Live ComfyUI preview..."
        },
        commit: async (generatedResult) => {
        const generatedImportContext = createInpaintImportContext(submittedSource, generatedResult);
        const resultDimensions = await readImageDimensionsFromBlob(generatedResult.blob);
        inpaintOutputDiagnostics = formatInpaintOutputDiagnostics({
          presetId: buildResult.preset.id,
          sourceDimensions: {
            width: submittedSource.width,
            height: submittedSource.height
          },
          maskDimensions: {
            width: submittedMask.width,
            height: submittedMask.height
          },
          resultDimensions,
          importMode: "aligned-context-fallback",
          maskPolarity: "white-repaints"
        });

        try {
          const debugFiles = await saveInpaintDebugBlobsToTemporaryFiles({
            sourceBlob: submittedSource.blob,
            maskBlob: submittedMask.blob,
            resultBlob: generatedResult.blob
          });
          debugExportMessage = ` Debug copies saved in the UXP temporary folder: ${debugFiles.join(", ")}.`;
        } catch (debugError) {
          debugExportMessage = ` Debug copy export unavailable: ${getErrorMessage(debugError)}.`;
        }

        activeInpaintImportContext = generatedImportContext;
        setInpaintResult(generatedResult);
        addHistoryEntry(elements, historyEntries, objectUrls, generatedResult, {
          prompt: elements.inpaintPrompt.value,
          negativePrompt: elements.inpaintNegativePrompt.value,
          checkpointName,
          modelName: checkpointName,
          workflowPreset: buildResult.preset.id,
          toolType: "inpaint",
          seed: buildResult.seed,
          sizeLabel: "Inpaint",
          dimensions: `${submittedSource.width} x ${submittedSource.height}`,
          sourceMode: getInpaintSourceModeLabel(submittedSource.sourceMode),
          sourceBounds: createMetadataBounds(submittedSource.selection.bounds),
          contextBounds: createMetadataBounds(submittedSource.selection.contextBounds),
          inpaintImportContext: generatedImportContext,
          experimental: true,
          diagnosticsSummary: [
            inpaintOutputDiagnostics,
            formatInpaintOutpaintDebugContract({
              toolType: "inpaint",
              presetId: buildResult.preset.id,
              sourceMode: getInpaintSourceModeLabel(submittedSource.sourceMode),
              sourceDimensions: {
                width: submittedSource.width,
                height: submittedSource.height
              },
              maskDimensions: {
                width: submittedMask.width,
                height: submittedMask.height
              },
              maskPolarity: "white-repaints",
              contextBounds: createMetadataBounds(submittedSource.selection.contextBounds),
              outputKind: "selection context",
              importMode: "Photoshop layer mask with aligned fallback"
            })
          ].filter(Boolean).join(" ")
        });
        }
      });

      if (!generatedResult) {
        return;
      }
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
      if (isGenerationCancelledError(caughtError)) {
        showGenerationCancelled("inpaint");
        return;
      }

      setInpaintStatus(elements, "Inpaint generation failed.", "error");
      setInpaintError(elements, getFriendlyInpaintErrorMessage(caughtError));
      console.error("[OpenLayer] Inpaint generation failed", getTechnicalErrorDetails(caughtError));
      setInpaintDiagnostics(elements, getInpaintFailureHint(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
  }

  async function handleImportInpaint(savedHistoryContext?: AppInpaintImportContext) {
    setInpaintDiagnostics(elements, "Inpaint import pressed.");
    const importContext = resolveInpaintImportContext(savedHistoryContext, activeInpaintImportContext);

    if (!importContext) {
      setInpaintError(elements, "Generate an Inpaint result before importing.");
      return;
    }

    const importSource = importContext.source;
    const importResultImage = importContext.result;
    // The result carries the exact capture it was generated from, so import
    // readiness re-checks that saved pair rather than whatever is on screen now.
    const importReadiness = evaluateInpaintReadiness({
      mode: "import",
      source: importSource,
      resultDimensions: await readImageDimensionsFromBlob(importResultImage.blob)
    });

    if (!importReadiness.ok) {
      reportInpaintNotReady(importReadiness);
      return;
    }

    const importMask = importSource.mask;

    if (!importMask) {
      reportInpaintNotReady({
        ok: false,
        reason: "mask-missing",
        message: "The saved selection mask for this Inpaint result is unavailable. Generate the result again from a captured selection.",
        warnings: []
      });
      return;
    }

    setInpaintError(elements, "");
    busyTool = "inpaint";
    isBusy = true;
    syncBusy();
    setInpaintStatus(elements, "Importing Inpaint result into Photoshop...", "idle");

    try {
      const layerName = createLayerName("OpenLayer_Inpaint");
      const presetId = readSelectValue(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW);
      const sourceDimensions = {
        width: importSource.width,
        height: importSource.height
      };
      const maskDimensions = {
        width: importMask.width,
        height: importMask.height
      };
      const resultDimensions = { width: importSource.width, height: importSource.height };
      let importMode: InpaintImportMode = "aligned-context-fallback";

      setInpaintDiagnostics(
        elements,
        `Importing into ${importResultImage.originatingDocument?.name || "the originating document"}...`
      );
      setInpaintStatus(elements, "Importing with Photoshop layer mask...", "idle");
      setInpaintDiagnostics(
        elements,
        "Applying the exact saved Photoshop selection mask."
      );

      const importResult = await importImageAlignedToSelectionWithLayerMask({
        blob: importResultImage.blob,
        originatingDocument: importResultImage.originatingDocument,
        bounds: importSource.selection.contextBounds,
        mask: {
          blob: importMask.blob,
          width: importMask.width,
          height: importMask.height
        },
        sourceDimensions,
        resultDimensions,
        layerName,
        onProgress: (message) => {
          setInpaintStatus(elements, message, "idle");
          setInpaintDiagnostics(elements, message);
        }
      });
      importMode = importResult.maskApplied ? "transparent-outside-mask" : "aligned-context-fallback";
      const importedLayerName = importResult.layerName;
      setInpaintStatus(elements, `Imported layer: ${importedLayerName}`, "ready");
      flashImported(elements.inpaintStatusText);
      markHistoryImported(elements, historyEntries, importResultImage, importedLayerName);
      const metadataMessage = await writeMetadataForImportedResult(historyEntries, importResultImage, importedLayerName, (message) => {
        setInpaintDiagnostics(elements, message);
      });
      setInpaintDiagnostics(
        elements,
        [
          `Layer created: ${importedLayerName}.`,
          metadataMessage,
          importResult.message,
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
      busyTool = null;
      syncBusy();
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
    busyTool = "prompt-from-layer";
    isBusy = true;
    syncBusy();

    try {
      const exportedSource = await options.capture();
      const sourcePreview = objectUrls.create(exportedSource.blob);
      setPromptLayerSource({
        ...exportedSource,
        previewUrl: sourcePreview
      });
      setPromptLayerStatus(elements, options.successMessage, "ready");
      setPromptLayerDiagnostics(
        elements,
        `${createSourceCaptureMessage(exportedSource)} Ready to generate prompt text with Florence-2 PromptGen.`
      );
    } catch (caughtError) {
      setPromptLayerStatus(elements, "Source capture failed.", "error");
      setPromptLayerError(elements, getErrorMessage(caughtError));
      setPromptLayerDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
  }

  async function handleGeneratePromptFromLayer() {
    if (blockRegularGenerationDuringLivePainting((message) => setPromptLayerStatus(elements, message, "error"))) {
      return;
    }

    if (!promptLayerSource) {
      setPromptLayerStatus(elements, "Source required.", "error");
      setPromptLayerError(elements, "Capture an active layer or canvas before generating prompt text.");
      return;
    }

    const task = readPromptLayerTask(elements);
    const numBeams = readPromptLayerNumBeams(elements);
    const seed = createRandomSeed();
    const client = new ComfyClient(elements.serverUrl.value);
    const preset = getWorkflowPreset("prompt-from-layer-florence2");

    setPromptLayerError(elements, "");
    setPromptLayerStatus(elements, "Uploading source to ComfyUI...", "idle");
    setPromptLayerDiagnostics(elements, `Task: ${task}. Num beams: ${numBeams}.`);
    busyTool = "prompt-from-layer";
    isBusy = true;
    syncBusy();
    let run: GenerationRunHandle | null = null;

    try {
      await client.validatePresetSetup(preset);
      const sourceImageName = await client.uploadImage(promptLayerSource.blob, promptLayerSource.filename);
      const workflowResult = await buildPromptFromLayerWorkflow({
        presetId: preset.id,
        sourceImageName,
        task,
        numBeams,
        seed
      });
      const textOutputNodeId = getTextOutputNodeId(workflowResult.preset);

      setPromptLayerStatus(elements, "Running Florence-2 PromptGen...", "idle");
      setPromptLayerDiagnostics(
        elements,
        `Uploaded ${sourceImageName}. Waiting for ${workflowResult.preset.label} text output...`
      );

      const promptId = await client.submitPrompt(workflowResult.workflow);
      run = generation.begin("prompt-from-layer", client, promptId);
      const startedRun = run;
      const historyItem = await client.pollUntilTextComplete(promptId, {
        preferredNodeId: textOutputNodeId,
        onTick: (message) => startedRun.publish(() => setPromptLayerStatus(elements, message, "idle")),
        isCancelled: () => startedRun.isRunCancelled()
      });
      const generatedText = await client.retrieveFirstOutputText(promptId, historyItem, {
        preferredNodeId: textOutputNodeId
      });
      run.assertCanCommit();

      elements.promptLayerGeneratedText.value = generatedText;
      run.finish();
      run = null;
      setPromptLayerStatus(elements, "Prompt text generated.", "ready");
      setPromptLayerDiagnostics(
        elements,
        `Generated from ${promptLayerSource.sourceName}. Task: ${task}. Num beams: ${numBeams}. Seed: ${seed}.`
      );
    } catch (caughtError) {
      if (isGenerationCancelledError(caughtError)) {
        if (!run || run.isCurrent()) showGenerationCancelled("prompt-from-layer", run?.promptId);
        return;
      }

      setPromptLayerStatus(elements, "Prompt text generation failed.", "error");
      setPromptLayerError(elements, getErrorMessage(caughtError));
      setPromptLayerDiagnostics(elements, getTechnicalErrorDetails(caughtError));
    } finally {
      run?.finish();
      isBusy = false;
      busyTool = null;
      syncBusy();
    }
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

  async function handleStartLivePainting() {
    if (isBusy) {
      setLiveStatus("Finish the current generation before starting a live session.");
      return;
    }

    if (livePaintingSession?.isRunning()) {
      setLiveStatus("A live session is already running.");
      return;
    }

    const prompt = elements.livePrompt.value.trim();

    if (!prompt) {
      setLiveStatus("Enter a prompt before starting the live session.");
      return;
    }

    const checkpointName = readSelectValue(elements.checkpoint);

    if (!checkpointName) {
      setLiveStatus("Choose a checkpoint on the Text to Image screen first.");
      return;
    }

    const denoise = Number(elements.liveDenoise.value);
    const session = new LivePaintingSessionV2(
      {
        checkpointName,
        prompt,
        denoise: Number.isFinite(denoise) ? denoise : 0.6,
        autoRefineOnPause: liveAutoRefine,
        refineDenoise: 0.45,
        refineMaxDimension: 1024,
        pauseSeconds: 4
      },
      {
        onStatus: (message) => setLiveStatus(message),
        onTimings: (message) => {
          elements.liveTimingsText.textContent = message;
        },
        onPreviewBlob: (blob, originatingDocument) => updateLivePreview(blob, originatingDocument),
        onRefineResult: (blob, originatingDocument) => {
          liveRefinedResult = bindDocumentContext({ blob }, originatingDocument);
          setActionDisabled(elements.importLiveRefinedButton, false);
          updateLivePreview(blob, originatingDocument, false);
        },
        onStateChanged: (state) => updateLiveStateBadge(state),
        onStopped: (reason) => {
          setLiveStatus(reason);
          updateLiveButtons(false);
        }
      },
      {
        client: new ComfyClient(elements.serverUrl.value),
        capture: captureCanvasForLivePainting
      }
    );

    livePaintingSession = session;
    updateLiveButtons(true);

    try {
      await session.start();
      void session.checkRefineAvailability()
        .then((gapMessage) => {
          if (gapMessage && livePaintingSession === session && session.isRunning()) {
            setLiveStatus(gapMessage);
          }
        })
        .catch((caughtError) => {
          if (livePaintingSession === session && session.isRunning()) {
            setLiveStatus(`Could not check Krea-2 refine availability: ${getErrorMessage(caughtError)}`);
          }
        });
    } catch (caughtError) {
      if (session.isRunning()) {
        session.stop("Live session stopped after a startup error.");
      }

      livePaintingSession = null;
      updateLiveButtons(false);
      updateLiveStateBadge("idle");
      setLiveStatus(getErrorMessage(caughtError));
      elements.liveTimingsText.textContent = getTechnicalErrorDetails(caughtError);
    }
  }

  function handleRefineLivePainting() {
    if (!livePaintingSession?.isRunning()) {
      setLiveStatus("Start a live session before refining.");
      return;
    }

    livePaintingSession.refineNow();
  }

  function handleStopLivePainting() {
    if (!livePaintingSession) {
      setLiveStatus("No live session is running.");
      return;
    }

    livePaintingSession.stop("Live session stopped.");
    livePaintingSession = null;
    updateLiveButtons(false);

    if (liveImportAutomatically && liveLastResult) {
      void handleImportLiveResult();
    }
  }

  function handleToggleLiveZoom() {
    livePreviewZoomed = !livePreviewZoomed;
    elements.liveResultPreviewPanel.classList.toggle("preview-zoomed", livePreviewZoomed);
    elements.liveZoomToggle.textContent = livePreviewZoomed ? "Zoom 1x" : "Zoom 2x";
    elements.liveZoomToggle.setAttribute("aria-pressed", String(livePreviewZoomed));
  }

  async function handleImportLiveResult() {
    if (!liveLastResult) {
      setLiveStatus("Generate a live result before importing.");
      return;
    }

    setLiveStatus("Importing live result into Photoshop...");

    try {
      const importedLayerName = await importGeneratedImageAsLayer({
        blob: liveLastResult.blob,
        originatingDocument: liveLastResult.originatingDocument,
        layerName: createLayerName("OpenLayer_Live"),
        onProgress: (message) => setLiveStatus(message)
      });
      setLiveStatus(`Imported layer: ${importedLayerName}`);
      flashImported(elements.liveStatusText);
    } catch (caughtError) {
      setLiveStatus(getErrorMessage(caughtError));
    }
  }

  async function handleImportLiveRefined() {
    if (!liveRefinedResult) {
      setLiveStatus("Generate a refined live result before importing.");
      return;
    }

    setLiveStatus("Importing refined live result into Photoshop...");

    try {
      const importedLayerName = await importGeneratedImageAsLayer({
        blob: liveRefinedResult.blob,
        originatingDocument: liveRefinedResult.originatingDocument,
        layerName: createLayerName("OpenLayer_LiveRefine"),
        onProgress: (message) => setLiveStatus(message)
      });
      setLiveStatus(`Imported layer: ${importedLayerName}`);
      flashImported(elements.liveStatusText);
    } catch (caughtError) {
      setLiveStatus(getErrorMessage(caughtError));
    }
  }

  function handleToggleLiveAutoImport() {
    liveImportAutomatically = !liveImportAutomatically;
    updateLiveAutoImportToggle(liveImportAutomatically);
    setLiveStatus(
      liveImportAutomatically
        ? "The latest live result will import automatically when the session stops."
        : "Live auto import is off."
    );
  }

  function updateLiveAutoImportToggle(isEnabled: boolean) {
    elements.liveAutoImportToggle.textContent = isEnabled ? "Auto Import On" : "Import Automatically";
    elements.liveAutoImportToggle.setAttribute("aria-pressed", String(isEnabled));
    elements.liveAutoImportToggle.classList.toggle("is-active", isEnabled);
  }

  function handleToggleLiveAutoRefine() {
    liveAutoRefine = !liveAutoRefine;
    updateLiveAutoRefineToggle(liveAutoRefine);
    setLiveStatus(
      liveAutoRefine
        ? "Auto refine will run after a 4-second painting pause in the next live session."
        : "Live auto refine is off."
    );
  }

  function updateLiveAutoRefineToggle(isEnabled: boolean) {
    elements.liveAutoRefineToggle.textContent = isEnabled ? "Auto Refine On" : "Auto Refine on Pause";
    elements.liveAutoRefineToggle.setAttribute("aria-pressed", String(isEnabled));
    elements.liveAutoRefineToggle.classList.toggle("is-active", isEnabled);
  }

  function setLiveStatus(message: string) {
    elements.liveStatusText.textContent = message;
  }

  function updateLiveButtons(isLive: boolean) {
    setActionDisabled(elements.liveStartButton, isLive);
    setActionDisabled(elements.liveStopButton, !isLive);
    setActionDisabled(elements.liveRefineButton, !isLive);
    setActionDisabled(elements.importLiveRefinedButton, !liveRefinedResult);
  }

  function updateLiveStateBadge(state: LivePaintingState) {
    const label = getLivePaintingStateBadgeLabel(state);
    elements.liveStateBadge.textContent = label;
    elements.liveStateBadge.classList.remove("idle", "live", "refining", "refined");
    elements.liveStateBadge.classList.add(label.toLowerCase());
  }

  function updateLivePreview(
    blob: Blob,
    originatingDocument: PhotoshopDocumentIdentity,
    recordLiveResult = true
  ) {
    // One persistent img element: swapping src avoids the rebuild flicker the
    // per-frame progress previews show elsewhere in the panel.
    if (!livePreviewImage) {
      elements.liveResultPreviewPanel.innerHTML = "";
      livePreviewImage = document.createElement("img");
      livePreviewImage.alt = "Live Painting preview";
      elements.liveResultPreviewPanel.append(livePreviewImage);
    }

    const previousUrl = livePreviewObjectUrl;
    livePreviewObjectUrl = objectUrls.create(blob);
    livePreviewImage.src = livePreviewObjectUrl;

    if (previousUrl) {
      objectUrls.revoke(previousUrl);
    }

    if (!recordLiveResult) {
      return;
    }

    liveLastResult = bindDocumentContext({ blob }, originatingDocument);
    setActionDisabled(elements.importLiveButton, false);
  }

  function setResult(nextResult: AppGeneratedImageResult | null) {
    result = nextResult;
    resultPanel.showResult(result?.blob ?? null);
    syncBusy();
  }

  function setProgressPreview(elements: AppElements, message: string, blob?: Blob) {
    resultPanel.showProgress(message, blob);
  }

  function setImageSource(nextSource: ImageSourceState | null) {
    imageSource = nextSource;
    imageSourcePanel.show(imageSource && {
      previewUrl: imageSource.previewUrl,
      title: imageSource.sourceName,
      meta: createSourceMetaText(imageSource)
    });
    updateImageCheckpointCompatibility(elements, allowExperimentalCheckpoints, imageSource);
    syncBusy();
  }

  function setImageResult(nextResult: AppGeneratedImageResult | null) {
    imageResult = nextResult;
    imageResultPanel.showResult(imageResult?.blob ?? null);
    syncBusy();
  }

  function setImageProgressPreview(elements: AppElements, message: string, blob?: Blob) {
    imageResultPanel.showProgress(message, blob);
  }

  function setSketchSource(nextSource: ImageSourceState | null) {
    sketchSource = nextSource;
    sketchSourcePanel.show(sketchSource && {
      previewUrl: sketchSource.previewUrl,
      title: sketchSource.sourceName,
      meta: createSourceMetaText(sketchSource)
    });
    updateSketchCheckpointCompatibility(elements, sketchSource);
    syncBusy();
  }

  function setSketchResult(nextResult: AppGeneratedImageResult | null) {
    sketchResult = nextResult;
    sketchResultPanel.showResult(sketchResult?.blob ?? null);
    syncBusy();
  }

  function setSketchProgressPreview(elements: AppElements, message: string, blob?: Blob) {
    sketchResultPanel.showProgress(message, blob);
  }

  function setInpaintSource(nextSource: InpaintSourceState | null) {
    inpaintSource = nextSource;
    inpaintSourcePanel.show(inpaintSource && {
      previewUrl: inpaintSource.previewUrl,
      title: inpaintSource.sourceName,
      meta: `${getInpaintSourceModeLabel(inpaintSource.sourceMode)} | ${createSourceMetaText(inpaintSource)} | Selection ${formatSelectionBounds(inpaintSource.selection.bounds)} | Context ${formatSelectionBounds(inpaintSource.selection.contextBounds)} | ${inpaintSource.sourceWarning}`
    });

    if (!inpaintSource) {
      inpaintMaskUrl.release();
      renderPreviewMessage(elements.inpaintMaskPreviewPanel, "source-empty", "Mask");
      elements.inpaintMaskMeta.textContent = "Mask export not available yet.";
    } else if (inpaintSource.mask) {
      renderPreviewImage(
        elements.inpaintMaskPreviewPanel,
        inpaintMaskUrl.createFrom(inpaintSource.mask.blob),
        "Captured Photoshop selection mask"
      );
      elements.inpaintMaskMeta.textContent = `${inpaintSource.mask.width} x ${inpaintSource.mask.height} | PNG/lossless mask`;
    } else {
      inpaintMaskUrl.release();
      renderPreviewMessage(elements.inpaintMaskPreviewPanel, "source-empty", "N/A");
      elements.inpaintMaskMeta.textContent = inpaintSource.maskMessage;
    }

    updateInpaintCheckpointCompatibility(elements, inpaintSource);
    syncBusy();
  }

  function setInpaintResult(nextResult: AppGeneratedImageResult | null) {
    if (!nextResult) {
      activeInpaintImportContext = null;
    }

    inpaintResult = nextResult;
    inpaintResultPanel.showResult(inpaintResult?.blob ?? null);
    syncBusy();
  }

  function setInpaintProgressPreview(elements: AppElements, message: string, blob?: Blob) {
    inpaintResultPanel.showProgress(message, blob);
  }

  function setOutpaintSource(nextSource: ImageSourceState | null) {
    outpaintSource = nextSource;
    outpaintSourcePanel.show(outpaintSource && {
      previewUrl: outpaintSource.previewUrl,
      title: outpaintSource.sourceName,
      meta: createSourceMetaText(outpaintSource)
    });
    updateOutpaintCheckpointCompatibility(elements, outpaintSource);
    syncBusy();
  }

  function setOutpaintResult(nextResult: AppGeneratedImageResult | null) {
    if (!nextResult) {
      activeOutpaintImportContext = null;
    }

    outpaintResult = nextResult;
    outpaintResultPanel.showResult(outpaintResult?.blob ?? null);
    syncBusy();
  }

  function setOutpaintProgressPreview(elements: AppElements, message: string, blob?: Blob) {
    outpaintResultPanel.showProgress(message, blob);
  }

  function setUpscaleSource(nextSource: ImageSourceState | null) {
    upscaleSource = nextSource;
    upscaleSourcePanel.show(upscaleSource && {
      previewUrl: upscaleSource.previewUrl,
      title: upscaleSource.sourceName,
      meta: createSourceMetaText(upscaleSource)
    });
    updateUpscaleCompatibility(elements, upscaleSource);
    syncBusy();
  }

  function setUpscaleResult(nextResult: AppGeneratedImageResult | null) {
    upscaleResult = nextResult;
    upscaleResultPanel.showResult(upscaleResult?.blob ?? null);
    syncBusy();
  }

  function setUpscaleProgressPreview(elements: AppElements, message: string, blob?: Blob) {
    upscaleResultPanel.showProgress(message, blob);
  }

  function setPromptLayerSource(nextSource: ImageSourceState | null) {
    promptLayerSource = nextSource;
    promptLayerSourcePanel.show(promptLayerSource && {
      previewUrl: promptLayerSource.previewUrl,
      title: promptLayerSource.sourceName,
      meta: createSourceMetaText(promptLayerSource)
    });
  }

  function setView(view: AppView) {
    currentView = view;
    elements.homeView.hidden = currentView !== "home";
    elements.generatorView.hidden = currentView !== "text-to-image";
    elements.imageToImageView.hidden = currentView !== "image-to-image";
    elements.sketchToImageView.hidden = currentView !== "sketch-to-image";
    elements.inpaintView.hidden = currentView !== "inpaint";
    elements.outpaintView.hidden = currentView !== "outpaint";
    elements.promptFromLayerView.hidden = currentView !== "prompt-from-layer";
    elements.upscaleView.hidden = currentView !== "upscale";
    elements.livePaintingView.hidden = currentView !== "live-painting";
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


function setBusy(
  elements: AppElements,
  isBusy: boolean,
  busyTool: HistoryToolType | null,
  gates: Record<BusyGateName, unknown>
) {
  for (const [groupName, fieldKeys] of Object.entries(BUSY_DISABLED_FIELD_GROUPS)) {
    const isGroupBusy = isBusy && (groupName === "global" || groupName === busyTool);

    for (const fieldKey of fieldKeys) {
      elements[fieldKey].disabled = isGroupBusy;
    }
  }

  for (const actionKey of BUSY_ALWAYS_DISABLED_ACTIONS) {
    setActionDisabled(elements[actionKey], isBusy);
  }

  for (const cancelButton of elements.cancelGenerationButtons) {
    setActionDisabled(cancelButton, !isBusy || cancelButton.hidden);
  }

  for (const { button, gate } of BUSY_GATED_ACTIONS) {
    setActionDisabled(elements[button], isBusy || !gates[gate]);
  }
}

// Flux Fill ignores the panel's steps/cfg/denoise, so those controls are
// disabled while it is selected: still disabled during an Inpaint operation,
// and still disabled afterwards for as long as Flux Fill is chosen.
// Must be re-applied anywhere the inpaint workflow selection changes, and after
// setBusy, which re-enables every field in its table once a run ends.
function updateInpaintReferenceControlLock(elements: AppElements, isBusy = false) {
  const isReferenceLocked = presetLocksSamplerControls(
    readSelectValue(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW)
  );

  for (const input of [elements.inpaintSteps, elements.inpaintCfg, elements.inpaintDenoise]) {
    input.disabled = isBusy || isReferenceLocked;
    input.classList.toggle("is-reference-locked", isReferenceLocked);
  }

  elements.inpaintLockedSettingsNote.hidden = !isReferenceLocked;
  elements.inpaintLockedSettingsNote.textContent = isReferenceLocked ? formatFluxFillLockedControlsNote() : "";
}

function setCancelGenerationVisible(elements: AppElements, isVisible: boolean) {
  for (const cancelButton of elements.cancelGenerationButtons) {
    cancelButton.hidden = !isVisible;
    setActionDisabled(cancelButton, !isVisible);
  }
}

function setStatusProgress(progressElement: HTMLElement, status: string, tone: StatusTone) {
  const normalizedStatus = status.trim().toLowerCase();
  const isBusy =
    tone === "idle" &&
    normalizedStatus !== "ready" &&
    normalizedStatus !== "ready." &&
    !normalizedStatus.includes("complete") &&
    !normalizedStatus.includes("copied") &&
    !normalizedStatus.includes("saved") &&
    !normalizedStatus.includes("reset") &&
    !normalizedStatus.includes("cancel");

  const fill = progressElement.firstElementChild as HTMLElement | null;
  const resolved = resolveStatusProgress(status, isBusy, statusProgressLastPercent.get(progressElement) ?? null);

  if (!resolved.isBusy) {
    const existingTimer = statusProgressTimers.get(progressElement);
    if (existingTimer) {
      window.clearInterval(existingTimer);
      statusProgressTimers.delete(progressElement);
    }

    statusProgressLastPercent.delete(progressElement);
    progressElement.hidden = true;
    progressElement.className = "status-progress";
    progressElement.style.removeProperty("--ol-progress");

    if (fill) {
      fill.style.marginLeft = "";
      fill.style.width = "";
    }
    progressElement.removeAttribute("data-progress-offset");
    progressElement.removeAttribute("data-progress-label");
    return;
  }

  const stickyPercent = resolved.percent;

  progressElement.hidden = false;
  progressElement.className = `status-progress is-active${stickyPercent !== null ? " is-determinate" : ""}`;

  if (stickyPercent !== null) {
    renderDeterminateProgress(progressElement, stickyPercent);
    return;
  }

  progressElement.style.removeProperty("--ol-progress");

  progressElement.removeAttribute("data-progress-label");

  if (statusProgressTimers.get(progressElement)) {
    return;
  }

  let offset = -42;
  const timer = window.setInterval(() => {
    offset = offset >= 110 ? -42 : offset + 7;
    progressElement.setAttribute("data-progress-offset", String(offset));

    if (fill) {
      fill.style.marginLeft = `${offset}%`;
      fill.style.width = "42%";
    }
  }, 120);

  statusProgressTimers.set(progressElement, timer);
}

function renderDeterminateProgress(progressElement: HTMLElement, percent: number) {
  const fill = progressElement.firstElementChild as HTMLElement | null;
  const existingTimer = statusProgressTimers.get(progressElement);

  if (existingTimer) {
    window.clearInterval(existingTimer);
    statusProgressTimers.delete(progressElement);
  }

  statusProgressLastPercent.set(progressElement, percent);
  progressElement.hidden = false;
  progressElement.className = "status-progress is-active is-determinate";
  // The determinate fill width is driven by a CSS variable so it beats the
  // legacy "width: 42% !important" indeterminate rule without inline hacks.
  progressElement.style.setProperty("--ol-progress", `${percent}%`);

  if (fill) {
    fill.style.marginLeft = "";
    fill.style.width = "";
  }

  progressElement.removeAttribute("data-progress-offset");
  progressElement.setAttribute("data-progress-label", `${percent}%`);
}

// Dedicated numeric progress entry point driven by the ComfyUI WebSocket
// progress channel, independent of the human-readable status text.
function applyDeterminateProgress(progressElement: HTMLElement, value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return;
  }

  renderDeterminateProgress(progressElement, Math.max(0, Math.min(100, Math.round((value / max) * 100))));
}

export type StatusProgressState = {
  isBusy: boolean;
  // null while busy = indeterminate warm-up animation; a number = determinate fill.
  percent: number | null;
};

// Pure resolver for the progress bar. Keeps a determinate bar determinate once
// real step progress has arrived: percent-less status updates (the history
// poll tick, "Retrieving image...") hold the last known percent instead of
// collapsing the bar back to the indeterminate warm-up animation.
export function resolveStatusProgress(
  status: string,
  isBusy: boolean,
  lastPercent: number | null
): StatusProgressState {
  if (!isBusy) {
    return { isBusy: false, percent: null };
  }

  const parsedPercent = readProgressPercent(status);
  const percent = parsedPercent ?? lastPercent;

  return { isBusy: true, percent: percent ?? null };
}

function readProgressPercent(status: string) {
  const percentMatch = status.match(/(\d{1,3})(?:\.\d+)?\s*%/);

  if (percentMatch) {
    return clampProgressPercent(Number(percentMatch[1]));
  }

  const stepMatch = status.match(/step\s+(\d+)\s+of\s+(\d+)/i);

  if (stepMatch) {
    const value = Number(stepMatch[1]);
    const max = Number(stepMatch[2]);

    if (Number.isFinite(value) && Number.isFinite(max) && max > 0) {
      return clampProgressPercent(Math.round((value / max) * 100));
    }
  }

  const fractionMatch = status.match(/\b(\d+)\s*\/\s*(\d+)\b/);

  if (fractionMatch) {
    const value = Number(fractionMatch[1]);
    const max = Number(fractionMatch[2]);

    if (Number.isFinite(value) && Number.isFinite(max) && max > 0) {
      return clampProgressPercent(Math.round((value / max) * 100));
    }
  }

  return null;
}

function clampProgressPercent(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

function flashImported(statusTextElement: HTMLElement) {
  const target = (statusTextElement.closest(".status-bar") as HTMLElement | null) ?? statusTextElement;
  target.classList.remove("ol-import-flash");
  void target.offsetWidth;
  target.classList.add("ol-import-flash");
  window.setTimeout(() => target.classList.remove("ol-import-flash"), 900);
}

function applyStatusPill(pill: HTMLElement, status: string, tone: StatusTone) {
  if (tone === "error") {
    pill.textContent = "Error";
    pill.className = "status-pill error";
    return;
  }

  if (tone === "ready") {
    pill.textContent = "Ready";
    pill.className = "status-pill ready";
    return;
  }

  const normalized = status.trim().toLowerCase();
  const isWorking =
    normalized !== "" &&
    normalized !== "ready" &&
    normalized !== "ready." &&
    !normalized.includes("complete") &&
    !normalized.includes("copied") &&
    !normalized.includes("saved") &&
    !normalized.includes("reset") &&
    !normalized.includes("cancelled");

  if (isWorking) {
    pill.textContent = "Working";
    pill.className = "status-pill working";
    return;
  }

  pill.textContent = "Ready";
  pill.className = "status-pill idle";
}

function updateHomeStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.homeStatusText.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : status.replace(/\.$/, "");
  // The text color defaults to the success green; only an error overrides it,
  // so Ready and in-progress statuses keep their familiar look.
  elements.homeStatusText.classList.toggle("is-error", tone === "error");
  elements.homeStatusDot.className = `home-status-dot ${tone}`;
}

function applyToolStatus(
  elements: AppElements,
  text: HTMLElement,
  pill: HTMLElement,
  progress: HTMLElement,
  status: string,
  tone: StatusTone
) {
  text.textContent = status;
  applyStatusPill(pill, status, tone);
  setStatusProgress(progress, status, tone);
  updateHomeStatus(elements, status, tone);
}

// The Text to Image status doubles as the global one: it broadcasts to every
// tool's status bar plus the settings screen. The per-tool setters below touch
// only their own bar and the home indicator.
function setStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.statusText.textContent = status;
  applyStatusPill(elements.statusPill, status, tone);
  setStatusProgress(elements.statusProgress, status, tone);
  applyToolStatus(elements, elements.imgStatusText, elements.imgStatusPill, elements.imgStatusProgress, status, tone);
  applyToolStatus(elements, elements.sketchStatusText, elements.sketchStatusPill, elements.sketchStatusProgress, status, tone);
  applyToolStatus(elements, elements.inpaintStatusText, elements.inpaintStatusPill, elements.inpaintStatusProgress, status, tone);
  applyToolStatus(elements, elements.outpaintStatusText, elements.outpaintStatusPill, elements.outpaintStatusProgress, status, tone);
  applyToolStatus(elements, elements.upscaleStatusText, elements.upscaleStatusPill, elements.upscaleStatusProgress, status, tone);
  applyToolStatus(elements, elements.promptLayerStatusText, elements.promptLayerStatusPill, elements.promptLayerStatusProgress, status, tone);
  applyToolStatus(elements, elements.settingsStatusText, elements.settingsStatusPill, elements.settingsStatusProgress, status, tone);
}

function setImageStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.imgStatusText, elements.imgStatusPill, elements.imgStatusProgress, status, tone);
}

function setSketchStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.sketchStatusText, elements.sketchStatusPill, elements.sketchStatusProgress, status, tone);
}

function setInpaintStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.inpaintStatusText, elements.inpaintStatusPill, elements.inpaintStatusProgress, status, tone);
}

function setOutpaintStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.outpaintStatusText, elements.outpaintStatusPill, elements.outpaintStatusProgress, status, tone);
}

function setUpscaleStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.upscaleStatusText, elements.upscaleStatusPill, elements.upscaleStatusProgress, status, tone);
}

function setPromptLayerStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.promptLayerStatusText, elements.promptLayerStatusPill, elements.promptLayerStatusProgress, status, tone);
}

function applyToolError(errorMessage: HTMLElement, message: string) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function setError(elements: AppElements, message: string) {
  applyToolError(elements.errorMessage, message);
  applyToolError(elements.settingsErrorMessage, message);
}

function setImageError(elements: AppElements, message: string) {
  applyToolError(elements.imgErrorMessage, message);
}

function setSketchError(elements: AppElements, message: string) {
  applyToolError(elements.sketchErrorMessage, message);
}

function setInpaintError(elements: AppElements, message: string) {
  applyToolError(elements.inpaintErrorMessage, message);
}

function setOutpaintError(elements: AppElements, message: string) {
  applyToolError(elements.outpaintErrorMessage, message);
}

function setUpscaleError(elements: AppElements, message: string) {
  applyToolError(elements.upscaleErrorMessage, message);
}

function setPromptLayerError(elements: AppElements, message: string) {
  applyToolError(elements.promptLayerErrorMessage, message);
}

function setDiagnostics(elements: AppElements, message: string) {
  elements.diagnosticsText.textContent = message;
  elements.imgDiagnosticsText.textContent = message;
  elements.sketchDiagnosticsText.textContent = message;
  elements.inpaintDiagnosticsText.textContent = message;
  elements.outpaintDiagnosticsText.textContent = message;
  elements.upscaleDiagnosticsText.textContent = message;
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

function setOutpaintDiagnostics(elements: AppElements, message: string) {
  elements.outpaintDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

function setUpscaleDiagnostics(elements: AppElements, message: string) {
  elements.upscaleDiagnosticsText.textContent = message;
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

function updateImg2ImgAutoImportToggle(elements: AppElements, isEnabled: boolean) {
  elements.imgAutoImportToggle.textContent = isEnabled ? "Auto Import On" : "Import Automatically";
  elements.imgAutoImportToggle.setAttribute("aria-pressed", String(isEnabled));
  elements.imgAutoImportToggle.classList.toggle("is-active", isEnabled);
}

function updateUpscaleAutoImportToggle(elements: AppElements, isEnabled: boolean) {
  elements.upscaleAutoImportToggle.textContent = isEnabled ? "Auto Import On" : "Import Automatically";
  elements.upscaleAutoImportToggle.setAttribute("aria-pressed", String(isEnabled));
  elements.upscaleAutoImportToggle.classList.toggle("is-active", isEnabled);
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

function updateOutpaintCheckpointCompatibility(elements: AppElements, source: ImageSourceState | null = null) {
  const checkpointName = readSelectValue(elements.outpaintCheckpoint);
  const preset = getWorkflowPreset(readSelectValue(elements.outpaintWorkflow, DEFAULT_OUTPAINT_WORKFLOW));
  const message = createWorkflowDiagnosticMessage(preset, {
    selectedModelName: checkpointName,
    photoshopInputs: createSourceInputAvailability(source)
  });

  elements.outpaintCompatibilityNote.textContent = formatWorkflowDiagnosticMessage(message);
  elements.outpaintCompatibilityNote.classList.toggle("is-warning", true);
  updateSettingsReport(elements);
}

function updateUpscaleCompatibility(elements: AppElements, source: ImageSourceState | null = null) {
  const modelName = readSelectValue(elements.upscaleModel);
  const preset = getWorkflowPreset(readSelectValue(elements.upscaleWorkflow, DEFAULT_UPSCALE_WORKFLOW));
  const message = createWorkflowDiagnosticMessage(preset, {
    selectedModelName: modelName,
    photoshopInputs: createSourceInputAvailability(source)
  });

  elements.upscaleCompatibilityNote.textContent = `${formatWorkflowDiagnosticMessage(message)} Pixel/model upscale only; prompts are not used.`;
  elements.upscaleCompatibilityNote.classList.toggle("is-warning", message.isWarning || preset.status === "experimental");
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

function getSaveImageNodeId(preset: WorkflowPresetDefinition) {
  return preset.requiredNodes.find((node) => node.classType === "SaveImage")?.id;
}

function getTextOutputNodeId(preset: WorkflowPresetDefinition) {
  return preset.requiredNodes.find((node) => node.classType.startsWith("ShowText"))?.id;
}

function readPromptLayerTask(elements: AppElements) {
  const selectedTask = readSelectValue(elements.promptLayerTask, DEFAULT_PROMPT_LAYER_TASK);
  const knownTask = PROMPT_LAYER_TASKS.find((task) => task.value === selectedTask);

  return knownTask?.value ?? DEFAULT_PROMPT_LAYER_TASK;
}

function readPromptLayerNumBeams(elements: AppElements) {
  const parsed = Number.parseInt(elements.promptLayerNumBeams.value, 10);

  if (Number.isFinite(parsed)) {
    return Math.min(Math.max(parsed, 1), 32);
  }

  return Number.parseInt(DEFAULT_PROMPT_LAYER_NUM_BEAMS, 10);
}

function createRandomSeed() {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

function snapDimensionToLatentGrid(value: number) {
  return Math.max(64, Math.round(value / 8) * 8);
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
  | "cancelGeneration"
  | "import"
  | "captureImageSource"
  | "captureCanvasSource"
  | "toggleExperimentalCheckpoints"
  | "generateImg2Img"
  | "importImg2Img"
  | "toggleImg2ImgAutoImport"
  | "captureSketchSource"
  | "captureSketchCanvasSource"
  | "generateSketch"
  | "importSketch"
  | "captureInpaintSelection"
  | "captureInpaintActiveLayer"
  | "generateInpaint"
  | "importInpaint"
  | "captureOutpaintSource"
  | "captureOutpaintCanvasSource"
  | "generateOutpaint"
  | "importOutpaint"
  | "capturePromptLayerSource"
  | "capturePromptCanvasSource"
  | "generatePromptFromLayer"
  | "copyPromptFromLayer"
  | "sendPromptToTextToImage"
  | "captureUpscaleSource"
  | "captureUpscaleCanvasSource"
  | "generateUpscale"
  | "importUpscale"
  | "toggleUpscaleAutoImport"
  | "clearHistory"
  | "startLivePainting"
  | "stopLivePainting"
  | "refineLivePainting"
  | "toggleLiveZoom"
  | "importLiveResult"
  | "importLiveRefined"
  | "toggleLiveAutoImport"
  | "toggleLiveAutoRefine";
type HistoryActionName = "preview" | "import" | "reuse";
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

  // A single "click" binding avoids the old pointerup+click double-fire.
  element.addEventListener("click", (event) => runFromEvent("click", event));

  element.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if ((key === "Enter" || key === " ") && !isActionDisabled(element)) {
      event.preventDefault();
      run(`keyboard:${key === " " ? "space" : key}`);
    }
  });
}

function bindDelegatedActions(rootElement: HTMLElement, actionHandlers: ActionHandlers) {
  rootElement.addEventListener(
    "click",
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
      actionHandlers[actionName]("click");
    },
    true
  );
}

function bindDocumentActions(rootElement: HTMLElement, actionHandlers: ActionHandlers) {
  document.addEventListener(
    "click",
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
      actionHandlers[actionName]("document:click");
    },
    true
  );
}

function bindHomeSectionToggles(rootElement: HTMLElement) {
  let lastRunAt = 0;

  const runFromEvent = (event: Event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const header = target.closest("[data-openlayer-section-toggle]") as HTMLElement | null;

    if (!header || !rootElement.contains(header)) {
      return;
    }

    const section = header.closest(".home-section") as HTMLElement | null;
    const body = section?.querySelector<HTMLElement>(".ol-section-body");

    if (!section || !body) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 220) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();
    event.stopPropagation();
    const isOpen = section.classList.toggle("is-open");
    header.setAttribute("aria-expanded", isOpen ? "true" : "false");
    body.hidden = !isOpen;
  };

  rootElement.addEventListener("click", runFromEvent, true);

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(event);
    }
  });
}

function bindDetailSectionToggles(rootElement: HTMLElement) {
  let lastRunAt = 0;

  rootElement.querySelectorAll<HTMLElement>(".panel-section > .section-heading").forEach((header) => {
    const section = header.parentElement;

    if (!section || section.classList.contains("home-section")) {
      return;
    }

    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", "true");
    header.setAttribute("data-openlayer-detail-toggle", "true");
    section.classList.add("is-open");
  });

  const runFromEvent = (event: Event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const header = target.closest("[data-openlayer-detail-toggle]") as HTMLElement | null;

    if (!header || !rootElement.contains(header)) {
      return;
    }

    const section = header.parentElement as HTMLElement | null;

    if (!section) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 250) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();
    const isOpen = section.classList.toggle("is-open");
    section.classList.toggle("is-collapsed", !isOpen);
    header.setAttribute("aria-expanded", isOpen ? "true" : "false");
  };

  rootElement.addEventListener("click", runFromEvent, true);

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(event);
    }
  });
}

function bindInfoToggles(rootElement: HTMLElement) {
  let lastRunAt = 0;

  const runFromEvent = (event: Event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const toggle = target.closest("[data-openlayer-info-toggle]") as HTMLElement | null;

    if (!toggle || !rootElement.contains(toggle)) {
      return;
    }

    const targetId = toggle.getAttribute("data-openlayer-info-toggle");
    const panel = targetId ? rootElement.querySelector<HTMLElement>(`#${targetId}`) : null;

    if (!panel) {
      return;
    }

    const now = Date.now();

    if (now - lastRunAt < 250) {
      return;
    }

    lastRunAt = now;
    event.preventDefault();
    const shouldShow = panel.hidden;
    panel.hidden = !shouldShow;
    toggle.classList.toggle("is-active", shouldShow);
    toggle.setAttribute("aria-expanded", shouldShow ? "true" : "false");
  };

  rootElement.addEventListener("click", runFromEvent, true);

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(event);
    }
  });
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

  rootElement.addEventListener("click", (event) => runFromEvent("click", event), true);

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

  rootElement.addEventListener("click", (event) => runFromEvent("click", event), true);

  rootElement.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;

    if (key === "Enter" || key === " ") {
      runFromEvent(`keyboard:${key === " " ? "space" : key}`, event);
    }
  });
}

function bindToolWarnings(rootElement: HTMLElement) {
  // Replace the always-on orange experimental banner with a small orange info
  // button in the screen header that reveals the note only when clicked.
  const warnings = Array.from(rootElement.querySelectorAll<HTMLElement>(".tool-warning"));

  for (const warning of warnings) {
    const view = warning.closest("section");
    const titleBlock = view?.querySelector<HTMLElement>(".screen-title-block");

    if (!titleBlock) {
      continue;
    }

    warning.hidden = true;

    const info = document.createElement("button");
    info.type = "button";
    info.className = "tool-info-button";
    info.textContent = "i";
    info.setAttribute("aria-label", "Show experimental notes");
    info.setAttribute("aria-expanded", "false");
    titleBlock.appendChild(info);

    info.addEventListener("click", () => {
      const show = warning.hidden;
      warning.hidden = !show;
      info.setAttribute("aria-expanded", String(show));
      info.classList.toggle("is-active", show);
    });
  }
}

function bindStickyProgress(rootElement: HTMLElement) {
  // Wrap each screen's back/title nav and its progress bar in one sticky
  // header so live progress stays visible even after scrolling down the form.
  const navs = Array.from(rootElement.querySelectorAll<HTMLElement>(".screen-nav"));

  for (const nav of navs) {
    const view = nav.closest("section");

    if (!view) {
      continue;
    }

    const head = document.createElement("div");
    head.className = "screen-head";
    nav.before(head);
    head.appendChild(nav);

    const progress = view.querySelector<HTMLElement>(".status-progress");

    if (progress) {
      head.appendChild(progress);
    }
  }
}

function bindAdvancedToggles(rootElement: HTMLElement) {
  // Hide the sampler-tuning grid (steps/CFG/seed and friends) behind an
  // "Advanced settings" disclosure so each screen leads with prompt + model.
  const grids = Array.from(rootElement.querySelectorAll<HTMLElement>(".settings-grid")).filter((grid) =>
    grid.querySelector('input[id$="steps"], input[id$="cfg"], input[id$="seed"], input[id$="guidance"]')
  );

  for (const grid of grids) {
    const parent = grid.parentElement;

    if (!parent) {
      continue;
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "advanced-toggle";
    toggle.setAttribute("aria-expanded", "false");
    // Plain-text caret (UXP does not render triangle/emoji glyphs reliably).
    toggle.textContent = "+ Advanced settings";

    const body = document.createElement("div");
    body.className = "advanced-body";
    body.hidden = true;

    parent.insertBefore(toggle, grid);
    parent.insertBefore(body, grid);
    body.appendChild(grid);

    // A sibling expansion grid (Outpaint padding stays visible) is left in place.
    toggle.addEventListener("click", () => {
      const shouldOpen = body.hidden;
      body.hidden = !shouldOpen;
      toggle.setAttribute("aria-expanded", String(shouldOpen));
      toggle.classList.toggle("is-open", shouldOpen);
      toggle.textContent = shouldOpen ? "− Advanced settings" : "+ Advanced settings";
    });
  }
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
    void openExternalUrl(url);
    console.log(`[OpenLayer] external link opened from ${eventName}: ${url}`);
  };

  rootElement.addEventListener("click", (event) => runFromEvent("click", event), true);

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

async function openExternalUrl(url: string) {
  try {
    const uxp = require("uxp") as UxpModule;

    if (uxp.shell?.openExternal) {
      await uxp.shell.openExternal(url);
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

async function refreshOutpaintModelOptionsForSelectedPreset(
  elements: AppElements,
  client = new ComfyClient(elements.serverUrl.value),
  preferredValue = readSelectValue(elements.outpaintCheckpoint)
) {
  const preset = getWorkflowPreset(readSelectValue(elements.outpaintWorkflow, DEFAULT_OUTPAINT_WORKFLOW));

  try {
    const modelNames = await client.getModelNamesForPreset(preset);

    if (modelNames.length > 0) {
      const preferredPresetModel = preset.modelStack?.find(
        (model) => model.kind === preset.modelSource.kind && modelNames.includes(model.modelName)
      )?.modelName;
      const preferredModel = modelNames.includes(preferredValue) ? preferredValue : preferredPresetModel;

      fillSingleCheckpointSelect(elements.outpaintCheckpoint, modelNames, preferredModel);
    }
  } catch {
    // Keep the existing list if ComfyUI is offline or the diffusion model source is unavailable.
  }

  updateOutpaintCheckpointCompatibility(elements);
}

async function refreshUpscaleModelOptionsForSelectedPreset(
  elements: AppElements,
  client = new ComfyClient(elements.serverUrl.value),
  preferredValue = readSelectValue(elements.upscaleModel)
) {
  const preset = getWorkflowPreset(readSelectValue(elements.upscaleWorkflow, DEFAULT_UPSCALE_WORKFLOW));

  try {
    const modelNames = await client.getModelNamesForPreset(preset);

    if (modelNames.length > 0) {
      const preferredPresetModel = preset.requiredModels?.find(
        (model) => modelNames.includes(model.modelName)
      )?.modelName;
      const preferredModel = modelNames.includes(preferredValue) ? preferredValue : preferredPresetModel;

      fillSingleCheckpointSelect(elements.upscaleModel, modelNames, preferredModel);
    }
  } catch {
    // Keep the existing list if ComfyUI is offline or the upscale model source is unavailable.
  }

  updateUpscaleCompatibility(elements);
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
  fillSingleCheckpointSelect(elements.outpaintCheckpoint, checkpoints, preferredValue);
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

function ensureCoreSelectDefaults(elements: AppElements) {
  ensureSelectOption(elements.imgWorkflow, DEFAULT_IMAGE_WORKFLOW);
  ensureSelectOption(elements.sketchWorkflow, DEFAULT_SKETCH_WORKFLOW);
  ensureSelectOption(elements.inpaintWorkflow, DEFAULT_INPAINT_WORKFLOW);
  ensureSelectOption(elements.outpaintWorkflow, DEFAULT_OUTPAINT_WORKFLOW);
  ensureSelectOption(elements.upscaleWorkflow, DEFAULT_UPSCALE_WORKFLOW);

  ensureSelectOption(elements.imgCheckpoint, FALLBACK_CHECKPOINTS[0]);
  ensureSelectOption(elements.sketchCheckpoint, RECOMMENDED_SKETCH_CHECKPOINT);
  ensureSelectOption(elements.inpaintCheckpoint, FALLBACK_CHECKPOINTS[0]);
  ensureSelectOption(elements.outpaintCheckpoint, "flux1-fill-dev.safetensors");
  ensureSelectOption(elements.upscaleModel, FALLBACK_UPSCALE_MODELS[0]);
}

function ensureSelectOption(select: HTMLSelectElement, value: string, label = value) {
  if (!value) {
    return;
  }

  const hasOption = Array.from(select.options).some((option) => option.value === value);

  if (!hasOption) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }

  if (!readSelectValue(select)) {
    select.value = value;
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

function getOutpaintFailureHint(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("outpaint-flux-fill-basic.json") || details.includes("outpaint workflow json")) {
    return "The bundled Outpaint workflow file was not found in this build. Rebuild OpenLayer and reload the plugin.";
  }

  if (
    details.includes("imagepadforoutpaint") ||
    details.includes("differentialdiffusion") ||
    details.includes("fluxguidance") ||
    details.includes("unetloader") ||
    details.includes("dualcliploader") ||
    details.includes("missing node")
  ) {
    return "This Outpaint workflow needs the local Flux Fill node stack, including ImagePadForOutpaint, DifferentialDiffusion, FluxGuidance, UNETLoader, DualCLIPLoader, VAELoader, and KSampler.";
  }

  if (
    details.includes("text encoder") ||
    details.includes("t5") ||
    details.includes("clip_l") ||
    details.includes("vae") ||
    details.includes("ae.safetensors")
  ) {
    return "Flux Fill Outpaint needs flux1-fill-dev.safetensors, clip_l.safetensors, t5xxl_fp16.safetensors or the accepted fp8 fallback, and ae.safetensors.";
  }

  const message = getTechnicalErrorDetails(error);
  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}

function getFriendlyOutpaintErrorMessage(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("outpaint-flux-fill-basic.json") || details.includes("outpaint workflow json")) {
    return "Outpaint workflow file missing from this build.";
  }

  if (
    details.includes("imagepadforoutpaint") ||
    details.includes("differentialdiffusion") ||
    details.includes("fluxguidance") ||
    details.includes("unetloader") ||
    details.includes("dualcliploader") ||
    details.includes("missing node")
  ) {
    return "The Outpaint workflow needs matching Flux Fill ComfyUI nodes.";
  }

  return getErrorMessage(error);
}

function getUpscaleFailureHint(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (details.includes("upscale-basic.json") || details.includes("workflow file")) {
    return "The bundled upscale-basic workflow file was not found in this build. Rebuild OpenLayer and reload the plugin.";
  }

  if (
    details.includes("upscalemodelloader") ||
    details.includes("imageupscalewithmodel") ||
    details.includes("loadimage") ||
    details.includes("missing node")
  ) {
    return "This Upscale preset needs ComfyUI's LoadImage, UpscaleModelLoader, ImageUpscaleWithModel, and SaveImage nodes.";
  }

  if (
    details.includes("4x-ultrasharp") ||
    details.includes("realesrgan") ||
    details.includes("upscale model") ||
    details.includes("not found")
  ) {
    return "Install an upscale model such as 4x-UltraSharp.pth or RealESRGAN_x4plus.pth, then click Check ComfyUI again.";
  }

  const message = getTechnicalErrorDetails(error);
  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}

function getFriendlyUpscaleErrorMessage(error: unknown) {
  const details = getTechnicalErrorDetails(error).toLowerCase();

  if (
    details.includes("upscalemodelloader") ||
    details.includes("imageupscalewithmodel") ||
    details.includes("missing node")
  ) {
    return "The Upscale workflow needs matching ComfyUI upscale nodes.";
  }

  if (
    details.includes("4x-ultrasharp") ||
    details.includes("realesrgan") ||
    details.includes("upscale model") ||
    details.includes("not found")
  ) {
    return "The selected upscale model was not found in ComfyUI.";
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

function applyRecommendedPresetSettings(
  workflowSelect: HTMLSelectElement,
  defaultPresetId: string,
  stepsInput: HTMLInputElement,
  cfgInput: HTMLInputElement
) {
  const recommended = getRecommendedPresetSettings(readSelectValue(workflowSelect, defaultPresetId));

  stepsInput.value = String(recommended.steps);
  cfgInput.value = String(recommended.cfg);
}

function setSelectValueIfPresent(select: HTMLSelectElement, value: string) {
  if (!value) {
    return false;
  }

  const matchingOption = Array.from(select.options).find((option) => option.value === value);

  if (!matchingOption) {
    return false;
  }

  select.value = value;
  return true;
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

function applyValidatedOutpaintSettings(elements: AppElements, settings: {
  steps: number;
  cfg: number;
  seed: number;
  denoise: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  feathering: number;
}) {
  elements.outpaintSteps.value = String(settings.steps);
  elements.outpaintGuidance.value = String(settings.cfg);
  elements.outpaintSeed.value = String(settings.seed);
  elements.outpaintDenoise.value = String(settings.denoise);
  elements.outpaintLeft.value = String(settings.left);
  elements.outpaintTop.value = String(settings.top);
  elements.outpaintRight.value = String(settings.right);
  elements.outpaintBottom.value = String(settings.bottom);
  elements.outpaintFeathering.value = String(settings.feathering);
}

function applyPreferences(elements: AppElements, preferences: Partial<OpenLayerPreferences>) {
  if (preferences.serverUrl) {
    elements.serverUrl.value = preferences.serverUrl;
  }

  elements.settingsThemeSelect.value = preferences.theme || DEFAULT_THEME;

  if (preferences.workflow) {
    elements.workflow.value = preferences.workflow;
  }

  elements.imgWorkflow.value = DEFAULT_IMAGE_WORKFLOW;
  elements.sketchWorkflow.value = DEFAULT_SKETCH_WORKFLOW;
  elements.inpaintWorkflow.value = DEFAULT_INPAINT_WORKFLOW;
  elements.outpaintWorkflow.value = DEFAULT_OUTPAINT_WORKFLOW;
  elements.upscaleWorkflow.value = DEFAULT_UPSCALE_WORKFLOW;

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
  elements.settingsThemeSelect.value = DEFAULT_THEME;
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
  elements.outpaintWorkflow.value = DEFAULT_OUTPAINT_WORKFLOW;
  elements.outpaintSteps.value = DEFAULT_OUTPAINT_STEPS;
  elements.outpaintGuidance.value = DEFAULT_OUTPAINT_GUIDANCE;
  elements.outpaintSeed.value = "";
  elements.outpaintDenoise.value = DEFAULT_OUTPAINT_DENOISE;
  elements.outpaintLeft.value = DEFAULT_OUTPAINT_LEFT;
  elements.outpaintTop.value = DEFAULT_OUTPAINT_TOP;
  elements.outpaintRight.value = DEFAULT_OUTPAINT_RIGHT;
  elements.outpaintBottom.value = DEFAULT_OUTPAINT_BOTTOM;
  elements.outpaintFeathering.value = DEFAULT_OUTPAINT_FEATHERING;
  elements.upscaleWorkflow.value = DEFAULT_UPSCALE_WORKFLOW;
  if (elements.upscaleModel.options.length === 0) {
    fillSingleCheckpointSelect(elements.upscaleModel, FALLBACK_UPSCALE_MODELS, FALLBACK_UPSCALE_MODELS[0]);
  }
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
    theme: readThemeSelection(elements),
    ...overrides
  });
}

function readThemeSelection(elements: AppElements): OpenLayerTheme {
  return elements.settingsThemeSelect.value === "classic" ? "classic" : "compact";
}

function applyTheme(elements: AppElements, theme: OpenLayerTheme) {
  const nextTheme = theme === "classic" ? "classic" : "compact";

  elements.settingsThemeSelect.value = nextTheme;
  elements.appShell.classList.toggle("theme-compact", nextTheme === "compact");
  elements.appShell.classList.toggle("theme-classic", nextTheme === "classic");
}

function getThemeLabel(theme: OpenLayerTheme) {
  return theme === "classic" ? "Classic v0.4" : "Compact Adobe Dark";
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
    }),
    createWorkflowDiagnosticMessage(getWorkflowPreset(readSelectValue(elements.outpaintWorkflow, DEFAULT_OUTPAINT_WORKFLOW)), {
      selectedModelName: readSelectValue(elements.outpaintCheckpoint)
    }),
    createWorkflowDiagnosticMessage(getWorkflowPreset(readSelectValue(elements.upscaleWorkflow, DEFAULT_UPSCALE_WORKFLOW)), {
      selectedModelName: readSelectValue(elements.upscaleModel)
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
    `Outpaint model: ${readSelectValue(elements.outpaintCheckpoint) || "None"}`,
    `Upscale model: ${readSelectValue(elements.upscaleModel) || "None"}`,
    "",
    "Workflow health:",
    workflowHealthReport?.summary ?? "Workflow health has not been checked yet.",
    ...formatWorkflowHealthReportLines(workflowHealthReport),
    "",
    "Hardware advisor:",
    ...formatHardwareReportLines(hardwareReport),
    "",
    "Model stack note:",
    "Z_image_Turbo is not a checkpoint. It appears through diffusion model loaders such as UNETLoader. Flux1-dev fp8 is a checkpoint-style exception; generic Flux presets need matching workflow JSON before they are ready."
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
  objectUrls: ObjectUrlRegistry,
  result: AppGeneratedImageResult,
  details: {
    prompt: string;
    negativePrompt?: string;
    checkpointName: string;
    modelName: string;
    workflowPreset: string;
    toolType: HistoryToolType;
    seed: number;
    sizeLabel: string;
    dimensions: string;
    sourceMode: string;
    sourceBounds?: OpenLayerLayerBounds;
    contextBounds?: OpenLayerLayerBounds;
    inpaintImportContext?: AppInpaintImportContext;
    outpaintImportContext?: AppOutpaintImportContext;
    experimental?: boolean;
    diagnosticsSummary?: string;
  }
) {
  const createdAt = new Date();
  const metadata = createOpenLayerLayerMetadata({
    openLayerVersion: APP_VERSION,
    toolType: details.toolType,
    workflowPresetId: details.workflowPreset,
    modelName: details.modelName || details.checkpointName,
    prompt: details.prompt,
    negativePrompt: details.negativePrompt,
    seed: details.seed,
    dimensions: createMetadataDimensions(details.dimensions),
    sourceMode: details.sourceMode,
    sourceBounds: details.sourceBounds,
    contextBounds: details.contextBounds,
    importTimestamp: createdAt,
    experimental: details.experimental ?? isWorkflowPresetExperimental(details.workflowPreset),
    diagnosticsSummary: details.diagnosticsSummary
  });

  historyEntries.unshift({
    id: createHistoryId(),
    result,
    originatingDocument: result.originatingDocument,
    inpaintImportContext: details.inpaintImportContext,
    outpaintImportContext: details.outpaintImportContext,
    previewUrl: objectUrls.create(result.blob),
    prompt: details.prompt.trim() || "Untitled prompt",
    checkpointName: details.checkpointName,
    modelName: details.modelName,
    workflowPreset: details.workflowPreset,
    toolType: details.toolType,
    seed: details.seed,
    sizeLabel: details.sizeLabel,
    dimensions: details.dimensions,
    sourceMode: details.sourceMode,
    importStatus: "not-imported",
    createdAt: createdAt.toLocaleString(),
    metadata
  });

  while (historyEntries.length > HISTORY_LIMIT) {
    const removedEntry = historyEntries.pop();

    if (removedEntry) {
      objectUrls.revoke(removedEntry.previewUrl);
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
    meta.textContent = createHistoryMetadataLine({
      toolType: entry.toolType,
      dimensions: entry.dimensions,
      seed: entry.seed
    });
    body.append(meta);

    const checkpoint = document.createElement("div");
    checkpoint.className = "history-meta";
    checkpoint.textContent = `${entry.workflowPreset} | ${entry.modelName || entry.checkpointName}`;
    body.append(checkpoint);

    if (entry.sourceMode) {
      const source = document.createElement("div");
      source.className = "history-meta";
      source.textContent = `Source: ${entry.sourceMode}`;
      body.append(source);
    }

    const importStatus = document.createElement("div");
    importStatus.className = "history-meta";
    importStatus.textContent = formatHistoryImportStatus(entry.importStatus, entry.importedLayerName);
    body.append(importStatus);

    const createdAt = document.createElement("div");
    createdAt.className = "history-time";
    createdAt.textContent = entry.createdAt;
    body.append(createdAt);

    const actions = document.createElement("div");
    actions.className = "history-actions";
    actions.append(createHistoryButton("Preview", "preview", entry.id));
    actions.append(createHistoryButton("Import", "import", entry.id));
    actions.append(createHistoryButton("Reuse Settings", "reuse", entry.id));
    body.append(actions);

    card.append(body);
    elements.historyList.append(card);
  }
}

function markHistoryImported(
  elements: AppElements,
  historyEntries: HistoryEntry[],
  result: AppGeneratedImageResult,
  importedLayerName: string
) {
  const entry = historyEntries.find((historyEntry) => historyEntry.result === result);

  if (!entry) {
    return;
  }

  entry.importStatus = "imported";
  entry.importedLayerName = importedLayerName;
  entry.importedAt = new Date().toLocaleString();
  entry.metadata = sanitizeOpenLayerLayerMetadata({
    ...entry.metadata,
    importedLayerName,
    importTimestamp: new Date().toISOString()
  });
  renderHistory(elements, historyEntries);
}

async function writeMetadataForImportedResult(
  historyEntries: HistoryEntry[],
  result: AppGeneratedImageResult,
  importedLayerName: string,
  onProgress?: (message: string) => void
) {
  const entry = historyEntries.find((historyEntry) => historyEntry.result === result);

  if (!entry) {
    return "No session metadata entry was found for this imported result.";
  }

  entry.metadata = sanitizeOpenLayerLayerMetadata({
    ...entry.metadata,
    importedLayerName,
    importTimestamp: new Date().toISOString()
  });

  try {
    const writeResult = await writeOpenLayerLayerMetadata(entry.metadata, onProgress);
    return writeResult.message;
  } catch (caughtError) {
    return `Layer metadata persistence skipped. ${getErrorMessage(caughtError)}`;
  }
}

function createMetadataDimensions(label: string) {
  const dimensions = readDimensionsFromLabel(label);

  return {
    ...dimensions,
    label
  };
}

function readDimensionsFromLabel(label: string) {
  const match = label.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);

  if (!match) {
    return {};
  }

  return {
    width: Number.parseFloat(match[1]),
    height: Number.parseFloat(match[2])
  };
}

function isWorkflowPresetExperimental(presetId: string) {
  try {
    return getWorkflowPreset(presetId).status === "experimental";
  } catch {
    return false;
  }
}

function createMetadataBounds(bounds: OpenLayerLayerBounds | undefined): OpenLayerLayerBounds | undefined {
  if (!bounds) {
    return undefined;
  }

  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    bottom: bounds.bottom,
    width: bounds.width ?? bounds.right - bounds.left,
    height: bounds.height ?? bounds.bottom - bounds.top
  };
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

function clearHistoryEntries(historyEntries: HistoryEntry[], objectUrls: ObjectUrlRegistry) {
  for (const entry of historyEntries) {
    objectUrls.revoke(entry.previewUrl);
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

