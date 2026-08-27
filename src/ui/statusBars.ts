import { AppElements } from "./appMarkup";

/**
 * Every status surface in the panel: the status text, the Ready/Working/Error
 * pill, the progress bar under it, the error line, the diagnostics line, and
 * the home screen's dot.
 *
 * Each of the seven tools owns one status bar, and the setters below are the
 * only writers. They are grouped here rather than in App.ts because they are
 * pure DOM writes over `AppElements` — no generation state, no Photoshop, no
 * closure variables — so the whole group moves as a unit.
 *
 * The one piece of real logic is the progress bar. `resolveStatusProgress`
 * decides busy/idle and determinate/indeterminate from the status text alone,
 * which is why it is pure and directly tested; `setStatusProgress` is the DOM
 * half that owns the animation timer and the sticky-percent memory.
 */

export type StatusTone = "idle" | "ready" | "error";

const statusProgressTimers = new WeakMap<HTMLElement, number>();
// Remembers the last real step percentage per progress bar so percent-less
// status updates (e.g. the history poll tick) cannot reset a determinate bar
// back to the indeterminate warm-up animation mid-run.
const statusProgressLastPercent = new WeakMap<HTMLElement, number>();

export function setStatusProgress(progressElement: HTMLElement, status: string, tone: StatusTone) {
  const normalizedStatus = status.trim().toLowerCase();
  const isBusy =
    tone === "idle" &&
    normalizedStatus !== "ready" &&
    normalizedStatus !== "ready." &&
    !normalizedStatus.includes("complete") &&
    !normalizedStatus.includes("copied") &&
    !normalizedStatus.includes("saved") &&
    !normalizedStatus.includes("reset") &&
    !normalizedStatus.includes("cancel");

  const fill = progressElement.firstElementChild as HTMLElement | null;
  const resolved = resolveStatusProgress(status, isBusy, statusProgressLastPercent.get(progressElement) ?? null);

  if (!resolved.isBusy) {
    const existingTimer = statusProgressTimers.get(progressElement);
    if (existingTimer) {
      window.clearInterval(existingTimer);
      statusProgressTimers.delete(progressElement);
    }

    statusProgressLastPercent.delete(progressElement);
    progressElement.hidden = true;
    progressElement.className = "status-progress";
    progressElement.style.removeProperty("--ol-progress");

    if (fill) {
      fill.style.marginLeft = "";
      fill.style.width = "";
    }
    progressElement.removeAttribute("data-progress-offset");
    return;
  }

  const stickyPercent = resolved.percent;

  progressElement.hidden = false;
  progressElement.className = `status-progress is-active${stickyPercent !== null ? " is-determinate" : ""}`;

  if (stickyPercent !== null) {
    renderDeterminateProgress(progressElement, stickyPercent);
    return;
  }

  progressElement.style.removeProperty("--ol-progress");

  if (statusProgressTimers.get(progressElement)) {
    return;
  }

  let offset = -42;
  const timer = window.setInterval(() => {
    offset = offset >= 110 ? -42 : offset + 7;
    progressElement.setAttribute("data-progress-offset", String(offset));

    if (fill) {
      fill.style.marginLeft = `${offset}%`;
      fill.style.width = "42%";
    }
  }, 120);

  statusProgressTimers.set(progressElement, timer);
}

function renderDeterminateProgress(progressElement: HTMLElement, percent: number) {
  const fill = progressElement.firstElementChild as HTMLElement | null;
  const existingTimer = statusProgressTimers.get(progressElement);

  if (existingTimer) {
    window.clearInterval(existingTimer);
    statusProgressTimers.delete(progressElement);
  }

  statusProgressLastPercent.set(progressElement, percent);
  progressElement.hidden = false;
  progressElement.className = "status-progress is-active is-determinate";
  // The determinate fill width is driven by a CSS variable so it beats the
  // legacy "width: 42% !important" indeterminate rule without inline hacks.
  progressElement.style.setProperty("--ol-progress", `${percent}%`);

  if (fill) {
    fill.style.marginLeft = "";
    fill.style.width = "";
  }

  progressElement.removeAttribute("data-progress-offset");
}

