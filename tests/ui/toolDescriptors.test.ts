import { describe, expect, it } from "vitest";
import {
  BUSY_ALLOWED_ACTIONS,
  BUSY_ALWAYS_DISABLED_ACTIONS,
  BUSY_DISABLED_FIELD_GROUPS,
  BUSY_GATED_ACTIONS
} from "../../src/ui/toolDescriptors";

describe("busy-state tables", () => {
  const fieldGroups = Object.values(BUSY_DISABLED_FIELD_GROUPS);
  const allFields = fieldGroups.flat();

  it("keeps a non-empty field group for global state and every tool", () => {
    expect(Object.keys(BUSY_DISABLED_FIELD_GROUPS)).toEqual([
      "global",
      "text-to-image",
      "image-to-image",
      "sketch-to-image",
      "inpaint",
      "outpaint",
      "upscale",
      "prompt-from-layer"
    ]);
    expect(fieldGroups.every((fields) => fields.length > 0)).toBe(true);
  });

  it("keeps the complete field inventory without assigning a field twice", () => {
    const expectedFields = [
      "serverUrl",
      "prompt",
      "negativePrompt",
      "workflow",
      "checkpoint",
      "width",
      "height",
      "steps",
      "cfg",
      "seed",
      "imgPrompt",
      "imgNegativePrompt",
      "imgWorkflow",
      "imgCheckpoint",
      "imgSteps",
      "imgCfg",
      "imgSeed",
      "imgDenoise",
      "sketchPrompt",
      "sketchNegativePrompt",
      "sketchWorkflow",
      "sketchCheckpoint",
      "sketchSteps",
      "sketchCfg",
      "sketchSeed",
      "sketchDenoise",
      "sketchControlStrength",
      "inpaintPrompt",
      "inpaintNegativePrompt",
      "inpaintWorkflow",
      "inpaintCheckpoint",
      "inpaintSteps",
      "inpaintCfg",
      "inpaintSeed",
      "inpaintDenoise",
      "outpaintPrompt",
      "outpaintWorkflow",
      "outpaintCheckpoint",
      "outpaintSteps",
      "outpaintGuidance",
      "outpaintSeed",
      "outpaintDenoise",
      "outpaintLeft",
      "outpaintTop",
      "outpaintRight",
      "outpaintBottom",
      "outpaintFeathering",
      "upscaleWorkflow",
      "upscaleModel",
      "promptLayerTask",
      "promptLayerNumBeams",
      "promptLayerGeneratedText"
    ];

    expect(new Set(allFields)).toEqual(new Set(expectedFields));
    expect(new Set(allFields).size).toBe(allFields.length);
  });

  it("accounts for every formerly busy-locked action exactly once", () => {
    const plainActions = [
      ...BUSY_ALWAYS_DISABLED_ACTIONS,
      ...BUSY_ALLOWED_ACTIONS
    ];
    const allActions = [
      ...plainActions,
      ...BUSY_GATED_ACTIONS.map(({ button }) => button)
    ];

    expect(plainActions).toHaveLength(29);
    expect(BUSY_GATED_ACTIONS).toHaveLength(11);
    expect(new Set(allActions).size).toBe(allActions.length);
  });

  it("leaves captures, preparation toggles, and prompt reuse actions out of the busy lock", () => {
    expect(new Set(BUSY_ALLOWED_ACTIONS)).toEqual(new Set([
      "negativePromptToggle",
      "autoImportToggle",
      "imgAutoImportToggle",
      "upscaleAutoImportToggle",
      "captureLayerButton",
      "captureCanvasButton",
      "experimentalCheckpointToggle",
      "captureSketchLayerButton",
      "captureSketchCanvasButton",
      "captureInpaintSelectionButton",
      "captureInpaintActiveLayerButton",
      "captureOutpaintLayerButton",
      "captureOutpaintCanvasButton",
      "captureUpscaleLayerButton",
      "captureUpscaleCanvasButton",
      "capturePromptLayerButton",
      "capturePromptCanvasButton",
      "copyPromptLayerButton",
      "sendPromptLayerButton"
    ]));
  });

  it("always locks every Generate and Import button while busy", () => {
    const lockedActions = new Set([
      ...BUSY_ALWAYS_DISABLED_ACTIONS,
      ...BUSY_GATED_ACTIONS.map(({ button }) => button)
    ]);

    expect(lockedActions).toEqual(new Set([
      "generateButton",
      "generateImg2ImgButton",
      "generateSketchButton",
      "generateInpaintButton",
      "generateOutpaintButton",
      "generateUpscaleButton",
      "generatePromptLayerButton",
      "importButton",
      "importImg2ImgButton",
      "importSketchButton",
      "importInpaintButton",
      "importOutpaintButton",
      "importUpscaleButton",
      "checkButton",
      "findPortButton",
      "detectHardwareButton",
      "checkWorkflowHealthButton",
      "copyDiagnosticsButton",
      "saveSettingsButton",
      "resetSettingsButton",
      "clearHistoryButton"
    ]));
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
