import { createOpenLayerError, OpenLayerError } from "../utils/errors";

export const COMFY_INTERRUPT_PATH = "/interrupt";

export function createComfyInterruptRequest(serverUrl: string) {
  return {
    url: `${normalizeServerUrl(serverUrl)}${COMFY_INTERRUPT_PATH}`,
    init: {
      method: "POST"
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

function normalizeServerUrl(serverUrl: string) {
  return serverUrl.trim().replace(/\/+$/, "");
}
