import { afterEach, describe, expect, it } from "vitest";
import { loadHasSeenWelcome, saveHasSeenWelcome } from "../../src/utils/preferences";

/**
 * The failure direction matters here: a storage read that throws must read as
 * "not seen" so the welcome screen shows again rather than being silently
 * skipped for someone who never actually connected.
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

describe("welcome-seen persistence", () => {
  it("reads as not seen when nothing was ever stored", () => {
    setStorage(createMemoryStorage().storage);

    expect(loadHasSeenWelcome()).toBe(false);
  });

  it("round-trips to seen once saved", () => {
    const { storage } = createMemoryStorage();
    setStorage(storage);

    expect(saveHasSeenWelcome()).toBe(true);
    expect(loadHasSeenWelcome()).toBe(true);
  });

  it("degrades to not seen when the host exposes no storage", () => {
    setStorage(undefined);

    expect(loadHasSeenWelcome()).toBe(false);
    expect(saveHasSeenWelcome()).toBe(false);
  });

  it("reads as not seen, not thrown, when storage throws on access", () => {
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

    expect(() => loadHasSeenWelcome()).not.toThrow();
    expect(loadHasSeenWelcome()).toBe(false);
    expect(saveHasSeenWelcome()).toBe(false);
  });
});
