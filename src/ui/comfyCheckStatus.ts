import { CPU_ONLY_NOTE } from "../comfy/hardwareAdvisor";

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

/**
 * The status bar is one line and clips at about 48 characters in the panel
 * (measured in Photoshop 2025: the first wording read "...No checkpoints in"
 * and stopped). So the bar says only what happened, and the reason goes on the
 * diagnostics line under it.
 */
export const COMFY_ONLINE_NO_CHECKPOINTS_STATUS = "ComfyUI is online. No SD checkpoints yet.";

export const NO_CHECKPOINTS_NOTE = "FLUX.2 Klein needs no checkpoint; only SD 1.5 and SDXL workflows do.";

/** 35 characters, inside the status bar's ~48; the reason goes on the line below. */
export const COMFY_ONLINE_CPU_ONLY_STATUS = "ComfyUI is online, but on CPU only.";

/**
 * The status line after a successful check, given how many checkpoints ComfyUI
 * listed and whether it runs on the processor alone. CPU-only wins: it decides
 * whether any tool is usable at all, which an empty checkpoints folder does not.
 */
export function getComfyOnlineStatus(checkpointCount: number, cpuOnly = false): string {
  if (cpuOnly) {
    return COMFY_ONLINE_CPU_ONLY_STATUS;
  }

  return checkpointCount > 0 ? COMFY_ONLINE_STATUS : COMFY_ONLINE_NO_CHECKPOINTS_STATUS;
}

/** The status line after Find ComfyUI port selected a server. */
export function getComfyFoundStatus(url: string, _checkpointCount: number): string {
  return `Found ComfyUI at ${url}.`;
}

/** What goes on the diagnostics line under the status, or null to leave it. */
export function getNoCheckpointsDiagnostics(checkpointCount: number): string | null {
  return checkpointCount > 0 ? null : NO_CHECKPOINTS_NOTE;
}

/** Every note a finished check has to add, CPU-only first, or null for none. */
export function getComfyCheckDiagnostics(checkpointCount: number, cpuOnly: boolean): string | null {
  const notes = [cpuOnly ? CPU_ONLY_NOTE : null, getNoCheckpointsDiagnostics(checkpointCount)].filter(Boolean);
  return notes.length > 0 ? notes.join(" ") : null;
}
