import { afterEach, describe, expect, it } from "vitest";
import { clearPromptDrafts, loadPromptDrafts, savePromptDraft } from "../../src/utils/preferences";

/**
 * Prompt drafts are the only thing keeping typed prompt text alive across a
 * closed panel -- OpenLayerPreferences never covered prompt text at all.
 *
 * Two behaviours matter beyond a plain round trip: a corrupt or missing value
 * must read as "nothing saved" rather than throwing, and clearing a field must
 * forget it outright rather than persisting "" (that is what "delete it
 * manually" has to mean).
 */

type StorageStub = Storage | undefined;

function setStorage(value: StorageStub) {
  (globalThis as { localStorage?: StorageStub }).localStorage = value;
}

function createMemoryStorage() {
  const entries = new Map<string, string>();

  return {
    entries,
    storage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key)
    } as unknown as Storage
  };
}

const originalLocalStorage = (globalThis as { localStorage?: StorageStub }).localStorage;

afterEach(() => {
  setStorage(originalLocalStorage);
});

describe("prompt draft persistence", () => {
  it("reads as empty when nothing was ever stored", () => {
    setStorage(createMemoryStorage().storage);

    expect(loadPromptDrafts()).toEqual({});
  });

  it("round-trips each field independently", () => {
    setStorage(createMemoryStorage().storage);

    expect(savePromptDraft("prompt", "a lighthouse at dusk")).toBe(true);
    expect(savePromptDraft("negative-prompt", "blurry, low detail")).toBe(true);

    expect(loadPromptDrafts()).toEqual({
      prompt: "a lighthouse at dusk",
      "negative-prompt": "blurry, low detail"
    });
  });

  it("forgets a field cleared back to empty, rather than storing a blank", () => {
    setStorage(createMemoryStorage().storage);

    savePromptDraft("prompt", "a lighthouse at dusk");
    savePromptDraft("prompt", "");

    expect(loadPromptDrafts()).toEqual({});
  });

  it("clears every draft on request", () => {
    setStorage(createMemoryStorage().storage);

    savePromptDraft("prompt", "a lighthouse at dusk");
    expect(clearPromptDrafts()).toBe(true);
    expect(loadPromptDrafts()).toEqual({});
  });

  it("degrades to empty when the host exposes no storage", () => {
    setStorage(undefined);

    expect(loadPromptDrafts()).toEqual({});
    expect(savePromptDraft("prompt", "anything")).toBe(false);
  });

  it("reads as empty, not thrown, when storage itself throws", () => {
    setStorage({
      getItem: () => {
        throw new Error("storage is not available");
      },
      setItem: () => {
        throw new Error("storage is not available");
      },
      removeItem: () => {
        throw new Error("storage is not available");
      }
    } as unknown as Storage);

    expect(() => loadPromptDrafts()).not.toThrow();
    expect(loadPromptDrafts()).toEqual({});
    expect(savePromptDraft("prompt", "anything")).toBe(false);
  });

  it("drops non-string and empty values from corrupt stored JSON", () => {
    const { storage, entries } = createMemoryStorage();
    setStorage(storage);

    entries.set(
      "openlayer.promptDrafts.v1",
      JSON.stringify({ prompt: 42, blank: "", valid: "kept" })
    );

    expect(loadPromptDrafts()).toEqual({ valid: "kept" });
  });

  it("reads as empty when the stored value is an array, not an object", () => {
    const { storage, entries } = createMemoryStorage();
    setStorage(storage);

    entries.set("openlayer.promptDrafts.v1", JSON.stringify(["nope"]));

    expect(loadPromptDrafts()).toEqual({});
  });
});
