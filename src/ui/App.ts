import { ComfyClient } from "../comfy/comfyClient";
import { getWorkflowPreset, listWorkflowPresets } from "../comfy/presetRegistry";
import { validateGenerationSettings } from "../comfy/settings";
import { buildTxt2ImgWorkflow } from "../comfy/workflowBuilder";
import { GeneratedImageResult } from "../comfy/types";
import { getActiveDocumentInfo, importGeneratedImageAsLayer } from "../photoshop/photoshopAdapter";
import { createOpenLayerError, getErrorMessage, getTechnicalErrorDetails } from "../utils/errors";
import { createLayerName } from "../utils/fileUtils";
import {
  clearOpenLayerPreferences,
  loadOpenLayerPreferences,
  OpenLayerPreferences,
  saveOpenLayerPreferences
} from "../utils/preferences";

const DEFAULT_SERVER_URL = "http://127.0.0.1:8190";
const APP_VERSION = "0.1.10";
const DEVELOPER_WEBSITE = "https://mehran-ahmadi.com/";
const DEVELOPER_GITHUB = "https://github.com/MehranMarxian";
const HISTORY_LIMIT = 5;
const COMFY_PORT_CANDIDATES = [8190, 8188, 8189, 8191, 8192, 8193, 7860];
const DEFAULT_WORKFLOW = "txt2img-basic";
const DEFAULT_WIDTH = "512";
const DEFAULT_HEIGHT = "512";
const DEFAULT_STEPS = "4";
const DEFAULT_CFG = "7";
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
type AppView = "home" | "text-to-image" | "settings" | "history";
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
    status: "coming-soon"
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
    status: "coming-soon"
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
  saveSettingsButton: HTMLElement;
  resetSettingsButton: HTMLElement;
  generateButton: HTMLElement;
  importButton: HTMLElement;
  autoImportToggle: HTMLElement;
  negativePromptToggle: HTMLElement;
  negativePromptField: HTMLElement;
  clearHistoryButton: HTMLElement;
  statusText: HTMLElement;
  statusPill: HTMLElement;
  settingsStatusText: HTMLElement;
  settingsStatusPill: HTMLElement;
  diagnosticsText: HTMLElement;
  settingsDiagnosticsText: HTMLElement;
  errorMessage: HTMLElement;
  settingsErrorMessage: HTMLElement;
  previewPanel: HTMLElement;
  historyList: HTMLElement;
  settingsUrlValue: HTMLElement;
  settingsCheckpointCount: HTMLElement;
  settingsLastCheckpoint: HTMLElement;
  settingsDocumentStatus: HTMLElement;
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

