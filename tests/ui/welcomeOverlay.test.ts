// @vitest-environment jsdom
//
// Mounts the real panel markup and calls the real binder rather than a
// hand-built stand-in, the same way seedFieldMarkup.test.ts trusts
// createAppMarkup() itself -- what's worth testing here is the actual DOM
// contract: does it show once, detect, and get out of the way for good.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";
import { bindWelcomeOverlay } from "../../src/ui/appBindings";
import { loadHasSeenWelcome, saveHasSeenWelcome } from "../../src/utils/preferences";

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
const originalFetch = globalThis.fetch;

function mount() {
  const root = document.createElement("div");
  root.innerHTML = createAppMarkup();
  document.body.replaceChildren(root);
  return getAppElements(root);
}

// Waits for the promise chain findActiveComfyUrl runs (one fetch per
// candidate port) to settle, without depending on how many candidates exist.
async function flushDetection() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

describe("welcome overlay", () => {
  beforeEach(() => {
    setStorage(createMemoryStorage());
  });

  afterEach(() => {
    setStorage(originalLocalStorage);
    globalThis.fetch = originalFetch;
  });

  it("stays hidden and does not fetch when already seen", () => {
    saveHasSeenWelcome();
    globalThis.fetch = vi.fn();

    const elements = mount();
    bindWelcomeOverlay(elements);

    expect(elements.welcomeOverlay.hidden).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("shows on first launch and reports no server found when nothing answers", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    const elements = mount();
    bindWelcomeOverlay(elements);

    expect(elements.welcomeOverlay.hidden).toBe(false);
    await flushDetection();

    expect(elements.welcomeManualRow.hidden).toBe(false);
    expect(elements.welcomeRetryButton.hidden).toBe(false);
    expect(elements.welcomeContinueButton.hidden).toBe(true);
    expect(elements.welcomeStatusText.textContent).toContain("No active ComfyUI port found");
    // Still on screen -- not seen until the artist dismisses it themselves.
    expect(elements.welcomeOverlay.hidden).toBe(false);
    expect(loadHasSeenWelcome()).toBe(false);
  });

  it("connects, syncs the server URL field, and dismisses on Continue", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    const elements = mount();
    bindWelcomeOverlay(elements);
    await flushDetection();

    expect(elements.welcomeContinueButton.hidden).toBe(false);
    expect(elements.serverUrl.value).toBe(elements.welcomeServerUrlInput.value);
    expect(elements.welcomeStatusText.textContent).toContain("Connected to");

    elements.welcomeContinueButton.click();

    expect(elements.welcomeOverlay.hidden).toBe(true);
    expect(loadHasSeenWelcome()).toBe(true);
  });

  it("Skip dismisses immediately, even mid-detection", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})); // never resolves

    const elements = mount();
    bindWelcomeOverlay(elements);

    expect(elements.welcomeOverlay.hidden).toBe(false);

    elements.welcomeSkipButton.click();

    expect(elements.welcomeOverlay.hidden).toBe(true);
    expect(loadHasSeenWelcome()).toBe(true);
  });

  it("does not show again on a later mount once seen", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    const firstRun = mount();
    bindWelcomeOverlay(firstRun);
    await flushDetection();
    firstRun.welcomeContinueButton.click();

    globalThis.fetch = vi.fn();
    const secondRun = mount();
    bindWelcomeOverlay(secondRun);

    expect(secondRun.welcomeOverlay.hidden).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
