import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { caretAfterPlaceholderStrip, readTextareaValue, stripPlaceholderBleed } from "../../src/ui/textareaValue";

/**
 * Every <textarea> in appMarkup.ts, by its AppElements property name. Photoshop
 * returns null for an empty one's `.value`; see src/ui/textareaValue.ts.
 */
const TEXTAREA_ELEMENTS = [
  "customWorkflowInput",
  "customWorkflowPrompt",
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
  "selectByTextPrompt",
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

  // The real strings from the panel, captured in Photoshop 28 on 2026-11-22.
  const PROMPT_PLACEHOLDER = "Describe the image you want to generate...";
  const SELECT_PLACEHOLDER = "For example: chair, the red car";

  it("drops the placeholder UXP leaves behind after select-all and typing", () => {
    expect(readTextareaValue({ value: `cat${PROMPT_PLACEHOLDER}`, placeholder: PROMPT_PLACEHOLDER })).toBe("cat");
    expect(readTextareaValue({ value: `plant${SELECT_PLACEHOLDER}`, placeholder: SELECT_PLACEHOLDER })).toBe("plant");
  });

  it("reads the placeholder from the attribute, which the panel changes at runtime", () => {
    const field = {
      value: "a signOPEN what should change",
      placeholder: "Describe how to reinterpret the active layer...",
      getAttribute: (name: string) => (name === "placeholder" ? "OPEN what should change" : null)
    };

    expect(readTextareaValue(field)).toBe("a sign");
  });

  it("leaves ordinary prompts alone, including ones with no placeholder to compare", () => {
    expect(readTextareaValue({ value: "a foggy forest", placeholder: PROMPT_PLACEHOLDER })).toBe("a foggy forest");
    expect(readTextareaValue({ value: "a foggy forest" })).toBe("a foggy forest");
    expect(readTextareaValue({ value: null, placeholder: PROMPT_PLACEHOLDER })).toBe("");
    // Part of the sentence is a prompt, not the placeholder.
    expect(readTextareaValue({ value: "Describe the image", placeholder: PROMPT_PLACEHOLDER })).toBe("Describe the image");
  });

  describe("stripPlaceholderBleed", () => {
    it("removes the placeholder wherever it sits and treats a placeholder-only field as empty", () => {
      expect(stripPlaceholderBleed(`cat${PROMPT_PLACEHOLDER}`, PROMPT_PLACEHOLDER)).toBe("cat");
      expect(stripPlaceholderBleed(`${PROMPT_PLACEHOLDER}cat`, PROMPT_PLACEHOLDER)).toBe("cat");
      expect(stripPlaceholderBleed(`a${PROMPT_PLACEHOLDER}b`, PROMPT_PLACEHOLDER)).toBe("ab");
      expect(stripPlaceholderBleed(PROMPT_PLACEHOLDER, PROMPT_PLACEHOLDER)).toBe("");
    });

    it("does nothing without a placeholder to look for", () => {
      expect(stripPlaceholderBleed("cat", "")).toBe("cat");
    });
  });

  describe("caretAfterPlaceholderStrip", () => {
    it("keeps a caret that sits before the placeholder and pulls back one that sits after it", () => {
      const raw = `cat${PROMPT_PLACEHOLDER}`;

      expect(caretAfterPlaceholderStrip(raw, PROMPT_PLACEHOLDER, 3)).toBe(3);
      expect(caretAfterPlaceholderStrip(raw, PROMPT_PLACEHOLDER, raw.length)).toBe(3);
      // Inside the placeholder it lands where the placeholder began.
      expect(caretAfterPlaceholderStrip(raw, PROMPT_PLACEHOLDER, 10)).toBe(3);
    });

    it("returns the caret as is when there is nothing to strip", () => {
      expect(caretAfterPlaceholderStrip("cat", PROMPT_PLACEHOLDER, 2)).toBe(2);
      expect(caretAfterPlaceholderStrip("cat", "", 2)).toBe(2);
    });
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
