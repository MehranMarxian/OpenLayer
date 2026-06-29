import {
  ComfyHistoryItem,
  ComfyHistoryResponse,
  ComfyImageOutput,
  ComfyModelInventory,
  ComfyObjectInfoResponse,
  ComfyPromptResponse,
  ComfyQueueResponse,
  ComfySystemStats,
  ComfyUploadImageResponse,
  ComfyWorkflow,
  GeneratedImageResult,
  WorkflowPresetDefinition
} from "./types";
import type { WorkflowNodeAvailability } from "./workflowCompatibility";
import {
  createRequiredModelSelectionKey,
  formatMissingRequiredModelMessage,
  getAcceptedModelNames
} from "./workflowModelRequirements";
import { createOpenLayerError, getNestedErrorMessage } from "../utils/errors";

const MODEL_INVENTORY_SOURCES = {
  checkpoints: [
    { objectInfoNode: "CheckpointLoaderSimple", inputName: "ckpt_name", label: "checkpoint loader" }
  ],
  diffusionModels: [
    { objectInfoNode: "UNETLoader", inputName: "unet_name", label: "diffusion model loader" },
    { objectInfoNode: "DiffusionModelLoader", inputName: "model_name", label: "diffusion model loader" }
  ],
  clipModels: [
    { objectInfoNode: "CLIPLoader", inputName: "clip_name", label: "CLIP loader" },
    { objectInfoNode: "DualCLIPLoader", inputName: "clip_name1", label: "dual CLIP loader" },
    { objectInfoNode: "DualCLIPLoader", inputName: "clip_name2", label: "dual CLIP loader" },
    { objectInfoNode: "TripleCLIPLoader", inputName: "clip_name1", label: "triple CLIP loader" },
    { objectInfoNode: "TripleCLIPLoader", inputName: "clip_name2", label: "triple CLIP loader" },
    { objectInfoNode: "TripleCLIPLoader", inputName: "clip_name3", label: "triple CLIP loader" }
  ],
  vaeModels: [
    { objectInfoNode: "VAELoader", inputName: "vae_name", label: "VAE loader" }
  ],
  controlNetModels: [
    { objectInfoNode: "ControlNetLoader", inputName: "control_net_name", label: "ControlNet loader" }
  ]
} as const;

type PollOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  onTick?: (message: string) => void;
};

type ProgressWatcherOptions = {
  onStatus?: (message: string) => void;
  onPreviewBlob?: (blob: Blob) => void;
  onError?: (message: string) => void;
};

type RetrieveOutputOptions = {
  preferredNodeId?: string;
};

