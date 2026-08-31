import { getWorkflowPreset, listRunnableWorkflowPresets, listWorkflowPresets } from "../comfy/presetRegistry";
import { NO_LORA_VALUE } from "../comfy/loraCompatibility";
import {
  APP_VERSION,
  DEFAULT_CFG,
  DEFAULT_HEIGHT,
  DEFAULT_IMG2IMG_DENOISE,
  DEFAULT_IMG2IMG_STEPS,
  DEFAULT_INPAINT_DENOISE,
  DEFAULT_INPAINT_STEPS,
  DEFAULT_LORA_STRENGTH,
  DEFAULT_OUTPAINT_BOTTOM,
  DEFAULT_OUTPAINT_DENOISE,
  DEFAULT_OUTPAINT_FEATHERING,
  DEFAULT_OUTPAINT_GUIDANCE,
  DEFAULT_OUTPAINT_LEFT,
  DEFAULT_OUTPAINT_RIGHT,
  DEFAULT_OUTPAINT_STEPS,
  DEFAULT_OUTPAINT_TOP,
  DEFAULT_PROMPT_LAYER_NUM_BEAMS,
  DEFAULT_PROMPT_LAYER_TASK,
  DEFAULT_SERVER_URL,
  DEFAULT_SKETCH_CONTROL_STRENGTH,
  DEFAULT_SKETCH_DENOISE,
  DEFAULT_SKETCH_STEPS,
  DEFAULT_MULTI_REFERENCE_CFG,
  DEFAULT_MULTI_REFERENCE_STEPS,
  DEFAULT_UNFLATTEN_LAYER_COUNT,
  DEFAULT_UNFLATTEN_STEPS,
  MAX_UNFLATTEN_LAYER_COUNT,
  MIN_UNFLATTEN_LAYER_COUNT,
  DEFAULT_STEPS,
  DEFAULT_STYLE_REFERENCE_CONTROL_STRENGTH,
  DEFAULT_WIDTH,
  FALLBACK_CHECKPOINTS,
  FALLBACK_UPSCALE_MODELS,
  HOME_TOOL_SECTIONS,
  PROMPT_LAYER_TASKS,
  TOOL_CARDS,
  ToolCard,
  ToolIconName
} from "./appConstants";
import { DEFAULT_AGENT_BRIDGE_PORT } from "../utils/preferences";

export type AppElements = {
  appShell: HTMLElement;
  welcomeOverlay: HTMLElement;
  welcomeStatusText: HTMLElement;
  welcomeManualRow: HTMLElement;
  welcomeServerUrlInput: HTMLInputElement;
  welcomeRetryButton: HTMLButtonElement;
  welcomeContinueButton: HTMLButtonElement;
  welcomeSkipButton: HTMLButtonElement;
  homeView: HTMLElement;
  generatorView: HTMLElement;
  imageToImageView: HTMLElement;
  sketchToImageView: HTMLElement;
  inpaintView: HTMLElement;
  outpaintView: HTMLElement;
  promptFromLayerView: HTMLElement;
  upscaleView: HTMLElement;
  settingsView: HTMLElement;
  setupView: HTMLElement;
  setupCheckedLabel: HTMLElement;
  setupTallies: HTMLElement;
  setupSummaryLine: HTMLElement;
  setupDownloadLine: HTMLElement;
  setupCheck: HTMLButtonElement;
  setupStatusText: HTMLElement;
  setupStatusPill: HTMLElement;
  setupFilters: HTMLElement;
  setupSections: HTMLElement;
  setupVramLabel: HTMLElement;
  setupOutlookList: HTMLElement;
  suggestPrompt: HTMLElement;
  agentBridgePort: HTMLInputElement;
  agentBridgeToggle: HTMLElement;
  agentBridgeStatusText: HTMLElement;
  agentBridgeStatusPill: HTMLElement;
  historyView: HTMLElement;
  promptWalletView: HTMLElement;
  promptWalletList: HTMLElement;
  promptWalletSearch: HTMLInputElement;
  promptWalletCount: HTMLElement;
  promptWalletBanner: HTMLElement;
  layerToolsView: HTMLElement;
  exportLayerFileButton: HTMLElement;
  exportLayerComfyButton: HTMLElement;
  exportSelectionFileButton: HTMLElement;
  exportSelectionComfyButton: HTMLElement;
  exportMaskFileButton: HTMLElement;
  exportMaskComfyButton: HTMLElement;
  layerToolsStatusText: HTMLElement;
  layerToolsStatusPill: HTMLElement;
  appHeader: HTMLElement;
  homeStatusRow: HTMLElement;
  homeStatusText: HTMLElement;
  homeStatusDot: HTMLElement;
  serverUrl: HTMLInputElement;
  prompt: HTMLTextAreaElement;
  promptWalletSave: HTMLElement;
  promptWalletLoad: HTMLElement;
  negativePrompt: HTMLTextAreaElement;
  workflow: HTMLSelectElement;
  checkpoint: HTMLSelectElement;
  loraField: HTMLElement;
  loraName: HTMLSelectElement;
  loraStrengthField: HTMLElement;
  loraStrength: HTMLInputElement;
  loraNote: HTMLElement;
  imgLoraField: HTMLElement;
  imgLoraName: HTMLSelectElement;
  imgLoraStrengthField: HTMLElement;
  imgLoraStrength: HTMLInputElement;
  imgLoraNote: HTMLElement;
  sketchLoraField: HTMLElement;
  sketchLoraName: HTMLSelectElement;
  sketchLoraStrengthField: HTMLElement;
  sketchLoraStrength: HTMLInputElement;
  sketchLoraNote: HTMLElement;
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
  spikeModelDownloadButton: HTMLElement;
  saveSettingsButton: HTMLElement;
  resetSettingsButton: HTMLElement;
  generateButton: HTMLElement;
  cancelGenerateButton: HTMLElement;
  cancelGenerationButtons: HTMLElement[];
  importButton: HTMLElement;
  autoImportToggle: HTMLElement;
  imgPrompt: HTMLTextAreaElement;
  imgPromptWalletSave: HTMLElement;
  imgPromptWalletLoad: HTMLElement;
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
  sketchPromptWalletSave: HTMLElement;
  sketchPromptWalletLoad: HTMLElement;
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
  inpaintPromptWalletSave: HTMLElement;
  inpaintPromptWalletLoad: HTMLElement;
  inpaintNegativePrompt: HTMLTextAreaElement;
  inpaintWorkflow: HTMLSelectElement;
  inpaintCheckpoint: HTMLSelectElement;
  inpaintSteps: HTMLInputElement;
  inpaintCfg: HTMLInputElement;
  inpaintSeed: HTMLInputElement;
  inpaintDenoise: HTMLInputElement;
  inpaintLockedSettingsNote: HTMLElement;
  captureInpaintSelectionButton: HTMLElement;
  captureInpaintActiveLayerButton: HTMLElement;
  generateInpaintButton: HTMLElement;
  importInpaintButton: HTMLElement;
  inpaintAutoImportToggle: HTMLElement;
  outpaintPrompt: HTMLTextAreaElement;
  outpaintPromptWalletSave: HTMLElement;
  outpaintPromptWalletLoad: HTMLElement;
  outpaintWorkflow: HTMLSelectElement;
  outpaintCheckpoint: HTMLSelectElement;
  outpaintSteps: HTMLInputElement;
  outpaintGuidance: HTMLInputElement;
  outpaintSeed: HTMLInputElement;
  outpaintDenoise: HTMLInputElement;
  outpaintLeft: HTMLInputElement;
  outpaintTop: HTMLInputElement;
  outpaintRight: HTMLInputElement;
  outpaintBottom: HTMLInputElement;
  outpaintFeathering: HTMLInputElement;
  captureOutpaintLayerButton: HTMLElement;
  captureOutpaintCanvasButton: HTMLElement;
  generateOutpaintButton: HTMLElement;
  importOutpaintButton: HTMLElement;
  capturePromptLayerButton: HTMLElement;
  capturePromptCanvasButton: HTMLElement;
  generatePromptLayerButton: HTMLElement;
  copyPromptLayerButton: HTMLElement;
  sendPromptLayerButton: HTMLElement;
  upscaleWorkflow: HTMLSelectElement;
  upscaleModel: HTMLSelectElement;
  captureUpscaleLayerButton: HTMLElement;
  captureUpscaleCanvasButton: HTMLElement;
  generateUpscaleButton: HTMLElement;
  importUpscaleButton: HTMLElement;
  upscaleAutoImportToggle: HTMLElement;
  imgAutoImportToggle: HTMLElement;
  experimentalCheckpointToggle: HTMLElement;
  negativePromptToggle: HTMLElement;
  negativePromptField: HTMLElement;
  clearHistoryButton: HTMLElement;
  statusText: HTMLElement;
  statusPill: HTMLElement;
  statusProgress: HTMLElement;
  imgStatusText: HTMLElement;
  imgStatusPill: HTMLElement;
  imgStatusProgress: HTMLElement;
  sketchStatusText: HTMLElement;
  sketchStatusPill: HTMLElement;
  sketchStatusProgress: HTMLElement;
  inpaintStatusText: HTMLElement;
  inpaintStatusPill: HTMLElement;
  inpaintStatusProgress: HTMLElement;
  promptLayerStatusText: HTMLElement;
  promptLayerStatusPill: HTMLElement;
  promptLayerStatusProgress: HTMLElement;
  settingsStatusText: HTMLElement;
  settingsStatusPill: HTMLElement;
  settingsStatusProgress: HTMLElement;
  diagnosticsText: HTMLElement;
  imgDiagnosticsText: HTMLElement;
  imgCompatibilityNote: HTMLElement;
  sketchDiagnosticsText: HTMLElement;
  sketchCompatibilityNote: HTMLElement;
  inpaintDiagnosticsText: HTMLElement;
  inpaintCompatibilityNote: HTMLElement;
  outpaintStatusText: HTMLElement;
  outpaintStatusPill: HTMLElement;
  outpaintStatusProgress: HTMLElement;
  upscaleStatusText: HTMLElement;
  upscaleStatusPill: HTMLElement;
  upscaleStatusProgress: HTMLElement;
  outpaintDiagnosticsText: HTMLElement;
  outpaintCompatibilityNote: HTMLElement;
  upscaleDiagnosticsText: HTMLElement;
  upscaleCompatibilityNote: HTMLElement;
  promptLayerDiagnosticsText: HTMLElement;
  settingsDiagnosticsText: HTMLElement;
  errorMessage: HTMLElement;
  imgErrorMessage: HTMLElement;
  sketchErrorMessage: HTMLElement;
  inpaintErrorMessage: HTMLElement;
  outpaintErrorMessage: HTMLElement;
  upscaleErrorMessage: HTMLElement;
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
  outpaintSourcePreviewPanel: HTMLElement;
  outpaintSourceTitle: HTMLElement;
  outpaintSourceMeta: HTMLElement;
  outpaintResultPreviewPanel: HTMLElement;
  upscaleSourcePreviewPanel: HTMLElement;
  upscaleSourceTitle: HTMLElement;
  upscaleSourceMeta: HTMLElement;
  upscaleResultPreviewPanel: HTMLElement;
  promptLayerSourcePreviewPanel: HTMLElement;
  promptLayerSourceTitle: HTMLElement;
  promptLayerSourceMeta: HTMLElement;
  promptLayerTask: HTMLSelectElement;
  promptLayerNumBeams: HTMLInputElement;
  promptLayerGeneratedText: HTMLTextAreaElement;
  historyList: HTMLElement;
  settingsUrlValue: HTMLElement;
  settingsCheckpointCount: HTMLElement;
  settingsLastCheckpoint: HTMLElement;
  settingsDocumentStatus: HTMLElement;
  settingsWorkflowReadiness: HTMLElement;
  settingsThemeSelect: HTMLSelectElement;
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
  livePaintingView: HTMLElement;
  livePrompt: HTMLTextAreaElement;
  livePromptWalletSave: HTMLElement;
  livePromptWalletLoad: HTMLElement;
  liveNegativePrompt: HTMLTextAreaElement;
  liveNegativePromptToggle: HTMLElement;
  liveNegativePromptField: HTMLElement;
  liveDenoise: HTMLInputElement;
  liveStartButton: HTMLElement;
  liveStopButton: HTMLElement;
  liveRefineButton: HTMLElement;
  liveAutoRefineToggle: HTMLElement;
  liveStatusText: HTMLElement;
  liveStateBadge: HTMLElement;
  liveTimingsText: HTMLElement;
  liveResultPreviewPanel: HTMLElement;
  importLiveButton: HTMLElement;
  importLiveRefinedButton: HTMLElement;
  liveAutoImportToggle: HTMLElement;
  styleReferenceView: HTMLElement;
  styleReferencePrompt: HTMLTextAreaElement;
  styleReferencePromptWalletSave: HTMLElement;
  styleReferencePromptWalletLoad: HTMLElement;
  styleReferenceNegativePrompt: HTMLTextAreaElement;
  styleReferenceWorkflow: HTMLSelectElement;
  styleReferenceCheckpoint: HTMLSelectElement;
  styleReferenceWidth: HTMLInputElement;
  styleReferenceHeight: HTMLInputElement;
  styleReferenceSteps: HTMLInputElement;
  styleReferenceCfg: HTMLInputElement;
  styleReferenceSeed: HTMLInputElement;
  styleReferenceControlStrength: HTMLInputElement;
  captureStyleReferenceLayerButton: HTMLElement;
  captureStyleReferenceCanvasButton: HTMLElement;
  generateStyleReferenceButton: HTMLElement;
  importStyleReferenceButton: HTMLElement;
  styleReferenceStatusText: HTMLElement;
  styleReferenceStatusPill: HTMLElement;
  styleReferenceStatusProgress: HTMLElement;
  styleReferenceDiagnosticsText: HTMLElement;
  styleReferenceCompatibilityNote: HTMLElement;
  styleReferenceErrorMessage: HTMLElement;
  styleReferenceSourcePreviewPanel: HTMLElement;
  styleReferenceSourceTitle: HTMLElement;
  styleReferenceSourceMeta: HTMLElement;
  styleReferenceResultPreviewPanel: HTMLElement;
  multiReferenceView: HTMLElement;
  multiReferencePrompt: HTMLTextAreaElement;
  multiReferencePromptWalletSave: HTMLElement;
  multiReferencePromptWalletLoad: HTMLElement;
  multiReferenceNegativePrompt: HTMLTextAreaElement;
  multiReferenceWorkflow: HTMLSelectElement;
  multiReferenceCheckpoint: HTMLSelectElement;
  multiReferenceSteps: HTMLInputElement;
  multiReferenceCfg: HTMLInputElement;
  multiReferenceSeed: HTMLInputElement;
  addMultiReferenceLayerButton: HTMLElement;
  addMultiReferenceCanvasButton: HTMLElement;
  generateMultiReferenceButton: HTMLElement;
  importMultiReferenceButton: HTMLElement;
  describeUnflattenSourceButton: HTMLElement;
  captureUnflattenLayerButton: HTMLElement;
  captureUnflattenCanvasButton: HTMLElement;
  generateUnflattenButton: HTMLElement;
  importUnflattenButton: HTMLElement;
  multiReferenceList: HTMLElement;
  multiReferenceCount: HTMLElement;
  multiReferenceStatusText: HTMLElement;
  multiReferenceStatusPill: HTMLElement;
  multiReferenceStatusProgress: HTMLElement;
  multiReferenceDiagnosticsText: HTMLElement;
  multiReferenceCompatibilityNote: HTMLElement;
  multiReferenceErrorMessage: HTMLElement;
  multiReferenceResultPreviewPanel: HTMLElement;
  unflattenView: HTMLElement;
  unflattenPrompt: HTMLTextAreaElement;
  unflattenPromptWalletSave: HTMLElement;
  unflattenPromptWalletLoad: HTMLElement;
  unflattenWorkflow: HTMLSelectElement;
  unflattenCheckpoint: HTMLSelectElement;
  unflattenLayerCount: HTMLInputElement;
  unflattenSteps: HTMLInputElement;
  unflattenSeed: HTMLInputElement;
  unflattenSourceTitle: HTMLElement;
  unflattenSourceMeta: HTMLElement;
  unflattenSourcePreviewPanel: HTMLElement;
  unflattenStatusText: HTMLElement;
  unflattenStatusPill: HTMLElement;
  unflattenStatusProgress: HTMLElement;
  unflattenDiagnosticsText: HTMLElement;
  unflattenErrorMessage: HTMLElement;
  unflattenResultLabel: HTMLElement;
  unflattenResultPreviewPanel: HTMLElement;
  workflowPresetsView: HTMLElement;
  workflowPresetsSummary: HTMLElement;
  workflowPresetsList: HTMLElement;
  customWorkflowView: HTMLElement;
  customWorkflowInput: HTMLTextAreaElement;
  checkCustomWorkflowButton: HTMLElement;
  customWorkflowStatusText: HTMLElement;
  customWorkflowStatusPill: HTMLElement;
  customWorkflowSummary: HTMLElement;
  customWorkflowError: HTMLElement;
  customWorkflowResults: HTMLElement;
};

