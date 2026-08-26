// @vitest-environment jsdom
//
// Mounts the real panel markup and calls the real binder, the same way
// welcomeOverlay.test.ts does.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";
import { bindPromptMemory } from "../../src/ui/promptMemory";

function mount() {
  const root = document.createElement("div");
  root.innerHTML = createAppMarkup();
  document.body.replaceChildren(root);
  return getAppElements(root);
}

function typeInto(field: HTMLTextAreaElement, value: string) {
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function pressUndo(field: HTMLTextAreaElement, shiftKey = false) {
  field.dispatchEvent(
    new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey, bubbles: true, cancelable: true })
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("prompt undo", () => {
  it("undoes and redoes without relying on the host's own undo", () => {
    vi.useFakeTimers();
    const elements = mount();
    bindPromptMemory(elements);

    typeInto(elements.prompt, "a lighthouse");
    vi.advanceTimersByTime(600);
    typeInto(elements.prompt, "a lighthouse at dusk");

    pressUndo(elements.prompt);
    expect(elements.prompt.value).toBe("a lighthouse");

    pressUndo(elements.prompt, true);
    expect(elements.prompt.value).toBe("a lighthouse at dusk");
  });

  /**
   * The behaviour actually asked for: repeated Ctrl+Z should walk back through
   * a prompt a word at a time, not empty the whole field in one step. Typing
   * here is one unbroken burst with no pause, so the pause-based commit never
   * fires -- every step below comes from finishing a word.
   */
  it("steps back one word at a time through an unbroken burst of typing", () => {
    vi.useFakeTimers();
    const elements = mount();
    bindPromptMemory(elements);

    typeInto(elements.prompt, "a ");
    typeInto(elements.prompt, "a lighthouse ");
    typeInto(elements.prompt, "a lighthouse at ");
    typeInto(elements.prompt, "a lighthouse at dusk");

    pressUndo(elements.prompt);
    expect(elements.prompt.value).toBe("a lighthouse at ");

    pressUndo(elements.prompt);
    expect(elements.prompt.value).toBe("a lighthouse ");

    pressUndo(elements.prompt);
    expect(elements.prompt.value).toBe("a ");

    pressUndo(elements.prompt);
    expect(elements.prompt.value).toBe("");
  });

  it("groups a burst with no word breaks into one step, then stops", () => {
    vi.useFakeTimers();
    const elements = mount();
    bindPromptMemory(elements);

    typeInto(elements.prompt, "a");
    typeInto(elements.prompt, "aa");
    typeInto(elements.prompt, "aaa");

    pressUndo(elements.prompt);
    expect(elements.prompt.value).toBe("");

    // Nothing left to undo; it must not throw or wrap around.
    pressUndo(elements.prompt);
    expect(elements.prompt.value).toBe("");
  });

  it("discards the redo stack once new text is typed", () => {
    vi.useFakeTimers();
    const elements = mount();
    bindPromptMemory(elements);

    typeInto(elements.prompt, "first ");
    typeInto(elements.prompt, "first second");
    vi.advanceTimersByTime(600);

    pressUndo(elements.prompt);
    expect(elements.prompt.value).toBe("first ");

    typeInto(elements.prompt, "first third");
    vi.advanceTimersByTime(600);

    // Redo must not resurrect "second" now that the branch has changed.
    pressUndo(elements.prompt, true);
    expect(elements.prompt.value).toBe("first third");
  });

  it("keeps each field's history to itself", () => {
    vi.useFakeTimers();
    const elements = mount();
    bindPromptMemory(elements);

    typeInto(elements.prompt, "positive text");
    vi.advanceTimersByTime(600);
    typeInto(elements.negativePrompt, "negative text");
    vi.advanceTimersByTime(600);
    typeInto(elements.prompt, "positive text, more detail");

    pressUndo(elements.prompt);

    expect(elements.prompt.value).toBe("positive text");
    expect(elements.negativePrompt.value).toBe("negative text");
  });

  it("ignores a plain z with no modifier", () => {
    vi.useFakeTimers();
    const elements = mount();
    bindPromptMemory(elements);

    typeInto(elements.prompt, "keep me");
    vi.advanceTimersByTime(600);
    elements.prompt.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true, cancelable: true }));

    expect(elements.prompt.value).toBe("keep me");
  });

  /**
   * The regression that broke three consecutive builds: in UXP an empty
   * <textarea> reports .value as null, where jsdom reports "". Binding must
   * survive that, because a throw here lands partway through renderApp and
   * silently disables every binding registered after it.
   */
  it("survives a UXP-style null value without throwing", () => {
    vi.useFakeTimers();
    const elements = mount();
    Object.defineProperty(elements.prompt, "value", {
      configurable: true,
      get: () => null,
      set: () => undefined
    });

    expect(() => bindPromptMemory(elements)).not.toThrow();

    // The other ten fields must still get their undo.
    typeInto(elements.negativePrompt, "one ");
    typeInto(elements.negativePrompt, "one two");
    pressUndo(elements.negativePrompt);
    expect(elements.negativePrompt.value).toBe("one ");
  });
});