type ProgressWatcher = {
  close: () => void;
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
        throw createOpenLayerError("COMFY_HTTP", `ComfyUI responded with HTTP ${response.status}.`);
      }
    } catch (caughtError) {
      throw createOpenLayerError(
        "COMFY_OFFLINE",
        `ComfyUI is offline or unreachable at ${this.serverUrl}.`,
        getNestedErrorMessage(caughtError)
      );
    }
  }

  async getSystemStats(): Promise<ComfySystemStats> {
    try {
      const response = await fetch(`${this.serverUrl}/system_stats`);

      if (!response.ok) {
        throw createOpenLayerError("COMFY_HTTP", `ComfyUI responded with HTTP ${response.status}.`);
      }

      return readComfySystemStats(await response.json());
    } catch (caughtError) {
      throw createOpenLayerError(
        "COMFY_OFFLINE",
        `Could not detect GPU information because ComfyUI is offline or unreachable at ${this.serverUrl}.`,
        getNestedErrorMessage(caughtError)
      );
    }
  }

  async getModelInventory(): Promise<ComfyModelInventory> {
    const inventory: ComfyModelInventory = {
      checkpoints: [],
      diffusionModels: [],
      clipModels: [],
      vaeModels: [],
      controlNetModels: [],
      missingSources: []
    };

    await this.collectInventoryNames(inventory, "checkpoints", MODEL_INVENTORY_SOURCES.checkpoints);
    await this.collectInventoryNames(inventory, "diffusionModels", MODEL_INVENTORY_SOURCES.diffusionModels);
    await this.collectInventoryNames(inventory, "clipModels", MODEL_INVENTORY_SOURCES.clipModels);
    await this.collectInventoryNames(inventory, "vaeModels", MODEL_INVENTORY_SOURCES.vaeModels);
    await this.collectInventoryNames(inventory, "controlNetModels", MODEL_INVENTORY_SOURCES.controlNetModels);

    return inventory;
  }

  async getWorkflowNodeAvailability(
    presets: readonly WorkflowPresetDefinition[]
  ): Promise<WorkflowNodeAvailability> {
    const availability: WorkflowNodeAvailability = {};
    const nodeClasses = new Set<string>();

    for (const preset of presets) {
      for (const requirement of preset.requiredNodes) {
        nodeClasses.add(requirement.classType);
      }
    }

    for (const classType of nodeClasses) {
      try {
        const objectInfo = await this.getObjectInfo(classType);
        const schema = objectInfo[classType];
        const requiredInputs = schema?.input?.required ?? {};

        if (schema) {
          availability[classType] = Object.keys(requiredInputs);
        }
      } catch {
        // Missing node classes are reported by the workflow health evaluator.
      }
    }

    return availability;
  }

  async getCheckpointNames(): Promise<string[]> {
    return this.getModelNamesFromObjectInfo("CheckpointLoaderSimple", "ckpt_name");
  }

  async getModelNamesForPreset(preset: WorkflowPresetDefinition): Promise<string[]> {
    return this.getModelNamesFromObjectInfo(preset.modelSource.objectInfoNode, preset.modelSource.inputName);
  }

  async hasCheckpoint(checkpointName: string) {
    const checkpoints = await this.getCheckpointNames();
    return checkpoints.includes(checkpointName);
  }

  async hasModelForPreset(modelName: string, preset: WorkflowPresetDefinition) {
    const modelNames = await this.getModelNamesForPreset(preset);
    return modelNames.includes(modelName);
  }

  async validatePresetSetup(preset: WorkflowPresetDefinition) {
    const problems: string[] = [];
    const modelSelections: Record<string, string> = {};
    const checkedNodeClasses = new Set<string>();

    for (const requirement of preset.requiredNodes) {
      if (checkedNodeClasses.has(requirement.classType)) {
        continue;
      }

      checkedNodeClasses.add(requirement.classType);

      try {
        const objectInfo = await this.getObjectInfo(requirement.classType);
        const schema = objectInfo[requirement.classType];
        const requiredInputs = schema?.input?.required ?? {};
        const missingInputs = requirement.requiredInputs.filter((inputName) => !(inputName in requiredInputs));

        if (!schema) {
          problems.push(`Missing ComfyUI node class "${requirement.classType}".`);
        } else if (missingInputs.length > 0) {
          problems.push(
            `Node "${requirement.classType}" is missing expected input(s): ${missingInputs.join(", ")}.`
          );
        }
      } catch (caughtError) {
        problems.push(`Could not inspect ComfyUI node "${requirement.classType}". ${getNestedErrorMessage(caughtError)}`);
      }
    }

    for (const requiredModel of preset.requiredModels ?? []) {
      try {
        const modelNames = await this.getModelNamesFromObjectInfo(
          requiredModel.objectInfoNode,
          requiredModel.inputName
        );

        const acceptedModelNames = getAcceptedModelNames(requiredModel);
        const matchedModelName = acceptedModelNames.find((modelName) => modelNames.includes(modelName));

        if (!matchedModelName) {
          problems.push(
            `${formatMissingRequiredModelMessage(requiredModel)} ${requiredModel.setupHint ?? ""}`.trim()
          );
        } else {
          modelSelections[createRequiredModelSelectionKey(requiredModel)] = matchedModelName;
        }
      } catch (caughtError) {
        problems.push(
          `Could not inspect ${requiredModel.label} models. ${getNestedErrorMessage(caughtError)}`
        );
      }
    }

    if (problems.length > 0) {
      throw createOpenLayerError(
        "COMFY_SETUP_MISSING",
        `ComfyUI is missing setup required by ${preset.label}.`,
        problems.join(" ")
      );
    }

    return modelSelections;
  }

  private async getModelNamesFromObjectInfo(objectInfoNode: string, inputName: string): Promise<string[]> {
    const data = await this.getObjectInfo(objectInfoNode);
    const names = readComfyModelNameList(data, objectInfoNode, inputName);

    return names.filter((name) => typeof name === "string");
  }

  private async getObjectInfo(objectInfoNode: string): Promise<ComfyObjectInfoResponse> {
    const response = await fetch(`${this.serverUrl}/object_info/${encodeURIComponent(objectInfoNode)}`);

    if (!response.ok) {
      throw createOpenLayerError(
        "COMFY_HTTP",
        `Could not read the ComfyUI ${objectInfoNode} object info. HTTP ${response.status}.`
      );
    }

    return (await response.json()) as ComfyObjectInfoResponse;
  }

  private async collectInventoryNames(
    inventory: ComfyModelInventory,
    category: Exclude<keyof ComfyModelInventory, "missingSources">,
    sources: readonly { objectInfoNode: string; inputName: string; label: string }[]
  ) {
    for (const source of sources) {
      try {
        const modelNames = await this.getModelNamesFromObjectInfo(source.objectInfoNode, source.inputName);
        inventory[category] = mergeUniqueStrings(inventory[category], modelNames);
      } catch {
        inventory.missingSources.push(`${source.label}: ${source.objectInfoNode}.${source.inputName}`);
      }
    }
  }

  async uploadImage(blob: Blob, fileName = "openlayer-source.png") {
    if (!blob || blob.size === 0) {
      throw createOpenLayerError("COMFY_UPLOAD_FAILED", "The source image is empty.");
    }

    const formData = new FormData();
    formData.append("image", blob, fileName);
    formData.append("type", "input");
    formData.append("overwrite", "true");

    const response = await fetch(`${this.serverUrl}/upload/image`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const message = await readResponseText(response);
      throw createOpenLayerError(
        "COMFY_UPLOAD_FAILED",
        `Could not upload the source image to ComfyUI. HTTP ${response.status}.`,
        message
      );
    }

    const data = (await response.json()) as ComfyUploadImageResponse;
    const uploadedName = data.name || fileName;

    if (!uploadedName) {
      throw createOpenLayerError("COMFY_UPLOAD_FAILED", "ComfyUI did not return an uploaded image name.");
    }

    return uploadedName;
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
      throw createOpenLayerError(
        "COMFY_REJECTED_WORKFLOW",
        `ComfyUI rejected the workflow with HTTP ${response.status}.`,
        message
      );
    }

    const data = (await response.json()) as ComfyPromptResponse;

    if (data.node_errors && Object.keys(data.node_errors).length > 0) {
      throw createOpenLayerError(
        "COMFY_REJECTED_WORKFLOW",
        "ComfyUI found node errors in the workflow JSON.",
        JSON.stringify(data.node_errors)
      );
    }

    if (!data.prompt_id) {
      throw createOpenLayerError("COMFY_REJECTED_WORKFLOW", "ComfyUI did not return a prompt ID.");
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
        throw createOpenLayerError(
          "COMFY_GENERATION_FAILED",
          "ComfyUI reported a generation failure.",
          JSON.stringify(item.status)
        );
      }

      if (item?.outputs && hasImageOutput(item)) {
        return item;
      }

      options.onTick?.(await this.createPollingStatusMessage(promptId));
      await delay(intervalMs);
    }

    throw createOpenLayerError("COMFY_TIMEOUT", "Timed out while waiting for ComfyUI to finish generation.");
  }

  async retrieveFirstOutputImage(
    promptId: string,
    historyItem?: ComfyHistoryItem,
    options: RetrieveOutputOptions = {}
  ): Promise<GeneratedImageResult> {
    const history = historyItem ?? (await this.getHistory(promptId))[promptId];

    if (!history) {
      throw createOpenLayerError("COMFY_NO_IMAGE", `No ComfyUI history was found for prompt ${promptId}.`);
    }

    const image = findImageOutput(history, options.preferredNodeId);

    if (!image) {
      throw createOpenLayerError(
        "COMFY_NO_IMAGE",
        options.preferredNodeId
          ? `No output image was found from the expected SaveImage node ${options.preferredNodeId}.`
          : "No output image was found in the ComfyUI history."
      );
    }

    const imageUrl = this.createViewUrl(image);
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw createOpenLayerError(
        "COMFY_HTTP",
        `Could not retrieve the output image from ComfyUI. HTTP ${response.status}.`
      );
    }

    const blob = await response.blob();
    const mimeType = response.headers.get("content-type") || blob.type || "image/png";

    return {
      blob,
      filename: image.filename,
      mimeType
    };
  }

  watchProgress(promptId: string, options: ProgressWatcherOptions = {}): ProgressWatcher | null {
    if (typeof WebSocket !== "function") {
      options.onStatus?.("WebSocket progress is unavailable in this UXP environment.");
      return null;
    }

    let socket: WebSocket;

    try {
      socket = new WebSocket(this.createWebSocketUrl());
      socket.binaryType = "blob";
    } catch (caughtError) {
      options.onError?.(
        `Could not open ComfyUI progress stream. Continuing with history polling. ${getNestedErrorMessage(caughtError)}`
      );
      return null;
    }

    let isClosed = false;

    socket.onopen = () => {
      options.onStatus?.("Connected to ComfyUI progress stream...");
    };

    socket.onmessage = (event) => {
      void this.handleProgressMessage(promptId, event.data, options);
    };

    socket.onerror = () => {
      options.onError?.("ComfyUI progress stream disconnected. Continuing with history polling...");
    };

    socket.onclose = () => {
      if (!isClosed) {
        options.onStatus?.("ComfyUI progress stream closed. Continuing with polling...");
      }
    };

    return {
      close: () => {
        isClosed = true;
        socket.close();
      }
    };
  }

  private async getHistory(promptId: string): Promise<ComfyHistoryResponse> {
    const response = await fetch(`${this.serverUrl}/history/${encodeURIComponent(promptId)}`);

    if (!response.ok) {
      throw createOpenLayerError("COMFY_HTTP", `Could not read ComfyUI history. HTTP ${response.status}.`);
    }

    return (await response.json()) as ComfyHistoryResponse;
  }

  private async getQueue(): Promise<ComfyQueueResponse> {
    const response = await fetch(`${this.serverUrl}/queue`);

    if (!response.ok) {
      throw createOpenLayerError("COMFY_HTTP", `Could not read ComfyUI queue. HTTP ${response.status}.`);
    }

    return (await response.json()) as ComfyQueueResponse;
  }

  private async createPollingStatusMessage(promptId: string) {
    try {
      const queue = await this.getQueue();
      const pendingIndex = findPromptIndex(queue.queue_pending, promptId);
      const runningIndex = findPromptIndex(queue.queue_running, promptId);

      if (runningIndex >= 0) {
        return "ComfyUI is running this prompt...";
      }

      if (pendingIndex >= 0) {
        return `Queued in ComfyUI. Position ${pendingIndex + 1}.`;
      }
    } catch {
      // Queue polling is helpful but not required for generation.
    }

    return "Waiting for ComfyUI output...";
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

  private createWebSocketUrl() {
    const url = new URL(this.serverUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/ws`.replace(/^\/\//, "/");
    url.search = new URLSearchParams({
      clientId: this.clientId
    }).toString();

    return url.toString();
  }

  private async handleProgressMessage(
    promptId: string,
    data: unknown,
    options: ProgressWatcherOptions
  ) {
    if (data instanceof Blob || data instanceof ArrayBuffer) {
      const previewBlob = await decodeComfyPreviewBlob(data);

      if (previewBlob) {
        options.onPreviewBlob?.(previewBlob);
      }

      return;
    }

    if (typeof data !== "string") {
      return;
    }

    const message = parseProgressJson(data);

    if (!message || !message.type) {
      return;
    }

    const messagePromptId = readString(message.data?.prompt_id);

    if (messagePromptId && messagePromptId !== promptId) {
      return;
    }

    if (message.type === "progress") {
      const value = readNumber(message.data?.value);
      const max = readNumber(message.data?.max);

      if (value !== null && max !== null && max > 0) {
        options.onStatus?.(`Generating step ${value} of ${max}...`);
      }
    } else if (message.type === "executing") {
      const node = readString(message.data?.node);

      if (node) {
        options.onStatus?.(`Executing ComfyUI node ${node}...`);
      }
    } else if (message.type === "execution_cached") {
      options.onStatus?.("ComfyUI is using cached workflow nodes...");
    } else if (message.type === "execution_error") {
      options.onError?.("ComfyUI reported an execution error. Waiting for final history...");
    }
  }
}

function normalizeServerUrl(serverUrl: string) {
  const trimmed = serverUrl.trim();

  if (!trimmed) {
    throw new Error("ComfyUI server URL is empty.");
  }

  return trimmed.replace(/\/+$/, "");
}

function readComfySystemStats(data: unknown): ComfySystemStats {
  const root = readObject(data);
  const system = readObject(root.system);
  const devices = Array.isArray(root.devices) ? root.devices : [];

  return {
    system: {
      os: readOptionalString(system.os),
      ramTotalBytes: readByteCount(system.ram_total),
      ramFreeBytes: readByteCount(system.ram_free),
      comfyuiVersion: readOptionalString(system.comfyui_version),
      pythonVersion: readOptionalString(system.python_version),
      pytorchVersion: readOptionalString(system.pytorch_version)
    },
    devices: devices.map(readComfyHardwareDevice).filter((device) => device.name || device.type)
  };
}

function readComfyHardwareDevice(value: unknown) {
  const device = readObject(value);

  return {
    name: readOptionalString(device.name) || "Unknown GPU",
    type: readOptionalString(device.type) || "unknown",
    index: readOptionalNumber(device.index),
    vramTotalBytes: readByteCount(device.vram_total),
    vramFreeBytes: readByteCount(device.vram_free),
    torchVramTotalBytes: readByteCount(device.torch_vram_total),
    torchVramFreeBytes: readByteCount(device.torch_vram_free)
  };
}

function readComfyModelNameList(data: ComfyObjectInfoResponse, objectInfoNode: string, inputName: string) {
  const input = data[objectInfoNode]?.input?.required?.[inputName];

  if (!Array.isArray(input) || !Array.isArray(input[0])) {
    return [];
  }

  return input[0].filter((name): name is string => typeof name === "string");
}

function mergeUniqueStrings(current: string[], next: string[]) {
  const names = new Set(current);

  for (const name of next) {
    if (name) {
      names.add(name);
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readByteCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return undefined;
}

function createClientId() {
  if ("crypto" in globalThis && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `openlayer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hasImageOutput(history: ComfyHistoryItem) {
  return Boolean(findImageOutput(history));
}

export function findImageOutput(
  history: ComfyHistoryItem,
  preferredNodeId?: string
): ComfyImageOutput | null {
  const outputs = history.outputs ?? {};

  if (preferredNodeId) {
    const preferredImage = outputs[preferredNodeId]?.images?.[0];
    return preferredImage?.filename ? preferredImage : null;
  }

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

function findPromptIndex(entries: unknown[] | undefined, promptId: string) {
  if (!Array.isArray(entries)) {
    return -1;
  }

  return entries.findIndex((entry) => JSON.stringify(entry).includes(promptId));
}

type ProgressJsonMessage = {
  type?: string;
  data?: Record<string, unknown>;
};

function parseProgressJson(data: string): ProgressJsonMessage | null {
  try {
    return JSON.parse(data) as ProgressJsonMessage;
  } catch {
    return null;
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function decodeComfyPreviewBlob(blob: Blob | ArrayBuffer) {
  const arrayBuffer = blob instanceof Blob ? await blob.arrayBuffer() : blob;

  if (arrayBuffer.byteLength <= 8) {
    return null;
  }

  const view = new DataView(arrayBuffer);
  const eventType = view.getUint32(0);

  if (eventType !== 1) {
    return null;
  }

  const imageType = view.getUint32(4);
  const mimeType = imageType === 1 ? "image/jpeg" : "image/png";

  return new Blob([arrayBuffer.slice(8)], {
    type: mimeType
  });
}
