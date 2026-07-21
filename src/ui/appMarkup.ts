import { listRunnableWorkflowPresets, listWorkflowPresets } from "../comfy/presetRegistry";
import {
  APP_VERSION,
  DEFAULT_CFG,
  DEFAULT_HEIGHT,
  DEFAULT_IMG2IMG_DENOISE,
  DEFAULT_IMG2IMG_STEPS,
  DEFAULT_INPAINT_DENOISE,
  DEFAULT_INPAINT_STEPS,
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
  DEFAULT_STEPS,
  DEFAULT_WIDTH,
  FALLBACK_CHECKPOINTS,
  FALLBACK_UPSCALE_MODELS,
  HOME_TOOL_SECTIONS,
  PROMPT_LAYER_TASKS,
  TOOL_CARDS,
  ToolCard,
  ToolIconName
} from "./appConstants";

export type AppElements = {
  appShell: HTMLElement;
  homeView: HTMLElement;
  generatorView: HTMLElement;
  imageToImageView: HTMLElement;
  sketchToImageView: HTMLElement;
  inpaintView: HTMLElement;
  outpaintView: HTMLElement;
  promptFromLayerView: HTMLElement;
  upscaleView: HTMLElement;
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
  cancelGenerateButton: HTMLElement;
  cancelGenerationButtons: HTMLElement[];
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
  inpaintLockedSettingsNote: HTMLElement;
  captureInpaintSelectionButton: HTMLElement;
  captureInpaintActiveLayerButton: HTMLElement;
  generateInpaintButton: HTMLElement;
  importInpaintButton: HTMLElement;
  outpaintPrompt: HTMLTextAreaElement;
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
  liveDenoise: HTMLInputElement;
  liveStartButton: HTMLElement;
  liveStopButton: HTMLElement;
  liveRefineButton: HTMLElement;
  liveAutoRefineToggle: HTMLElement;
  liveStatusText: HTMLElement;
  liveStateBadge: HTMLElement;
  liveTimingsText: HTMLElement;
  liveResultPreviewPanel: HTMLElement;
  liveZoomToggle: HTMLElement;
  importLiveButton: HTMLElement;
  importLiveRefinedButton: HTMLElement;
  liveAutoImportToggle: HTMLElement;
};

export function createAppMarkup() {
  return `
    <main class="app-shell theme-compact" id="app-shell">
      ${createBrandHeaderMarkup()}
      <div class="home-status-row">
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
          <textarea class="textarea compact-textarea" id="prompt-layer-generated-text" placeholder="Generated prompt text will appear here..."></textarea>
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
            ${createScreenIconMarkup("style", "Live Painting")}
            <span class="screen-title">Live Painting</span>
          </div>
        </div>

        <section class="panel-section generator-panel" aria-label="Live Painting session">
          <div class="section-heading">
            <span class="label">Live session</span>
            <span class="muted-label">Two-tier session</span>
          </div>
          <div class="diagnostics-line">
            Live tier uses the Text to Image checkpoint with the local SD 1.5 LCM LoRA; Refine uses Krea-2 Turbo.
            Start a session, then paint in the document and watch the preview follow your strokes.
          </div>
          <label class="field">
            <span class="label">Prompt</span>
            <textarea class="textarea" id="live-prompt" placeholder="Describe what your painting should become..."></textarea>
          </label>
          <label class="field">
            <span class="label">Strength (denoise)</span>
            <input class="input input-compact" id="live-denoise" type="number" min="0.2" max="0.95" step="0.05" value="0.6" />
          </label>
          <button class="button button-primary button-generate button-wide action-control" id="start-live-painting" data-openlayer-action="startLivePainting" type="button">Start Live Session</button>
          <button class="button button-wide action-control" id="stop-live-painting" data-openlayer-action="stopLivePainting" type="button">Stop Live Session</button>
          <div class="live-refine-actions">
            <button class="button action-control" id="refine-live-painting" data-openlayer-action="refineLivePainting" type="button">Refine Now</button>
            <button class="button action-control" id="live-auto-refine-toggle" data-openlayer-action="toggleLiveAutoRefine" type="button" aria-pressed="false">Auto Refine on Pause</button>
          </div>
        </section>

        <section class="panel-section generator-panel" aria-label="Live Painting preview">
          <div class="section-heading">
            <span class="label">Live preview</span>
            <button class="button action-control" id="live-zoom-toggle" data-openlayer-action="toggleLiveZoom" type="button" aria-pressed="false">Zoom 2x</button>
          </div>
          <div class="preview-panel" id="live-result-preview-panel">
            <span class="preview-empty">Start a session, then paint a stroke</span>
          </div>
          <div class="import-actions">
            <button class="button action-control" id="import-live-result" data-openlayer-action="importLiveResult" type="button">Import to Layers</button>
            <button class="button action-control" id="live-auto-import-toggle" data-openlayer-action="toggleLiveAutoImport" type="button" aria-pressed="false">Import Automatically</button>
          </div>
          <button class="button live-refined-import-button action-control" id="import-live-refined" data-openlayer-action="importLiveRefined" type="button">Import Refined as Layer</button>
          <div class="diagnostics-line">
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
            <div class="field-label-row">
              <span class="label">Model</span>
              ${createInfoToggleMarkup("img-compatibility-note")}
            </div>
            <select class="select" id="img-checkpoint">
              ${FALLBACK_CHECKPOINTS.map((checkpoint) => `<option value="${checkpoint}">${checkpoint}</option>`).join("")}
            </select>
            ${createInfoPanelMarkup("img-compatibility-note", "img2img-basic is safest with SD 1.x and SDXL checkpoints. SD3 and Flux may need dedicated presets.")}
          </div>
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
              <input class="input input-compact" id="img-seed" type="number" min="0" placeholder="Random" />
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
              <span class="source-card-meta" id="sketch-source-meta">ComfyUI LineArtPreprocessor creates the guide.</span>
            </div>
          </div>
        </section>

        <section class="panel-section generator-panel img2img-form-panel" aria-label="Sketch to Image prompt">
          <div class="section-heading">
            <span class="label">Generate</span>
            <span class="muted-label">Prompt and LINECN settings</span>
          </div>
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
            <div class="field-label-row">
              <span class="label">Checkpoint</span>
              ${createInfoToggleMarkup("sketch-compatibility-note")}
            </div>
            <select class="select" id="sketch-checkpoint">
              ${FALLBACK_CHECKPOINTS.map((checkpoint) => `<option value="${checkpoint}">${checkpoint}</option>`).join("")}
            </select>
            ${createInfoPanelMarkup("sketch-compatibility-note", "Recommended: epicrealism_naturalSinRC1VAE.safetensors with an SD 1.5 LineArt ControlNet workflow.")}
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
              <input class="input input-compact" id="inpaint-seed" type="number" min="0" placeholder="Random" />
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
            <span class="label">Prompt</span>
            <textarea class="textarea compact-textarea" id="outpaint-prompt" placeholder="Describe what should extend beyond the current image..."></textarea>
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
              <input class="input input-compact" id="outpaint-seed" type="number" min="0" placeholder="Random" />
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

      <footer class="app-footer">
        <span>OpenLayer v${APP_VERSION} &middot; Developer: Mehran Ahmadi 2026</span>
      </footer>
    </main>
  `;
}