export function createAppMarkup() {
  return `
    <main class="app-shell theme-compact" id="app-shell">
      <div class="welcome-overlay" id="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title" hidden>
        <div class="welcome-card">
          <h2 class="welcome-title" id="welcome-title">OpenLayer needs ComfyUI</h2>
          <p class="welcome-copy">
            OpenLayer connects Photoshop to a <a href="https://github.com/comfyanonymous/ComfyUI" data-openlayer-external="https://github.com/comfyanonymous/ComfyUI">ComfyUI</a>
            server running on your own machine — it isn't bundled with the plugin. If it isn't running yet, start it
            now; OpenLayer will find it automatically.
          </p>
          <div class="welcome-status-row">
            <span class="home-status-dot idle" id="welcome-status-dot" aria-hidden="true"></span>
            <span id="welcome-status-text">Looking for ComfyUI...</span>
          </div>
          <div class="welcome-manual-row field" id="welcome-manual-row" hidden>
            <span class="label">ComfyUI address</span>
            <input class="input" id="welcome-server-url" type="text" placeholder="http://127.0.0.1:8188" />
          </div>
          <div class="welcome-actions">
            <button class="button button-primary action-control" id="welcome-retry" type="button" hidden>Try again</button>
            <button class="button button-primary action-control" id="welcome-continue" type="button" hidden>Continue</button>
            <button class="button action-control" id="welcome-skip" type="button">Skip for now</button>
          </div>
          <p class="welcome-footnote">
            Not sure where to start? The <strong>Setup</strong> screen (under Preferences) lists everything the
            presets need, once you're in the panel.
          </p>
        </div>
      </div>
      ${createBrandHeaderMarkup()}
      <div class="home-status-row" id="home-status-row">
        <span>Status:</span>
        <strong id="home-status-text">Ready</strong>
        <span class="home-status-dot idle" id="home-status-dot" aria-hidden="true"></span>
      </div>

      <section class="home-view" id="home-view" aria-label="OpenLayer tools">
        ${HOME_TOOL_SECTIONS.map(createHomeToolSectionMarkup).join("")}
      </section>

      <section class="prompt-from-layer-view image-to-image-view" id="prompt-from-layer-view" aria-label="Prompt from Layer" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("promptFromLayer", "Prompt from Layer")}
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
            <span class="muted-label">Florence-2 PromptGen</span>
          </div>
          <div class="settings-grid" aria-label="Prompt from Layer settings">
            <label class="field">
              <span class="label">Task</span>
              <select class="select" id="prompt-layer-task">
                ${PROMPT_LAYER_TASKS.map((task) => `<option value="${task.value}"${task.value === DEFAULT_PROMPT_LAYER_TASK ? " selected" : ""}>${task.label}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span class="label">Num beams</span>
              <input class="input input-compact" id="prompt-layer-num-beams" type="number" min="1" max="32" step="1" value="${DEFAULT_PROMPT_LAYER_NUM_BEAMS}" />
            </label>
          </div>
          <textarea maxlength="10000" class="textarea compact-textarea" id="prompt-layer-generated-text" placeholder="Generated prompt text will appear here..."></textarea>
          <button class="button button-primary button-generate button-wide action-control" id="generate-prompt-from-layer" data-openlayer-action="generatePromptFromLayer" type="button">Generate Text from Layer</button>
          <button class="button button-wide action-control cancel-generation-button" data-openlayer-action="cancelGeneration" type="button" hidden>Cancel Generation</button>
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
          <div class="status-progress" id="prompt-layer-status-progress" hidden><span></span></div>
          <div class="diagnostics-line" id="prompt-layer-diagnostics-text">Capture a source, then generate a Florence-2 PromptGen caption.</div>
          <div class="error-message" id="prompt-layer-error-message" hidden></div>
        </section>
      </section>

      <section class="live-painting-view image-to-image-view" id="live-painting-view" aria-label="Live Painting" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("livePainting", "Live Painting")}
            <span class="screen-title">Live Painting</span>
          </div>
        </div>

        <section class="panel-section generator-panel" aria-label="Live Painting session">
          <div class="section-heading">
            <span class="label">Live session</span>
            <span class="muted-label">Two-tier session</span>
          </div>
          <div class="diagnostics-line live-hint">
            The live tier runs the model picked in the Model dropdown on the Text to Image screen,
            paired with your local SD 1.5 LCM LoRA. Refine uses Krea-2 Turbo.
            If no model is selected there yet, open Text to Image, choose a workflow and a model,
            then come back here. Once the session is running, paint in the document and the preview
            follows your strokes.
          </div>
          <label class="field">
            <span class="label">Prompt${createPromptWalletControlsMarkup("live-prompt")}</span>
            <textarea maxlength="10000" class="textarea" id="live-prompt" placeholder="Describe what your painting should become..."></textarea>
          </label>
          <section class="negative-prompt-section" aria-label="Live Painting negative prompt">
            <button class="button disclosure-button action-control" id="live-negative-prompt-toggle" data-openlayer-action="toggleLiveNegativePrompt" type="button">Show Negative Prompt</button>
            <label class="field negative-prompt-field" id="live-negative-prompt-field" hidden>
              <span class="label">Negative prompt</span>
              <textarea maxlength="10000" class="textarea" id="live-negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
            </label>
          </section>
          <label class="field">
            <span class="label">Strength (denoise)</span>
            <input class="input input-compact" id="live-denoise" type="number" min="0.2" max="0.95" step="0.05" value="0.6" />
          </label>
          <div class="live-session-actions">
            <button class="button button-primary button-generate button-wide action-control" id="start-live-painting" data-openlayer-action="startLivePainting" type="button">Start Live Session</button>
            <button class="button button-wide action-control" id="stop-live-painting" data-openlayer-action="stopLivePainting" type="button">Stop Live Session</button>
          </div>
          <div class="live-refine-actions">
            <button class="button action-control" id="refine-live-painting" data-openlayer-action="refineLivePainting" type="button">Refine Now</button>
            <button class="button action-control" id="live-auto-refine-toggle" data-openlayer-action="toggleLiveAutoRefine" type="button" aria-pressed="false">Auto Refine on Pause</button>
          </div>
        </section>

        <section class="panel-section generator-panel" aria-label="Live Painting preview">
          <div class="section-heading">
            <span class="label">Live preview</span>
          </div>
          <div class="preview-panel" id="live-result-preview-panel">
            <span class="preview-empty">Start a session, then paint a stroke</span>
          </div>
          <div class="import-actions">
            <button class="button action-control" id="import-live-result" data-openlayer-action="importLiveResult" type="button">Import to Layers</button>
            <button class="button action-control" id="live-auto-import-toggle" data-openlayer-action="toggleLiveAutoImport" type="button" aria-pressed="false">Import Automatically</button>
          </div>
          <button class="button live-refined-import-button action-control" id="import-live-refined" data-openlayer-action="importLiveRefined" type="button">Import Refined as Layer</button>
          <div class="diagnostics-line live-hint">
            Import Automatically brings the latest live result into Photoshop as a new layer when you stop the session.
          </div>
        </section>

        <section class="generation-status-panel" aria-label="Live Painting status">
          <div class="status-bar" role="status">
            <span class="status-text" id="live-status-text">Live Painting ready.</span>
            <span class="status-pill live-state-badge idle" id="live-state-badge">IDLE</span>
          </div>
          <div class="diagnostics-line" id="live-timings-text">Cycle timings will appear here.</div>
        </section>
      </section>

      <section class="settings-view" id="settings-view" aria-label="Settings" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("settings", "Settings")}
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
            <!-- SPIKE, delete with src/ui/spikeModelDownload.ts once model acquisition is decided. -->
            <button class="button action-control" id="spike-model-download" data-openlayer-action="spikeModelDownload" type="button">Spike: Model Download</button>
            <button class="button action-control" id="save-settings" data-openlayer-action="saveSettings" type="button">Save Settings</button>
            <button class="button action-control" id="reset-settings" data-openlayer-action="resetSettings" type="button">Reset Defaults</button>
          </div>
          <textarea maxlength="10000" class="textarea compact-textarea diagnostics-report" id="settings-diagnostics-report" readonly hidden></textarea>
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
          <div class="status-progress" id="settings-status-progress" hidden><span></span></div>
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
            Z_image_Turbo is not a checkpoint. It uses a diffusion model stack. Flux1-dev fp8 is a checkpoint-style exception; generic Flux presets still need dedicated workflow JSON.
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
            <label class="field theme-field">
              <span class="label">Panel theme</span>
              <select class="select" id="settings-theme-select">
                <option value="compact">Compact Adobe Dark</option>
                <option value="artist">Artist-Friendly Dark</option>
                <option value="classic">Classic v0.4</option>
              </select>
            </label>
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
            ${createScreenIconMarkup("imagePlus", "Text to Image")}
            <span class="screen-title">Text to Image</span>
          </div>
        </div>

        <section class="panel-section generator-panel" aria-label="Prompt">
          <div class="section-heading">
            <span class="label">Generate</span>
            <span class="muted-label">Prompt and settings</span>
          </div>
          <label class="field">
            <span class="label">Prompt${createPromptWalletControlsMarkup("prompt")}</span>
            <textarea maxlength="10000" class="textarea" id="prompt" placeholder="Describe the image you want to generate..."></textarea>
          </label>
          <button class="button action-control" id="suggest-prompt" data-openlayer-action="suggestPrompt" type="button">Ask the Agent for a Prompt</button>
          <section class="negative-prompt-section" aria-label="Negative prompt">
            <button class="button disclosure-button action-control" id="negative-prompt-toggle" data-openlayer-action="toggleNegativePrompt" type="button">Show Negative Prompt</button>
            <label class="field negative-prompt-field" id="negative-prompt-field" hidden>
              <span class="label">Negative prompt</span>
              <textarea maxlength="10000" class="textarea" id="negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
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
          <section class="lora-section" id="lora-field" aria-label="LoRA" hidden>
            <label class="field">
              <span class="label">LoRA (optional)</span>
              <select class="select" id="lora-name">
                <option value="${NO_LORA_VALUE}">None</option>
              </select>
            </label>
            <label class="field" id="lora-strength-field" hidden>
              <span class="label">LoRA strength</span>
              <input class="input input-compact" id="lora-strength" type="number" min="0" max="2" step="0.05" value="${DEFAULT_LORA_STRENGTH}" />
            </label>
            <div class="diagnostics-line" id="lora-note" hidden></div>
          </section>
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
              <input class="input input-compact" id="seed" type="text" inputmode="numeric" placeholder="Random" />
            </label>
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate" data-openlayer-action="generate" type="button">Generate</button>
          <button class="button button-wide action-control cancel-generation-button" id="cancel-generation" data-openlayer-action="cancelGeneration" type="button" hidden>Cancel Generation</button>
        </section>

        <section class="generation-status-panel" aria-label="Generation status">
          <div class="status-bar" role="status">
            <span class="status-text" id="status-text">Ready.</span>
            <span class="status-pill idle" id="status-pill">Status</span>
          </div>
          <div class="status-progress" id="status-progress" hidden><span></span></div>
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

      </section>

      <section class="image-to-image-view" id="image-to-image-view" aria-label="Image to Image" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("image", "Image to Image")}
            <span class="screen-title">Image to Image</span>
          </div>
        </div>

        <section class="panel-section generator-panel source-panel" aria-label="Image source">
          <div class="section-heading">
            <span class="label">Source layer</span>
            <span class="muted-label">Input image</span>
          </div>
          <div class="source-action-row ol-capture-actions" aria-label="Source capture actions">
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
          <div class="section-heading">
            <span class="label">Generate</span>
            <span class="muted-label">Prompt and workflow</span>
          </div>
          <div class="field img2img-field">
            <span class="label">Prompt${createPromptWalletControlsMarkup("img-prompt")}</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="img-prompt" placeholder="Describe how to reinterpret the active layer..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Negative prompt</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="img-negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Workflow</span>
            <select class="select" id="img-workflow">
              ${listRunnableWorkflowPresets("img2img").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <div class="field-label-row">
              <span class="label">Model</span>
              ${createInfoToggleMarkup("img-compatibility-note")}
            </div>
            <select class="select" id="img-checkpoint">
              ${FALLBACK_CHECKPOINTS.map((checkpoint) => `<option value="${checkpoint}">${checkpoint}</option>`).join("")}
            </select>
            ${createInfoPanelMarkup("img-compatibility-note", "img2img-basic is safest with SD 1.x and SDXL checkpoints. SD3 and Flux may need dedicated presets.")}
          </div>
          <section class="lora-section" id="img-lora-field" aria-label="LoRA" hidden>
            <label class="field">
              <span class="label">LoRA (optional)</span>
              <select class="select" id="img-lora-name">
                <option value="${NO_LORA_VALUE}">None</option>
              </select>
            </label>
            <label class="field" id="img-lora-strength-field" hidden>
              <span class="label">LoRA strength</span>
              <input class="input input-compact" id="img-lora-strength" type="number" min="0" max="2" step="0.05" value="${DEFAULT_LORA_STRENGTH}" />
            </label>
            <div class="diagnostics-line" id="img-lora-note" hidden></div>
          </section>
          <button class="button experimental-toggle action-control" id="experimental-checkpoint-toggle" data-openlayer-action="toggleExperimentalCheckpoints" type="button" aria-pressed="false">Experimental Checkpoints Off</button>
          <div class="settings-grid img2img-settings-grid" aria-label="Image to Image settings">
            <div class="field ol-setting-row">
              <span class="label">Steps</span>
              <input class="input input-compact" id="img-steps" type="number" min="1" max="150" step="1" value="${DEFAULT_IMG2IMG_STEPS}" />
            </div>
            <div class="field ol-setting-row">
              <span class="label">CFG</span>
              <input class="input input-compact" id="img-cfg" type="number" min="1" max="30" step="0.5" value="${DEFAULT_CFG}" />
            </div>
            <div class="field ol-setting-row">
              <span class="label">Denoise</span>
              <input class="input input-compact" id="img-denoise" type="number" min="0.05" max="1" step="0.05" value="${DEFAULT_IMG2IMG_DENOISE}" />
            </div>
            <div class="field settings-seed ol-setting-row">
              <span class="label">Seed</span>
              <input class="input input-compact" id="img-seed" type="text" inputmode="numeric" placeholder="Random" />
            </div>
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate-img2img" data-openlayer-action="generateImg2Img" type="button">Generate Image to Image</button>
          <button class="button button-wide action-control cancel-generation-button" data-openlayer-action="cancelGeneration" type="button" hidden>Cancel Generation</button>
        </section>

        <section class="generation-status-panel img2img-status-panel" aria-label="Image to Image status">
          <div class="status-bar" role="status">
            <span class="status-text" id="img-status-text">Ready.</span>
            <span class="status-pill idle" id="img-status-pill">Status</span>
          </div>
          <div class="status-progress" id="img-status-progress" hidden><span></span></div>
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
            <button class="button auto-import-toggle action-control" id="img2img-auto-import-toggle" data-openlayer-action="toggleImg2ImgAutoImport" type="button" aria-pressed="false">Import Automatically</button>
          </div>
        </section>

      </section>

      <section class="sketch-to-image-view image-to-image-view" id="sketch-to-image-view" aria-label="Sketch to Image" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("lineart", "Sketch to Image")}
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
              <span class="source-card-meta" id="sketch-source-meta">ComfyUI Standard Lineart creates the guide.</span>
            </div>
          </div>
        </section>

        <section class="panel-section generator-panel img2img-form-panel" aria-label="Sketch to Image prompt">
          <div class="section-heading">
            <span class="label">Generate</span>
            <span class="muted-label">Prompt and LINECN settings</span>
          </div>
          <div class="field img2img-field">
            <span class="label">Prompt${createPromptWalletControlsMarkup("sketch-prompt")}</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="sketch-prompt" placeholder="Describe the final image guided by the lineart..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Negative prompt</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="sketch-negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Workflow</span>
            <select class="select" id="sketch-workflow">
              ${listRunnableWorkflowPresets("sketch2img").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <div class="field-label-row">
              <span class="label">Checkpoint</span>
              ${createInfoToggleMarkup("sketch-compatibility-note")}
            </div>
            <select class="select" id="sketch-checkpoint">
              ${FALLBACK_CHECKPOINTS.map((checkpoint) => `<option value="${checkpoint}">${checkpoint}</option>`).join("")}
            </select>
            ${createInfoPanelMarkup("sketch-compatibility-note", "Recommended: epicrealism_naturalSinRC1VAE.safetensors with an SD 1.5 LineArt ControlNet workflow.")}
          </div>
          <section class="lora-section" id="sketch-lora-field" aria-label="LoRA" hidden>
            <label class="field">
              <span class="label">LoRA (optional)</span>
              <select class="select" id="sketch-lora-name">
                <option value="${NO_LORA_VALUE}">None</option>
              </select>
            </label>
            <label class="field" id="sketch-lora-strength-field" hidden>
              <span class="label">LoRA strength</span>
              <input class="input input-compact" id="sketch-lora-strength" type="number" min="0" max="2" step="0.05" value="${DEFAULT_LORA_STRENGTH}" />
            </label>
            <div class="diagnostics-line" id="sketch-lora-note" hidden></div>
          </section>
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
              <input class="input input-compact" id="sketch-seed" type="text" inputmode="numeric" placeholder="Random" />
            </div>
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate-sketch" data-openlayer-action="generateSketch" type="button">Generate Sketch to Image</button>
          <button class="button button-wide action-control cancel-generation-button" data-openlayer-action="cancelGeneration" type="button" hidden>Cancel Generation</button>
        </section>

        <section class="generation-status-panel img2img-status-panel" aria-label="Sketch to Image status">
          <div class="status-bar" role="status">
            <span class="status-text" id="sketch-status-text">Ready.</span>
            <span class="status-pill idle" id="sketch-status-pill">Status</span>
          </div>
          <div class="status-progress" id="sketch-status-progress" hidden><span></span></div>
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

      <section class="style-reference-view image-to-image-view" id="style-reference-view" aria-label="Style Reference" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("styleReference", "Style Reference")}
            <span class="screen-title">Style Reference</span>
          </div>
        </div>

        <section class="panel-section generator-panel source-panel" aria-label="Style reference source">
          <div class="section-heading">
            <span class="label">Reference layer</span>
            <span class="muted-label">IPAdapter input</span>
          </div>
          <div class="source-action-row" aria-label="Style reference capture actions">
            <button class="button source-action-button action-control" id="capture-style-reference-source" data-openlayer-action="captureStyleReferenceSource" type="button">Capture Active Layer</button>
            <button class="button source-action-button action-control" id="capture-style-reference-canvas-source" data-openlayer-action="captureStyleReferenceCanvasSource" type="button">Capture Canvas</button>
          </div>
          <div class="source-card">
            <div class="source-thumb-frame" id="style-reference-source-preview-panel">
              <span class="source-empty">None</span>
            </div>
            <div class="source-card-body">
              <span class="source-title" id="style-reference-source-title">No source captured</span>
              <span class="source-card-meta" id="style-reference-source-meta">Palette and mood are borrowed from this layer. Photographic references work; flat illustrations mostly do not.</span>
            </div>
          </div>
        </section>

        <section class="panel-section generator-panel img2img-form-panel" aria-label="Style Reference prompt">
          <div class="section-heading">
            <span class="label">Generate</span>
            <span class="muted-label">Prompt and IPAdapter settings</span>
          </div>
          <div class="field img2img-field">
            <span class="label">Prompt${createPromptWalletControlsMarkup("style-reference-prompt")}</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="style-reference-prompt" placeholder="Describe the new image; the reference layer supplies mood and color..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Negative prompt</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="style-reference-negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Workflow</span>
            <select class="select" id="style-reference-workflow">
              ${listRunnableWorkflowPresets("style-reference").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <div class="field-label-row">
              <span class="label">Checkpoint</span>
              ${createInfoToggleMarkup("style-reference-compatibility-note")}
            </div>
            <select class="select" id="style-reference-checkpoint">
              ${FALLBACK_CHECKPOINTS.map((checkpoint) => `<option value="${checkpoint}">${checkpoint}</option>`).join("")}
            </select>
            ${createInfoPanelMarkup("style-reference-compatibility-note", "Recommended: epicrealism_naturalSinRC1VAE.safetensors. IPAdapter Plus SD1.5 needs an SD 1.x checkpoint.")}
          </div>
          <div class="settings-grid img2img-settings-grid" aria-label="Style Reference settings">
            <div class="field">
              <span class="label">Width</span>
              <input class="input input-compact" id="style-reference-width" type="number" min="64" max="2048" step="8" value="${DEFAULT_WIDTH}" />
            </div>
            <div class="field">
              <span class="label">Height</span>
              <input class="input input-compact" id="style-reference-height" type="number" min="64" max="2048" step="8" value="${DEFAULT_HEIGHT}" />
            </div>
            <div class="field">
              <span class="label">Steps</span>
              <input class="input input-compact" id="style-reference-steps" type="number" min="1" max="150" step="1" value="${DEFAULT_STEPS}" />
            </div>
            <div class="field">
              <span class="label">CFG</span>
              <input class="input input-compact" id="style-reference-cfg" type="number" min="1" max="30" step="0.5" value="${DEFAULT_CFG}" />
            </div>
            <div class="field">
              <span class="label">Strength</span>
              <input class="input input-compact" id="style-reference-control-strength" type="number" min="0" max="2" step="0.05" value="${DEFAULT_STYLE_REFERENCE_CONTROL_STRENGTH}" />
            </div>
            <div class="field settings-seed">
              <span class="label">Seed</span>
              <input class="input input-compact" id="style-reference-seed" type="text" inputmode="numeric" placeholder="Random" />
            </div>
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate-style-reference" data-openlayer-action="generateStyleReference" type="button">Generate Style Reference</button>
          <button class="button button-wide action-control cancel-generation-button" data-openlayer-action="cancelGeneration" type="button" hidden>Cancel Generation</button>
        </section>

        <section class="generation-status-panel img2img-status-panel" aria-label="Style Reference status">
          <div class="status-bar" role="status">
            <span class="status-text" id="style-reference-status-text">Ready.</span>
            <span class="status-pill idle" id="style-reference-status-pill">Status</span>
          </div>
          <div class="status-progress" id="style-reference-status-progress" hidden><span></span></div>
          <div class="diagnostics-line" id="style-reference-diagnostics-text">Capture a reference layer, then use the IPAdapter Plus workflow preset.</div>
          <div class="error-message" id="style-reference-error-message" hidden></div>
        </section>

        <section class="panel-section result-panel img2img-result-panel" aria-label="Style Reference result">
          <div class="section-heading">
            <span class="label">Result preview</span>
            <span class="muted-label">Generated result appears here</span>
          </div>
          <div class="preview-panel" id="style-reference-result-preview-panel">
            <span class="preview-empty">No Style Reference result yet</span>
          </div>
          <div class="import-actions">
            <button class="button button-import button-import-blue action-control is-disabled" id="import-style-reference-result" data-openlayer-action="importStyleReference" type="button" tabindex="-1" aria-disabled="true">Import to Layers</button>
          </div>
        </section>
      </section>

      <section class="multi-reference-view image-to-image-view" id="multi-reference-view" aria-label="Multi-Reference Composition" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("multiReference", "Multi-Reference Composition")}
            <span class="screen-title">Multi-Reference</span>
          </div>
        </div>

        <section class="panel-section generator-panel source-panel" aria-label="Reference layers">
          <div class="section-heading">
            <span class="label">Reference layers</span>
            <span class="muted-label" id="multi-reference-count">None captured</span>
          </div>
          <div class="source-action-row" aria-label="Reference capture actions">
            <button class="button source-action-button action-control" id="add-multi-reference-layer" data-openlayer-action="addMultiReferenceLayer" type="button">Add Active Layer</button>
            <button class="button source-action-button action-control" id="add-multi-reference-canvas" data-openlayer-action="addMultiReferenceCanvas" type="button">Add Canvas</button>
          </div>
          <div class="reference-list" id="multi-reference-list">
            <span class="source-empty">No reference layers yet</span>
          </div>
          <div class="diagnostics-line" id="multi-reference-list-hint">Reference 1 sets the output size. Order is worth trying: an object that has to sit behind your subjects is steadier earlier in the list.</div>
        </section>

        <section class="panel-section generator-panel img2img-form-panel" aria-label="Composition prompt">
          <div class="section-heading">
            <span class="label">Compose</span>
            <span class="muted-label">Prompt and sampler settings</span>
          </div>
          <div class="field img2img-field">
            <span class="label">Prompt${createPromptWalletControlsMarkup("multi-reference-prompt")}</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="multi-reference-prompt" placeholder="Describe the picture you want built from these layers..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Negative prompt</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="multi-reference-negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Workflow</span>
            <select class="select" id="multi-reference-workflow">
              ${listRunnableWorkflowPresets("multi-reference").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <div class="field-label-row">
              <span class="label">Klein model</span>
              ${createInfoToggleMarkup("multi-reference-compatibility-note")}
            </div>
            <select class="select" id="multi-reference-checkpoint">
              ${createMultiReferenceModelOptionsMarkup()}
            </select>
            ${createInfoPanelMarkup("multi-reference-compatibility-note", "Clothing, props, setting and lighting carry across from your layers. Faces do not: a person in a reference comes back as a plausible stranger, so this cannot place a specific person in a picture.")}
          </div>
          <div class="settings-grid img2img-settings-grid" aria-label="Multi-Reference settings">
            <div class="field">
              <span class="label">Steps</span>
              <input class="input input-compact" id="multi-reference-steps" type="number" min="1" max="150" step="1" value="${DEFAULT_MULTI_REFERENCE_STEPS}" />
            </div>
            <div class="field">
              <span class="label">CFG</span>
              <input class="input input-compact" id="multi-reference-cfg" type="number" min="1" max="30" step="0.5" value="${DEFAULT_MULTI_REFERENCE_CFG}" />
            </div>
            <div class="field settings-seed">
              <span class="label">Seed</span>
              <input class="input input-compact" id="multi-reference-seed" type="text" inputmode="numeric" placeholder="Random" />
            </div>
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate-multi-reference" data-openlayer-action="generateMultiReference" type="button">Compose</button>
          <button class="button button-wide action-control cancel-generation-button" data-openlayer-action="cancelGeneration" type="button" hidden>Cancel Generation</button>
        </section>

        <section class="generation-status-panel img2img-status-panel" aria-label="Multi-Reference status">
          <div class="status-bar" role="status">
            <span class="status-text" id="multi-reference-status-text">Ready.</span>
            <span class="status-pill idle" id="multi-reference-status-pill">Status</span>
          </div>
          <div class="status-progress" id="multi-reference-status-progress" hidden><span></span></div>
          <div class="diagnostics-line" id="multi-reference-diagnostics-text">Add two or more layers, then describe the picture they should become.</div>
          <div class="error-message" id="multi-reference-error-message" hidden></div>
        </section>

        <section class="panel-section result-panel img2img-result-panel" aria-label="Multi-Reference result">
          <div class="section-heading">
            <span class="label">Result preview</span>
            <span class="muted-label">Generated result appears here</span>
          </div>
          <div class="preview-panel" id="multi-reference-result-preview-panel">
            <span class="preview-empty">No composition yet</span>
          </div>
          <div class="import-actions">
            <button class="button button-import button-import-blue action-control is-disabled" id="import-multi-reference-result" data-openlayer-action="importMultiReference" type="button" tabindex="-1" aria-disabled="true">Import to Layers</button>
          </div>
        </section>
      </section>

      <section class="unflatten-view image-to-image-view" id="unflatten-view" aria-label="Unflatten" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("unflatten", "Unflatten")}
            <span class="screen-title">Unflatten</span>
          </div>
        </div>

        <section class="panel-section generator-panel source-panel" aria-label="Unflatten source">
          <div class="section-heading">
            <span class="label">Source</span>
            <span class="muted-label">Layer or canvas</span>
          </div>
          <div class="source-action-row" aria-label="Source capture actions">
            <button class="button source-action-button action-control" id="capture-unflatten-layer" data-openlayer-action="captureUnflattenLayer" type="button">Use Active Layer</button>
            <button class="button source-action-button action-control" id="capture-unflatten-canvas" data-openlayer-action="captureUnflattenCanvas" type="button">Use Canvas</button>
          </div>
          <div class="source-card">
            <div class="source-thumb-frame" id="unflatten-source-preview-panel">
              <span class="source-empty">None</span>
            </div>
            <div class="source-card-body">
              <span class="source-title" id="unflatten-source-title">No source captured</span>
              <span class="source-card-meta" id="unflatten-source-meta">A subject in front of a background.</span>
            </div>
          </div>
        </section>

        <section class="panel-section generator-panel img2img-form-panel" aria-label="Unflatten settings">
          <div class="section-heading">
            <span class="label">Unflatten</span>
            <span class="muted-label">Description and layer count</span>
          </div>
          <div class="field img2img-field">
            <span class="label">Description${createPromptWalletControlsMarkup("unflatten-prompt")}</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="unflatten-prompt" placeholder="Describe what is already in the picture..."></textarea>
            <button class="button source-action-button action-control" id="describe-unflatten-source" data-openlayer-action="describeUnflattenSource" type="button">Describe the source for me</button>
            <div class="diagnostics-line unflatten-hint" id="unflatten-prompt-hint">Describe what is already there, not what you want changed. Needs a picture with something standing in front of something else -- a close-up that fills the frame comes back unseparated. Layers in front keep your own pixels and stay sharp; the background is repainted by the model at 640px, so it is softer. The cut edge comes from that 640px matte -- refine it with Select and Mask if you need a clean cut-out.</div>
          </div>
          <div class="field img2img-field">
            <span class="label">Workflow</span>
            <select class="select" id="unflatten-workflow">
              ${listRunnableWorkflowPresets("unflatten").map((preset) => `<option value="${preset.id}">${preset.displayName}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <span class="label">Layered model</span>
            <select class="select" id="unflatten-checkpoint">
              ${createUnflattenModelOptionsMarkup()}
            </select>
          </div>
          <div class="settings-grid img2img-settings-grid" aria-label="Unflatten settings">
            <div class="field">
              <span class="label">Layers</span>
              <input class="input input-compact" id="unflatten-layer-count" type="number" min="${MIN_UNFLATTEN_LAYER_COUNT}" max="${MAX_UNFLATTEN_LAYER_COUNT}" step="1" value="${DEFAULT_UNFLATTEN_LAYER_COUNT}" />
            </div>
            <div class="field">
              <span class="label">Steps</span>
              <input class="input input-compact" id="unflatten-steps" type="number" min="1" max="150" step="1" value="${DEFAULT_UNFLATTEN_STEPS}" />
            </div>
            <div class="field settings-seed">
              <span class="label">Seed</span>
              <input class="input input-compact" id="unflatten-seed" type="text" inputmode="numeric" placeholder="Random" />
            </div>
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate-unflatten" data-openlayer-action="generateUnflatten" type="button">Unflatten</button>
          <button class="button button-wide action-control cancel-generation-button" data-openlayer-action="cancelGeneration" type="button" hidden>Cancel Generation</button>
        </section>

        <section class="generation-status-panel img2img-status-panel" aria-label="Unflatten status">
          <div class="status-bar" role="status">
            <span class="status-text" id="unflatten-status-text">Ready.</span>
            <span class="status-pill idle" id="unflatten-status-pill">Status</span>
          </div>
          <div class="status-progress" id="unflatten-status-progress" hidden><span></span></div>
          <div class="diagnostics-line" id="unflatten-diagnostics-text">Capture a layer, describe it, then Unflatten.</div>
          <div class="error-message" id="unflatten-error-message" hidden></div>
        </section>

        <section class="panel-section result-panel img2img-result-panel" aria-label="Unflatten result">
          <div class="section-heading">
            <span class="label">Result preview</span>
            <span class="muted-label" id="unflatten-result-label">Reassembled picture appears here</span>
          </div>
          <div class="preview-panel" id="unflatten-result-preview-panel">
            <span class="preview-empty">No layers yet</span>
          </div>
          <div class="import-actions">
            <button class="button button-import button-import-blue action-control is-disabled" id="import-unflatten-result" data-openlayer-action="importUnflatten" type="button" tabindex="-1" aria-disabled="true">Import to Layers</button>
          </div>
        </section>
      </section>

      <section class="inpaint-view image-to-image-view" id="inpaint-view" aria-label="Inpaint" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("brush", "Inpaint")}
            <span class="screen-title">Inpaint</span>
          </div>
        </div>


        <section class="panel-section generator-panel source-panel" aria-label="Inpaint selection source">
          <div class="section-heading">
            <span class="label">Selection source</span>
            <span class="muted-label">Photoshop selection</span>
          </div>
          <div class="source-action-row" aria-label="Selection capture actions">
            <button class="button source-action-button action-control" id="capture-inpaint-selection" data-openlayer-action="captureInpaintSelection" type="button">Capture Visible</button>
            <button class="button source-action-button action-control" id="capture-inpaint-active-layer" data-openlayer-action="captureInpaintActiveLayer" type="button">Capture Active Layer</button>
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
          <div class="section-heading">
            <span class="label">Generate</span>
            <span class="muted-label">Prompt and mask settings</span>
          </div>
          <div class="field img2img-field">
            <span class="label">Prompt${createPromptWalletControlsMarkup("inpaint-prompt")}</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="inpaint-prompt" placeholder="Describe what should replace the selected area..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Negative prompt</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="inpaint-negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Workflow</span>
            <select class="select" id="inpaint-workflow">
              ${listWorkflowPresets("inpaint").map((preset) => `<option value="${preset.id}">${preset.label}${preset.status === "todo" ? " (setup required)" : ""}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <div class="field-label-row">
              <span class="label">Checkpoint</span>
              ${createInfoToggleMarkup("inpaint-compatibility-note")}
            </div>
            <select class="select" id="inpaint-checkpoint">
              ${FALLBACK_CHECKPOINTS.map((checkpoint) => `<option value="${checkpoint}">${checkpoint}</option>`).join("")}
            </select>
            ${createInfoPanelMarkup("inpaint-compatibility-note", "Capture a Photoshop selection, then generate; the result imports with your exact selection as a layer mask.")}
          </div>
          <div class="settings-grid img2img-settings-grid" aria-label="Inpaint settings">
            <div class="field">
              <span class="label">Steps</span>
              <input class="input input-compact" id="inpaint-steps" type="number" min="1" max="150" step="1" value="${DEFAULT_INPAINT_STEPS}" aria-describedby="inpaint-locked-settings-note" />
            </div>
            <div class="field">
              <span class="label">CFG</span>
              <input class="input input-compact" id="inpaint-cfg" type="number" min="1" max="30" step="0.5" value="${DEFAULT_CFG}" aria-describedby="inpaint-locked-settings-note" />
            </div>
            <div class="field">
              <span class="label">Denoise</span>
              <input class="input input-compact" id="inpaint-denoise" type="number" min="0.05" max="1" step="0.05" value="${DEFAULT_INPAINT_DENOISE}" aria-describedby="inpaint-locked-settings-note" />
            </div>
            <div class="field settings-seed">
              <span class="label">Seed</span>
              <input class="input input-compact" id="inpaint-seed" type="text" inputmode="numeric" placeholder="Random" />
            </div>
          </div>
          <span class="compatibility-note" id="inpaint-locked-settings-note" hidden></span>
          <button class="button button-primary button-generate button-wide action-control" id="generate-inpaint" data-openlayer-action="generateInpaint" type="button">Generate Inpaint</button>
          <button class="button button-wide action-control cancel-generation-button" data-openlayer-action="cancelGeneration" type="button" hidden>Cancel Generation</button>
        </section>

        <section class="generation-status-panel img2img-status-panel" aria-label="Inpaint status">
          <div class="status-bar" role="status">
            <span class="status-text" id="inpaint-status-text">Ready.</span>
            <span class="status-pill idle" id="inpaint-status-pill">Status</span>
          </div>
          <div class="status-progress" id="inpaint-status-progress" hidden><span></span></div>
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
            <button class="button auto-import-toggle action-control" id="inpaint-auto-import-toggle" data-openlayer-action="toggleInpaintAutoImport" type="button" aria-pressed="false">Import Automatically</button>
          </div>
        </section>
      </section>

      <section class="outpaint-view image-to-image-view" id="outpaint-view" aria-label="Outpaint" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("expand", "Outpaint")}
            <span class="screen-title">Outpaint</span>
          </div>
        </div>


        <section class="panel-section generator-panel source-panel" aria-label="Outpaint source">
          <div class="section-heading">
            <span class="label">Source layer</span>
            <span class="muted-label">Flux Fill input</span>
          </div>
          <div class="source-action-row" aria-label="Outpaint source capture actions">
            <button class="button source-action-button action-control" id="capture-outpaint-source" data-openlayer-action="captureOutpaintSource" type="button">Capture Active Layer</button>
            <button class="button source-action-button action-control" id="capture-outpaint-canvas-source" data-openlayer-action="captureOutpaintCanvasSource" type="button">Capture Canvas</button>
          </div>
          <div class="source-card">
            <div class="source-thumb-frame" id="outpaint-source-preview-panel">
              <span class="source-empty">None</span>
            </div>
            <div class="source-card-body">
              <span class="source-title" id="outpaint-source-title">No source captured</span>
              <span class="source-card-meta" id="outpaint-source-meta">Choose active layer or full canvas.</span>
            </div>
          </div>
        </section>

        <section class="panel-section generator-panel img2img-form-panel" aria-label="Outpaint prompt">
          <div class="section-heading">
            <span class="label">Generate</span>
            <span class="muted-label">Prompt and expansion</span>
          </div>
          <div class="field img2img-field">
            <span class="label">Prompt${createPromptWalletControlsMarkup("outpaint-prompt")}</span>
            <textarea maxlength="10000" class="textarea compact-textarea" id="outpaint-prompt" placeholder="Describe what should extend beyond the current image..."></textarea>
          </div>
          <div class="field img2img-field">
            <span class="label">Workflow</span>
            <select class="select" id="outpaint-workflow">
              ${listRunnableWorkflowPresets("outpaint").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <div class="field-label-row">
              <span class="label">Model</span>
              ${createInfoToggleMarkup("outpaint-compatibility-note")}
            </div>
            <select class="select" id="outpaint-checkpoint">
              ${FALLBACK_CHECKPOINTS.map((checkpoint) => `<option value="${checkpoint}">${checkpoint}</option>`).join("")}
            </select>
            ${createInfoPanelMarkup("outpaint-compatibility-note", "Outpaint uses Flux Fill diffusion models and ImagePadForOutpaint.")}
          </div>
          <div class="settings-grid img2img-settings-grid" aria-label="Outpaint settings">
            <div class="field">
              <span class="label">Steps</span>
              <input class="input input-compact" id="outpaint-steps" type="number" min="1" max="150" step="1" value="${DEFAULT_OUTPAINT_STEPS}" />
            </div>
            <div class="field">
              <span class="label">Guidance</span>
              <input class="input input-compact" id="outpaint-guidance" type="number" min="0" max="60" step="0.5" value="${DEFAULT_OUTPAINT_GUIDANCE}" />
            </div>
            <div class="field">
              <span class="label">Denoise</span>
              <input class="input input-compact" id="outpaint-denoise" type="number" min="0.05" max="1" step="0.05" value="${DEFAULT_OUTPAINT_DENOISE}" />
            </div>
            <div class="field settings-seed">
              <span class="label">Seed</span>
              <input class="input input-compact" id="outpaint-seed" type="text" inputmode="numeric" placeholder="Random" />
            </div>
          </div>
          <div class="settings-grid img2img-settings-grid" aria-label="Outpaint expansion settings">
            <div class="field">
              <span class="label">Left</span>
              <input class="input input-compact" id="outpaint-left" type="number" min="0" max="2048" step="8" value="${DEFAULT_OUTPAINT_LEFT}" />
            </div>
            <div class="field">
              <span class="label">Top</span>
              <input class="input input-compact" id="outpaint-top" type="number" min="0" max="2048" step="8" value="${DEFAULT_OUTPAINT_TOP}" />
            </div>
            <div class="field">
              <span class="label">Right</span>
              <input class="input input-compact" id="outpaint-right" type="number" min="0" max="2048" step="8" value="${DEFAULT_OUTPAINT_RIGHT}" />
            </div>
            <div class="field">
              <span class="label">Bottom</span>
              <input class="input input-compact" id="outpaint-bottom" type="number" min="0" max="2048" step="8" value="${DEFAULT_OUTPAINT_BOTTOM}" />
            </div>
            <div class="field">
              <span class="label">Feather</span>
              <input class="input input-compact" id="outpaint-feathering" type="number" min="0" max="256" step="1" value="${DEFAULT_OUTPAINT_FEATHERING}" />
            </div>
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate-outpaint" data-openlayer-action="generateOutpaint" type="button">Generate Outpaint</button>
          <button class="button button-wide action-control cancel-generation-button" data-openlayer-action="cancelGeneration" type="button" hidden>Cancel Generation</button>
        </section>

        <section class="generation-status-panel img2img-status-panel" aria-label="Outpaint status">
          <div class="status-bar" role="status">
            <span class="status-text" id="outpaint-status-text">Ready.</span>
            <span class="status-pill idle" id="outpaint-status-pill">Status</span>
          </div>
          <div class="status-progress" id="outpaint-status-progress" hidden><span></span></div>
          <div class="diagnostics-line" id="outpaint-diagnostics-text">Capture a source, then extend it with Flux Fill outpaint.</div>
          <div class="error-message" id="outpaint-error-message" hidden></div>
        </section>

        <section class="panel-section result-panel img2img-result-panel" aria-label="Outpaint result">
          <div class="section-heading">
            <span class="label">Result preview</span>
            <span class="muted-label">Generated result appears here</span>
          </div>
          <div class="preview-panel" id="outpaint-result-preview-panel">
            <span class="preview-empty">No Outpaint result yet</span>
          </div>
          <div class="import-actions">
            <button class="button button-import button-import-blue action-control is-disabled" id="import-outpaint-result" data-openlayer-action="importOutpaint" type="button" tabindex="-1" aria-disabled="true">Import to Layers</button>
          </div>
        </section>
      </section>

      <section class="upscale-view image-to-image-view" id="upscale-view" aria-label="Upscale" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("upscale", "Upscale")}
            <span class="screen-title">Upscale</span>
          </div>
        </div>

        <div class="tool-warning" role="note">
          Upscale uses pixel/model enlargement only. It does not reinterpret prompts or run diffusion sampling.
        </div>

        <section class="panel-section generator-panel source-panel" aria-label="Upscale source">
          <div class="section-heading">
            <span class="label">Source layer</span>
            <span class="muted-label">Pixel upscale input</span>
          </div>
          <div class="source-action-row" aria-label="Upscale source capture actions">
            <button class="button source-action-button action-control" id="capture-upscale-source" data-openlayer-action="captureUpscaleSource" type="button">Capture Active Layer</button>
            <button class="button source-action-button action-control" id="capture-upscale-canvas-source" data-openlayer-action="captureUpscaleCanvasSource" type="button">Capture Canvas</button>
          </div>
          <div class="source-card">
            <div class="source-thumb-frame" id="upscale-source-preview-panel">
              <span class="source-empty">None</span>
            </div>
            <div class="source-card-body">
              <span class="source-title" id="upscale-source-title">No source captured</span>
              <span class="source-card-meta" id="upscale-source-meta">Choose active layer or full canvas.</span>
            </div>
          </div>
        </section>

        <section class="panel-section generator-panel img2img-form-panel" aria-label="Upscale settings">
          <div class="section-heading">
            <span class="label">Upscale</span>
            <span class="muted-label">Model and workflow</span>
          </div>
          <div class="field img2img-field">
            <span class="label">Workflow</span>
            <select class="select" id="upscale-workflow">
              ${listRunnableWorkflowPresets("upscale").map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
            </select>
          </div>
          <div class="field img2img-field">
            <div class="field-label-row">
              <span class="label">Upscale model</span>
              ${createInfoToggleMarkup("upscale-compatibility-note")}
            </div>
            <select class="select" id="upscale-model">
              ${FALLBACK_UPSCALE_MODELS.map((model) => `<option value="${model}">${model}</option>`).join("")}
            </select>
            ${createInfoPanelMarkup("upscale-compatibility-note", "upscale-basic needs UpscaleModelLoader and ImageUpscaleWithModel in ComfyUI.")}
          </div>
          <button class="button button-primary button-generate button-wide action-control" id="generate-upscale" data-openlayer-action="generateUpscale" type="button">Generate Upscale</button>
          <button class="button button-wide action-control cancel-generation-button" data-openlayer-action="cancelGeneration" type="button" hidden>Cancel Generation</button>
        </section>

        <section class="generation-status-panel img2img-status-panel" aria-label="Upscale status">
          <div class="status-bar" role="status">
            <span class="status-text" id="upscale-status-text">Ready.</span>
            <span class="status-pill idle" id="upscale-status-pill">Status</span>
          </div>
          <div class="status-progress" id="upscale-status-progress" hidden><span></span></div>
          <div class="diagnostics-line" id="upscale-diagnostics-text">Capture a source, then upscale with a ComfyUI upscale model.</div>
          <div class="error-message" id="upscale-error-message" hidden></div>
        </section>

        <section class="panel-section result-panel img2img-result-panel" aria-label="Upscale result">
          <div class="section-heading">
            <span class="label">Result preview</span>
            <span class="muted-label">Generated upscale appears here</span>
          </div>
          <div class="preview-panel" id="upscale-result-preview-panel">
            <span class="preview-empty">No Upscale result yet</span>
          </div>
          <div class="import-actions">
            <button class="button button-import button-import-blue action-control is-disabled" id="import-upscale-result" data-openlayer-action="importUpscale" type="button" tabindex="-1" aria-disabled="true">Import to Layers</button>
            <button class="button auto-import-toggle action-control" id="upscale-auto-import-toggle" data-openlayer-action="toggleUpscaleAutoImport" type="button" aria-pressed="false">Import Automatically</button>
          </div>
        </section>
      </section>

      <section class="layer-tools-view" id="layer-tools-view" aria-label="Layer Tools" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("layers", "Layer Tools")}
            <span class="screen-title">Layer Tools</span>
          </div>
        </div>

        <section class="panel-section" aria-label="Export destinations">
          <div class="section-heading">
            <span class="label">Export</span>
            <span class="muted-label">PNG</span>
          </div>
          <p class="field-hint">
            Save to a file you choose, or send straight into ComfyUI's input folder so a workflow can
            reference it without any file shuffling.
          </p>

          <div class="layer-export-row">
            <span class="label">Active layer</span>
            <div class="layer-export-actions">
              <button class="button action-control" id="export-layer-file" data-openlayer-action="exportLayerToFile" type="button">Save As…</button>
              <button class="button action-control" id="export-layer-comfy" data-openlayer-action="exportLayerToComfyUI" type="button">Send to ComfyUI</button>
            </div>
          </div>

          <div class="layer-export-row">
            <span class="label">Selection</span>
            <div class="layer-export-actions">
              <button class="button action-control" id="export-selection-file" data-openlayer-action="exportSelectionToFile" type="button">Save As…</button>
              <button class="button action-control" id="export-selection-comfy" data-openlayer-action="exportSelectionToComfyUI" type="button">Send to ComfyUI</button>
            </div>
          </div>

          <div class="layer-export-row">
            <span class="label">Selection mask</span>
            <div class="layer-export-actions">
              <button class="button action-control" id="export-mask-file" data-openlayer-action="exportMaskToFile" type="button">Save As…</button>
              <button class="button action-control" id="export-mask-comfy" data-openlayer-action="exportMaskToComfyUI" type="button">Send to ComfyUI</button>
            </div>
          </div>
        </section>

        <section class="panel-section" aria-label="Layer Tools status">
          <div class="section-heading">
            <span class="label">Status</span>
            <span class="muted-label">Export</span>
          </div>
          <div class="status-bar" role="status">
            <span class="status-text" id="layer-tools-status-text">Ready.</span>
            <span class="status-pill idle" id="layer-tools-status-pill">Status</span>
          </div>
        </section>
      </section>

      <section class="custom-workflow-view setup-view" id="custom-workflow-view" aria-label="Workflow" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("workflow", "Workflow")}
            <span class="screen-title">Workflow</span>
          </div>
        </div>

        <section class="panel-section settings-panel diagnostic-section diagnostic-scroll-safe" aria-label="Check a custom workflow">
          <div class="section-heading">
            <span class="label">Check a custom workflow</span>
            <span class="muted-label">Validate only</span>
          </div>
          <div class="diagnostics-line setup-paragraph">
            Paste a ComfyUI workflow to find out whether this ComfyUI could run it. In ComfyUI use
            Workflow &gt; Export (API), not Save. Nothing is generated here and OpenLayer does not take
            the graph over -- this reports what is installed and what is missing.
          </div>
          <div class="field">
            <span class="label">Workflow JSON</span>
            <textarea maxlength="2000000" class="textarea compact-textarea" id="custom-workflow-input" placeholder="Paste the exported API workflow JSON here..."></textarea>
          </div>
          <button class="button button-primary button-wide action-control" id="check-custom-workflow" data-openlayer-action="checkCustomWorkflow" type="button">Check This Workflow</button>
          <div class="status-bar" role="status">
            <span class="status-text" id="custom-workflow-status-text">Ready.</span>
            <span class="status-pill idle" id="custom-workflow-status-pill">Status</span>
          </div>
          <div class="diagnostics-line setup-paragraph" id="custom-workflow-summary"></div>
          <div class="error-message" id="custom-workflow-error" hidden></div>
        </section>

        <div id="custom-workflow-results"></div>
      </section>

      <section class="workflow-presets-view setup-view" id="workflow-presets-view" aria-label="Workflow Presets" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("control", "Workflow Presets")}
            <span class="screen-title">Workflow Presets</span>
          </div>
        </div>

        <section class="panel-section settings-panel diagnostic-section diagnostic-scroll-safe" aria-label="Workflow preset catalogue">
          <div class="section-heading">
            <span class="label">Every preset OpenLayer ships</span>
            <span class="muted-label" id="workflow-presets-summary"></span>
          </div>
          <div class="diagnostics-line setup-paragraph">
            These are the routes behind each tool's Workflow dropdown. Read from the plugin itself, so this list is
            true whether or not ComfyUI is running. For what still needs downloading, open Setup.
          </div>
        </section>

        <div id="workflow-presets-list"></div>
      </section>

      <section class="setup-view" id="setup-view" aria-label="Setup" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("control", "Setup")}
            <span class="screen-title">Setup</span>
          </div>
        </div>

        <section class="panel-section settings-panel diagnostic-section diagnostic-scroll-safe" aria-label="Setup requirements">
          <div class="section-heading">
            <span class="label">Requirements</span>
            <span class="muted-label" id="setup-checked-label">Not checked yet.</span>
          </div>
          <div class="diagnostic-summary-grid" id="setup-tallies" aria-label="Setup requirement counts"></div>
          <div class="diagnostics-line setup-paragraph" id="setup-summary-line">
            Open this screen to check what OpenLayer needs.
          </div>
          <div class="diagnostics-line setup-paragraph" id="setup-download-line"></div>
          <button class="button action-control" id="setup-check" data-openlayer-action="checkSetup" type="button">Check Again</button>
          <div class="status-bar" role="status">
            <span class="status-text" id="setup-status-text">Setup ready.</span>
            <span class="status-pill idle" id="setup-status-pill">Status</span>
          </div>
        </section>

        <div class="setup-filter-row" id="setup-filters" aria-label="Filter requirements by tool"></div>

        <div id="setup-sections"></div>

        <section class="panel-section settings-panel diagnostic-section diagnostic-scroll-safe" aria-label="What will run well">
          <div class="section-heading">
            <span class="label">What will run well</span>
            <span class="muted-label" id="setup-vram-label">VRAM not detected</span>
          </div>
          <div class="diagnostics-line setup-paragraph" id="setup-outlook-note">
            Sizes are model weights, not measured VRAM use. ComfyUI moves what does not fit into system RAM, so a large stack runs slower rather than failing.
          </div>
          <div id="setup-outlook-list"></div>
        </section>

        <section class="panel-section settings-panel diagnostic-section diagnostic-scroll-safe" aria-label="Agent Bridge">
          <div class="section-heading">
            <span class="label">Agent Bridge</span>
            <span class="muted-label">Experimental</span>
          </div>
          <div class="diagnostics-line setup-paragraph">
            Lets an AI assistant drive OpenLayer's tools through the Model Context Protocol, instead of only panel clicks. It runs entirely on this machine and is off unless you turn it on. The bridge program is installed separately &mdash; see <code>bridge/README.md</code>.
          </div>
          <div class="settings-grid" aria-label="Agent Bridge settings">
            <label class="field">
              <span class="label">Bridge port</span>
              <input class="input input-compact" id="agent-bridge-port" type="number" min="1" max="65535" step="1" value="${DEFAULT_AGENT_BRIDGE_PORT}" />
            </label>
          </div>
          <button class="button action-control" id="agent-bridge-toggle" data-openlayer-action="toggleAgentBridge" type="button" aria-pressed="false">Turn Agent Bridge On</button>
          <div class="status-bar" role="status">
            <span class="status-text" id="agent-bridge-status-text">Agent Bridge is off.</span>
            <span class="status-pill idle" id="agent-bridge-status-pill">Status</span>
          </div>
        </section>
      </section>

      <section class="history-view" id="history-view" aria-label="History" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("history", "History")}
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

      <section class="prompt-wallet-view history-view" id="prompt-wallet-view" aria-label="Prompt Wallet" hidden>
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="home">Back to Tools</div>
          <div class="screen-title-block">
            ${createScreenIconMarkup("promptFromLayer", "Prompt Wallet")}
            <span class="screen-title">Prompt Wallet</span>
          </div>
        </div>

        <section class="panel-section" aria-label="Saved prompts">
          <div class="prompt-wallet-banner" id="prompt-wallet-banner" hidden></div>
          <div class="section-heading">
            <span class="label">Saved prompts</span>
            <span class="muted-label" id="prompt-wallet-count"></span>
          </div>
          <input
            class="input prompt-wallet-search"
            id="prompt-wallet-search"
            type="text"
            placeholder="Search saved prompts..."
            aria-label="Search saved prompts"
          />
          <div class="history-list" id="prompt-wallet-list"></div>
        </section>
      </section>

      <footer class="app-footer">
        <span>OpenLayer v${APP_VERSION} &copy; By Mehran Ahmadi 2026</span>
      </footer>
    </main>
  `;
}

function createBrandHeaderMarkup() {
  return `
    <header class="app-header" id="app-header">
      <div class="brand-lockup">
        <img class="brand-icon" src="icons/openlayer-icon.png" alt="" width="48" height="48" />
        <div>
          <h1 class="app-title">OpenLayer</h1>
          <p class="app-subtitle">Local AI layers for Photoshop</p>
        </div>
      </div>
    </header>
  `;
}

function createToolCardMarkup(card: ToolCard) {
  const isEnabled = card.status !== "coming-soon";
  const viewAttribute = isEnabled && card.view ? ` data-openlayer-view="${card.view}"` : "";
  const disabledAttributes = isEnabled ? "" : ` aria-disabled="true" tabindex="-1"`;

  return `
    <div
      class="tool-card ol-row is-${card.status}"
      role="button"
      tabindex="${isEnabled ? "0" : "-1"}"
      data-tool-id="${card.id}"
      ${viewAttribute}
      ${disabledAttributes}
    >
      <div class="tool-icon ol-row-icon" aria-hidden="true">${createToolIconMarkup(card.icon)}</div>
      <div class="tool-card-body ol-row-main">
        <div class="tool-title-row">
          <div class="tool-title ol-row-title">${card.title}</div>
        </div>
        <div class="tool-subtitle ol-row-desc">${card.subtitle}</div>
      </div>
      <div class="tool-arrow ol-row-chevron" aria-hidden="true">${isEnabled ? "&rsaquo;" : ""}</div>
    </div>
  `;
}

function createHomeToolSectionMarkup(section: { title: string; toolIds: string[] }) {
  const cards = section.toolIds
    .map((toolId) => TOOL_CARDS.find((card) => card.id === toolId))
    .filter((card): card is ToolCard => Boolean(card));

  // Only the Workflow group is collapsible (and starts collapsed); the other
  // groups are static labels for a flat, compact dashboard.
  const isCollapsible = section.title === "Workflow";

  if (isCollapsible) {
    return `
    <section class="home-section ol-section is-collapsible" aria-label="${section.title}">
      <div class="home-section-title ol-section-header" role="button" tabindex="0" aria-expanded="false" data-openlayer-section-toggle>
        <span class="home-section-chevron ol-section-chevron" aria-hidden="true"></span>
        <span>${section.title}</span>
      </div>
      <div class="tool-list ol-section-body">
        ${cards.map(createToolCardMarkup).join("")}
      </div>
    </section>
  `;
  }

  return `
    <section class="home-section ol-section is-open is-static" aria-label="${section.title}">
      <div class="home-section-title ol-section-header is-static">
        <span>${section.title}</span>
      </div>
      <div class="tool-list ol-section-body">
        ${cards.map(createToolCardMarkup).join("")}
      </div>
    </section>
  `;
}

/**
 * The starting contents of the Klein model dropdown.
 *
 * Taken from the preset's own stack rather than from FALLBACK_CHECKPOINTS,
 * which lists SD 1.x checkpoints -- the wrong kind of file for a diffusion
 * model stack, and misleading in the seconds before ComfyUI answers with what
 * is actually installed.
 */
function createUnflattenModelOptionsMarkup() {
  const preset = getWorkflowPreset("unflatten-qwen-layered");
  const modelName = preset.modelStack?.find((model) => model.kind === preset.modelSource.kind)?.modelName;

  return modelName ? `<option value="${modelName}">${modelName}</option>` : "";
}

function createMultiReferenceModelOptionsMarkup() {
  const preset = getWorkflowPreset("multi-reference-flux2-klein");
  const modelName = preset.modelStack?.find((model) => model.kind === preset.modelSource.kind)?.modelName;

  return modelName ? `<option value="${modelName}">${modelName}</option>` : "";
}

function createToolIconMarkup(icon: ToolIconName) {
  const icons: Record<ToolIconName, string> = {
    image: "image-to-image.png",
    imagePlus: "text-to-image.png",
    brush: "inpaint.png",
    expand: "outpaint.png",
    lineart: "sketch-to-image.png",
    promptFromLayer: "prompt-from-layer.png",
    upscale: "upscale.png",
    // Live Painting and Style Reference shared one file until v0.18. They are
    // separate names now so replacing either one's art cannot change the other.
    livePainting: "live-painting.png",
    styleReference: "style-reference.png",
    multiReference: "multi-reference.png",
    unflatten: "unflatten.png",
    control: "workflow-presets.png",
    workflow: "workflow.png",
    layers: "layer-tools.png",
    history: "history.png",
    settings: "settings.png"
  };

  return `<img class="icon-image" src="icons/tools/${icons[icon]}" alt="" aria-hidden="true" />`;
}

function createScreenIconMarkup(icon: ToolIconName, label: string) {
  return `<span class="screen-kicker screen-icon" aria-label="${label}" title="${label}">${createToolIconMarkup(icon)}</span>`;
}

/**
 * The small circular Wallet save control, inline in the "Prompt" label itself
 * rather than in its own row below the field -- a full row read as too heavy
 * for what is a small, secondary action, and sitting inside the label keeps
 * it out of the way of the field it belongs to.
 *
 * A circle rather than a labelled button so it stays small. Both a title and
 * an aria-label carry the meaning, and pressing it reports what happened in
 * the tool's own status line, so the colour never has to be self-explanatory.
 *
 * `fieldId` is the positive prompt's own element id, reused as the button id
 * prefix so two tools' controls can never collide.
 */
function createPromptWalletControlsMarkup(fieldId: string) {
  return `<button
    class="prompt-wallet-dot prompt-wallet-save is-disabled"
    id="${fieldId}-wallet-save"
    type="button"
    aria-disabled="true"
    aria-label="Save this prompt to the Wallet"
    title="Save this prompt to the Wallet"
  >+</button><button
    class="prompt-wallet-dot prompt-wallet-load is-disabled"
    id="${fieldId}-wallet-load"
    type="button"
    aria-disabled="true"
    aria-label="Load a prompt from the Wallet"
    title="Load a prompt from the Wallet"
  >↓</button>`;
}

function createInfoToggleMarkup(targetId: string) {
  return `
    <button
      class="info-toggle"
      type="button"
      aria-label="Show setup note"
      aria-expanded="false"
      aria-controls="${targetId}"
      data-openlayer-info-toggle="${targetId}"
      title="Show setup note"
    ><span class="info-toggle-glyph" aria-hidden="true">?</span></button>
  `;
}

function createInfoPanelMarkup(targetId: string, text: string) {
  return `<div class="compatibility-note info-panel" id="${targetId}" hidden>${text}</div>`;
}

export function getAppElements(rootElement: HTMLElement): AppElements {
  return {
    appShell: getElement<HTMLElement>(rootElement, "app-shell"),
    welcomeOverlay: getElement<HTMLElement>(rootElement, "welcome-overlay"),
    welcomeStatusText: getElement<HTMLElement>(rootElement, "welcome-status-text"),
    welcomeManualRow: getElement<HTMLElement>(rootElement, "welcome-manual-row"),
    welcomeServerUrlInput: getElement<HTMLInputElement>(rootElement, "welcome-server-url"),
    welcomeRetryButton: getElement<HTMLButtonElement>(rootElement, "welcome-retry"),
    welcomeContinueButton: getElement<HTMLButtonElement>(rootElement, "welcome-continue"),
    welcomeSkipButton: getElement<HTMLButtonElement>(rootElement, "welcome-skip"),
    homeView: getElement<HTMLElement>(rootElement, "home-view"),
    generatorView: getElement<HTMLElement>(rootElement, "generator-view"),
    imageToImageView: getElement<HTMLElement>(rootElement, "image-to-image-view"),
    sketchToImageView: getElement<HTMLElement>(rootElement, "sketch-to-image-view"),
    inpaintView: getElement<HTMLElement>(rootElement, "inpaint-view"),
    outpaintView: getElement<HTMLElement>(rootElement, "outpaint-view"),
    promptFromLayerView: getElement<HTMLElement>(rootElement, "prompt-from-layer-view"),
    upscaleView: getElement<HTMLElement>(rootElement, "upscale-view"),
    settingsView: getElement<HTMLElement>(rootElement, "settings-view"),
    setupView: getElement<HTMLElement>(rootElement, "setup-view"),
    setupCheckedLabel: getElement<HTMLElement>(rootElement, "setup-checked-label"),
    setupTallies: getElement<HTMLElement>(rootElement, "setup-tallies"),
    setupSummaryLine: getElement<HTMLElement>(rootElement, "setup-summary-line"),
    setupDownloadLine: getElement<HTMLElement>(rootElement, "setup-download-line"),
    setupCheck: getElement<HTMLButtonElement>(rootElement, "setup-check"),
    setupStatusText: getElement<HTMLElement>(rootElement, "setup-status-text"),
    setupStatusPill: getElement<HTMLElement>(rootElement, "setup-status-pill"),
    setupFilters: getElement<HTMLElement>(rootElement, "setup-filters"),
    setupSections: getElement<HTMLElement>(rootElement, "setup-sections"),
    setupVramLabel: getElement<HTMLElement>(rootElement, "setup-vram-label"),
    setupOutlookList: getElement<HTMLElement>(rootElement, "setup-outlook-list"),
    suggestPrompt: getElement<HTMLElement>(rootElement, "suggest-prompt"),
    agentBridgePort: getElement<HTMLInputElement>(rootElement, "agent-bridge-port"),
    agentBridgeToggle: getElement<HTMLElement>(rootElement, "agent-bridge-toggle"),
    agentBridgeStatusText: getElement<HTMLElement>(rootElement, "agent-bridge-status-text"),
    agentBridgeStatusPill: getElement<HTMLElement>(rootElement, "agent-bridge-status-pill"),
    historyView: getElement<HTMLElement>(rootElement, "history-view"),
    promptWalletView: getElement<HTMLElement>(rootElement, "prompt-wallet-view"),
    promptWalletList: getElement<HTMLElement>(rootElement, "prompt-wallet-list"),
    promptWalletSearch: getElement<HTMLInputElement>(rootElement, "prompt-wallet-search"),
    promptWalletCount: getElement<HTMLElement>(rootElement, "prompt-wallet-count"),
    promptWalletBanner: getElement<HTMLElement>(rootElement, "prompt-wallet-banner"),
    layerToolsView: getElement<HTMLElement>(rootElement, "layer-tools-view"),
    exportLayerFileButton: getElement<HTMLElement>(rootElement, "export-layer-file"),
    exportLayerComfyButton: getElement<HTMLElement>(rootElement, "export-layer-comfy"),
    exportSelectionFileButton: getElement<HTMLElement>(rootElement, "export-selection-file"),
    exportSelectionComfyButton: getElement<HTMLElement>(rootElement, "export-selection-comfy"),
    exportMaskFileButton: getElement<HTMLElement>(rootElement, "export-mask-file"),
    exportMaskComfyButton: getElement<HTMLElement>(rootElement, "export-mask-comfy"),
    layerToolsStatusText: getElement<HTMLElement>(rootElement, "layer-tools-status-text"),
    layerToolsStatusPill: getElement<HTMLElement>(rootElement, "layer-tools-status-pill"),
    appHeader: getElement<HTMLElement>(rootElement, "app-header"),
    homeStatusRow: getElement<HTMLElement>(rootElement, "home-status-row"),
    homeStatusText: getElement<HTMLElement>(rootElement, "home-status-text"),
    homeStatusDot: getElement<HTMLElement>(rootElement, "home-status-dot"),
    serverUrl: getElement<HTMLInputElement>(rootElement, "server-url"),
    prompt: getElement<HTMLTextAreaElement>(rootElement, "prompt"),
    promptWalletSave: getElement<HTMLElement>(rootElement, "prompt-wallet-save"),
    promptWalletLoad: getElement<HTMLElement>(rootElement, "prompt-wallet-load"),
    negativePrompt: getElement<HTMLTextAreaElement>(rootElement, "negative-prompt"),
    workflow: getElement<HTMLSelectElement>(rootElement, "workflow"),
    checkpoint: getElement<HTMLSelectElement>(rootElement, "checkpoint"),
    loraField: getElement<HTMLElement>(rootElement, "lora-field"),
    loraName: getElement<HTMLSelectElement>(rootElement, "lora-name"),
    loraStrengthField: getElement<HTMLElement>(rootElement, "lora-strength-field"),
    loraStrength: getElement<HTMLInputElement>(rootElement, "lora-strength"),
    loraNote: getElement<HTMLElement>(rootElement, "lora-note"),
    imgLoraField: getElement<HTMLElement>(rootElement, "img-lora-field"),
    imgLoraName: getElement<HTMLSelectElement>(rootElement, "img-lora-name"),
    imgLoraStrengthField: getElement<HTMLElement>(rootElement, "img-lora-strength-field"),
    imgLoraStrength: getElement<HTMLInputElement>(rootElement, "img-lora-strength"),
    imgLoraNote: getElement<HTMLElement>(rootElement, "img-lora-note"),
    sketchLoraField: getElement<HTMLElement>(rootElement, "sketch-lora-field"),
    sketchLoraName: getElement<HTMLSelectElement>(rootElement, "sketch-lora-name"),
    sketchLoraStrengthField: getElement<HTMLElement>(rootElement, "sketch-lora-strength-field"),
    sketchLoraStrength: getElement<HTMLInputElement>(rootElement, "sketch-lora-strength"),
    sketchLoraNote: getElement<HTMLElement>(rootElement, "sketch-lora-note"),
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
    spikeModelDownloadButton: getElement<HTMLElement>(rootElement, "spike-model-download"),
    saveSettingsButton: getElement<HTMLElement>(rootElement, "save-settings"),
    resetSettingsButton: getElement<HTMLElement>(rootElement, "reset-settings"),
    generateButton: getElement<HTMLElement>(rootElement, "generate"),
    cancelGenerateButton: getElement<HTMLElement>(rootElement, "cancel-generation"),
    cancelGenerationButtons: Array.from(rootElement.querySelectorAll<HTMLElement>(".cancel-generation-button")),
    importButton: getElement<HTMLElement>(rootElement, "import-result"),
    autoImportToggle: getElement<HTMLElement>(rootElement, "auto-import-toggle"),
    imgPrompt: getElement<HTMLTextAreaElement>(rootElement, "img-prompt"),
    imgPromptWalletSave: getElement<HTMLElement>(rootElement, "img-prompt-wallet-save"),
    imgPromptWalletLoad: getElement<HTMLElement>(rootElement, "img-prompt-wallet-load"),
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
    sketchPromptWalletSave: getElement<HTMLElement>(rootElement, "sketch-prompt-wallet-save"),
    sketchPromptWalletLoad: getElement<HTMLElement>(rootElement, "sketch-prompt-wallet-load"),
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
    inpaintPromptWalletSave: getElement<HTMLElement>(rootElement, "inpaint-prompt-wallet-save"),
    inpaintPromptWalletLoad: getElement<HTMLElement>(rootElement, "inpaint-prompt-wallet-load"),
    inpaintNegativePrompt: getElement<HTMLTextAreaElement>(rootElement, "inpaint-negative-prompt"),
    inpaintWorkflow: getElement<HTMLSelectElement>(rootElement, "inpaint-workflow"),
    inpaintCheckpoint: getElement<HTMLSelectElement>(rootElement, "inpaint-checkpoint"),
    inpaintSteps: getElement<HTMLInputElement>(rootElement, "inpaint-steps"),
    inpaintCfg: getElement<HTMLInputElement>(rootElement, "inpaint-cfg"),
    inpaintSeed: getElement<HTMLInputElement>(rootElement, "inpaint-seed"),
    inpaintDenoise: getElement<HTMLInputElement>(rootElement, "inpaint-denoise"),
    inpaintLockedSettingsNote: getElement<HTMLElement>(rootElement, "inpaint-locked-settings-note"),
    captureInpaintSelectionButton: getElement<HTMLElement>(rootElement, "capture-inpaint-selection"),
    captureInpaintActiveLayerButton: getElement<HTMLElement>(rootElement, "capture-inpaint-active-layer"),
    generateInpaintButton: getElement<HTMLElement>(rootElement, "generate-inpaint"),
    importInpaintButton: getElement<HTMLElement>(rootElement, "import-inpaint-result"),
    inpaintAutoImportToggle: getElement<HTMLElement>(rootElement, "inpaint-auto-import-toggle"),
    outpaintPrompt: getElement<HTMLTextAreaElement>(rootElement, "outpaint-prompt"),
    outpaintPromptWalletSave: getElement<HTMLElement>(rootElement, "outpaint-prompt-wallet-save"),
    outpaintPromptWalletLoad: getElement<HTMLElement>(rootElement, "outpaint-prompt-wallet-load"),
    outpaintWorkflow: getElement<HTMLSelectElement>(rootElement, "outpaint-workflow"),
    outpaintCheckpoint: getElement<HTMLSelectElement>(rootElement, "outpaint-checkpoint"),
    outpaintSteps: getElement<HTMLInputElement>(rootElement, "outpaint-steps"),
    outpaintGuidance: getElement<HTMLInputElement>(rootElement, "outpaint-guidance"),
    outpaintSeed: getElement<HTMLInputElement>(rootElement, "outpaint-seed"),
    outpaintDenoise: getElement<HTMLInputElement>(rootElement, "outpaint-denoise"),
    outpaintLeft: getElement<HTMLInputElement>(rootElement, "outpaint-left"),
    outpaintTop: getElement<HTMLInputElement>(rootElement, "outpaint-top"),
    outpaintRight: getElement<HTMLInputElement>(rootElement, "outpaint-right"),
    outpaintBottom: getElement<HTMLInputElement>(rootElement, "outpaint-bottom"),
    outpaintFeathering: getElement<HTMLInputElement>(rootElement, "outpaint-feathering"),
    captureOutpaintLayerButton: getElement<HTMLElement>(rootElement, "capture-outpaint-source"),
    captureOutpaintCanvasButton: getElement<HTMLElement>(rootElement, "capture-outpaint-canvas-source"),
    generateOutpaintButton: getElement<HTMLElement>(rootElement, "generate-outpaint"),
    importOutpaintButton: getElement<HTMLElement>(rootElement, "import-outpaint-result"),
    capturePromptLayerButton: getElement<HTMLElement>(rootElement, "capture-prompt-layer-source"),
    capturePromptCanvasButton: getElement<HTMLElement>(rootElement, "capture-prompt-canvas-source"),
    generatePromptLayerButton: getElement<HTMLElement>(rootElement, "generate-prompt-from-layer"),
    copyPromptLayerButton: getElement<HTMLElement>(rootElement, "copy-prompt-from-layer"),
    sendPromptLayerButton: getElement<HTMLElement>(rootElement, "send-prompt-to-text-to-image"),
    upscaleWorkflow: getElement<HTMLSelectElement>(rootElement, "upscale-workflow"),
    upscaleModel: getElement<HTMLSelectElement>(rootElement, "upscale-model"),
    captureUpscaleLayerButton: getElement<HTMLElement>(rootElement, "capture-upscale-source"),
    captureUpscaleCanvasButton: getElement<HTMLElement>(rootElement, "capture-upscale-canvas-source"),
    generateUpscaleButton: getElement<HTMLElement>(rootElement, "generate-upscale"),
    importUpscaleButton: getElement<HTMLElement>(rootElement, "import-upscale-result"),
    upscaleAutoImportToggle: getElement<HTMLElement>(rootElement, "upscale-auto-import-toggle"),
    imgAutoImportToggle: getElement<HTMLElement>(rootElement, "img2img-auto-import-toggle"),
    experimentalCheckpointToggle: getElement<HTMLElement>(rootElement, "experimental-checkpoint-toggle"),
    negativePromptToggle: getElement<HTMLElement>(rootElement, "negative-prompt-toggle"),
    negativePromptField: getElement<HTMLElement>(rootElement, "negative-prompt-field"),
    clearHistoryButton: getElement<HTMLElement>(rootElement, "clear-history"),
    statusText: getElement<HTMLElement>(rootElement, "status-text"),
    statusPill: getElement<HTMLElement>(rootElement, "status-pill"),
    statusProgress: getElement<HTMLElement>(rootElement, "status-progress"),
    imgStatusText: getElement<HTMLElement>(rootElement, "img-status-text"),
    imgStatusPill: getElement<HTMLElement>(rootElement, "img-status-pill"),
    imgStatusProgress: getElement<HTMLElement>(rootElement, "img-status-progress"),
    sketchStatusText: getElement<HTMLElement>(rootElement, "sketch-status-text"),
    sketchStatusPill: getElement<HTMLElement>(rootElement, "sketch-status-pill"),
    sketchStatusProgress: getElement<HTMLElement>(rootElement, "sketch-status-progress"),
    inpaintStatusText: getElement<HTMLElement>(rootElement, "inpaint-status-text"),
    inpaintStatusPill: getElement<HTMLElement>(rootElement, "inpaint-status-pill"),
    inpaintStatusProgress: getElement<HTMLElement>(rootElement, "inpaint-status-progress"),
    promptLayerStatusText: getElement<HTMLElement>(rootElement, "prompt-layer-status-text"),
    promptLayerStatusPill: getElement<HTMLElement>(rootElement, "prompt-layer-status-pill"),
    promptLayerStatusProgress: getElement<HTMLElement>(rootElement, "prompt-layer-status-progress"),
    settingsStatusText: getElement<HTMLElement>(rootElement, "settings-status-text"),
    settingsStatusPill: getElement<HTMLElement>(rootElement, "settings-status-pill"),
    settingsStatusProgress: getElement<HTMLElement>(rootElement, "settings-status-progress"),
    diagnosticsText: getElement<HTMLElement>(rootElement, "diagnostics-text"),
    imgDiagnosticsText: getElement<HTMLElement>(rootElement, "img-diagnostics-text"),
    imgCompatibilityNote: getElement<HTMLElement>(rootElement, "img-compatibility-note"),
    sketchDiagnosticsText: getElement<HTMLElement>(rootElement, "sketch-diagnostics-text"),
    sketchCompatibilityNote: getElement<HTMLElement>(rootElement, "sketch-compatibility-note"),
    inpaintDiagnosticsText: getElement<HTMLElement>(rootElement, "inpaint-diagnostics-text"),
    inpaintCompatibilityNote: getElement<HTMLElement>(rootElement, "inpaint-compatibility-note"),
    outpaintStatusText: getElement<HTMLElement>(rootElement, "outpaint-status-text"),
    outpaintStatusPill: getElement<HTMLElement>(rootElement, "outpaint-status-pill"),
    outpaintStatusProgress: getElement<HTMLElement>(rootElement, "outpaint-status-progress"),
    upscaleStatusText: getElement<HTMLElement>(rootElement, "upscale-status-text"),
    upscaleStatusPill: getElement<HTMLElement>(rootElement, "upscale-status-pill"),
    upscaleStatusProgress: getElement<HTMLElement>(rootElement, "upscale-status-progress"),
    outpaintDiagnosticsText: getElement<HTMLElement>(rootElement, "outpaint-diagnostics-text"),
    outpaintCompatibilityNote: getElement<HTMLElement>(rootElement, "outpaint-compatibility-note"),
    upscaleDiagnosticsText: getElement<HTMLElement>(rootElement, "upscale-diagnostics-text"),
    upscaleCompatibilityNote: getElement<HTMLElement>(rootElement, "upscale-compatibility-note"),
    promptLayerDiagnosticsText: getElement<HTMLElement>(rootElement, "prompt-layer-diagnostics-text"),
    settingsDiagnosticsText: getElement<HTMLElement>(rootElement, "settings-diagnostics-text"),
    errorMessage: getElement<HTMLElement>(rootElement, "error-message"),
    imgErrorMessage: getElement<HTMLElement>(rootElement, "img-error-message"),
    sketchErrorMessage: getElement<HTMLElement>(rootElement, "sketch-error-message"),
    inpaintErrorMessage: getElement<HTMLElement>(rootElement, "inpaint-error-message"),
    outpaintErrorMessage: getElement<HTMLElement>(rootElement, "outpaint-error-message"),
    upscaleErrorMessage: getElement<HTMLElement>(rootElement, "upscale-error-message"),
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
    outpaintSourcePreviewPanel: getElement<HTMLElement>(rootElement, "outpaint-source-preview-panel"),
    outpaintSourceTitle: getElement<HTMLElement>(rootElement, "outpaint-source-title"),
    outpaintSourceMeta: getElement<HTMLElement>(rootElement, "outpaint-source-meta"),
    outpaintResultPreviewPanel: getElement<HTMLElement>(rootElement, "outpaint-result-preview-panel"),
    upscaleSourcePreviewPanel: getElement<HTMLElement>(rootElement, "upscale-source-preview-panel"),
    upscaleSourceTitle: getElement<HTMLElement>(rootElement, "upscale-source-title"),
    upscaleSourceMeta: getElement<HTMLElement>(rootElement, "upscale-source-meta"),
    upscaleResultPreviewPanel: getElement<HTMLElement>(rootElement, "upscale-result-preview-panel"),
    promptLayerSourcePreviewPanel: getElement<HTMLElement>(rootElement, "prompt-layer-source-preview-panel"),
    promptLayerSourceTitle: getElement<HTMLElement>(rootElement, "prompt-layer-source-title"),
    promptLayerSourceMeta: getElement<HTMLElement>(rootElement, "prompt-layer-source-meta"),
    promptLayerTask: getElement<HTMLSelectElement>(rootElement, "prompt-layer-task"),
    promptLayerNumBeams: getElement<HTMLInputElement>(rootElement, "prompt-layer-num-beams"),
    promptLayerGeneratedText: getElement<HTMLTextAreaElement>(rootElement, "prompt-layer-generated-text"),
    historyList: getElement<HTMLElement>(rootElement, "history-list"),
    settingsUrlValue: getElement<HTMLElement>(rootElement, "settings-url-value"),
    settingsCheckpointCount: getElement<HTMLElement>(rootElement, "settings-checkpoint-count"),
    settingsLastCheckpoint: getElement<HTMLElement>(rootElement, "settings-last-checkpoint"),
    settingsDocumentStatus: getElement<HTMLElement>(rootElement, "settings-document-status"),
    settingsWorkflowReadiness: getElement<HTMLElement>(rootElement, "settings-workflow-readiness"),
    settingsThemeSelect: getElement<HTMLSelectElement>(rootElement, "settings-theme-select"),
    settingsGpuName: getElement<HTMLElement>(rootElement, "settings-gpu-name"),
    settingsVramTotal: getElement<HTMLElement>(rootElement, "settings-vram-total"),
    settingsVramFree: getElement<HTMLElement>(rootElement, "settings-vram-free"),
    settingsVramTier: getElement<HTMLElement>(rootElement, "settings-vram-tier"),
    settingsModelFamilies: getElement<HTMLElement>(rootElement, "settings-model-families"),
    settingsZImageTurbo: getElement<HTMLElement>(rootElement, "settings-z-image-turbo"),
    settingsModelRecommendations: getElement<HTMLElement>(rootElement, "settings-model-recommendations"),
    settingsWorkflowHealthSummary: getElement<HTMLElement>(rootElement, "settings-workflow-health-summary"),
    settingsWorkflowHealthList: getElement<HTMLElement>(rootElement, "settings-workflow-health-list"),
    settingsDiagnosticsReport: getElement<HTMLTextAreaElement>(rootElement, "settings-diagnostics-report"),
    livePaintingView: getElement<HTMLElement>(rootElement, "live-painting-view"),
    livePrompt: getElement<HTMLTextAreaElement>(rootElement, "live-prompt"),
    livePromptWalletSave: getElement<HTMLElement>(rootElement, "live-prompt-wallet-save"),
    livePromptWalletLoad: getElement<HTMLElement>(rootElement, "live-prompt-wallet-load"),
    liveNegativePrompt: getElement<HTMLTextAreaElement>(rootElement, "live-negative-prompt"),
    liveNegativePromptToggle: getElement<HTMLElement>(rootElement, "live-negative-prompt-toggle"),
    liveNegativePromptField: getElement<HTMLElement>(rootElement, "live-negative-prompt-field"),
    liveDenoise: getElement<HTMLInputElement>(rootElement, "live-denoise"),
    liveStartButton: getElement<HTMLElement>(rootElement, "start-live-painting"),
    liveStopButton: getElement<HTMLElement>(rootElement, "stop-live-painting"),
    liveRefineButton: getElement<HTMLElement>(rootElement, "refine-live-painting"),
    liveAutoRefineToggle: getElement<HTMLElement>(rootElement, "live-auto-refine-toggle"),
    liveStatusText: getElement<HTMLElement>(rootElement, "live-status-text"),
    liveStateBadge: getElement<HTMLElement>(rootElement, "live-state-badge"),
    liveTimingsText: getElement<HTMLElement>(rootElement, "live-timings-text"),
    liveResultPreviewPanel: getElement<HTMLElement>(rootElement, "live-result-preview-panel"),
    importLiveButton: getElement<HTMLElement>(rootElement, "import-live-result"),
    importLiveRefinedButton: getElement<HTMLElement>(rootElement, "import-live-refined"),
    liveAutoImportToggle: getElement<HTMLElement>(rootElement, "live-auto-import-toggle"),
    styleReferenceView: getElement<HTMLElement>(rootElement, "style-reference-view"),
    styleReferencePrompt: getElement<HTMLTextAreaElement>(rootElement, "style-reference-prompt"),
    styleReferencePromptWalletSave: getElement<HTMLElement>(rootElement, "style-reference-prompt-wallet-save"),
    styleReferencePromptWalletLoad: getElement<HTMLElement>(rootElement, "style-reference-prompt-wallet-load"),
    styleReferenceNegativePrompt: getElement<HTMLTextAreaElement>(rootElement, "style-reference-negative-prompt"),
    styleReferenceWorkflow: getElement<HTMLSelectElement>(rootElement, "style-reference-workflow"),
    styleReferenceCheckpoint: getElement<HTMLSelectElement>(rootElement, "style-reference-checkpoint"),
    styleReferenceWidth: getElement<HTMLInputElement>(rootElement, "style-reference-width"),
    styleReferenceHeight: getElement<HTMLInputElement>(rootElement, "style-reference-height"),
    styleReferenceSteps: getElement<HTMLInputElement>(rootElement, "style-reference-steps"),
    styleReferenceCfg: getElement<HTMLInputElement>(rootElement, "style-reference-cfg"),
    styleReferenceSeed: getElement<HTMLInputElement>(rootElement, "style-reference-seed"),
    styleReferenceControlStrength: getElement<HTMLInputElement>(rootElement, "style-reference-control-strength"),
    captureStyleReferenceLayerButton: getElement<HTMLElement>(rootElement, "capture-style-reference-source"),
    captureStyleReferenceCanvasButton: getElement<HTMLElement>(rootElement, "capture-style-reference-canvas-source"),
    generateStyleReferenceButton: getElement<HTMLElement>(rootElement, "generate-style-reference"),
    importStyleReferenceButton: getElement<HTMLElement>(rootElement, "import-style-reference-result"),
    styleReferenceStatusText: getElement<HTMLElement>(rootElement, "style-reference-status-text"),
    styleReferenceStatusPill: getElement<HTMLElement>(rootElement, "style-reference-status-pill"),
    styleReferenceStatusProgress: getElement<HTMLElement>(rootElement, "style-reference-status-progress"),
    styleReferenceDiagnosticsText: getElement<HTMLElement>(rootElement, "style-reference-diagnostics-text"),
    styleReferenceCompatibilityNote: getElement<HTMLElement>(rootElement, "style-reference-compatibility-note"),
    styleReferenceErrorMessage: getElement<HTMLElement>(rootElement, "style-reference-error-message"),
    styleReferenceSourcePreviewPanel: getElement<HTMLElement>(rootElement, "style-reference-source-preview-panel"),
    styleReferenceSourceTitle: getElement<HTMLElement>(rootElement, "style-reference-source-title"),
    styleReferenceSourceMeta: getElement<HTMLElement>(rootElement, "style-reference-source-meta"),
    styleReferenceResultPreviewPanel: getElement<HTMLElement>(rootElement, "style-reference-result-preview-panel"),
    multiReferenceView: getElement<HTMLElement>(rootElement, "multi-reference-view"),
    multiReferencePrompt: getElement<HTMLTextAreaElement>(rootElement, "multi-reference-prompt"),
    multiReferencePromptWalletSave: getElement<HTMLElement>(rootElement, "multi-reference-prompt-wallet-save"),
    multiReferencePromptWalletLoad: getElement<HTMLElement>(rootElement, "multi-reference-prompt-wallet-load"),
    multiReferenceNegativePrompt: getElement<HTMLTextAreaElement>(rootElement, "multi-reference-negative-prompt"),
    multiReferenceWorkflow: getElement<HTMLSelectElement>(rootElement, "multi-reference-workflow"),
    multiReferenceCheckpoint: getElement<HTMLSelectElement>(rootElement, "multi-reference-checkpoint"),
    multiReferenceSteps: getElement<HTMLInputElement>(rootElement, "multi-reference-steps"),
    multiReferenceCfg: getElement<HTMLInputElement>(rootElement, "multi-reference-cfg"),
    multiReferenceSeed: getElement<HTMLInputElement>(rootElement, "multi-reference-seed"),
    addMultiReferenceLayerButton: getElement<HTMLElement>(rootElement, "add-multi-reference-layer"),
    addMultiReferenceCanvasButton: getElement<HTMLElement>(rootElement, "add-multi-reference-canvas"),
    generateMultiReferenceButton: getElement<HTMLElement>(rootElement, "generate-multi-reference"),
    importMultiReferenceButton: getElement<HTMLElement>(rootElement, "import-multi-reference-result"),
    describeUnflattenSourceButton: getElement<HTMLElement>(rootElement, "describe-unflatten-source"),
    captureUnflattenLayerButton: getElement<HTMLElement>(rootElement, "capture-unflatten-layer"),
    captureUnflattenCanvasButton: getElement<HTMLElement>(rootElement, "capture-unflatten-canvas"),
    generateUnflattenButton: getElement<HTMLElement>(rootElement, "generate-unflatten"),
    importUnflattenButton: getElement<HTMLElement>(rootElement, "import-unflatten-result"),
    multiReferenceList: getElement<HTMLElement>(rootElement, "multi-reference-list"),
    multiReferenceCount: getElement<HTMLElement>(rootElement, "multi-reference-count"),
    multiReferenceStatusText: getElement<HTMLElement>(rootElement, "multi-reference-status-text"),
    multiReferenceStatusPill: getElement<HTMLElement>(rootElement, "multi-reference-status-pill"),
    multiReferenceStatusProgress: getElement<HTMLElement>(rootElement, "multi-reference-status-progress"),
    multiReferenceDiagnosticsText: getElement<HTMLElement>(rootElement, "multi-reference-diagnostics-text"),
    multiReferenceCompatibilityNote: getElement<HTMLElement>(rootElement, "multi-reference-compatibility-note"),
    multiReferenceErrorMessage: getElement<HTMLElement>(rootElement, "multi-reference-error-message"),
    multiReferenceResultPreviewPanel: getElement<HTMLElement>(rootElement, "multi-reference-result-preview-panel"),
    unflattenView: getElement<HTMLElement>(rootElement, "unflatten-view"),
    unflattenPrompt: getElement<HTMLTextAreaElement>(rootElement, "unflatten-prompt"),
    unflattenPromptWalletSave: getElement<HTMLElement>(rootElement, "unflatten-prompt-wallet-save"),
    unflattenPromptWalletLoad: getElement<HTMLElement>(rootElement, "unflatten-prompt-wallet-load"),
    unflattenWorkflow: getElement<HTMLSelectElement>(rootElement, "unflatten-workflow"),
    unflattenCheckpoint: getElement<HTMLSelectElement>(rootElement, "unflatten-checkpoint"),
    unflattenLayerCount: getElement<HTMLInputElement>(rootElement, "unflatten-layer-count"),
    unflattenSteps: getElement<HTMLInputElement>(rootElement, "unflatten-steps"),
    unflattenSeed: getElement<HTMLInputElement>(rootElement, "unflatten-seed"),
    unflattenSourceTitle: getElement<HTMLElement>(rootElement, "unflatten-source-title"),
    unflattenSourceMeta: getElement<HTMLElement>(rootElement, "unflatten-source-meta"),
    unflattenSourcePreviewPanel: getElement<HTMLElement>(rootElement, "unflatten-source-preview-panel"),
    unflattenStatusText: getElement<HTMLElement>(rootElement, "unflatten-status-text"),
    unflattenStatusPill: getElement<HTMLElement>(rootElement, "unflatten-status-pill"),
    unflattenStatusProgress: getElement<HTMLElement>(rootElement, "unflatten-status-progress"),
    unflattenDiagnosticsText: getElement<HTMLElement>(rootElement, "unflatten-diagnostics-text"),
    unflattenErrorMessage: getElement<HTMLElement>(rootElement, "unflatten-error-message"),
    unflattenResultLabel: getElement<HTMLElement>(rootElement, "unflatten-result-label"),
    unflattenResultPreviewPanel: getElement<HTMLElement>(rootElement, "unflatten-result-preview-panel"),
    workflowPresetsView: getElement<HTMLElement>(rootElement, "workflow-presets-view"),
    workflowPresetsSummary: getElement<HTMLElement>(rootElement, "workflow-presets-summary"),
    workflowPresetsList: getElement<HTMLElement>(rootElement, "workflow-presets-list"),
    customWorkflowView: getElement<HTMLElement>(rootElement, "custom-workflow-view"),
    customWorkflowInput: getElement<HTMLTextAreaElement>(rootElement, "custom-workflow-input"),
    checkCustomWorkflowButton: getElement<HTMLElement>(rootElement, "check-custom-workflow"),
    customWorkflowStatusText: getElement<HTMLElement>(rootElement, "custom-workflow-status-text"),
    customWorkflowStatusPill: getElement<HTMLElement>(rootElement, "custom-workflow-status-pill"),
    customWorkflowSummary: getElement<HTMLElement>(rootElement, "custom-workflow-summary"),
    customWorkflowError: getElement<HTMLElement>(rootElement, "custom-workflow-error"),
    customWorkflowResults: getElement<HTMLElement>(rootElement, "custom-workflow-results")
  };
}

function getElement<T extends HTMLElement>(rootElement: HTMLElement, id: string) {
  const element = rootElement.querySelector(`#${id}`);

  if (!element || typeof (element as HTMLElement).setAttribute !== "function") {
    throw new Error(`OpenLayer UI element #${id} was not found.`);
  }

  return element as T;
}