// Dedicated numeric progress entry point driven by the ComfyUI WebSocket
// progress channel, independent of the human-readable status text.
export function applyDeterminateProgress(progressElement: HTMLElement, value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return;
  }

  renderDeterminateProgress(progressElement, Math.max(0, Math.min(100, Math.round((value / max) * 100))));
}

export type StatusProgressState = {
  isBusy: boolean;
  // null while busy = indeterminate warm-up animation; a number = determinate fill.
  percent: number | null;
};

// Pure resolver for the progress bar. Keeps a determinate bar determinate once
// real step progress has arrived: percent-less status updates (the history
// poll tick, "Retrieving image...") hold the last known percent instead of
// collapsing the bar back to the indeterminate warm-up animation.
export function resolveStatusProgress(
  status: string,
  isBusy: boolean,
  lastPercent: number | null
): StatusProgressState {
  if (!isBusy) {
    return { isBusy: false, percent: null };
  }

  const parsedPercent = readProgressPercent(status);
  const percent = parsedPercent ?? lastPercent;

  return { isBusy: true, percent: percent ?? null };
}

function readProgressPercent(status: string) {
  const percentMatch = status.match(/(\d{1,3})(?:\.\d+)?\s*%/);

  if (percentMatch) {
    return clampProgressPercent(Number(percentMatch[1]));
  }

  const stepMatch = status.match(/step\s+(\d+)\s+of\s+(\d+)/i);

  if (stepMatch) {
    const value = Number(stepMatch[1]);
    const max = Number(stepMatch[2]);

    if (Number.isFinite(value) && Number.isFinite(max) && max > 0) {
      return clampProgressPercent(Math.round((value / max) * 100));
    }
  }

  const fractionMatch = status.match(/\b(\d+)\s*\/\s*(\d+)\b/);

  if (fractionMatch) {
    const value = Number(fractionMatch[1]);
    const max = Number(fractionMatch[2]);

    if (Number.isFinite(value) && Number.isFinite(max) && max > 0) {
      return clampProgressPercent(Math.round((value / max) * 100));
    }
  }

  return null;
}

function clampProgressPercent(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

export function flashImported(statusTextElement: HTMLElement) {
  const target = (statusTextElement.closest(".status-bar") as HTMLElement | null) ?? statusTextElement;
  target.classList.remove("ol-import-flash");
  void target.offsetWidth;
  target.classList.add("ol-import-flash");
  window.setTimeout(() => target.classList.remove("ol-import-flash"), 900);
}

function applyStatusPill(pill: HTMLElement, status: string, tone: StatusTone) {
  if (tone === "error") {
    pill.textContent = "Error";
    pill.className = "status-pill error";
    return;
  }

  if (tone === "ready") {
    pill.textContent = "Ready";
    pill.className = "status-pill ready";
    return;
  }

  const normalized = status.trim().toLowerCase();
  const isWorking =
    normalized !== "" &&
    normalized !== "ready" &&
    normalized !== "ready." &&
    !normalized.includes("complete") &&
    !normalized.includes("copied") &&
    !normalized.includes("saved") &&
    !normalized.includes("reset") &&
    !normalized.includes("cancelled");

  if (isWorking) {
    pill.textContent = "Working";
    pill.className = "status-pill working";
    return;
  }

  pill.textContent = "Ready";
  pill.className = "status-pill idle";
}

function updateHomeStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.homeStatusText.textContent = tone === "ready" ? "Ready" : tone === "error" ? "Error" : status.replace(/\.$/, "");
  // The text color defaults to the success green; only an error overrides it,
  // so Ready and in-progress statuses keep their familiar look.
  elements.homeStatusText.classList.toggle("is-error", tone === "error");
  elements.homeStatusDot.className = `home-status-dot ${tone}`;
}

function applyToolStatus(
  elements: AppElements,
  text: HTMLElement,
  pill: HTMLElement,
  progress: HTMLElement,
  status: string,
  tone: StatusTone
) {
  text.textContent = status;
  applyStatusPill(pill, status, tone);
  setStatusProgress(progress, status, tone);
  updateHomeStatus(elements, status, tone);
}

