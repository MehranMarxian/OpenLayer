import { describe, expect, it } from "vitest";
import { AppElements } from "../../src/ui/appMarkup";
import {
  setGlobalDiagnostics,
  setGlobalError,
  setImageDiagnostics,
  setImageError,
  setInpaintDiagnostics,
  setInpaintError,
  setOutpaintDiagnostics,
  setOutpaintError,
  setPromptLayerDiagnostics,
  setPromptLayerError,
  setSketchDiagnostics,
  setSketchError,
  setTextToImageDiagnostics,
  setTextToImageError,
  setUpscaleDiagnostics,
  setUpscaleError
} from "../../src/ui/statusBars";

/**
 * Which screens a diagnostics or error message reaches. The setters are DOM
 * writes and the suite is node-only, but these two only ever touch `textContent`
 * and `hidden`, so a bag of plain objects is enough to record the fan-out.
 *
 * Worth testing because a wrong owner is invisible until a user sees one tool's
 * message on another tool's screen: nothing throws, nothing fails to compile,
 * and the panel looks fine to whoever made the change.
 */

const DIAGNOSTICS_KEYS = [
  "diagnosticsText",
  "imgDiagnosticsText",
  "sketchDiagnosticsText",
  "inpaintDiagnosticsText",
  "outpaintDiagnosticsText",
  "upscaleDiagnosticsText",
  "promptLayerDiagnosticsText",
  "settingsDiagnosticsText"
] as const;

const ERROR_KEYS = [
  "errorMessage",
  "imgErrorMessage",
  "sketchErrorMessage",
  "inpaintErrorMessage",
  "outpaintErrorMessage",
  "upscaleErrorMessage",
  "promptLayerErrorMessage",
  "settingsErrorMessage"
] as const;

type LineKey = (typeof DIAGNOSTICS_KEYS)[number] | (typeof ERROR_KEYS)[number];

function createLines() {
  const lines = {} as Record<LineKey, { textContent: string; hidden: boolean }>;

  for (const key of [...DIAGNOSTICS_KEYS, ...ERROR_KEYS]) {
    lines[key] = { textContent: "", hidden: true };
  }

  return lines;
}

function linesWritten(
  keys: readonly LineKey[],
  write: (elements: AppElements) => void
) {
  const lines = createLines();

  write(lines as unknown as AppElements);

  return keys.filter((key) => lines[key].textContent === "written");
}

function diagnosticsReach(setter: (elements: AppElements, message: string) => void) {
  return linesWritten(DIAGNOSTICS_KEYS, (elements) => setter(elements, "written"));
}

function errorReach(setter: (elements: AppElements, message: string) => void) {
  return linesWritten(ERROR_KEYS, (elements) => setter(elements, "written"));
}

describe("diagnostics fan-out", () => {
  it("keeps a panel-wide diagnostic on the Settings screen", () => {
    // The GPU report and the port scan happen on Settings. Before v0.9 they were
    // written into all seven tool lines too, where they had nothing to do and no
    // idle state to clear them.
    expect(diagnosticsReach(setGlobalDiagnostics)).toEqual(["settingsDiagnosticsText"]);
  });

  it.each([
    ["text to image", setTextToImageDiagnostics, "diagnosticsText"],
    ["image to image", setImageDiagnostics, "imgDiagnosticsText"],
    ["sketch to image", setSketchDiagnostics, "sketchDiagnosticsText"],
    ["inpaint", setInpaintDiagnostics, "inpaintDiagnosticsText"],
    ["outpaint", setOutpaintDiagnostics, "outpaintDiagnosticsText"],
    ["upscale", setUpscaleDiagnostics, "upscaleDiagnosticsText"],
    ["prompt from layer", setPromptLayerDiagnostics, "promptLayerDiagnosticsText"]
  ])("writes %s's own line and the Settings log, and no other tool", (_tool, setter, ownLine) => {
    // Settings is the catch-all on purpose: it shows what every tool reported.
    expect(diagnosticsReach(setter).sort()).toEqual([ownLine, "settingsDiagnosticsText"].sort());
  });
});

describe("error fan-out", () => {
  it("puts a panel-wide error on Settings and Text to Image", () => {
    // Settings is where the server URL that fixes a connection error lives, and
    // Text to Image is the screen most likely to be open when startup falls back
    // to the built-in model list. Deliberately asymmetric with the diagnostics
    // rule above: an unreported startup warning is worse than a duplicated one.
    expect(errorReach(setGlobalError).sort()).toEqual(["errorMessage", "settingsErrorMessage"].sort());
  });

  it.each([
    ["text to image", setTextToImageError, "errorMessage"],
    ["image to image", setImageError, "imgErrorMessage"],
    ["sketch to image", setSketchError, "sketchErrorMessage"],
    ["inpaint", setInpaintError, "inpaintErrorMessage"],
    ["outpaint", setOutpaintError, "outpaintErrorMessage"],
    ["upscale", setUpscaleError, "upscaleErrorMessage"],
    ["prompt from layer", setPromptLayerError, "promptLayerErrorMessage"]
  ])("keeps %s's error on its own screen", (_tool, setter, ownLine) => {
    // Text to Image used to write the Settings error line as well, so "Enter a
    // prompt before generating." greeted anyone who opened Settings next.
    expect(errorReach(setter)).toEqual([ownLine]);
  });

  it("hides an error line when the message is cleared", () => {
    const lines = createLines();
    const elements = lines as unknown as AppElements;

    setTextToImageError(elements, "Generation failed.");
    expect(lines.errorMessage.hidden).toBe(false);

    setTextToImageError(elements, "");
    expect(lines.errorMessage.hidden).toBe(true);
  });
});
