// @vitest-environment jsdom
//
// The persistence unit tests live in tests/utils/advancedSections.test.ts.
// What's worth testing here is the DOM contract: a grid whose key was saved
// open renders open on the next bind, and clicking a toggle updates storage
// -- the whole point of the feature, and not exercised by the pure functions.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bindAdvancedToggles } from "../../src/ui/appBindings";
import { loadOpenAdvancedSections, saveOpenAdvancedSections } from "../../src/utils/preferences";

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

function buildGrid(label: string): HTMLElement {
  const section = document.createElement("section");
  const grid = document.createElement("div");
  grid.className = "settings-grid";
  grid.setAttribute("aria-label", label);
  const steps = document.createElement("input");
  steps.id = "steps";
  grid.appendChild(steps);
  section.appendChild(grid);
  return section;
}

describe("bindAdvancedToggles persistence", () => {
  let root: HTMLElement;

  beforeEach(() => {
    setStorage(createMemoryStorage());
    root = document.createElement("div");
    root.appendChild(buildGrid("Generation settings"));
    document.body.replaceChildren(root);
  });

  afterEach(() => {
    setStorage(originalLocalStorage);
  });

  it("defaults a screen to collapsed when nothing was ever saved", () => {
    bindAdvancedToggles(root);

    const toggle = root.querySelector<HTMLButtonElement>(".advanced-toggle")!;
    const body = root.querySelector<HTMLElement>(".advanced-body")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(body.hidden).toBe(true);
  });

  it("opens a screen that was left open on a previous visit", () => {
    saveOpenAdvancedSections(["Generation settings"]);

    bindAdvancedToggles(root);

    const toggle = root.querySelector<HTMLButtonElement>(".advanced-toggle")!;
    const body = root.querySelector<HTMLElement>(".advanced-body")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(body.hidden).toBe(false);
    expect(toggle.textContent).toBe("− Advanced settings");
  });

  it("saves the key when a toggle is opened by click", () => {
    bindAdvancedToggles(root);
    root.querySelector<HTMLButtonElement>(".advanced-toggle")!.click();

    expect(loadOpenAdvancedSections()).toEqual(["Generation settings"]);
  });

  it("removes the key when a toggle is closed by click", () => {
    saveOpenAdvancedSections(["Generation settings", "Outpaint settings"]);
    bindAdvancedToggles(root);

    root.querySelector<HTMLButtonElement>(".advanced-toggle")!.click();

    expect(loadOpenAdvancedSections()).toEqual(["Outpaint settings"]);
  });

  it("keeps each screen's open state independent", () => {
    root.appendChild(buildGrid("Image to Image settings"));
    saveOpenAdvancedSections(["Generation settings"]);

    bindAdvancedToggles(root);

    const toggles = root.querySelectorAll<HTMLButtonElement>(".advanced-toggle");
    expect(toggles[0].getAttribute("aria-expanded")).toBe("true");
    expect(toggles[1].getAttribute("aria-expanded")).toBe("false");
  });

  it("does not throw when a grid has no aria-label", () => {
    const bare = document.createElement("div");
    const grid = document.createElement("div");
    grid.className = "settings-grid";
    const steps = document.createElement("input");
    steps.id = "steps";
    grid.appendChild(steps);
    bare.appendChild(grid);
    document.body.replaceChildren(bare);

    expect(() => bindAdvancedToggles(bare)).not.toThrow();
    expect(() => bare.querySelector<HTMLButtonElement>(".advanced-toggle")!.click()).not.toThrow();
  });
});
