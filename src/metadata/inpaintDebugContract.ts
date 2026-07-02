import { OpenLayerLayerBounds } from "./layerMetadata";

export type InpaintOutpaintDebugContract = {
  toolType: "inpaint" | "outpaint";
  presetId: string;
  sourceMode?: string;
  sourceDimensions?: {
    width: number;
    height: number;
  };
  maskDimensions?: {
    width: number;
    height: number;
  } | null;
  maskPolarity?: "white-repaints" | "none";
  contextBounds?: OpenLayerLayerBounds;
  outputKind?: string;
  importMode?: string;
};

export function formatInpaintOutpaintDebugContract(contract: InpaintOutpaintDebugContract) {
  const parts = [
    `${formatTool(contract.toolType)} debug contract: ${contract.presetId}.`,
    contract.sourceMode ? `Source mode: ${contract.sourceMode}.` : "",
    `Source: ${formatDimensions(contract.sourceDimensions)}.`,
    contract.toolType === "inpaint" ? `Mask: ${formatDimensions(contract.maskDimensions)}.` : "",
    contract.maskPolarity && contract.maskPolarity !== "none" ? "Mask polarity: white = repaint." : "",
    contract.contextBounds ? `Context: ${formatBounds(contract.contextBounds)}.` : "",
    contract.outputKind ? `Output: ${contract.outputKind}.` : "",
    contract.importMode ? `Import: ${contract.importMode}.` : ""
  ];

  return parts.filter(Boolean).join(" ");
}

function formatTool(toolType: InpaintOutpaintDebugContract["toolType"]) {
  return toolType === "inpaint" ? "Inpaint" : "Outpaint";
}

function formatDimensions(dimensions: InpaintOutpaintDebugContract["sourceDimensions"] | null | undefined) {
  if (!dimensions || !Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height)) {
    return "unknown";
  }

  return `${Math.round(dimensions.width)} x ${Math.round(dimensions.height)}`;
}

function formatBounds(bounds: OpenLayerLayerBounds) {
  return `${Math.round(bounds.left)}, ${Math.round(bounds.top)} to ${Math.round(bounds.right)}, ${Math.round(bounds.bottom)}`;
}
