// @vitest-environment jsdom
//
// Mounts the real panel markup and calls the real binder, the same way
// welcomeOverlay.test.ts does.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";
import { bindPromptMemory } from "../../src/ui/promptMemory";
import { loadPromptDrafts, savePromptDraft } from "../../src/utils/preferences";

type StorageStub = Storage | undefined;

function setStorage(value: StorageStub) {
  (globalThis as { localStorage?: StorageStub }).localStorage = value;
}

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key)
  } as unknown as Storage;
}

const originalLocalStorage = (globalThis as { localStorage?: StorageStub }).localStorage;

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

describe("prompt memory", () => {
  beforeEach(() => {
    setStorage(createMemoryStorage());
  });

  afterEach(() => {
    setStorage(originalLocalStorage);
    vi.useRealTimers();
  });

  it("saves what is typed", () => {
    const elements = mount();
    bindPromptMemory(elements);

    typeInto(elements.prompt, "a lighthouse at dusk");

    expect(loadPromptDrafts()).toMatchObject({ prompt: "a lighthouse at dusk" });
  });

  it("restores a saved draft on the next launch", () => {
    savePromptDraft("prompt", "a lighthouse at dusk");

    const elements = mount();
    bindPromptMemory(elements);

    expect(elements.prompt.value).toBe("a lighthouse at dusk");
  });

  it("does not overwrite a field the panel already filled", () => {
    savePromptDraft("prompt", "an old draft");

    const elements = mount();
    // Stands in for a History entry being reused, or a prompt sent from
    // another tool -- both have a better claim than storage.
    elements.prompt.value = "reused from history";
    bindPromptMemory(elements);

    expect(elements.prompt.value).toBe("reused from history");
  });

  it("forgets a field cleared back to empty", () => {
    const elements = mount();
    bindPromptMemory(elements);

    typeInto(elements.prompt, "a lighthouse at dusk");
    typeInto(elements.prompt, "");

    expect(loadPromptDrafts()).toEqual({});
  });

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

  it("groups a burst of typing into one undo step", () => {
    vi.useFakeTimers();
    const elements = mount();
    bindPromptMemory(elements);

    // No pause between these, so they are one edit, not four.
    typeInto(elements.prompt, "a");
    typeInto(elements.prompt, "a l");
    typeInto(elements.prompt, "a lig");
    typeInto(elements.prompt, "a light");

    pressUndo(elements.prompt);
    expect(elements.prompt.value).toBe("");
  });

  it("persists the undone value, so undo survives a reload too", () => {
    vi.useFakeTimers();
    const elements = mount();
    bindPromptMemory(elements);

    typeInto(elements.prompt, "first");
    vi.advanceTimersByTime(600);
    typeInto(elements.prompt, "second");
    pressUndo(elements.prompt);

    expect(loadPromptDrafts()).toMatchObject({ prompt: "first" });
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
    const elements = mount();
    Object.defineProperty(elements.prompt, "value", {
      configurable: true,
      get: () => null,
      set: () => undefined
    });

    expect(() => bindPromptMemory(elements)).not.toThrow();
    // The other ten fields must still get their memory.
    typeInto(elements.negativePrompt, "still working");
    expect(loadPromptDrafts()).toMatchObject({ "negative-prompt": "still working" });
  });
});
