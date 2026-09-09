// @vitest-environment jsdom
//
// jsdom because the reachability checks at the bottom derive the button list
// from the real panel markup rather than a hand-written inventory.
import { describe, expect, it } from "vitest";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";
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
      "prompt-from-layer",
      "style-reference",
      "multi-reference",
      "unflatten",
      "remove-background",
      "layer-maps"
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
      "removeBackgroundModel",
      "removeBackgroundWorkflow",
      "layerMapsModel",
      "layerMapsWorkflow",
      "promptLayerNumBeams",
      "promptLayerGeneratedText",
      "styleReferencePrompt",
      "styleReferenceNegativePrompt",
      "styleReferenceWorkflow",
      "styleReferenceCheckpoint",
      "styleReferenceWidth",
      "styleReferenceHeight",
      "styleReferenceSteps",
      "styleReferenceCfg",
      "styleReferenceSeed",
      "styleReferenceControlStrength",
      "multiReferencePrompt",
      "multiReferenceNegativePrompt",
      "multiReferenceWorkflow",
      "multiReferenceCheckpoint",
      "multiReferenceSteps",
      "multiReferenceCfg",
      "multiReferenceSeed",
      "unflattenPrompt",
      "unflattenWorkflow",
      "unflattenCheckpoint",
      "unflattenLayerCount",
      "unflattenSteps",
      "unflattenSeed"
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

    // 40 = the original 29, plus Layer Tools' six export buttons, plus the
    // model-download spike button, plus Style Reference's two capture buttons,
    // plus Multi-Reference's two. Deleting the spike takes this back to 39.
    expect(plainActions).toHaveLength(42);
    // 22 = 20, plus Layer Maps' Generate and Import.
    expect(BUSY_GATED_ACTIONS).toHaveLength(22);
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
      "sendPromptLayerButton",
      "captureStyleReferenceLayerButton",
      "captureStyleReferenceCanvasButton",
      "addMultiReferenceLayerButton",
      "addMultiReferenceCanvasButton",
      "captureUnflattenLayerButton",
      "captureUnflattenCanvasButton"
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
      "generateStyleReferenceButton",
      "generateMultiReferenceButton",
      "importButton",
      "importImg2ImgButton",
      "importSketchButton",
      "importInpaintButton",
      "importOutpaintButton",
      "importUpscaleButton",
      "importStyleReferenceButton",
      "importMultiReferenceButton",
      "describeUnflattenSourceButton",
      "generateUnflattenButton",
      "importUnflattenButton",
      "generateRemoveBackgroundButton",
      "importRemoveBackgroundButton",
      "generateLayerMapsButton",
      "importLayerMapsButton",
      "checkButton",
      "findPortButton",
      "detectHardwareButton",
      "checkWorkflowHealthButton",
      "copyDiagnosticsButton",
      // SPIKE: remove with the spike itself.
      "spikeModelDownloadButton",
      "saveSettingsButton",
      "resetSettingsButton",
      "clearHistoryButton",
      "exportLayerFileButton",
      "exportLayerComfyButton",
      "exportSelectionFileButton",
      "exportSelectionComfyButton",
      "exportMaskFileButton",
      "exportMaskComfyButton"
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

/**
 * Every Import and Generate button must be gated on something.
 *
 * `BUSY_GATED_ACTIONS` is what makes those buttons clickable: `setBusy` walks
 * it and disables anything whose gate is empty. A button the table does not
 * mention is never visited, so it keeps the `is-disabled` class its markup
 * ships with and stays dead forever, looking exactly like a button that is
 * merely waiting for a result.
 *
 * That shipped. Remove Background's "Import to Layers" rendered, bound its
 * handler, and could not be pressed -- caught only by a person clicking it in
 * Photoshop, because nothing in the suite knew the table was supposed to cover
 * it. It was the third bug of this shape in one release: a control drawn in one
 * list and enabled by a second, with nothing checking the two agree.
 *
 * Derived from the real markup rather than a hand-written inventory, so a new
 * tool is covered the moment its buttons exist.
 */
describe("every action button is reachable", () => {
  const gatedButtons = new Set(BUSY_GATED_ACTIONS.map((action) => action.button));
  const alwaysDisabled = new Set<string>(BUSY_ALWAYS_DISABLED_ACTIONS);
  /**
   * Live Painting drives these two itself, from session state rather than from
   * a "a result exists" gate: one follows the session being live, the other the
   * refine pass having produced something. Listed by name rather than by
   * loosening the check, so a third one cannot join them silently.
   */
  const selfManaged = new Set(["importLiveButton", "importLiveRefinedButton"]);

  function actionButtonKeys(prefix: string) {
    const root = document.createElement("div");
    root.innerHTML = createAppMarkup();
    const elements = getAppElements(root) as unknown as Record<string, HTMLElement>;

    return Object.keys(elements).filter(
      (key) => key.startsWith(prefix) && key.endsWith("Button") && elements[key]?.tagName === "BUTTON"
    );
  }

  it("gates every Import button on a result", () => {
    const ungated = actionButtonKeys("import").filter(
      (key) => !gatedButtons.has(key as never) && !alwaysDisabled.has(key) && !selfManaged.has(key)
    );

    expect(ungated, "import buttons no gate enables, so they can never be pressed").toEqual([]);
  });

  it("gates every Generate button on a source", () => {
    const ungated = actionButtonKeys("generate").filter(
      (key) => !gatedButtons.has(key as never) && !alwaysDisabled.has(key) && !selfManaged.has(key)
    );

    expect(ungated, "generate buttons no gate enables, so they can never be pressed").toEqual([]);
  });
});
