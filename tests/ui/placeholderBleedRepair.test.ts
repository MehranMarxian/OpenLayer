// @vitest-environment jsdom
//
// What matters here is the DOM contract: when UXP leaves the placeholder
// behind as real text, the next `input` event removes it from the box the
// artist is looking at, not only from the value we read. The string helpers
// are covered in textareaValue.test.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { bindPlaceholderBleedRepair } from "../../src/ui/textareaValue";

const PLACEHOLDER = "Describe the image you want to generate...";

function buildRoot(placeholder = PLACEHOLDER) {
  const root = document.createElement("div");
  const textarea = document.createElement("textarea");
  textarea.setAttribute("placeholder", placeholder);
  const input = document.createElement("input");
  input.setAttribute("placeholder", "Random");
  root.append(textarea, input);
  document.body.append(root);
  return { root, textarea, input };
}

/** What the host does: the typed text, then the placeholder, caret after the typed text. */
function bleed(textarea: HTMLTextAreaElement, typed: string, placeholder = PLACEHOLDER) {
  textarea.value = `${typed}${placeholder}`;
  textarea.setSelectionRange(typed.length, typed.length);
  textarea.dispatchEvent(new Event("input"));
}

describe("bindPlaceholderBleedRepair", () => {
  it("removes the placeholder from the box on the keystroke that leaves it behind", () => {
    const { root, textarea } = buildRoot();
    bindPlaceholderBleedRepair(root);

    bleed(textarea, "c");

    expect(textarea.value).toBe("c");
    expect(textarea.selectionStart).toBe(1);
    expect(textarea.selectionEnd).toBe(1);
  });

  it("keeps working while the artist keeps typing", () => {
    const { root, textarea } = buildRoot();
    bindPlaceholderBleedRepair(root);

    bleed(textarea, "c");
    textarea.value = "cat";
    textarea.setSelectionRange(3, 3);
    textarea.dispatchEvent(new Event("input"));

    expect(textarea.value).toBe("cat");
    expect(textarea.selectionStart).toBe(3);
  });

  it("empties a box that holds only the placeholder", () => {
    const { root, textarea } = buildRoot();
    bindPlaceholderBleedRepair(root);

    bleed(textarea, "");

    expect(textarea.value).toBe("");
  });

  it("follows a placeholder that Edit Image swapped in with setAttribute", () => {
    const { root, textarea } = buildRoot();
    bindPlaceholderBleedRepair(root);
    textarea.setAttribute("placeholder", "What should change? e.g. change the sign to read OPEN");

    bleed(textarea, "paint it red", "What should change? e.g. change the sign to read OPEN");

    expect(textarea.value).toBe("paint it red");
  });

  it("does not touch ordinary typing, and does not write to the box when there is nothing to repair", () => {
    const { root, textarea } = buildRoot();
    bindPlaceholderBleedRepair(root);
    textarea.value = "a foggy forest";
    textarea.setSelectionRange(2, 2);

    textarea.dispatchEvent(new Event("input"));

    expect(textarea.value).toBe("a foggy forest");
    // A write would have moved the caret to the end.
    expect(textarea.selectionStart).toBe(2);
  });

  it("leaves <input> fields alone (Seed does not bleed, and its Random placeholder is a real word)", () => {
    const { root, input } = buildRoot();
    bindPlaceholderBleedRepair(root);

    input.value = "Random";
    input.dispatchEvent(new Event("input"));

    expect(input.value).toBe("Random");
  });

  it("does not throw on a field whose caret cannot be set", () => {
    const { root, textarea } = buildRoot();
    bindPlaceholderBleedRepair(root);
    Object.defineProperty(textarea, "selectionStart", {
      get: () => 1,
      set: () => {
        throw new Error("not supported");
      }
    });

    expect(() => bleed(textarea, "c")).not.toThrow();
    expect(textarea.value).toBe("c");
  });

  it("is bound before the undo history, so Ctrl+Z never steps back onto bled text", () => {
    const app = readFileSync(resolve(__dirname, "../../src/ui/App.ts"), "utf8");
    const repair = app.indexOf("bindPlaceholderBleedRepair(rootElement)");
    const memory = app.indexOf("bindPromptMemory(elements)");

    expect(repair).toBeGreaterThan(-1);
    expect(memory).toBeGreaterThan(repair);
  });
});