/**
 * A message that is true for the whole panel: the ComfyUI connection, the
 * settings screen, the session history. Those are not owned by any one tool, so
 * they land in every tool's bar plus the settings screen.
 *
 * Nothing a single tool is doing may come through here. This used to be the
 * only fan-out setter *and* Text to Image's own setter, which is why Text to
 * Image progress ("Preparing workflow...", "Generation complete.") appeared in
 * the Inpaint and Upscale bars in v0.7. Tool work goes to the tool's own setter.
 */
export function setGlobalStatus(elements: AppElements, status: string, tone: StatusTone) {
  setTextToImageStatus(elements, status, tone);
  applyToolStatus(elements, elements.imgStatusText, elements.imgStatusPill, elements.imgStatusProgress, status, tone);
  applyToolStatus(elements, elements.sketchStatusText, elements.sketchStatusPill, elements.sketchStatusProgress, status, tone);
  applyToolStatus(elements, elements.inpaintStatusText, elements.inpaintStatusPill, elements.inpaintStatusProgress, status, tone);
  applyToolStatus(elements, elements.outpaintStatusText, elements.outpaintStatusPill, elements.outpaintStatusProgress, status, tone);
  applyToolStatus(elements, elements.upscaleStatusText, elements.upscaleStatusPill, elements.upscaleStatusProgress, status, tone);
  applyToolStatus(elements, elements.promptLayerStatusText, elements.promptLayerStatusPill, elements.promptLayerStatusProgress, status, tone);
  applyToolStatus(elements, elements.styleReferenceStatusText, elements.styleReferenceStatusPill, elements.styleReferenceStatusProgress, status, tone);
  applyToolStatus(elements, elements.settingsStatusText, elements.settingsStatusPill, elements.settingsStatusProgress, status, tone);
}

// Text to Image owns the unprefixed status elements, a leftover from when it was
// the only tool in the panel. It is a per-tool setter like every other one below.
export function setTextToImageStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.statusText, elements.statusPill, elements.statusProgress, status, tone);
}

export function setImageStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.imgStatusText, elements.imgStatusPill, elements.imgStatusProgress, status, tone);
}

export function setSketchStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.sketchStatusText, elements.sketchStatusPill, elements.sketchStatusProgress, status, tone);
}

export function setInpaintStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.inpaintStatusText, elements.inpaintStatusPill, elements.inpaintStatusProgress, status, tone);
}

export function setOutpaintStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.outpaintStatusText, elements.outpaintStatusPill, elements.outpaintStatusProgress, status, tone);
}

export function setUpscaleStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.upscaleStatusText, elements.upscaleStatusPill, elements.upscaleStatusProgress, status, tone);
}

export function setPromptLayerStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.promptLayerStatusText, elements.promptLayerStatusPill, elements.promptLayerStatusProgress, status, tone);
}

export function setStyleReferenceStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.styleReferenceStatusText, elements.styleReferenceStatusPill, elements.styleReferenceStatusProgress, status, tone);
}

export function setMultiReferenceStatus(elements: AppElements, status: string, tone: StatusTone) {
  applyToolStatus(elements, elements.multiReferenceStatusText, elements.multiReferenceStatusPill, elements.multiReferenceStatusProgress, status, tone);
}

// Layer Tools is not a generation: it has no progress bar and nothing to report
// on the Home status row. It therefore writes its own bar only, rather than
// going through applyToolStatus -- the fan-out that put one tool's progress in
// another tool's bar came from exactly that kind of shared write.
export function setLayerToolsStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.layerToolsStatusText.textContent = status;
  applyStatusPill(elements.layerToolsStatusPill, status, tone);
}

// Setup is a read-only inspection of the server, for the same reason: its own
// bar and nothing else.
export function setSetupStatus(elements: AppElements, status: string, tone: StatusTone) {
  elements.setupStatusText.textContent = status;
  applyStatusPill(elements.setupStatusPill, status, tone);
}

function applyToolError(errorMessage: HTMLElement, message: string) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

