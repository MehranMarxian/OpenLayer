import { ComfyClient } from "../comfy/comfyClient";
import { buildTxt2ImgWorkflow } from "../comfy/workflowBuilder";
import { GeneratedImageResult, WorkflowPreset } from "../comfy/types";
import { getActiveDocumentInfo, importGeneratedImageAsLayer } from "../photoshop/photoshopAdapter";
import { getErrorMessage } from "../utils/errors";
import { createLayerName } from "../utils/fileUtils";

const DEFAULT_SERVER_URL = "http://127.0.0.1:8190";
const APP_VERSION = "0.1.7";
const DEVELOPER_WEBSITE = "https://mehran-ahmadi.com/";
const DEVELOPER_GITHUB = "https://github.com/MehranMarxian";
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

type AppElements = {
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
  generateButton: HTMLElement;
  importButton: HTMLElement;
  statusText: HTMLElement;
  statusPill: HTMLElement;
  diagnosticsText: HTMLElement;
  errorMessage: HTMLElement;
  previewPanel: HTMLElement;
};

export function renderApp(rootElement: HTMLElement) {
  let isBusy = false;
  let result: GeneratedImageResult | null = null;
  let previewUrl = "";

  rootElement.innerHTML = createAppMarkup();

  const elements = getAppElements(rootElement);
  fillCheckpointOptions(elements, FALLBACK_CHECKPOINTS, FALLBACK_CHECKPOINTS[0]);

  const actionHandlers: ActionHandlers = {
    check: createActionRunner(elements, "check", handleCheckComfy),
    generate: createActionRunner(elements, "generate", handleGenerate),
    import: createActionRunner(elements, "import", handleImport)
  };

  bindActionControl(elements.checkButton, actionHandlers.check);
  bindActionControl(elements.generateButton, actionHandlers.generate);
  bindActionControl(elements.importButton, actionHandlers.import);
  bindDelegatedActions(rootElement, actionHandlers);
  bindDocumentActions(rootElement, actionHandlers);

  setStatus(elements, "Ready.", "idle");
  setError(elements, "");
  setBusy(elements, isBusy, result);
  void loadInitialCheckpoints();

  async function loadInitialCheckpoints() {
    setStatus(elements, "Loading ComfyUI models...", "idle");

    try {
      const client = new ComfyClient(elements.serverUrl.value);
      await client.checkOnline();
      await loadCheckpoints(client, elements);
      setStatus(elements, "ComfyUI is online. Models loaded.", "ready");
    } catch (caughtError) {
      setStatus(elements, "Ready.", "idle");
      setError(elements, `Using fallback model list. ${getErrorMessage(caughtError)}`);
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
    } catch (caughtError) {
      setStatus(elements, "ComfyUI check failed.", "error");
      setError(elements, getErrorMessage(caughtError));
    }
  }

  async function handleGenerate() {
    setDiagnostics(elements, `Generate pressed at ${new Date().toLocaleTimeString()}.`);

    if (!elements.prompt.value.trim()) {
      setError(elements, "Enter a prompt before generating.");
      setStatus(elements, "Prompt required.", "error");
      return;
    }

    setError(elements, "");
    setResult(null);
    isBusy = true;
    setBusy(elements, isBusy, result);
    setStatus(elements, "Preparing workflow...", "idle");

    try {
      const workflowPreset = readSelectValue(elements.workflow, "txt2img-basic") as WorkflowPreset;
      const checkpointName = readSelectValue(elements.checkpoint);
      const client = new ComfyClient(elements.serverUrl.value);

      setDiagnostics(elements, `Using workflow ${workflowPreset}, checkpoint: ${checkpointName || "none"}`);
      await client.checkOnline();

      if (workflowPreset !== "txt2img-basic") {
        throw new Error(`Unsupported workflow preset: ${workflowPreset}`);
      }

      if (!checkpointName) {
        throw new Error("Choose a ComfyUI checkpoint before generating.");
      }

      const workflow = await buildTxt2ImgWorkflow({
        prompt: elements.prompt.value,
        negativePrompt: elements.negativePrompt.value,
        checkpointName,
        width: readInteger(elements.width, "Width"),
        height: readInteger(elements.height, "Height"),
        steps: readInteger(elements.steps, "Steps"),
        cfg: readNumber(elements.cfg, "CFG"),
        seed: readOptionalSeed(elements.seed)
      });

      setStatus(elements, "Submitting prompt to ComfyUI...", "idle");
      const promptId = await client.submitPrompt(workflow);

      setStatus(elements, "Generating image...", "idle");
      const history = await client.pollUntilComplete(promptId, {
        onTick: (message) => setStatus(elements, message, "idle")
      });

      setStatus(elements, "Retrieving image...", "idle");
      setResult(await client.retrieveFirstOutputImage(promptId, history));
      setStatus(elements, "Generation complete.", "ready");
    } catch (caughtError) {
      setStatus(elements, "Generation failed.", "error");
      setError(elements, getErrorMessage(caughtError));
    } finally {
      isBusy = false;
      setBusy(elements, isBusy, result);
    }
  }

  async function handleImport() {
    setDiagnostics(elements, "Import pressed.");

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

    result = nextResult;
    elements.previewPanel.innerHTML = "";

    if (!result) {
      const empty = document.createElement("span");
      empty.className = "preview-empty";
      empty.textContent = "No result yet";
      elements.previewPanel.append(empty);
      return;
    }

    previewUrl = URL.createObjectURL(result.blob);
    const image = document.createElement("img");
    image.src = previewUrl;
    image.alt = "Generated OpenLayer preview";
    elements.previewPanel.append(image);
  }
}

