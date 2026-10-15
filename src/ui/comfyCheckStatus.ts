/**
 * What the panel says once ComfyUI has answered and the model lists are read.
 *
 * An empty `models/checkpoints` used to fail the whole check with "No ComfyUI
 * checkpoints were found.", which is exactly what a fresh install that only
 * has the FLUX.2 Klein 4B starter looks like: Klein loads through UNETLoader
 * from `diffusion_models`, so it needs no checkpoint at all. Following the
 * Start here card would have greeted every new artist with a failed check.
 *
 * So no checkpoints is not an error. ComfyUI is online; only the workflows
 * that read a checkpoint (SD 1.5, SDXL) are missing their model, and the
 * Setup screen already names those per preset. The Checkpoint dropdowns keep
 * the list they had, the same as when ComfyUI is offline.
 *
 * Plain text: rendered with textContent.
 */

export const COMFY_ONLINE_STATUS = "ComfyUI is online. Models loaded.";

export const NO_CHECKPOINTS_NOTE =
  "No checkpoints in models/checkpoints yet. FLUX.2 Klein and the other diffusion model workflows do not need one; SD 1.5 and SDXL workflows do.";

/** The status line after a successful check, given how many checkpoints ComfyUI listed. */
export function getComfyOnlineStatus(checkpointCount: number): string {
  return checkpointCount > 0 ? COMFY_ONLINE_STATUS : `${COMFY_ONLINE_STATUS} ${NO_CHECKPOINTS_NOTE}`;
}

/** The status line after Find ComfyUI port selected a server. */
export function getComfyFoundStatus(url: string, checkpointCount: number): string {
  const found = `Found ComfyUI at ${url}.`;

  return checkpointCount > 0 ? found : `${found} ${NO_CHECKPOINTS_NOTE}`;
}