/**
 * An error that belongs to the panel rather than to a tool: the ComfyUI
 * connection, the port scan, GPU detection, workflow health, settings reset.
 * It writes the Settings error line, where the server URL that usually fixes it
 * lives, and the Text to Image line, which is the screen most likely to be open
 * when startup falls back to the built-in model list.
 *
 * Nothing a single tool is doing may come through here. The six other tools each
 * surface their own failures through their own setter, and Text to Image now has
 * one too.
 */
export function setGlobalError(elements: AppElements, message: string) {
  applyToolError(elements.errorMessage, message);
  applyToolError(elements.settingsErrorMessage, message);
}

// Text to Image owns the unprefixed error element, the same leftover that gave
// it the unprefixed status elements. Like every other per-tool error setter it
// writes its own line only -- its "Enter a prompt before generating." has no
// business appearing on the Settings screen.
export function setTextToImageError(elements: AppElements, message: string) {
  applyToolError(elements.errorMessage, message);
}

export function setImageError(elements: AppElements, message: string) {
  applyToolError(elements.imgErrorMessage, message);
}

export function setSketchError(elements: AppElements, message: string) {
  applyToolError(elements.sketchErrorMessage, message);
}

export function setInpaintError(elements: AppElements, message: string) {
  applyToolError(elements.inpaintErrorMessage, message);
}

export function setOutpaintError(elements: AppElements, message: string) {
  applyToolError(elements.outpaintErrorMessage, message);
}

export function setUpscaleError(elements: AppElements, message: string) {
  applyToolError(elements.upscaleErrorMessage, message);
}

export function setPromptLayerError(elements: AppElements, message: string) {
  applyToolError(elements.promptLayerErrorMessage, message);
}

export function setStyleReferenceError(elements: AppElements, message: string) {
  applyToolError(elements.styleReferenceErrorMessage, message);
}

export function setMultiReferenceError(elements: AppElements, message: string) {
  applyToolError(elements.multiReferenceErrorMessage, message);
}

/**
 * A diagnostic that belongs to the panel rather than to a tool: the ComfyUI
 * connection, the port scan, the hardware report, workflow health, the settings
 * screen, the session history.
 *
 * Nothing a single tool is doing may come through here. This used to be the only
 * fan-out setter *and* Text to Image's own setter, so every "Generate pressed
 * at...", "Seed used: ..." and workflow warning was written into the Inpaint,
 * Upscale, Outpaint, Sketch, Image to Image and Prompt from Layer diagnostics
 * lines as well.
 *
 * It writes the Settings line only, unlike setGlobalStatus, which does still
 * paint every bar. A status bar reports state -- "ComfyUI is offline" is true of
 * every tool, so every tool should say it. A diagnostics line reports the last
 * thing that happened, it has no idle state to fall back to, and a GPU report
 * produced on the Settings screen did not happen on the Upscale screen: it would
 * sit there until the next upscale. Settings is where these are actionable and
 * where every tool already logs, so that is where they belong.
 */
export function setGlobalDiagnostics(elements: AppElements, message: string) {
  elements.settingsDiagnosticsText.textContent = message;
}

// Text to Image owns the unprefixed diagnostics element. Like every other
// per-tool diagnostics setter it writes its own line plus the Settings line,
// which is the panel's catch-all log: Settings shows what every tool reported,
// each tool shows only its own.
export function setTextToImageDiagnostics(elements: AppElements, message: string) {
  elements.diagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

export function setImageDiagnostics(elements: AppElements, message: string) {
  elements.imgDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

export function setSketchDiagnostics(elements: AppElements, message: string) {
  elements.sketchDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

export function setInpaintDiagnostics(elements: AppElements, message: string) {
  elements.inpaintDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

export function setOutpaintDiagnostics(elements: AppElements, message: string) {
  elements.outpaintDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

export function setUpscaleDiagnostics(elements: AppElements, message: string) {
  elements.upscaleDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

export function setPromptLayerDiagnostics(elements: AppElements, message: string) {
  elements.promptLayerDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

export function setStyleReferenceDiagnostics(elements: AppElements, message: string) {
  elements.styleReferenceDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}

export function setMultiReferenceDiagnostics(elements: AppElements, message: string) {
  elements.multiReferenceDiagnosticsText.textContent = message;
  elements.settingsDiagnosticsText.textContent = message;
}