function createBrandHeaderMarkup() {
  return `
    <header class="app-header">
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

function createToolIconMarkup(icon: ToolIconName) {
  const icons: Record<ToolIconName, string> = {
    image: "image-to-image.png",
    imagePlus: "text-to-image.png",
    brush: "inpaint.png",
    expand: "outpaint.png",
    lineart: "sketch-to-image.png",
    promptFromLayer: "prompt-from-layer.png",
    upscale: "upscale.png",
    style: "style-reference.png",
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
    homeView: getElement<HTMLElement>(rootElement, "home-view"),
    generatorView: getElement<HTMLElement>(rootElement, "generator-view"),
    imageToImageView: getElement<HTMLElement>(rootElement, "image-to-image-view"),
    sketchToImageView: getElement<HTMLElement>(rootElement, "sketch-to-image-view"),
    inpaintView: getElement<HTMLElement>(rootElement, "inpaint-view"),
    outpaintView: getElement<HTMLElement>(rootElement, "outpaint-view"),
    promptFromLayerView: getElement<HTMLElement>(rootElement, "prompt-from-layer-view"),
    upscaleView: getElement<HTMLElement>(rootElement, "upscale-view"),
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
    cancelGenerateButton: getElement<HTMLElement>(rootElement, "cancel-generation"),
    cancelGenerationButtons: Array.from(rootElement.querySelectorAll<HTMLElement>(".cancel-generation-button")),
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
    inpaintLockedSettingsNote: getElement<HTMLElement>(rootElement, "inpaint-locked-settings-note"),
    captureInpaintSelectionButton: getElement<HTMLElement>(rootElement, "capture-inpaint-selection"),
    captureInpaintActiveLayerButton: getElement<HTMLElement>(rootElement, "capture-inpaint-active-layer"),
    generateInpaintButton: getElement<HTMLElement>(rootElement, "generate-inpaint"),
    importInpaintButton: getElement<HTMLElement>(rootElement, "import-inpaint-result"),
    outpaintPrompt: getElement<HTMLTextAreaElement>(rootElement, "outpaint-prompt"),
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
    liveDenoise: getElement<HTMLInputElement>(rootElement, "live-denoise"),
    liveStartButton: getElement<HTMLElement>(rootElement, "start-live-painting"),
    liveStopButton: getElement<HTMLElement>(rootElement, "stop-live-painting"),
    liveRefineButton: getElement<HTMLElement>(rootElement, "refine-live-painting"),
    liveAutoRefineToggle: getElement<HTMLElement>(rootElement, "live-auto-refine-toggle"),
    liveStatusText: getElement<HTMLElement>(rootElement, "live-status-text"),
    liveStateBadge: getElement<HTMLElement>(rootElement, "live-state-badge"),
    liveTimingsText: getElement<HTMLElement>(rootElement, "live-timings-text"),
    liveResultPreviewPanel: getElement<HTMLElement>(rootElement, "live-result-preview-panel"),
    liveZoomToggle: getElement<HTMLElement>(rootElement, "live-zoom-toggle"),
    importLiveButton: getElement<HTMLElement>(rootElement, "import-live-result"),
    importLiveRefinedButton: getElement<HTMLElement>(rootElement, "import-live-refined"),
    liveAutoImportToggle: getElement<HTMLElement>(rootElement, "live-auto-import-toggle")
  };
}

function getElement<T extends HTMLElement>(rootElement: HTMLElement, id: string) {
  const element = rootElement.querySelector(`#${id}`);

  if (!element || typeof (element as HTMLElement).setAttribute !== "function") {
    throw new Error(`OpenLayer UI element #${id} was not found.`);
  }

  return element as T;
}
