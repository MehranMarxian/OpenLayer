export type HistoryToolType =
  | "text-to-image"
  | "image-to-image"
  | "sketch-to-image"
  | "inpaint"
  | "outpaint"
  | "prompt-from-layer"
  | "upscale";

export type HistoryImportStatus = "not-imported" | "imported";

const TOOL_LABELS: Record<HistoryToolType, string> = {
  "text-to-image": "Text to Image",
  "image-to-image": "Image to Image",
  "sketch-to-image": "Sketch to Image",
  inpaint: "Inpaint",
  outpaint: "Outpaint",
  "prompt-from-layer": "Prompt from Layer",
  upscale: "Upscale"
};

export function formatHistoryToolLabel(toolType: HistoryToolType) {
  return TOOL_LABELS[toolType] ?? "OpenLayer";
}

export function createHistoryMetadataLine(options: {
  toolType: HistoryToolType;
  dimensions: string;
  seed: number;
}) {
  return `${formatHistoryToolLabel(options.toolType)} | ${options.dimensions} | Seed ${options.seed}`;
}

export function formatHistoryImportStatus(status: HistoryImportStatus, importedLayerName?: string) {
  if (status === "imported") {
    return importedLayerName ? `Imported: ${importedLayerName}` : "Imported";
  }

  return "Not imported yet";
}

export function createHistoryReuseMessage(toolType: HistoryToolType) {
  return `Reused ${formatHistoryToolLabel(toolType)} settings from history.`;
}
