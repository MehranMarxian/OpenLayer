export type OpenLayerMetadataToolType =
  | "text-to-image"
  | "image-to-image"
  | "sketch-to-image"
  | "inpaint"
  | "outpaint"
  | "prompt-from-layer"
  | "upscale";

export type OpenLayerLayerBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width?: number;
  height?: number;
};

export type OpenLayerLayerDimensions = {
  width?: number;
  height?: number;
  label: string;
};

export type OpenLayerLayerMetadata = {
  schemaVersion: 1;
  appName: "OpenLayer";
  openLayerVersion: string;
  toolType: OpenLayerMetadataToolType;
  workflowPresetId: string;
  modelName: string;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  dimensions?: OpenLayerLayerDimensions;
  sourceMode?: string;
  sourceBounds?: OpenLayerLayerBounds;
  contextBounds?: OpenLayerLayerBounds;
  importTimestamp: string;
  importedLayerName?: string;
  experimental: boolean;
  diagnosticsSummary?: string;
};

export type OpenLayerLayerMetadataInput = {
  openLayerVersion: string;
  toolType: OpenLayerMetadataToolType;
  workflowPresetId: string;
  modelName?: string;
  prompt?: string;
  negativePrompt?: string;
  seed?: number;
  dimensions?: OpenLayerLayerDimensions | string;
  sourceMode?: string;
  sourceBounds?: OpenLayerLayerBounds;
  contextBounds?: OpenLayerLayerBounds;
  importTimestamp?: string | Date;
  importedLayerName?: string;
  experimental?: boolean;
  diagnosticsSummary?: string;
};

const MAX_TEXT_LENGTH = 2400;

export function createOpenLayerLayerMetadata(input: OpenLayerLayerMetadataInput): OpenLayerLayerMetadata {
  return sanitizeOpenLayerLayerMetadata({
    schemaVersion: 1,
    appName: "OpenLayer",
    openLayerVersion: input.openLayerVersion,
    toolType: input.toolType,
    workflowPresetId: input.workflowPresetId,
    modelName: input.modelName ?? "",
    prompt: input.prompt ?? "",
    negativePrompt: input.negativePrompt,
    seed: input.seed,
    dimensions: normalizeDimensions(input.dimensions),
    sourceMode: input.sourceMode,
    sourceBounds: input.sourceBounds,
    contextBounds: input.contextBounds,
    importTimestamp: normalizeTimestamp(input.importTimestamp),
    importedLayerName: input.importedLayerName,
    experimental: Boolean(input.experimental),
    diagnosticsSummary: input.diagnosticsSummary
  });
}

export function sanitizeOpenLayerLayerMetadata(metadata: OpenLayerLayerMetadata): OpenLayerLayerMetadata {
  const sanitized: OpenLayerLayerMetadata = {
    schemaVersion: 1,
    appName: "OpenLayer",
    openLayerVersion: sanitizeText(metadata.openLayerVersion, 48) || "unknown",
    toolType: metadata.toolType,
    workflowPresetId: sanitizeText(metadata.workflowPresetId, 160) || "unknown",
    modelName: sanitizeText(metadata.modelName, 260) || "unknown",
    prompt: sanitizeText(metadata.prompt) || "Untitled prompt",
    importTimestamp: normalizeTimestamp(metadata.importTimestamp),
    experimental: Boolean(metadata.experimental)
  };

  const negativePrompt = sanitizeText(metadata.negativePrompt);
  const sourceMode = sanitizeText(metadata.sourceMode, 260);
  const importedLayerName = sanitizeText(metadata.importedLayerName, 260);
  const diagnosticsSummary = sanitizeText(metadata.diagnosticsSummary);
  const seed = normalizeFiniteNumber(metadata.seed);
  const dimensions = normalizeDimensions(metadata.dimensions);
  const sourceBounds = normalizeBounds(metadata.sourceBounds);
  const contextBounds = normalizeBounds(metadata.contextBounds);

  if (negativePrompt) {
    sanitized.negativePrompt = negativePrompt;
  }

  if (seed !== undefined) {
    sanitized.seed = seed;
  }

  if (dimensions) {
    sanitized.dimensions = dimensions;
  }

  if (sourceMode) {
    sanitized.sourceMode = sourceMode;
  }

  if (sourceBounds) {
    sanitized.sourceBounds = sourceBounds;
  }

  if (contextBounds) {
    sanitized.contextBounds = contextBounds;
  }

  if (importedLayerName) {
    sanitized.importedLayerName = importedLayerName;
  }

  if (diagnosticsSummary) {
    sanitized.diagnosticsSummary = diagnosticsSummary;
  }

  return sanitized;
}

export function serializeOpenLayerLayerMetadata(metadata: OpenLayerLayerMetadata) {
  return JSON.stringify(sanitizeOpenLayerLayerMetadata(metadata));
}

export function summarizeOpenLayerLayerMetadata(metadata: OpenLayerLayerMetadata) {
  const safe = sanitizeOpenLayerLayerMetadata(metadata);
  const parts = [
    `OpenLayer v${safe.openLayerVersion}`,
    formatToolType(safe.toolType),
    safe.workflowPresetId,
    safe.modelName,
    safe.seed !== undefined ? `Seed ${safe.seed}` : "",
    safe.dimensions?.label ?? "",
    safe.experimental ? "Experimental" : ""
  ].filter(Boolean);

  return parts.join(" | ");
}

function normalizeDimensions(value: OpenLayerLayerMetadataInput["dimensions"]): OpenLayerLayerDimensions | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    const label = sanitizeText(value, 120);
    return label ? { label } : undefined;
  }

  const width = normalizePositiveNumber(value.width);
  const height = normalizePositiveNumber(value.height);
  const fallbackLabel = width && height ? `${Math.round(width)} x ${Math.round(height)}` : "";
  const label = sanitizeText(value.label, 120) || fallbackLabel;

  if (!label) {
    return undefined;
  }

  return {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    label
  };
}

function normalizeBounds(value: OpenLayerLayerBounds | undefined): OpenLayerLayerBounds | undefined {
  if (!value) {
    return undefined;
  }

  const left = normalizeFiniteNumber(value.left);
  const top = normalizeFiniteNumber(value.top);
  const right = normalizeFiniteNumber(value.right);
  const bottom = normalizeFiniteNumber(value.bottom);

  if (left === undefined || top === undefined || right === undefined || bottom === undefined) {
    return undefined;
  }

  const width = normalizePositiveNumber(value.width ?? right - left);
  const height = normalizePositiveNumber(value.height ?? bottom - top);

  return {
    left,
    top,
    right,
    bottom,
    ...(width ? { width } : {}),
    ...(height ? { height } : {})
  };
}

function sanitizeText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeTimestamp(value: string | Date | undefined) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);

    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizePositiveNumber(value: unknown) {
  const numberValue = normalizeFiniteNumber(value);
  return numberValue !== undefined && numberValue > 0 ? numberValue : undefined;
}

function formatToolType(toolType: OpenLayerMetadataToolType) {
  switch (toolType) {
    case "text-to-image":
      return "Text to Image";
    case "image-to-image":
      return "Image to Image";
    case "sketch-to-image":
      return "Sketch to Image";
    case "inpaint":
      return "Inpaint";
    case "outpaint":
      return "Outpaint";
    case "prompt-from-layer":
      return "Prompt from Layer";
    case "upscale":
      return "Upscale";
    default:
      return "OpenLayer";
  }
}
