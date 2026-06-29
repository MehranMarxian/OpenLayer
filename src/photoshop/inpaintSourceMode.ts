export type InpaintSourceMode = "visible-canvas" | "active-layer";

export type InpaintSourceModeDiagnosticInput = {
  mode: InpaintSourceMode;
  sourceName?: string;
  activeLayerName?: string;
  maskAvailable: boolean;
};

export type InpaintImportDecisionInput = {
  hasMask: boolean;
  canUseNativeLayerMask: boolean;
};

export function getInpaintSourceModeLabel(mode: InpaintSourceMode) {
  return mode === "active-layer" ? "Active Layer" : "Visible Canvas";
}

export function createInpaintSourceModeWarning(mode: InpaintSourceMode, activeLayerName = "") {
  if (mode === "active-layer") {
    return "Active Layer mode captures only the selected active layer inside the selection context.";
  }

  if (isLikelyOpenLayerResultLayer(activeLayerName)) {
    return "Visible Canvas mode includes visible OpenLayer result layers. Hide previous OpenLayer result layers or use Active Layer mode for a cleaner source.";
  }

  return "Visible Canvas mode includes all visible Photoshop layers in the selected context.";
}

export function createInpaintSourceModeDiagnostic(input: InpaintSourceModeDiagnosticInput) {
  const modeLabel = getInpaintSourceModeLabel(input.mode);
  const sourceLabel = input.sourceName ? ` Source: ${input.sourceName}.` : "";
  const maskLabel = input.maskAvailable ? " Selection mask captured." : " Selection mask unavailable.";

  return `Inpaint source mode: ${modeLabel}.${sourceLabel}${maskLabel} ${createInpaintSourceModeWarning(input.mode, input.activeLayerName)}`;
}

export function chooseInpaintImportMode(input: InpaintImportDecisionInput) {
  if (input.hasMask && input.canUseNativeLayerMask) {
    return {
      useNativeLayerMask: true,
      message: "Native Photoshop layer mask import will be attempted."
    };
  }

  if (!input.hasMask) {
    return {
      useNativeLayerMask: false,
      message: "No captured mask is available. OpenLayer will use aligned context fallback."
    };
  }

  return {
    useNativeLayerMask: false,
    message: "Native Photoshop layer mask import is unavailable. OpenLayer will use aligned context fallback."
  };
}

function isLikelyOpenLayerResultLayer(layerName: string) {
  return /^openlayer[_\s-]/i.test(layerName.trim());
}