function createAppMarkup() {
  return `
    <main class="app-shell">
      <header class="app-header">
        <div>
          <h1 class="app-title">OpenLayer</h1>
          <p class="app-subtitle">Local AI layers for Photoshop</p>
        </div>
        <span class="version-badge">v${APP_VERSION}</span>
      </header>

      <section class="panel-section connection-panel" aria-label="Connection">
        <label class="field">
          <span class="label">ComfyUI server URL</span>
          <input class="input" id="server-url" value="${DEFAULT_SERVER_URL}" placeholder="${DEFAULT_SERVER_URL}" />
        </label>
        <button class="button action-control" id="check-comfy" data-openlayer-action="check" type="button">Check ComfyUI</button>
      </section>

      <section class="panel-section" aria-label="Prompt">
        <label class="field">
          <span class="label">Prompt</span>
          <textarea class="textarea" id="prompt" placeholder="Describe the image you want to generate..."></textarea>
        </label>
        <label class="field">
          <span class="label">Negative prompt</span>
          <textarea class="textarea" id="negative-prompt" placeholder="Optional: describe what to avoid..."></textarea>
        </label>
        <label class="field">
          <span class="label">Workflow</span>
          <select class="select" id="workflow">
            <option value="txt2img-basic">txt2img-basic</option>
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
            <input class="input input-compact" id="width" type="number" min="64" step="64" value="512" />
          </label>
          <label class="field">
            <span class="label">Height</span>
            <input class="input input-compact" id="height" type="number" min="64" step="64" value="512" />
          </label>
          <label class="field">
            <span class="label">Steps</span>
            <input class="input input-compact" id="steps" type="number" min="1" max="150" step="1" value="4" />
          </label>
          <label class="field">
            <span class="label">CFG</span>
            <input class="input input-compact" id="cfg" type="number" min="1" max="30" step="0.5" value="7" />
          </label>
          <label class="field settings-seed">
            <span class="label">Seed</span>
            <input class="input input-compact" id="seed" type="number" min="0" placeholder="Random" />
          </label>
        </div>
        <button class="button button-primary button-wide action-control" id="generate" data-openlayer-action="generate" type="button">Generate</button>
      </section>

      <div class="status-bar" role="status">
        <span class="status-text" id="status-text">Ready.</span>
        <span class="status-pill idle" id="status-pill">Status</span>
      </div>
      <div class="diagnostics-line" id="diagnostics-text">Click test ready for v${APP_VERSION}.</div>
      <div class="error-message" id="error-message" hidden></div>

      <section class="panel-section" aria-label="Result">
        <div class="section-heading">
          <span class="label">Preview</span>
          <span class="muted-label">Result appears here after generation</span>
        </div>
        <div class="preview-panel" id="preview-panel">
          <span class="preview-empty">No result yet</span>
        </div>
        <button class="button button-wide action-control is-disabled" id="import-result" data-openlayer-action="import" type="button" tabindex="-1" aria-disabled="true">Import Result as New Layer</button>
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

function getAppElements(rootElement: HTMLElement): AppElements {
  return {
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
    generateButton: getElement<HTMLElement>(rootElement, "generate"),
    importButton: getElement<HTMLElement>(rootElement, "import-result"),
    statusText: getElement<HTMLElement>(rootElement, "status-text"),
    statusPill: getElement<HTMLElement>(rootElement, "status-pill"),
    diagnosticsText: getElement<HTMLElement>(rootElement, "diagnostics-text"),
    errorMessage: getElement<HTMLElement>(rootElement, "error-message"),
    previewPanel: getElement<HTMLElement>(rootElement, "preview-panel")
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
  setActionDisabled(elements.generateButton, isBusy);
  setActionDisabled(elements.importButton, isBusy || !result);
}

function setStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.statusText.textContent = status;
  elements.statusPill.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";
  elements.statusPill.className = `status-pill ${tone}`;
}

function setError(elements: AppElements, message: string) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = !message;
}

function setDiagnostics(elements: AppElements, message: string) {
  elements.diagnosticsText.textContent = message;
}

type ActionName = "check" | "generate" | "import";
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

async function loadCheckpoints(client: ComfyClient, elements: AppElements) {
  const checkpoints = await client.getCheckpointNames();

  if (checkpoints.length === 0) {
    throw new Error("No ComfyUI checkpoints were found.");
  }

  fillCheckpointOptions(elements, checkpoints, readSelectValue(elements.checkpoint));
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

function readInteger(input: HTMLInputElement, label: string) {
  const value = Number.parseInt(input.value, 10);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }

  return value;
}

function readNumber(input: HTMLInputElement, label: string) {
  const value = Number.parseFloat(input.value);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }

  return value;
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

function readOptionalSeed(input: HTMLInputElement) {
  if (!input.value.trim()) {
    return undefined;
  }

  return readInteger(input, "Seed");
}
