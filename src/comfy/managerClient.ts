import type { ManagerInstallModelRequest, ManagerQueueStatus } from "./assistedInstall";
import {
  createOpenLayerError,
  getNestedErrorMessage,
  OpenLayerError
} from "../utils/errors";

export const MANAGER_SECURITY_LEVEL_ERROR_NAME = "ManagerSecurityLevelError";

const MANAGER_SECURITY_LEVEL_MESSAGE =
  "ComfyUI-Manager blocked this model install because of its security_level setting. In ComfyUI-Manager's config.ini, set security_level to normal (or normal- for non-safetensors models), restart ComfyUI, and try again.";

export class ManagerClient {
  private readonly serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = normalizeServerUrl(serverUrl);
  }

  async getManagerVersion(): Promise<string | null> {
    const response = await fetchManager(
      `${this.serverUrl}/manager/version`,
      undefined,
      this.serverUrl,
      "check the ComfyUI-Manager version"
    );

    if (response.status === 404) {
      return null;
    }

    await assertOk(response, "ComfyUI-Manager version check");

    try {
      return (await response.text()).trim();
    } catch (caughtError) {
      throw createOpenLayerError(
        "COMFY_HTTP",
        "ComfyUI-Manager returned an unreadable version response.",
        getNestedErrorMessage(caughtError)
      );
    }
  }

  async getQueueStatus(): Promise<ManagerQueueStatus> {
    const response = await fetchManager(
      `${this.serverUrl}/manager/queue/status`,
      undefined,
      this.serverUrl,
      "read the ComfyUI-Manager queue"
    );
    await assertOk(response, "ComfyUI-Manager queue status request");

    let data: unknown;

    try {
      data = await response.json();
    } catch (caughtError) {
      throw createOpenLayerError(
        "COMFY_HTTP",
        "ComfyUI-Manager returned an invalid queue status.",
        getNestedErrorMessage(caughtError)
      );
    }

    return readManagerQueueStatus(data);
  }

  async enqueueModelInstall(request: ManagerInstallModelRequest): Promise<void> {
    const response = await fetchManager(
      `${this.serverUrl}/manager/queue/install_model`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
      },
      this.serverUrl,
      "queue a model install"
    );

    if (response.status === 403) {
      const technicalDetails = await readResponseText(response);
      const error = createOpenLayerError(
        "COMFY_HTTP",
        MANAGER_SECURITY_LEVEL_MESSAGE,
        technicalDetails
      );
      error.name = MANAGER_SECURITY_LEVEL_ERROR_NAME;
      throw error;
    }

    await assertOk(response, "ComfyUI-Manager model install request");
  }

  async startQueue(): Promise<void> {
    const response = await fetchManager(
      `${this.serverUrl}/manager/queue/start`,
      { method: "POST" },
      this.serverUrl,
      "start the ComfyUI-Manager queue"
    );
    await assertOk(response, "ComfyUI-Manager queue start request");
  }
}

export function isManagerSecurityLevelError(error: unknown): error is OpenLayerError {
  return error instanceof OpenLayerError && error.name === MANAGER_SECURITY_LEVEL_ERROR_NAME;
}

function normalizeServerUrl(serverUrl: string) {
  const trimmed = serverUrl.trim();

  if (!trimmed) {
    throw new Error("ComfyUI server URL is empty.");
  }

  return trimmed.replace(/\/+$/, "");
}

async function fetchManager(
  url: string,
  init: RequestInit | undefined,
  serverUrl: string,
  action: string
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (caughtError) {
    throw createOpenLayerError(
      "COMFY_OFFLINE",
      `Could not ${action} because ComfyUI is offline or unreachable at ${serverUrl}.`,
      getNestedErrorMessage(caughtError)
    );
  }
}

async function assertOk(response: Response, action: string): Promise<void> {
  if (response.ok) {
    return;
  }

  throw createOpenLayerError(
    "COMFY_HTTP",
    `${action} failed with HTTP ${response.status}.`,
    await readResponseText(response)
  );
}

function readManagerQueueStatus(data: unknown): ManagerQueueStatus {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw invalidQueueStatusError(data);
  }

  const record = data as Record<string, unknown>;
  const totalCount = readCount(record.total_count);
  const doneCount = readCount(record.done_count);
  const inProgressCount = readCount(record.in_progress_count);

  if (
    totalCount === null ||
    doneCount === null ||
    inProgressCount === null ||
    typeof record.is_processing !== "boolean"
  ) {
    throw invalidQueueStatusError(data);
  }

  return {
    total_count: totalCount,
    done_count: doneCount,
    in_progress_count: inProgressCount,
    is_processing: record.is_processing
  };
}

function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function invalidQueueStatusError(data: unknown) {
  return createOpenLayerError(
    "COMFY_HTTP",
    "ComfyUI-Manager returned an invalid queue status.",
    stringifyForDetails(data)
  );
}

function stringifyForDetails(value: unknown) {
  try {
    return JSON.stringify(value) ?? "No queue status details were returned.";
  } catch {
    return "The queue status could not be serialized.";
  }
}

async function readResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

// This client intentionally exposes no reset, reboot, or custom-node install.
// Reset and reboot can disrupt server-global work owned by another client, and
// OpenLayer does not carry the registry metadata needed for safe node installs.
