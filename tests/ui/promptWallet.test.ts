// @vitest-environment jsdom
//
// Mounts the real panel markup and calls the real binder, the same way
// welcomeOverlay.test.ts does.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";
import {
  bindPromptWallet,
  createWalletEntryName,
  filterWalletEntries,
  PromptWalletTool,
  sortWalletEntries
} from "../../src/ui/promptWallet";
import { loadPromptWallet, PromptWalletEntry } from "../../src/utils/preferences";

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

const reported: string[] = [];
const visitedViews: string[] = [];
const setView = (view: string) => visitedViews.push(view);

/** Mirrors the real table in App.ts, including Outpaint having no negative. */
const TOOLS: readonly PromptWalletTool[] = [
  {
    positive: "prompt",
    negative: "negativePrompt",
    saveButton: "promptWalletSave",
    loadButton: "promptWalletLoad",
    view: "text-to-image",
    label: "Text to Image",
    report: (_elements, message) => reported.push(message)
  },
  {
    positive: "outpaintPrompt",
    saveButton: "outpaintPromptWalletSave",
    loadButton: "outpaintPromptWalletLoad",
    view: "outpaint",
    label: "Outpaint",
    report: (_elements, message) => reported.push(message)
  }
];

function mount() {
  const root = document.createElement("div");
  root.innerHTML = createAppMarkup();
  document.body.replaceChildren(root);
  return getAppElements(root);
}

function typeInto(field: HTMLTextAreaElement | HTMLInputElement, value: string) {
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  setStorage(createMemoryStorage());
  reported.length = 0;
  visitedViews.length = 0;
});

afterEach(() => {
  setStorage(originalLocalStorage);
});

describe("prompt wallet helpers", () => {
  it("names an entry from its prompt, truncating long ones", () => {
    expect(createWalletEntryName("  a lighthouse   at dusk ")).toBe("a lighthouse at dusk");
    expect(createWalletEntryName("")).toBe("Untitled prompt");

    const long = createWalletEntryName("a ".repeat(60));
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith("…")).toBe(true);
  });

  it("floats pinned entries above newer unpinned ones", () => {
    const entry = (id: string, pinned: boolean, createdAt: string): PromptWalletEntry => ({
      id,
      name: id,
      positivePrompt: id,
      negativePrompt: "",
      pinned,
      createdAt
    });

    const sorted = sortWalletEntries([
      entry("newest", false, "2026-08-26T00:00:00.000Z"),
      entry("pinned-old", true, "2026-01-01T00:00:00.000Z"),
      entry("older", false, "2026-05-01T00:00:00.000Z")
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["pinned-old", "newest", "older"]);
  });

  it("searches the name and both prompt bodies", () => {
    const entries: PromptWalletEntry[] = [
      {
        id: "1",
        name: "Lighthouse",
        positivePrompt: "a tower by the sea",
        negativePrompt: "blurry",
        pinned: false,
        createdAt: "2026-08-26T00:00:00.000Z"
      }
    ];

    expect(filterWalletEntries(entries, "lighthouse")).toHaveLength(1);
    expect(filterWalletEntries(entries, "TOWER")).toHaveLength(1);
    expect(filterWalletEntries(entries, "blurry")).toHaveLength(1);
    expect(filterWalletEntries(entries, "mountain")).toHaveLength(0);
    expect(filterWalletEntries(entries, "   ")).toHaveLength(1);
  });
});

