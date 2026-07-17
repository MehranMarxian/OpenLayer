import { WorkflowPreset } from "./types";

export type FluxFillInpaintSourceInfo = {
  presetId: WorkflowPreset | string;
  hasSourceImage: boolean;
  hasMaskImage: boolean;
  sourceWidth?: number;
  sourceHeight?: number;
  maskWidth?: number;
  maskHeight?: number;
  hasSelectionContextBounds: boolean;
};

export type FluxFillInpaintDebugInput = FluxFillInpaintSourceInfo & {
  selectedFluxModelName?: string;
  t5TextEncoderName?: string;
  t5FallbackName?: string;
  clipLName?: string;
  vaeName?: string;
};

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
