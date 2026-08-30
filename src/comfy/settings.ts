import {
  GenerationSettingsInput,
  GenerationSettingsValidation,
  ImageToImageSettingsInput,
  ImageToImageSettingsValidation,
  OutpaintSettingsInput,
  OutpaintSettingsValidation,
  SketchToImageSettingsInput,
  SketchToImageSettingsValidation,
  MultiReferenceSettingsInput,
  MultiReferenceSettingsValidation,
  UnflattenSettingsInput,
  UnflattenSettingsValidation,
  StyleReferenceSettingsInput,
  StyleReferenceSettingsValidation
} from "./types";
import { createOpenLayerError } from "../utils/errors";

const MAX_SEED = Number.MAX_SAFE_INTEGER;

export function validateGenerationSettings(input: GenerationSettingsInput): GenerationSettingsValidation {
  const warnings: string[] = [];
  const width = readDimension(input.width, "Width", warnings);
  const height = readDimension(input.height, "Height", warnings);
  const steps = readIntegerInRange(input.steps, "Steps", 1, 150, warnings);
  const cfg = readNumberInRange(input.cfg, "CFG", 1, 30, warnings);
  const seed = readSeed(input.seed, warnings);

  return {
    settings: {
      width,
      height,
      steps,
      cfg,
      seed
    },
    warnings
  };
}

export function validateImageToImageSettings(input: ImageToImageSettingsInput): ImageToImageSettingsValidation {
  const warnings: string[] = [];
  const steps = readIntegerInRange(input.steps, "Steps", 1, 150, warnings);
  const cfg = readNumberInRange(input.cfg, "CFG", 1, 30, warnings);
  const seed = readSeed(input.seed, warnings);
  const denoise = readNumberInRange(input.denoise, "Denoise", 0.05, 1, warnings);

  return {
    settings: {
      steps,
      cfg,
      seed,
      denoise
    },
    warnings
  };
}

export function validateSketchToImageSettings(input: SketchToImageSettingsInput): SketchToImageSettingsValidation {
  const { settings, warnings } = validateImageToImageSettings(input);
  const controlStrength = readNumberInRange(input.controlStrength, "ControlNet strength", 0, 2, warnings);

  return {
    settings: {
      ...settings,
      controlStrength
    },
    warnings
  };
}

export function validateStyleReferenceSettings(input: StyleReferenceSettingsInput): StyleReferenceSettingsValidation {
  const { settings, warnings } = validateGenerationSettings(input);
  const controlStrength = readNumberInRange(input.controlStrength, "Style strength", 0, 2, warnings);

  return {
    settings: {
      ...settings,
      controlStrength
    },
    warnings
  };
}

export function validateMultiReferenceSettings(
  input: MultiReferenceSettingsInput
): MultiReferenceSettingsValidation {
  const warnings: string[] = [];
  const steps = readIntegerInRange(input.steps, "Steps", 1, 150, warnings);
  const cfg = readNumberInRange(input.cfg, "CFG", 1, 30, warnings);
  const seed = readSeed(input.seed, warnings);

  return {
    settings: {
      steps,
      cfg,
      seed
    },
    warnings
  };
}

/**
 * Layer count is clamped to 2-4 rather than left open, and the ceiling is
 * measured rather than cautious: six layers came back with three of five plates
 * blank, and two fuses distinct objects into a single plate. Four is the
 * optimum. docs/unflatten-gate-findings.md, Q2.
 *
 * There is no CFG here. The graph decomposes an existing picture at a fixed
 * 2.5, the way the edit presets fix denoise at 1 -- it is the technique rather
 * than a default, so there is nowhere for a slider to go.
 */
export function validateUnflattenSettings(input: UnflattenSettingsInput): UnflattenSettingsValidation {
  const warnings: string[] = [];
  const layerCount = readIntegerInRange(input.layerCount, "Layers", 2, 4, warnings);
  const steps = readIntegerInRange(input.steps, "Steps", 1, 150, warnings);
  const seed = readSeed(input.seed, warnings);

  return {
    settings: {
      layerCount,
      steps,
      seed
    },
    warnings
  };
}

export function validateOutpaintSettings(input: OutpaintSettingsInput): OutpaintSettingsValidation {
  const { settings, warnings } = validateImageToImageSettings(input);
  const left = readIntegerInRange(input.left, "Left expansion", 0, 2048, warnings);
  const top = readIntegerInRange(input.top, "Top expansion", 0, 2048, warnings);
  const right = readIntegerInRange(input.right, "Right expansion", 0, 2048, warnings);
  const bottom = readIntegerInRange(input.bottom, "Bottom expansion", 0, 2048, warnings);
  const feathering = readIntegerInRange(input.feathering, "Feathering", 0, 256, warnings);

  if (left + top + right + bottom === 0) {
    warnings.push("No outpaint expansion was requested.");
  }

  return {
    settings: {
      ...settings,
      left,
      top,
      right,
      bottom,
      feathering
    },
    warnings
  };
}

function readDimension(rawValue: string, label: string, warnings: string[]) {
  const parsed = readRequiredInteger(rawValue, label);
  const clamped = clamp(parsed, 64, 2048);
  const rounded = Math.round(clamped / 64) * 64;

  if (rounded !== parsed) {
    warnings.push(`${label} adjusted to ${rounded}.`);
  }

  return rounded;
}

function readIntegerInRange(
  rawValue: string,
  label: string,
  min: number,
  max: number,
  warnings: string[]
) {
  const parsed = readRequiredInteger(rawValue, label);
  const clamped = clamp(parsed, min, max);

  if (clamped !== parsed) {
    warnings.push(`${label} adjusted to ${clamped}.`);
  }

  return clamped;
}

function readNumberInRange(
  rawValue: string,
  label: string,
  min: number,
  max: number,
  warnings: string[]
) {
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    throw createOpenLayerError("SETTINGS_INVALID", `${label} must be a number.`);
  }

  const clamped = clamp(parsed, min, max);

  if (clamped !== parsed) {
    warnings.push(`${label} adjusted to ${clamped}.`);
  }

  return Number(clamped.toFixed(2));
}

function readSeed(rawValue: string, warnings: string[]) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    const seed = createRandomSeed();
    warnings.push(`Random seed: ${seed}.`);
    return seed;
  }

  const seed = readRequiredInteger(trimmed, "Seed");
  const clamped = clamp(seed, 0, MAX_SEED);

  if (clamped !== seed) {
    warnings.push(`Seed adjusted to ${clamped}.`);
  }

  return clamped;
}

function readRequiredInteger(rawValue: string, label: string) {
  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed)) {
    throw createOpenLayerError("SETTINGS_INVALID", `${label} must be a whole number.`);
  }

  return parsed;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createRandomSeed() {
  return Math.floor(Math.random() * MAX_SEED);
}
