import { describe, expect, it } from "vitest";
import {
  chooseInpaintImportMode,
  createInpaintSourceModeDiagnostic,
  createInpaintSourceModeWarning,
  getInpaintSourceModeLabel
} from "../../src/photoshop/inpaintSourceMode";

describe("inpaintSourceMode", () => {
  it("labels visible canvas and active layer modes", () => {
    expect(getInpaintSourceModeLabel("visible-canvas")).toBe("Visible Canvas");
    expect(getInpaintSourceModeLabel("active-layer")).toBe("Active Layer");
  });

  it("warns when visible canvas may include previous OpenLayer result layers", () => {
    const warning = createInpaintSourceModeWarning("visible-canvas", "OpenLayer_Inpaint_20260629_2159");

    expect(warning).toContain("includes visible OpenLayer result layers");
  });

  it("describes active layer capture as isolated from the visible stack", () => {
    const warning = createInpaintSourceModeWarning("active-layer", "Base Photo");

    expect(warning).toContain("captures only the selected active layer");
  });

  it("formats a compact capture diagnostic", () => {
    const diagnostic = createInpaintSourceModeDiagnostic({
      mode: "active-layer",
      sourceName: "Active layer: Base Photo",
      activeLayerName: "Base Photo",
      maskAvailable: true
    });

    expect(diagnostic).toContain("Inpaint source mode: Active Layer");
    expect(diagnostic).toContain("Selection mask captured");
  });

  it("chooses native layer mask import only when a mask is available", () => {
    expect(chooseInpaintImportMode({ hasMask: true, canUseNativeLayerMask: true }).useNativeLayerMask).toBe(true);
    expect(chooseInpaintImportMode({ hasMask: false, canUseNativeLayerMask: true }).useNativeLayerMask).toBe(false);
  });
});
