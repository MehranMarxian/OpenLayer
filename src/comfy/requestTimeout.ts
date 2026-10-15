import { createOpenLayerError, OpenLayerError } from "../utils/errors";

/**
 * Time limits for every HTTP request OpenLayer makes to ComfyUI.
 *
 * Without them, a ComfyUI that has wedged (a stuck custom node, a process
 * paused in a debugger, a machine swapping) leaves Check ComfyUI and Generate
 * waiting forever with no message (codebase review finding 9). The limits are
 * generous on purpose: ComfyUI's web server keeps answering while it
 * generates, so a request that takes this long means something is wrong, not
 * that ComfyUI is busy. The long ones carry image bytes, which on a 16 MP
 * capture is tens of megabytes.
 *
 * The overall wait for a generation to finish is separate and longer: that is
 * `pollUntilComplete`'s own timeout. These limits apply to each request inside
 * it.
 */
export const COMFY_REQUEST_TIMEOUT_MS = {
  status: 10_000,
  control: 10_000,
  objectInfo: 30_000,
  submit: 60_000,
  upload: 120_000,
  download: 120_000
} as const;

export type ComfyRequestKind = keyof typeof COMFY_REQUEST_TIMEOUT_MS;

const REQUEST_NAME: Record<ComfyRequestKind, string> = {
  status: "a status check",
  control: "a queue request",
  objectInfo: "a request for its model list",
  submit: "the workflow",
  upload: "the image upload",
  download: "the request for the result"
};

/**
 * Artist-facing: this message is what the tool's status bar shows, and panel
 * status strings render through textContent, so it is plain sentences.
 */
export function createComfyNotRespondingError(kind: ComfyRequestKind, url: string, timeoutMs: number) {
  const seconds = Math.round(timeoutMs / 1000);

  return createOpenLayerError(
    "COMFY_NOT_RESPONDING",
    `ComfyUI did not answer ${REQUEST_NAME[kind]} within ${seconds} seconds. It may be frozen, still starting, or stuck on a node. Check the ComfyUI window, or restart ComfyUI and try again.`,
    `No response from ${url} after ${timeoutMs} ms (${kind} request limit).`
  );
}

export function isComfyNotRespondingError(error: unknown) {
  return error instanceof OpenLayerError && error.code === "COMFY_NOT_RESPONDING";
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * `fetch` with a time limit on getting a response.
 *
 * It races the request against a timer rather than relying on AbortSignal
 * alone: whether UXP's fetch honours an abort is not established, while a race
 * stops OpenLayer waiting either way. When AbortController exists it is still
 * used, so a host that supports it also drops the connection.
 *
 * The limit covers the response arriving, not reading its body afterwards.
 */
export async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit | undefined,
  kind: ComfyRequestKind,
  timeoutMs: number = COMFY_REQUEST_TIMEOUT_MS[kind]
): Promise<Response> {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(createComfyNotRespondingError(kind, url, timeoutMs));
    }, timeoutMs);
  });

  try {
    const request = fetchImpl(url, controller ? { ...init, signal: controller.signal } : init);
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