describe("prompt wallet: saving", () => {
  it("keeps save disabled until the prompt has text", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    expect(elements.promptWalletSave.classList.contains("is-disabled")).toBe(true);

    typeInto(elements.prompt, "a lighthouse at dusk");
    expect(elements.promptWalletSave.classList.contains("is-disabled")).toBe(false);

    typeInto(elements.prompt, "");
    expect(elements.promptWalletSave.classList.contains("is-disabled")).toBe(true);
  });

  it("saves the positive and negative prompt together, and says so", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.negativePrompt.value = "blurry";
    elements.promptWalletSave.click();

    const saved = loadPromptWallet();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      name: "a lighthouse at dusk",
      positivePrompt: "a lighthouse at dusk",
      negativePrompt: "blurry",
      pinned: false
    });
    expect(reported).toContain("Prompt saved to Wallet.");
  });

  it("refuses to save the same prompt twice", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.promptWalletSave.click();
    elements.promptWalletSave.click();

    expect(loadPromptWallet()).toHaveLength(1);
    expect(reported).toContain("That prompt is already in your Wallet.");
  });

  it("saves from a tool with no negative prompt field", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.outpaintPrompt, "extend the shoreline");
    elements.outpaintPromptWalletSave.click();

    expect(loadPromptWallet()[0]).toMatchObject({
      positivePrompt: "extend the shoreline",
      negativePrompt: ""
    });
  });

  it("shares one library across tools", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.prompt, "from text to image");
    elements.promptWalletSave.click();
    typeInto(elements.outpaintPrompt, "from outpaint");
    elements.outpaintPromptWalletSave.click();

    expect(loadPromptWallet()).toHaveLength(2);
    expect(elements.promptWalletList.querySelectorAll(".prompt-wallet-card")).toHaveLength(2);
  });
});

describe("prompt wallet: loading", () => {
  it("keeps load disabled while the wallet is empty", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    expect(elements.promptWalletLoad.classList.contains("is-disabled")).toBe(true);

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.promptWalletSave.click();

    expect(elements.promptWalletLoad.classList.contains("is-disabled")).toBe(false);
    // Every tool's load unlocks, not just the one that just saved -- one
    // shared library.
    expect(elements.outpaintPromptWalletLoad.classList.contains("is-disabled")).toBe(false);
  });

  it("does nothing when clicked while disabled, same as Save", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    expect(elements.promptWalletLoad.classList.contains("is-disabled")).toBe(true);
    elements.promptWalletLoad.click();

    expect(visitedViews).toEqual([]);
    expect(reported).toEqual([]);
  });

  it("navigates to the Wallet and shows who is picking", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.promptWalletSave.click();

    elements.outpaintPromptWalletLoad.click();

    expect(visitedViews).toEqual(["prompt-wallet"]);
    expect(elements.promptWalletBanner.hidden).toBe(false);
    expect(elements.promptWalletBanner.textContent).toContain("Outpaint");
  });

  it("shows a Use button only while picking, and only until a pick is made", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.promptWalletSave.click();

    expect(elements.promptWalletList.querySelector(".prompt-wallet-use")).toBeNull();

    elements.promptWalletLoad.click();
    expect(elements.promptWalletList.querySelector(".prompt-wallet-use")).not.toBeNull();

    elements.promptWalletList.querySelector<HTMLButtonElement>(".prompt-wallet-use")!.click();
    expect(elements.promptWalletList.querySelector(".prompt-wallet-use")).toBeNull();
  });

  it("writes both fields, returns to the requesting tool, and reports it", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.negativePrompt.value = "blurry";
    elements.promptWalletSave.click();
    reported.length = 0;

    // Requested from Outpaint, which has no negative field of its own.
    elements.outpaintPromptWalletLoad.click();
    elements.promptWalletList.querySelector<HTMLButtonElement>(".prompt-wallet-use")!.click();

    expect(elements.outpaintPrompt.value).toBe("a lighthouse at dusk");
    expect(visitedViews).toEqual(["prompt-wallet", "outpaint"]);
    expect(reported).toContain("Prompt loaded from Wallet.");
  });

  it("fires an input event on load, so the field's own undo stack sees it", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.promptWalletSave.click();

    const inputSpy = vi.fn();
    elements.prompt.addEventListener("input", inputSpy);
    elements.promptWalletLoad.click();
    elements.promptWalletList.querySelector<HTMLButtonElement>(".prompt-wallet-use")!.click();

    expect(inputSpy).toHaveBeenCalled();
  });

  it("clears the pick banner when leaving the Wallet without choosing", () => {
    const elements = mount();
    const wallet = bindPromptWallet(elements, TOOLS, setView)!;

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.promptWalletSave.click();
    elements.promptWalletLoad.click();
    expect(elements.promptWalletBanner.hidden).toBe(false);

    // Stands in for App.ts's view-switch hook firing on navigation away.
    wallet.exitPickMode();
    wallet.render();

    expect(elements.promptWalletBanner.hidden).toBe(true);
    expect(elements.promptWalletList.querySelector(".prompt-wallet-use")).toBeNull();
  });
});

