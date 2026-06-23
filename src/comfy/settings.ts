import {
  GenerationSettingsInput,
  GenerationSettingsValidation,
  ImageToImageSettingsInput,
  ImageToImageSettingsValidation,
  SketchToImageSettingsInput,
  SketchToImageSettingsValidation
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
