import { afterEach, describe, expect, it } from "vitest";
import { loadOpenAdvancedSections, saveOpenAdvancedSections } from "../../src/utils/preferences";

/**
 * Which "Advanced settings" disclosures the user left open. Same
 * storage-unavailable concerns as previewPanelPin.test.ts: a missing or
 * throwing host must degrade to "nothing remembered", not take the panel
 * down, and in this case that also means every screen defaults to collapsed
 * -- which is the same default a first-ever launch already has.
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

describe("advanced sections persistence", () => {
  it("round-trips a set of open section keys", () => {
    setStorage(createMemoryStorage().storage);

    expect(saveOpenAdvancedSections(["Generation settings", "Outpaint settings"])).toBe(true);
    expect(loadOpenAdvancedSections().sort()).toEqual(["Generation settings", "Outpaint settings"]);
  });

  it("de-duplicates keys on save", () => {
    setStorage(createMemoryStorage().storage);

    saveOpenAdvancedSections(["Generation settings", "Generation settings"]);

    expect(loadOpenAdvancedSections()).toEqual(["Generation settings"]);
  });

  it("reads as nothing open when nothing was ever stored", () => {
    setStorage(createMemoryStorage().storage);
    expect(loadOpenAdvancedSections()).toEqual([]);
  });

  it("discards non-string entries from a corrupted value instead of throwing", () => {
    const { entries, storage } = createMemoryStorage();
    setStorage(storage);
    entries.set("openlayer.advancedSections.v1", JSON.stringify(["Generation settings", 42, null]));

    expect(loadOpenAdvancedSections()).toEqual(["Generation settings"]);
  });

  it("reads as nothing open when the stored value is not an array", () => {
    const { entries, storage } = createMemoryStorage();
    setStorage(storage);
    entries.set("openlayer.advancedSections.v1", JSON.stringify({ oops: true }));

    expect(loadOpenAdvancedSections()).toEqual([]);
  });

  it("degrades to nothing open when the host exposes no storage", () => {
    setStorage(undefined);

    expect(loadOpenAdvancedSections()).toEqual([]);
    expect(saveOpenAdvancedSections(["Generation settings"])).toBe(false);
  });

  it("survives storage that throws on access", () => {
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

    expect(() => loadOpenAdvancedSections()).not.toThrow();
    expect(loadOpenAdvancedSections()).toEqual([]);
    expect(saveOpenAdvancedSections(["Generation settings"])).toBe(false);
  });
});
