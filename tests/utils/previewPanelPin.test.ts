import { afterEach, describe, expect, it } from "vitest";
import { loadPreviewPanelPin, savePreviewPanelPin } from "../../src/utils/preferences";

/**
 * The preview panel's pinned tool is the one preference written from outside the
 * settings screen, and the panel it belongs to is a second UXP entrypoint. Both
 * facts make the storage-unavailable paths worth covering: if localStorage is
 * missing or throws in the host, pinning has to degrade to "not persisted"
 * rather than taking the panel down with it.
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

describe("preview panel pin persistence", () => {
  it("round-trips a pinned tool", () => {
    const { storage } = createMemoryStorage();
    setStorage(storage);

    expect(savePreviewPanelPin("inpaint")).toBe(true);
    expect(loadPreviewPanelPin()).toBe("inpaint");
  });

  it("removes the key when the pin is cleared, rather than storing an empty string", () => {
    const { entries, storage } = createMemoryStorage();
    setStorage(storage);

    savePreviewPanelPin("upscale");
    savePreviewPanelPin("");

    expect(entries.size).toBe(0);
    expect(loadPreviewPanelPin()).toBe("");
  });

  it("reads as unpinned when nothing was ever stored", () => {
    setStorage(createMemoryStorage().storage);

    expect(loadPreviewPanelPin()).toBe("");
  });

  it("degrades to unpinned when the host exposes no storage", () => {
    setStorage(undefined);

    expect(loadPreviewPanelPin()).toBe("");
    expect(savePreviewPanelPin("inpaint")).toBe(false);
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

    expect(() => loadPreviewPanelPin()).not.toThrow();
    expect(loadPreviewPanelPin()).toBe("");
    expect(savePreviewPanelPin("inpaint")).toBe(false);
  });
});
