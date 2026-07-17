import type { SelectedRegionSourceImage } from "../photoshop/photoshopAdapter";
import type { PixelDimensions } from "../photoshop/exactInpaintMask";
import type { NormalizedSelectionBounds } from "../photoshop/selectionUtils";
import type { WorkflowPresetDefinition } from "../comfy/types";
import {
  evaluateWorkflowCompatibility,
  WorkflowCompatibilityContext
} from "../comfy/workflowCompatibility";

// ComfyUI's VAE rounds image dimensions down to multiples of 8. A context that is
// not a multiple of 8 comes back smaller than it was captured, which silently
// breaks the translate-only aligned import, so it is a readiness failure rather
// than a warning. Mirrors INPAINT_CONTEXT_MULTIPLE in photoshopAdapter.
const INPAINT_CONTEXT_MULTIPLE = 8;

export const FLUX_FILL_PRESET_ID = "inpaint-flux-fill-basic";

export type InpaintReadinessReason =
  | "workflow-unresolved"
  | "workflow-not-runnable"
  | "source-missing"
  | "origin-document-missing"
  | "prompt-missing"
  | "mask-missing"
  | "mask-dimension-mismatch"
  | "context-bounds-invalid"
  | "context-bounds-unaligned"
  | "source-context-mismatch"
  | "selection-outside-context"
  | "checkpoint-missing"
  | "checkpoint-not-installed"
  | "flux-fill-mask-bridge-unavailable"
  | "result-dimension-mismatch";

export type InpaintReadiness =
  | Readonly<{ ok: true; warnings: readonly string[] }>
  | Readonly<{
    ok: false;
    reason: InpaintReadinessReason;
    message: string;
    technicalMessage?: string;
    warnings: readonly string[];
  }>;

// Importing a saved result replays pixels that already exist: it runs no
// workflow, loads no checkpoint, and needs no ComfyUI node. Import readiness is
// therefore the capture-and-geometry subset of generate readiness, plus the
// check that the result still matches the context it was generated for.
export type InpaintReadinessMode = "generate" | "import";

export type InpaintReadinessInput = Readonly<{
  mode: InpaintReadinessMode;
  source: SelectedRegionSourceImage | null;
  // Generate only.
  preset?: WorkflowPresetDefinition | null;
  presetId?: string;
  checkpointName?: string;
  prompt?: string;
  compatibilityContext?: WorkflowCompatibilityContext;
  // The model names the ComfyUI server actually offers for this preset's model
  // source. Omitted when the list could not be read, because an unreachable or
  // unlisted server must not block generation on a guess.
  installedModelNames?: readonly string[];
  // Flux Fill embeds the mask in the source PNG's alpha channel instead of
  // uploading a separate mask image.
  maskBridgeAvailable?: boolean;
  // Import only: what ComfyUI actually returned.
  resultDimensions?: PixelDimensions | null;
}>;

