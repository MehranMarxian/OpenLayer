import { useMemo, useState } from "react";
import { Button } from "./components/Button";
import { PreviewPanel } from "./components/PreviewPanel";
import { StatusBar, StatusTone } from "./components/StatusBar";
import { TextArea } from "./components/TextArea";
import { ComfyClient } from "../comfy/comfyClient";
import { buildTxt2ImgWorkflow } from "../comfy/workflowBuilder";
import { GeneratedImageResult, WorkflowPreset } from "../comfy/types";
import { getActiveDocumentInfo, importGeneratedImageAsLayer } from "../photoshop/photoshopAdapter";
import { createLayerName } from "../utils/fileUtils";
import { getErrorMessage } from "../utils/errors";

const DEFAULT_SERVER_URL = "http://127.0.0.1:8190";

export function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [workflowPreset, setWorkflowPreset] = useState<WorkflowPreset>("txt2img-basic");
  const [status, setStatus] = useState("Ready.");
  const [statusTone, setStatusTone] = useState<StatusTone>("idle");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<GeneratedImageResult | null>(null);

  const previewUrl = useMemo(() => {
    if (!result) {
      return "";
    }

    return URL.createObjectURL(result.blob);
  }, [result]);

  async function handleCheckComfy() {
    setError("");
    setStatus("Checking ComfyUI...");
    setStatusTone("idle");

    try {
      const client = new ComfyClient(serverUrl);
      await client.checkOnline();
      setStatus("ComfyUI is online.");
      setStatusTone("ready");
    } catch (caughtError) {
      setStatus("ComfyUI check failed.");
      setStatusTone("error");
      setError(getErrorMessage(caughtError));
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError("Enter a prompt before generating.");
      return;
    }

    setError("");
    setResult(null);
    setIsBusy(true);
    setStatus("Preparing workflow...");
    setStatusTone("idle");

    try {
      const client = new ComfyClient(serverUrl);
      await client.checkOnline();

      if (workflowPreset !== "txt2img-basic") {
        throw new Error(`Unsupported workflow preset: ${workflowPreset}`);
      }

      const workflow = await buildTxt2ImgWorkflow({
        prompt,
        negativePrompt,
        width: 1024,
        height: 1024,
        steps: 20,
        cfg: 7
      });

      setStatus("Submitting prompt to ComfyUI...");
      const promptId = await client.submitPrompt(workflow);

      setStatus("Generating image...");
      const history = await client.pollUntilComplete(promptId, {
        onTick: (message) => setStatus(message)
      });

      setStatus("Retrieving image...");
      const imageResult = await client.retrieveFirstOutputImage(promptId, history);
      setResult(imageResult);
      setStatus("Generation complete.");
      setStatusTone("ready");
    } catch (caughtError) {
      setStatus("Generation failed.");
      setStatusTone("error");
      setError(getErrorMessage(caughtError));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleImport() {
    if (!result) {
      setError("Generate an image before importing.");
      return;
    }

    setError("");
    setIsBusy(true);
    setStatus("Importing image into Photoshop...");
    setStatusTone("idle");

    try {
      await getActiveDocumentInfo();
      const layerName = createLayerName("OpenLayer_Generated");
      await importGeneratedImageAsLayer(result.blob, layerName);
      setStatus(`Imported layer: ${layerName}`);
      setStatusTone("ready");
    } catch (caughtError) {
      setStatus("Import failed.");
      setStatusTone("error");
      setError(getErrorMessage(caughtError));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1 className="app-title">OpenLayer</h1>
        <p className="app-subtitle">Local AI layers for Photoshop</p>
      </header>

      <section className="panel-section" aria-label="Connection">
        <div className="field-row">
          <label className="field">
            <span className="label">ComfyUI server URL</span>
            <input
              className="input"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder={DEFAULT_SERVER_URL}
              disabled={isBusy}
            />
          </label>
          <Button onClick={handleCheckComfy} disabled={isBusy}>
            Check ComfyUI
          </Button>
        </div>
      </section>

      <section className="panel-section" aria-label="Prompt">
        <TextArea
          label="Prompt"
          value={prompt}
          onChange={setPrompt}
          placeholder="Describe the image you want to generate..."
          disabled={isBusy}
        />
        <TextArea
          label="Negative prompt"
          value={negativePrompt}
          onChange={setNegativePrompt}
          placeholder="Optional: describe what to avoid..."
          disabled={isBusy}
        />
        <label className="field">
          <span className="label">Workflow</span>
          <select
            className="select"
            value={workflowPreset}
            onChange={(event) => setWorkflowPreset(event.target.value as WorkflowPreset)}
            disabled={isBusy}
          >
            <option value="txt2img-basic">txt2img-basic</option>
          </select>
        </label>
        <Button variant="primary" className="button-wide" onClick={handleGenerate} disabled={isBusy}>
          Generate
        </Button>
      </section>

      <StatusBar status={status} tone={statusTone} />
      {error ? <div className="error-message">{error}</div> : null}

      <section className="panel-section" aria-label="Result">
        <PreviewPanel imageUrl={previewUrl} />
        <Button className="button-wide" onClick={handleImport} disabled={isBusy || !result}>
          Import Result as New Layer
        </Button>
      </section>
    </main>
  );
}
