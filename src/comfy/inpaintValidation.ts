import { WorkflowPreset } from "./types";

export type FluxFillInpaintSourceValidationInput = {
  presetId: WorkflowPreset | string;
  hasSourceImage: boolean;
  hasMaskImage: boolean;
  sourceWidth?: number;
  sourceHeight?: number;
  maskWidth?: number;
  maskHeight?: number;
  hasSelectionContextBounds: boolean;
};

export type FluxFillInpaintDebugInput = FluxFillInpaintSourceValidationInput & {
  selectedFluxModelName?: string;
  t5TextEncoderName?: string;
  t5FallbackName?: string;
  clipLName?: string;
  vaeName?: string;
};

export function validateFluxFillInpaintSource(input: FluxFillInpaintSourceValidationInput) {
  if (input.presetId !== "inpaint-flux-fill-basic") {
    return [];
  }

  const problems: string[] = [];

  if (!input.hasSourceImage) {
    problems.push("Capture a Photoshop selection source before running Flux Fill.");
  }

  if (!input.hasMaskImage) {
    problems.push("Capture a Photoshop selection mask before running Flux Fill.");
  }

  if (!input.hasSelectionContextBounds) {
    problems.push("Flux Fill needs the captured selection context bounds before generation.");
  }

  if (!hasKnownDimensions(input.sourceWidth, input.sourceHeight)) {
    problems.push("Flux Fill needs known source image dimensions before generation.");
  }

  if (!hasKnownDimensions(input.maskWidth, input.maskHeight)) {
    problems.push("Flux Fill needs known mask image dimensions before generation.");
  }

  if (
    hasKnownDimensions(input.sourceWidth, input.sourceHeight) &&
    hasKnownDimensions(input.maskWidth, input.maskHeight) &&
    (Math.round(Number(input.sourceWidth)) !== Math.round(Number(input.maskWidth)) ||
      Math.round(Number(input.sourceHeight)) !== Math.round(Number(input.maskHeight)))
  ) {
    problems.push(
      `Flux Fill source and mask must match. Source is ${Math.round(Number(input.sourceWidth))} x ${Math.round(Number(input.sourceHeight))}, mask is ${Math.round(Number(input.maskWidth))} x ${Math.round(Number(input.maskHeight))}.`
    );
  }

  return problems;
}

export function createFluxFillInpaintDebugSummary(input: FluxFillInpaintDebugInput) {
  if (input.presetId !== "inpaint-flux-fill-basic") {
    return "";
  }

  const sourceSize = formatSize(input.sourceWidth, input.sourceHeight);
  const maskSize = formatSize(input.maskWidth, input.maskHeight);
  const selectedModelName = input.selectedFluxModelName || "flux1-fill-dev.safetensors";
  const t5TextEncoderName = input.t5TextEncoderName || "t5xxl_fp16.safetensors";
  const t5FallbackName = input.t5FallbackName || "t5xxl_fp8_e4m3fn.safetensors";
  const clipLName = input.clipLName || "clip_l.safetensors";
  const vaeName = input.vaeName || "ae.safetensors";

  return [
    `Flux Fill debug: preset inpaint-flux-fill-basic.`,
    `Source ${sourceSize}; mask ${maskSize}.`,
    `Model ${selectedModelName}.`,
    `Text encoders ${t5TextEncoderName} preferred, ${t5FallbackName} fallback, ${clipLName}.`,
    `VAE ${vaeName}.`,
    `Mask polarity assumption: white = repaint.`,
    `Flux Fill is experimental; verify source and mask in ComfyUI if output looks wrong.`
  ].join(" ");
}

function hasKnownDimensions(width: number | undefined, height: number | undefined) {
  return Number.isFinite(width) && Number.isFinite(height) && Number(width) > 0 && Number(height) > 0;
}

function formatSize(width: number | undefined, height: number | undefined) {
  if (!hasKnownDimensions(width, height)) {
    return "unknown size";
  }

  return `${Math.round(Number(width))} x ${Math.round(Number(height))}`;
}