export function evaluateInpaintReadiness(input: InpaintReadinessInput): InpaintReadiness {
  const warnings: string[] = [];
  const isGenerate = input.mode === "generate";

  if (isGenerate && !input.preset) {
    return blocked(
      "workflow-unresolved",
      `OpenLayer could not resolve the “${input.presetId || "selected"}” Inpaint workflow. Choose an Inpaint workflow in the panel and try again.`,
      warnings
    );
  }

  const source = input.source;

  if (!source || source.blob.size === 0) {
    return blocked(
      "source-missing",
      "Make a Photoshop selection, then click Capture Selection before generating Inpaint.",
      warnings
    );
  }

  if (!source.originatingDocument) {
    return blocked(
      "origin-document-missing",
      "This captured selection is not linked to a Photoshop document, so OpenLayer will not generate from it. Capture the selection again while the intended document is active.",
      warnings
    );
  }

  if (isGenerate && !(input.prompt ?? "").trim()) {
    return blocked("prompt-missing", "Enter a prompt before generating Inpaint.", warnings);
  }

  if (!source.mask || source.mask.blob.size === 0) {
    return blocked(
      "mask-missing",
      source.maskMessage || "Capture Selection did not produce a mask image. Capture the selection again before generating.",
      warnings
    );
  }

  if (!sameDimensions(source.mask, source)) {
    return blocked(
      "mask-dimension-mismatch",
      "The captured mask does not match its source image, so the repainted area would land in the wrong place. Capture the selection again.",
      warnings,
      `Mask is ${formatDimensions(source.mask)}; source is ${formatDimensions(source)}.`
    );
  }

  const contextBounds = source.selection?.contextBounds;

  if (!contextBounds || !isVisibleBounds(contextBounds)) {
    return blocked(
      "context-bounds-invalid",
      "The captured selection context is missing or empty. Make a visible selection and capture it again.",
      warnings
    );
  }

  if (!isAlignedToMultiple(contextBounds)) {
    return blocked(
      "context-bounds-unaligned",
      "The captured selection context cannot be generated at its exact size, so the result would not line up with your selection. Capture the selection again.",
      warnings,
      `Context ${formatDimensions(contextBounds)} is not a multiple of ${INPAINT_CONTEXT_MULTIPLE}; ComfyUI would round it down and return a smaller image.`
    );
  }

  if (!sameDimensions(source, contextBounds)) {
    return blocked(
      "source-context-mismatch",
      "The captured source image does not match its selection context, so the result would not line up with your selection. Capture the selection again.",
      warnings,
      `Source is ${formatDimensions(source)}; context is ${formatDimensions(contextBounds)}.`
    );
  }

  const selectionBounds = source.selection?.bounds;

  if (selectionBounds && !containsBounds(contextBounds, selectionBounds)) {
    return blocked(
      "selection-outside-context",
      "The captured selection sits outside its own context, so the repainted area would be clipped. Capture the selection again.",
      warnings,
      `Selection ${formatBounds(selectionBounds)} is not contained by context ${formatBounds(contextBounds)}.`
    );
  }

  if (isGenerate && input.preset) {
    const workflowReadiness = evaluateWorkflowReadiness(input, input.preset, warnings);

    if (workflowReadiness) {
      return workflowReadiness;
    }
  }

  if (input.mode === "import" && (!input.resultDimensions || !sameDimensions(input.resultDimensions, source))) {
    return blocked(
      "result-dimension-mismatch",
      "The generated Inpaint result does not match the saved source context. Generate this result again before importing.",
      warnings,
      `Result is ${input.resultDimensions ? formatDimensions(input.resultDimensions) : "an unreadable size"}; saved source context is ${formatDimensions(source)}.`
    );
  }

  return { ok: true, warnings };
}

// Returns a blocked readiness, or null when the workflow side is ready. Warnings
// are collected into the caller's list either way.
function evaluateWorkflowReadiness(
  input: InpaintReadinessInput,
  preset: WorkflowPresetDefinition,
  warnings: string[]
): InpaintReadiness | null {
  const checkpointName = (input.checkpointName ?? "").trim();

  if (!checkpointName) {
    return blocked(
      "checkpoint-missing",
      `Choose a ${preset.modelSource.label} for the ${preset.label} workflow before generating.`,
      warnings
    );
  }

  // evaluateWorkflowCompatibility only checks the models a preset declares in
  // requiredModels, so a freely chosen checkpoint is never compared against the
  // server there. A stale dropdown or a deleted model would otherwise reach the
  // upload before ComfyUI rejected it.
  const installedModelNames = input.installedModelNames ?? [];

  if (installedModelNames.length > 0 && !installedModelNames.includes(checkpointName)) {
    return blocked(
      "checkpoint-not-installed",
      `“${checkpointName}” is not installed in ComfyUI. Choose an installed ${preset.modelSource.label} for the ${preset.label} workflow.`,
      warnings,
      `Installed options: ${installedModelNames.join(", ")}.`
    );
  }

  if (preset.id === FLUX_FILL_PRESET_ID && input.maskBridgeAvailable === false) {
    return blocked(
      "flux-fill-mask-bridge-unavailable",
      "OpenLayer could not embed the Photoshop mask into the Flux Fill source image, so Flux Fill would repaint the wrong area. Capture the selection again.",
      warnings,
      "inpaint-flux-fill-basic uploads one PNG whose alpha channel carries the mask for the LoadImage mask output."
    );
  }

  const compatibility = evaluateWorkflowCompatibility(preset, {
    ...input.compatibilityContext,
    selectedModelName: input.compatibilityContext?.selectedModelName ?? checkpointName,
    photoshopInputs: {
      ...input.compatibilityContext?.photoshopInputs,
      selection: true,
      "selection-mask": true
    }
  });

  for (const issue of compatibility.issues) {
    if (issue.level === "warning" || issue.level === "experimental") {
      warnings.push(issue.artistMessage);
    }
  }

  if (!compatibility.canRun) {
    const blockingIssue =
      compatibility.issues.find((issue) => issue.level === "unsupported") ??
      compatibility.issues.find((issue) => issue.level === "setup-required");

    return blocked(
      "workflow-not-runnable",
      blockingIssue?.artistMessage ?? `The ${preset.label} workflow is not ready to run in this ComfyUI setup.`,
      warnings,
      [blockingIssue?.code, blockingIssue?.technicalMessage, compatibility.recommendedAction]
        .filter(Boolean)
        .join(" ") || undefined
    );
  }

  return null;
}

