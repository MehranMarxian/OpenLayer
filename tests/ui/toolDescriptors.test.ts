import { describe, expect, it } from "vitest";
import {
  BUSY_DISABLED_ACTIONS,
  BUSY_DISABLED_FIELDS,
  BUSY_GATED_ACTIONS
} from "../../src/ui/toolDescriptors";

describe("busy-state tables", () => {
  it("keeps the full inventory the hand-written setBusy used to toggle", () => {
    // 52 form fields + 29 plain actions + 11 gated actions, counted from the
    // function this table replaced. A silently dropped entry would leave a
    // control enabled mid-generation with no failing test.
    expect(BUSY_DISABLED_FIELDS).toHaveLength(52);
    expect(BUSY_DISABLED_ACTIONS).toHaveLength(29);
    expect(BUSY_GATED_ACTIONS).toHaveLength(11);
  });

  it("lists every element at most once across all three tables", () => {
    const allKeys = [
      ...BUSY_DISABLED_FIELDS,
      ...BUSY_DISABLED_ACTIONS,
      ...BUSY_GATED_ACTIONS.map((action) => action.button)
    ];

    expect(new Set(allKeys).size).toBe(allKeys.length);
  });

  it("gates every tool's generate button on its captured source", () => {
    const gates = Object.fromEntries(BUSY_GATED_ACTIONS.map(({ button, gate }) => [button, gate]));

    expect(gates.generateImg2ImgButton).toBe("imageSource");
    expect(gates.generateSketchButton).toBe("sketchSource");
    expect(gates.generateInpaintButton).toBe("inpaintSource");
    expect(gates.generateOutpaintButton).toBe("outpaintSource");
    expect(gates.generateUpscaleButton).toBe("upscaleSource");
  });

  it("gates every tool's import button on its generated result", () => {
    const gates = Object.fromEntries(BUSY_GATED_ACTIONS.map(({ button, gate }) => [button, gate]));

    expect(gates.importButton).toBe("result");
    expect(gates.importImg2ImgButton).toBe("imageResult");
    expect(gates.importSketchButton).toBe("sketchResult");
    expect(gates.importInpaintButton).toBe("inpaintResult");
    expect(gates.importOutpaintButton).toBe("outpaintResult");
    expect(gates.importUpscaleButton).toBe("upscaleResult");
  });
});
