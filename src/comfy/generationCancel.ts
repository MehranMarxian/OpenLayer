import { createOpenLayerError, OpenLayerError } from "../utils/errors";

export const COMFY_INTERRUPT_PATH = "/interrupt";
export const COMFY_QUEUE_PATH = "/queue";

/**
 * What a cancel did on the ComfyUI side.
 *
 * ComfyUI is often shared: the artist's own browser tab, a second app, a batch
 * someone queued overnight. A plain `POST /interrupt` stops whatever is
 * running, which may not be ours, so OpenLayer only ever touches its own prompt:
 *
 * - `dequeued`: ours was still waiting and was removed from the queue.
 * - `interrupted`: ours was the one running and was stopped with a targeted
 *   interrupt that names it.
 * - `not-active`: ours is neither waiting nor running, so it already finished
 *   (or failed) and there is nothing to stop. Nothing was sent.
 * - `unconfirmed`: the queue could not be read, so nothing was sent rather than
 *   risk stopping someone else's work.
 * - `not-submitted`: there was no prompt id yet. Nothing was sent.
 */
export type GenerationCancelResult = "dequeued" | "interrupted" | "not-active" | "unconfirmed" | "not-submitted";

export type CancelAction = "dequeue" | "interrupt" | "none";

/**
 * Decides what to send for one of our prompts, given ComfyUI's `/queue`.
 * `null` means the queue could not be read. Pure, so the rule that keeps a
 * shared ComfyUI safe is tested without a server.
 */
export function decideCancelAction(
  queue: { queue_running?: unknown[]; queue_pending?: unknown[] } | null,
  promptId: string
): CancelAction {
  if (!queue) return "none";
  if (queueContainsPrompt(queue.queue_pending, promptId)) return "dequeue";
  if (queueContainsPrompt(queue.queue_running, promptId)) return "interrupt";
  return "none";
}

/**
 * A targeted interrupt. ComfyUI (checked in 0.38.1's `server.py`) only
 * interrupts when `prompt_id` names the prompt that is running, and does
 * nothing otherwise. An older ComfyUI ignores the body and interrupts whatever
 * runs, which is why this is only ever sent after `/queue` showed ours running.
 */
export function createComfyInterruptRequest(serverUrl: string, promptId: string) {
  return {
    url: `${normalizeServerUrl(serverUrl)}${COMFY_INTERRUPT_PATH}`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt_id: promptId })
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

  switch (result) {
    case "dequeued":
      return `${base} The pending prompt was removed from the ComfyUI queue.`;
    case "interrupted":
      return `${base} ComfyUI interrupted the running prompt.`;
    case "not-active":
      return `${base} It had already finished in ComfyUI, so nothing else was stopped.`;
    case "unconfirmed":
      return `${base} The ComfyUI queue could not be read, so nothing was stopped there. Other work on ComfyUI was left alone.`;
    case "not-submitted":
      return `${base} Nothing had reached ComfyUI yet.`;
  }
}

function queueContainsPrompt(entries: unknown[] | undefined, promptId: string) {
  // Queue entries are [number, prompt_id, prompt, extra_data, outputs].
  return Array.isArray(entries) && entries.some((entry) => Array.isArray(entry) && entry[1] === promptId);
}

function normalizeServerUrl(serverUrl: string) {
  return serverUrl.trim().replace(/\/+$/, "");
}