describe("prompt wallet: managing", () => {
  it("explains itself when nothing is saved", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    const empty = elements.promptWalletList.querySelector(".history-empty");
    expect(empty?.textContent).toContain("No saved prompts yet");
  });

  it("filters the list from the search box", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.promptWalletSave.click();
    typeInto(elements.prompt, "a mountain at dawn");
    elements.promptWalletSave.click();

    typeInto(elements.promptWalletSearch, "lighthouse");

    expect(elements.promptWalletList.querySelectorAll(".prompt-wallet-card")).toHaveLength(1);
    expect(elements.promptWalletCount.textContent).toBe("1 of 2");

    typeInto(elements.promptWalletSearch, "nothing matches this");
    expect(elements.promptWalletList.querySelector(".history-empty")?.textContent).toContain(
      "No prompts match"
    );
  });

  it("renames, pins and deletes from the card", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.promptWalletSave.click();

    const card = () => elements.promptWalletList.querySelector(".prompt-wallet-card") as HTMLElement;
    const buttonNamed = (label: string) =>
      Array.from(card().querySelectorAll<HTMLButtonElement>(".history-button")).find(
        (button) => button.textContent === label
      )!;

    const name = card().querySelector<HTMLInputElement>(".prompt-wallet-name")!;
    name.value = "Golden hour";
    name.dispatchEvent(new Event("change", { bubbles: true }));
    expect(loadPromptWallet()[0].name).toBe("Golden hour");

    buttonNamed("Pin").click();
    expect(loadPromptWallet()[0].pinned).toBe(true);
    expect(buttonNamed("Unpin")).toBeTruthy();

    buttonNamed("Delete").click();
    expect(loadPromptWallet()).toEqual([]);
  });

  it("falls back to a generated name when renamed to blank", () => {
    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.promptWalletSave.click();

    const name = elements.promptWalletList.querySelector<HTMLInputElement>(".prompt-wallet-name")!;
    name.value = "   ";
    name.dispatchEvent(new Event("change", { bubbles: true }));

    expect(loadPromptWallet()[0].name).toBe("a lighthouse at dusk");
  });

  it("copies the prompt, including the negative when there is one", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const elements = mount();
    bindPromptWallet(elements, TOOLS, setView);

    typeInto(elements.prompt, "a lighthouse at dusk");
    elements.negativePrompt.value = "blurry";
    elements.promptWalletSave.click();

    const copy = Array.from(
      elements.promptWalletList.querySelectorAll<HTMLButtonElement>(".history-button")
    ).find((button) => button.textContent === "Copy")!;
    copy.click();

    expect(writeText).toHaveBeenCalledWith("a lighthouse at dusk\n\nNegative: blurry");
  });
});

describe("prompt wallet: UXP null-value regression", () => {
  /**
   * The regression that broke three consecutive builds: in UXP an empty field
   * reports .value as null, where jsdom reports "". Binding must survive it,
   * because a throw here lands partway through renderApp and silently disables
   * every binding registered after it.
   */
  it("survives a UXP-style null value without throwing", () => {
    const elements = mount();
    for (const field of [elements.prompt, elements.negativePrompt, elements.promptWalletSearch]) {
      Object.defineProperty(field, "value", {
        configurable: true,
        get: () => null,
        set: () => undefined
      });
    }

    expect(() => bindPromptWallet(elements, TOOLS, setView)).not.toThrow();
    // The tool whose fields still behave must keep working.
    typeInto(elements.outpaintPrompt, "extend the shoreline");
    elements.outpaintPromptWalletSave.click();
    expect(loadPromptWallet()).toHaveLength(1);
  });
});
