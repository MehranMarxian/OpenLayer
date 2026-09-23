import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readTextareaValue } from "../../src/ui/textareaValue";

/**
 * Every <textarea> in appMarkup.ts, by its AppElements property name. Photoshop
 * returns null for an empty one's `.value`; see src/ui/textareaValue.ts.
 */
const TEXTAREA_ELEMENTS = [
  "customWorkflowInput",
  "imgNegativePrompt",
  "imgPrompt",
  "inpaintNegativePrompt",
  "inpaintPrompt",
  "liveNegativePrompt",
  "livePrompt",
  "multiReferenceNegativePrompt",
  "multiReferencePrompt",
  "negativePrompt",
  "outpaintPrompt",
  "prompt",
  "promptLayerGeneratedText",
  "settingsDiagnosticsReport",
  "sketchNegativePrompt",
  "sketchPrompt",
  "styleReferenceNegativePrompt",
  "styleReferencePrompt",
  "unflattenPrompt"
];

describe("readTextareaValue", () => {
  it("reads Photoshop's null for an empty textarea as an empty string", () => {
    expect(readTextareaValue({ value: null })).toBe("");
    expect(readTextareaValue({ value: "a foggy forest" })).toBe("a foggy forest");
  });

  it("is the only way App.ts reads a textarea", () => {
    const app = readFileSync(resolve(__dirname, "../../src/ui/App.ts"), "utf8");
    // A read is `.value` not followed by an assignment; writes stay as they are.
    const unguardedRead = new RegExp(`elements\\.(${TEXTAREA_ELEMENTS.join("|")})\\.value\\b(?!\\s*=[^=])`, "g");
    const offenders = [...app.matchAll(unguardedRead)].map((match) => match[0]);

    expect(offenders).toEqual([]);
  });

  it("covers every textarea the markup actually declares", () => {
    const markup = readFileSync(resolve(__dirname, "../../src/ui/appMarkup.ts"), "utf8");
    const declared = [...markup.matchAll(/<textarea[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);

    // Adding a textarea without adding it above would leave its reads unchecked.
    expect(declared.length).toBe(TEXTAREA_ELEMENTS.length);
  });
});
