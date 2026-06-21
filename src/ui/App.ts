import { ComfyClient } from "../comfy/comfyClient";
import { buildTxt2ImgWorkflow } from "../comfy/workflowBuilder";
import { GeneratedImageResult, WorkflowPreset } from "../comfy/types";
import { getActiveDocumentInfo, importGeneratedImageAsLayer } from "../photoshop/photoshopAdapter";
import { getErrorMessage } from "../utils/errors";
import { createLayerName } from "../utils/fileUtils";

const DEFAULT_SERVER_URL = "http://127.0.0.1:8190";
const APP_VERSION = "0.1.0";
const DEVELOPER_WEBSITE = "https://mehran-ahmadi.com/";
const DEVELOPER_GITHUB = "https://github.com/MehranMarxian";

type StatusTone = "idle" | "ready" | "error";

type AppElements = {
  serverUrl: HTMLInputElement;
  prompt: HTMLTextAreaElement;
  negativePrompt: HTMLTextAreaElement;
  workflow: HTMLSelectElement;
  width: HTMLInputElement;
  height: HTMLInputElement;
  steps: HTMLInputElement;
  cfg: HTMLInputElement;
  seed: HTMLInputElement;
  checkButton: HTMLButtonElement;
  generateButton: HTMLButtonElement;
  importButton: HTMLButtonElement;
  statusText: HTMLSpanElement;
  statusPill: HTMLSpanElement;
  errorMessage: HTMLDivElement;
  previewPanel: HTMLDivElement;
};

export function renderApp(rootElement: HTMLElement) {
  let isBusy = false;
  let result: GeneratedImageResult | null = null;
  let previewUrl = "";

  rootElement.innerHTML = createAppMarkup();

  const elements = getAppElements(rootElement);

  elements.checkButton.addEventListener("click", handleCheckComfy);
  elements.generateButton.addEventListener("click", handleGenerate);
  elements.importButton.addEventListener("click", handleImport);

  setStatus(elements, "Ready.", "idle");
  setError(elements, "");
  setBusy(elements, isBusy, result);

  async function handleCheckComfy() {
    setError(elements, "");
    setStatus(elements, "Checking ComfyUI...", "idle");

    try {
      const client = new ComfyClient(elements.serverUrl.value);
      await client.checkOnline();
      setStatus(elements, "ComfyUI is online.", "ready");
    } catch (caughtError) {
      setStatus(elements, "ComfyUI check failed.", "error");
      setError(elements, getErrorMessage(caughtError));
    }
  }

  async function handleGenerate() {
    if (!elements.prompt.value.trim()) {
      setError(elements, "Enter a prompt before generating.");
      return;
    }

    setError(elements, "");
    setResult(null);
    isBusy = true;
    setBusy(elements, isBusy, result);
    setStatus(elements, "Preparing workflow...", "idle");

    try {
      const workflowPreset = elements.workflow.value as WorkflowPreset;
      const client = new ComfyClient(elements.serverUrl.value);

      await client.checkOnline();

      if (workflowPreset !== "txt2img-basic") {
        throw new Error(`Unsupported workflow preset: ${workflowPreset}`);
      }

      const workflow = await buildTxt2ImgWorkflow({
        prompt: elements.prompt.value,
        negativePrompt: elements.negativePrompt.value,
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
    if (!result) {
      setError(elements, "Generate an image before importing.");
      return;
    }

    setError(elements, "");
    isBusy = true;
    setBusy(elements, isBusy, result);
    setStatus(elements, "Importing image into Photoshop...", "idle");

    try {
      await getActiveDocumentInfo();
      const layerName = createLayerName("OpenLayer_Generated");

      await importGeneratedImageAsLayer(result.blob, layerName);
      setStatus(elements, `Imported layer: ${layerName}`, "ready");
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
        <button class="button" id="check-comfy" type="button">Check ComfyUI</button>
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
        <div class="settings-grid" aria-label="Generation settings">
          <label class="field">
            <span class="label">Width</span>
            <input class="input input-compact" id="width" type="number" min="64" step="64" value="1024" />
          </label>
          <label class="field">
            <span class="label">Height</span>
            <input class="input input-compact" id="height" type="number" min="64" step="64" value="1024" />
          </label>
          <label class="field">
            <span class="label">Steps</span>
            <input class="input input-compact" id="steps" type="number" min="1" max="150" step="1" value="20" />
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
        <button class="button button-primary button-wide" id="generate" type="button">Generate</button>
      </section>

      <div class="status-bar" role="status">
        <span class="status-text" id="status-text">Ready.</span>
        <span class="status-pill idle" id="status-pill">Status</span>
      </div>
      <div class="error-message" id="error-message" hidden></div>

      <section class="panel-section" aria-label="Result">
        <div class="section-heading">
          <span class="label">Preview</span>
          <span class="muted-label">Result appears here after generation</span>
        </div>
        <div class="preview-panel" id="preview-panel">
          <span class="preview-empty">No result yet</span>
        </div>
        <button class="button button-wide" id="import-result" type="button" disabled>Import Result as New Layer</button>
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
    serverUrl: getElement(rootElement, "server-url", HTMLInputElement),
    prompt: getElement(rootElement, "prompt", HTMLTextAreaElement),
    negativePrompt: getElement(rootElement, "negative-prompt", HTMLTextAreaElement),
    workflow: getElement(rootElement, "workflow", HTMLSelectElement),
    width: getElement(rootElement, "width", HTMLInputElement),
    height: getElement(rootElement, "height", HTMLInputElement),
    steps: getElement(rootElement, "steps", HTMLInputElement),
    cfg: getElement(rootElement, "cfg", HTMLInputElement),
    seed: getElement(rootElement, "seed", HTMLInputElement),
    checkButton: getElement(rootElement, "check-comfy", HTMLButtonElement),
    generateButton: getElement(rootElement, "generate", HTMLButtonElement),
    importButton: getElement(rootElement, "import-result", HTMLButtonElement),
    statusText: getElement(rootElement, "status-text", HTMLSpanElement),
    statusPill: getElement(rootElement, "status-pill", HTMLSpanElement),
    errorMessage: getElement(rootElement, "error-message", HTMLDivElement),
    previewPanel: getElement(rootElement, "preview-panel", HTMLDivElement)
  };
}

function getElement<T extends HTMLElement>(
  rootElement: HTMLElement,
  id: string,
  elementType: new (...args: never[]) => T
) {
  const element = rootElement.querySelector(`#${id}`);

  if (!(element instanceof elementType)) {
    throw new Error(`OpenLayer UI element #${id} was not found.`);
  }

  return element;
}

function setBusy(elements: AppElements, isBusy: boolean, result: GeneratedImageResult | null) {
  elements.serverUrl.disabled = isBusy;
  elements.prompt.disabled = isBusy;
  elements.negativePrompt.disabled = isBusy;
  elements.workflow.disabled = isBusy;
  elements.width.disabled = isBusy;
  elements.height.disabled = isBusy;
  elements.steps.disabled = isBusy;
  elements.cfg.disabled = isBusy;
  elements.seed.disabled = isBusy;
  elements.checkButton.disabled = isBusy;
  elements.generateButton.disabled = isBusy;
  elements.importButton.disabled = isBusy || !result;
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

function readOptionalSeed(input: HTMLInputElement) {
  if (!input.value.trim()) {
    return undefined;
  }

  return readInteger(input, "Seed");
}