export function renderApp(rootElement: HTMLElement) {
  let currentView: AppView = "home";
  let isBusy = false;
  let result: GeneratedImageResult | null = null;
  let previewUrl = "";
  let livePreviewUrl = "";
  let importAutomatically = false;
  let isNegativePromptOpen = false;
  const historyEntries: HistoryEntry[] = [];

  rootElement.innerHTML = createAppMarkup();

  const elements = getAppElements(rootElement);
  const preferences = loadOpenLayerPreferences();
  applyPreferences(elements, preferences);
  fillCheckpointOptions(elements, FALLBACK_CHECKPOINTS, preferences.checkpointName || FALLBACK_CHECKPOINTS[0]);

  const actionHandlers: ActionHandlers = {
    check: createActionRunner(elements, "check", handleCheckComfy),
    findPort: createActionRunner(elements, "findPort", handleFindComfyPort),
    saveSettings: createActionRunner(elements, "saveSettings", handleSaveSettings),
    resetSettings: createActionRunner(elements, "resetSettings", handleResetSettings),
    toggleNegativePrompt: createActionRunner(elements, "toggleNegativePrompt", handleToggleNegativePrompt),
    toggleAutoImport: createActionRunner(elements, "toggleAutoImport", handleToggleAutoImport),
    generate: createActionRunner(elements, "generate", handleGenerate),
    import: createActionRunner(elements, "import", handleImport),
    clearHistory: createActionRunner(elements, "clearHistory", handleClearHistory)
  };

  bindActionControl(elements.checkButton, actionHandlers.check);
  bindActionControl(elements.findPortButton, actionHandlers.findPort);
  bindActionControl(elements.saveSettingsButton, actionHandlers.saveSettings);
  bindActionControl(elements.resetSettingsButton, actionHandlers.resetSettings);
  bindActionControl(elements.negativePromptToggle, actionHandlers.toggleNegativePrompt);
  bindActionControl(elements.autoImportToggle, actionHandlers.toggleAutoImport);
  bindActionControl(elements.generateButton, actionHandlers.generate);
  bindActionControl(elements.importButton, actionHandlers.import);
  bindActionControl(elements.clearHistoryButton, actionHandlers.clearHistory);
  bindDelegatedActions(rootElement, actionHandlers);
  bindDocumentActions(rootElement, actionHandlers);
  bindToolCards(rootElement, (view) => setView(view));
  bindHistoryActions(rootElement, handleHistoryAction);

  setStatus(elements, "Ready.", "idle");
  setView(currentView);
  setError(elements, "");
  setBusy(elements, isBusy, result);
  updateNegativePromptDisclosure(elements, isNegativePromptOpen);
  updateAutoImportToggle(elements, importAutomatically);
  updateSettingsReport(elements);
  renderHistory(elements, historyEntries);
  void loadInitialCheckpoints();

  async function loadInitialCheckpoints() {
    setStatus(elements, "Loading ComfyUI models...", "idle");

    try {
      const client = new ComfyClient(elements.serverUrl.value);
      await client.checkOnline();
      await loadCheckpoints(client, elements, preferences.checkpointName || readSelectValue(elements.checkpoint));
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
    setBusy(elements, isBusy, result);
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
      setDiagnostics(
        elements,
        warnings.length > 0
          ? warnings.join(" ")
          : `Using workflow ${preset.id}, checkpoint: ${checkpointName || "none"}`
      );
      await client.checkOnline();

      if (!checkpointName) {
        throw createOpenLayerError("CHECKPOINT_REQUIRED", "Choose a ComfyUI checkpoint before generating.");
      }

      setStatus(elements, "Checking selected checkpoint...", "idle");
      setProgressPreview(elements, "Checking selected checkpoint...");

      if (!(await client.hasCheckpoint(checkpointName))) {
        throw createOpenLayerError(
          "CHECKPOINT_REQUIRED",
          `The checkpoint "${checkpointName}" was not found in ComfyUI. Click Check ComfyUI and choose an available checkpoint.`
        );
      }

      const buildResult = await buildTxt2ImgWorkflow({
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
      setBusy(elements, isBusy, result);
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
    setBusy(elements, isBusy, result);
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
      setBusy(elements, isBusy, result);
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
      setBusy(elements, isBusy, result);
      return;
    }

    previewUrl = URL.createObjectURL(result.blob);
    const image = document.createElement("img");
    image.src = previewUrl;
    image.alt = "Generated OpenLayer preview";
    elements.previewPanel.append(image);
    setBusy(elements, isBusy, result);
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

  function setView(view: AppView) {
    currentView = view;
    elements.homeView.hidden = currentView !== "home";
    elements.generatorView.hidden = currentView !== "text-to-image";
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

      <section class="home-view" id="home-view" aria-label="OpenLayer tools">
        <div class="home-status-row">
          <span>Status:</span>
          <strong id="home-status-text">Ready</strong>
          <span class="home-status-dot idle" id="home-status-dot" aria-hidden="true"></span>
        </div>
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
              ${listWorkflowPresets().map((preset) => `<option value="${preset.id}">${preset.label}</option>`).join("")}
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
        <a href="${DEVELOPER_WEBSITE}">Website</a>
        <a href="${DEVELOPER_GITHUB}">GitHub</a>
      </footer>
    </main>
  `;
}

function createBrandHeaderMarkup() {
  return `
    <header class="app-header">
      <div class="brand-lockup">
        <img class="brand-icon" src="icons/openlayer.png" alt="" width="32" height="32" />
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
    control: "WF",
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
    saveSettingsButton: getElement<HTMLElement>(rootElement, "save-settings"),
    resetSettingsButton: getElement<HTMLElement>(rootElement, "reset-settings"),
    generateButton: getElement<HTMLElement>(rootElement, "generate"),
    importButton: getElement<HTMLElement>(rootElement, "import-result"),
    autoImportToggle: getElement<HTMLElement>(rootElement, "auto-import-toggle"),
    negativePromptToggle: getElement<HTMLElement>(rootElement, "negative-prompt-toggle"),
    negativePromptField: getElement<HTMLElement>(rootElement, "negative-prompt-field"),
    clearHistoryButton: getElement<HTMLElement>(rootElement, "clear-history"),
    statusText: getElement<HTMLElement>(rootElement, "status-text"),
    statusPill: getElement<HTMLElement>(rootElement, "status-pill"),
    settingsStatusText: getElement<HTMLElement>(rootElement, "settings-status-text"),
    settingsStatusPill: getElement<HTMLElement>(rootElement, "settings-status-pill"),
    diagnosticsText: getElement<HTMLElement>(rootElement, "diagnostics-text"),
    settingsDiagnosticsText: getElement<HTMLElement>(rootElement, "settings-diagnostics-text"),
    errorMessage: getElement<HTMLElement>(rootElement, "error-message"),
    settingsErrorMessage: getElement<HTMLElement>(rootElement, "settings-error-message"),
    previewPanel: getElement<HTMLElement>(rootElement, "preview-panel"),
    historyList: getElement<HTMLElement>(rootElement, "history-list"),
    settingsUrlValue: getElement<HTMLElement>(rootElement, "settings-url-value"),
    settingsCheckpointCount: getElement<HTMLElement>(rootElement, "settings-checkpoint-count"),
    settingsLastCheckpoint: getElement<HTMLElement>(rootElement, "settings-last-checkpoint"),
    settingsDocumentStatus: getElement<HTMLElement>(rootElement, "settings-document-status")
  };
}

function getElement<T extends HTMLElement>(rootElement: HTMLElement, id: string) {
  const element = rootElement.querySelector(`#${id}`);

  if (!element || typeof (element as HTMLElement).setAttribute !== "function") {
    throw new Error(`OpenLayer UI element #${id} was not found.`);
  }

  return element as T;
}

function setBusy(elements: AppElements, isBusy: boolean, result: GeneratedImageResult | null) {
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
  setActionDisabled(elements.checkButton, isBusy);
  setActionDisabled(elements.findPortButton, isBusy);
  setActionDisabled(elements.saveSettingsButton, isBusy);
  setActionDisabled(elements.resetSettingsButton, isBusy);
  setActionDisabled(elements.negativePromptToggle, isBusy);
  setActionDisabled(elements.autoImportToggle, isBusy);
  setActionDisabled(elements.generateButton, isBusy);
  setActionDisabled(elements.importButton, isBusy || !result);
  setActionDisabled(elements.clearHistoryButton, isBusy);
}

function setStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.statusText.textContent = status;
  elements.statusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.statusPill.className = `status-pill ${tone}`;
  elements.settingsStatusText.textContent = status;
  elements.settingsStatusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.settingsStatusPill.className = `status-pill ${tone}`;
  elements.homeStatusText.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : status.replace(/\.$/, "");
  elements.homeStatusDot.className = `home-status-dot ${tone}`;
}

function setError(elements: AppElements, message: string) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = !message;
  elements.settingsErrorMessage.textContent = message;
  elements.settingsErrorMessage.hidden = !message;
}

function setDiagnostics(elements: AppElements, message: string) {
  elements.diagnosticsText.textContent = message;
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

type ActionName =
  | "check"
  | "findPort"
  | "saveSettings"
  | "resetSettings"
  | "toggleNegativePrompt"
  | "toggleAutoImport"
  | "generate"
  | "import"
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
  elements.checkpoint.innerHTML = "";

  for (const checkpoint of checkpoints) {
    const option = document.createElement("option");
    option.value = checkpoint;
    option.textContent = checkpoint;
    elements.checkpoint.append(option);
  }

  if (preferredValue && checkpoints.includes(preferredValue)) {
    elements.checkpoint.value = preferredValue;
  } else {
    elements.checkpoint.value = checkpoints[0] ?? "";
  }
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

function applyPreferences(elements: AppElements, preferences: Partial<OpenLayerPreferences>) {
  if (preferences.serverUrl) {
    elements.serverUrl.value = preferences.serverUrl;
  }

  if (preferences.workflow) {
    elements.workflow.value = preferences.workflow;
  }

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
  }

  if (preferences.seed) {
    elements.seed.value = preferences.seed;
  }
}

function applyDefaultSettings(elements: AppElements) {
  elements.serverUrl.value = DEFAULT_SERVER_URL;
  elements.workflow.value = DEFAULT_WORKFLOW;
  elements.width.value = DEFAULT_WIDTH;
  elements.height.value = DEFAULT_HEIGHT;
  elements.steps.value = DEFAULT_STEPS;
  elements.cfg.value = DEFAULT_CFG;
  elements.seed.value = "";
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
