import {
  ComfyCheckpointInfoResponse,
  ComfyHistoryItem,
  ComfyHistoryResponse,
  ComfyImageOutput,
  ComfyPromptResponse,
  ComfyWorkflow,
  GeneratedImageResult
} from "./types";

type PollOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  onTick?: (message: string) => void;
};

export class ComfyClient {
  private serverUrl: string;
  private readonly clientId: string;

  constructor(serverUrl: string) {
    this.serverUrl = normalizeServerUrl(serverUrl);
    this.clientId = createClientId();
  }

  setServerUrl(serverUrl: string) {
    this.serverUrl = normalizeServerUrl(serverUrl);
  }

  getServerUrl() {
    return this.serverUrl;
  }

  async checkOnline() {
    try {
      const response = await fetch(`${this.serverUrl}/system_stats`);

      if (!response.ok) {
        throw new Error(`ComfyUI responded with HTTP ${response.status}.`);
      }
    } catch (caughtError) {
      throw new Error(`ComfyUI is offline or unreachable at ${this.serverUrl}. ${getNestedErrorMessage(caughtError)}`);
    }
  }

  async getCheckpointNames(): Promise<string[]> {
    const response = await fetch(`${this.serverUrl}/object_info/CheckpointLoaderSimple`);

    if (!response.ok) {
      throw new Error(`Could not read ComfyUI checkpoint list. HTTP ${response.status}.`);
    }

    const data = (await response.json()) as ComfyCheckpointInfoResponse;
    const names = data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];

    return names.filter((name) => typeof name === "string");
  }

  async submitPrompt(workflow: ComfyWorkflow): Promise<string> {
    const response = await fetch(`${this.serverUrl}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: workflow,
        client_id: this.clientId
      })
    });

    if (!response.ok) {
      const message = await readResponseText(response);
      throw new Error(`ComfyUI rejected the workflow with HTTP ${response.status}. ${message}`);
    }

    const data = (await response.json()) as ComfyPromptResponse;

    if (data.node_errors && Object.keys(data.node_errors).length > 0) {
      throw new Error(`The workflow JSON contains node errors: ${JSON.stringify(data.node_errors)}`);
    }

    if (!data.prompt_id) {
      throw new Error("ComfyUI did not return a prompt_id.");
    }

    return data.prompt_id;
  }

  async pollUntilComplete(promptId: string, options: PollOptions = {}): Promise<ComfyHistoryItem> {
    const intervalMs = options.intervalMs ?? 1500;
    const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const history = await this.getHistory(promptId);
      const item = history[promptId];

      if (item?.status?.status_str === "error") {
        throw new Error("ComfyUI reported a generation failure.");
      }

      if (item?.outputs && hasImageOutput(item)) {
        return item;
      }

      options.onTick?.("Waiting for ComfyUI output...");
      await delay(intervalMs);
    }

    throw new Error("Timed out while waiting for ComfyUI to finish generation.");
  }

  async retrieveFirstOutputImage(promptId: string, historyItem?: ComfyHistoryItem): Promise<GeneratedImageResult> {
    const history = historyItem ?? (await this.getHistory(promptId))[promptId];

    if (!history) {
      throw new Error(`No ComfyUI history was found for prompt ${promptId}.`);
    }

    const image = findFirstImage(history);

    if (!image) {
      throw new Error("No output image was found in the ComfyUI history.");
    }

    const imageUrl = this.createViewUrl(image);
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Could not retrieve output image from ComfyUI. HTTP ${response.status}.`);
    }

    const blob = await response.blob();
    const mimeType = response.headers.get("content-type") || blob.type || "image/png";

    return {
      blob,
      filename: image.filename,
      mimeType
    };
  }

  private async getHistory(promptId: string): Promise<ComfyHistoryResponse> {
    const response = await fetch(`${this.serverUrl}/history/${encodeURIComponent(promptId)}`);

    if (!response.ok) {
      throw new Error(`Could not read ComfyUI history. HTTP ${response.status}.`);
    }

    return (await response.json()) as ComfyHistoryResponse;
  }

  private createViewUrl(image: ComfyImageOutput) {
    const params = new URLSearchParams({
      filename: image.filename,
      type: image.type ?? "output"
    });

    if (image.subfolder) {
      params.set("subfolder", image.subfolder);
    }

    return `${this.serverUrl}/view?${params.toString()}`;
  }
}

function normalizeServerUrl(serverUrl: string) {
  const trimmed = serverUrl.trim();

  if (!trimmed) {
    throw new Error("ComfyUI server URL is empty.");
  }

  return trimmed.replace(/\/+$/, "");
}

function createClientId() {
  if ("crypto" in globalThis && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `openlayer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hasImageOutput(history: ComfyHistoryItem) {
  return Boolean(findFirstImage(history));
}

function findFirstImage(history: ComfyHistoryItem): ComfyImageOutput | null {
  const outputs = history.outputs ?? {};

  for (const output of Object.values(outputs)) {
    const image = output.images?.[0];

    if (image?.filename) {
      return image;
    }
  }

  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function readResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function getNestedErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
