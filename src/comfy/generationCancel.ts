import { createOpenLayerError, OpenLayerError } from "../utils/errors";

export const COMFY_INTERRUPT_PATH = "/interrupt";
export const COMFY_QUEUE_PATH = "/queue";

export type GenerationCancelResult = "dequeued" | "interrupted";

export function createComfyInterruptRequest(serverUrl: string) {
  return {
    url: `${normalizeServerUrl(serverUrl)}${COMFY_INTERRUPT_PATH}`,
    init: {
      method: "POST"
    } as RequestInit
  };
}

export function createComfyQueueDeleteRequest(serverUrl: string, promptId: string) {
  return {
    url: `${normalizeServerUrl(serverUrl)}${COMFY_QUEUE_PATH}`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ delete: [promptId] })
    } as RequestInit
  };
}

export function createGenerationCancelledError() {
  return createOpenLayerError(
    "COMFY_CANCELLED",
    "Generation cancelled.",
    "The active ComfyUI generation was interrupted by the user."
  );
}

export function isGenerationCancelledError(error: unknown) {
  return error instanceof OpenLayerError && error.code === "COMFY_CANCELLED";
}

export function formatCancelDiagnostic(promptId?: string) {
  return promptId
    ? `Cancel requested for ComfyUI prompt ${promptId}.`
    : "Cancel requested before ComfyUI returned a prompt ID.";
}

export function formatCancelResultDiagnostic(result: GenerationCancelResult, promptId?: string) {
  const base = formatCancelDiagnostic(promptId);

  return result === "dequeued"
    ? `${base} The pending prompt was removed from the ComfyUI queue.`
    : `${base} ComfyUI interrupted the running prompt.`;
}

function normalizeServerUrl(serverUrl: string) {
  return serverUrl.trim().replace(/\/+$/, "");
}