// Short status-line label per reason, so a blocked run keeps naming the one thing
// the artist has to fix rather than collapsing to a generic "not ready".
const READINESS_STATUS_LABELS: Record<InpaintReadinessReason, string> = {
  "workflow-unresolved": "Workflow required.",
  "workflow-not-runnable": "Setup required.",
  "source-missing": "Selection required.",
  "origin-document-missing": "Document required.",
  "prompt-missing": "Prompt required.",
  "mask-missing": "Mask required.",
  "mask-dimension-mismatch": "Recapture required.",
  "context-bounds-invalid": "Selection required.",
  "context-bounds-unaligned": "Recapture required.",
  "source-context-mismatch": "Recapture required.",
  "selection-outside-context": "Recapture required.",
  "checkpoint-missing": "Checkpoint required.",
  "checkpoint-not-installed": "Checkpoint required.",
  "flux-fill-mask-bridge-unavailable": "Mask required.",
  "result-dimension-mismatch": "Regenerate required."
};

export function getInpaintReadinessStatusLabel(reason: InpaintReadinessReason) {
  return READINESS_STATUS_LABELS[reason];
}

export function formatInpaintReadinessDiagnostic(readiness: InpaintReadiness) {
  if (readiness.ok) {
    return readiness.warnings.join(" ");
  }

  return [`Inpaint blocked (${readiness.reason}).`, readiness.technicalMessage, ...readiness.warnings]
    .filter(Boolean)
    .join(" ");
}

function blocked(
  reason: InpaintReadinessReason,
  message: string,
  warnings: readonly string[],
  technicalMessage?: string
): InpaintReadiness {
  return { ok: false, reason, message, technicalMessage, warnings: [...warnings] };
}

function sameDimensions(left: PixelDimensions, right: PixelDimensions) {
  return Math.round(left.width) === Math.round(right.width) && Math.round(left.height) === Math.round(right.height);
}

function isVisibleBounds(bounds: NormalizedSelectionBounds) {
  return [bounds.left, bounds.top, bounds.right, bounds.bottom].every((value) => Number.isFinite(value)) &&
    bounds.right > bounds.left &&
    bounds.bottom > bounds.top &&
    isPositiveInteger(bounds.width) &&
    isPositiveInteger(bounds.height) &&
    bounds.width === bounds.right - bounds.left &&
    bounds.height === bounds.bottom - bounds.top;
}

function isAlignedToMultiple(bounds: NormalizedSelectionBounds) {
  return bounds.width % INPAINT_CONTEXT_MULTIPLE === 0 && bounds.height % INPAINT_CONTEXT_MULTIPLE === 0;
}

function containsBounds(outer: NormalizedSelectionBounds, inner: NormalizedSelectionBounds) {
  return inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.right <= outer.right &&
    inner.bottom <= outer.bottom;
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function formatDimensions(dimensions: PixelDimensions) {
  return `${Math.round(dimensions.width)} x ${Math.round(dimensions.height)}`;
}

function formatBounds(bounds: NormalizedSelectionBounds) {
  return `${formatDimensions(bounds)} at ${bounds.left}, ${bounds.top}`;
}
