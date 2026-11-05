// @vitest-environment jsdom
//
// Mounts the real panel markup and calls the real binders, the same way
// promptWallet.test.ts does.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAppMarkup, getAppElements } from "../../src/ui/appMarkup";
import { getInpaintReadinessStatusLabel } from "../../src/ui/inpaintReadiness";
import {
  bindPromptRequiredReset,
  isPromptRequiredErrorStale,
  PROMPT_REQUIRED_STATUS,
  PROMPT_REQUIRED_TOOLS
} from "../../src/ui/promptRequiredReset";
import { bindPromptWallet, PROMPT_WALLET_TOOLS } from "../../src/ui/promptWallet";
import {
  setGlobalStatus,
  setTextToImageError,
  setTextToImageStatus,
  setOutpaintError,
  setOutpaintStatus
} from "../../src/ui/statusBars";
import { savePromptWallet } from "../../src/utils/preferences";

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

/** What handleGenerate does when the prompt is empty. */
function pressGenerateWithNoPrompt(elements: ReturnType<typeof mount>) {
  setTextToImageError(elements, "Enter a prompt before generating.");
  setTextToImageStatus(elements, PROMPT_REQUIRED_STATUS, "error");
}

beforeEach(() => {
  setStorage(createMemoryStorage());
});

afterEach(() => {
  setStorage(originalLocalStorage);
});

describe("isPromptRequiredErrorStale", () => {
  it("is stale once the field has text again", () => {
    expect(isPromptRequiredErrorStale("Prompt required.", "a lighthouse at dusk")).toBe(true);
  });

  it("is not stale while the field is still empty or whitespace", () => {
    expect(isPromptRequiredErrorStale("Prompt required.", "")).toBe(false);
    expect(isPromptRequiredErrorStale("Prompt required.", "   \n")).toBe(false);
  });

  it("reads UXP's null for an empty field as empty", () => {
    expect(isPromptRequiredErrorStale("Prompt required.", null)).toBe(false);
    expect(isPromptRequiredErrorStale(null, "a lighthouse")).toBe(false);
  });

  it("never treats any other status as a prompt error", () => {
    for (const status of ["Ready.", "Generation failed.", "ComfyUI is offline.", "Setup required.", "Mask required."]) {
      expect(isPromptRequiredErrorStale(status, "a lighthouse")).toBe(false);
    }
  });
});

describe("bindPromptRequiredReset", () => {
  it("clears the error line and the Error pill when a prompt is typed", () => {
    const elements = mount();
    bindPromptRequiredReset(elements);
    pressGenerateWithNoPrompt(elements);

    expect(elements.errorMessage.hidden).toBe(false);
    expect(elements.statusPill.classList.contains("error")).toBe(true);

    typeInto(elements.prompt, "a lighthouse at dusk");

    expect(elements.errorMessage.hidden).toBe(true);
    expect(elements.errorMessage.textContent).toBe("");
    expect(elements.statusText.textContent).toBe("Ready.");
    expect(elements.statusPill.classList.contains("error")).toBe(false);
  });

  it("keeps the error while the field is still empty", () => {
    const elements = mount();
    bindPromptRequiredReset(elements);
    pressGenerateWithNoPrompt(elements);

    typeInto(elements.prompt, "   ");

    expect(elements.statusText.textContent).toBe(PROMPT_REQUIRED_STATUS);
    expect(elements.errorMessage.hidden).toBe(false);
  });

  it("leaves every other error alone", () => {
    const elements = mount();
    bindPromptRequiredReset(elements);
    setTextToImageError(elements, "ComfyUI returned an error.");
    setTextToImageStatus(elements, "Generation failed.", "error");

    typeInto(elements.prompt, "a lighthouse at dusk");

    expect(elements.statusText.textContent).toBe("Generation failed.");
    expect(elements.errorMessage.textContent).toBe("ComfyUI returned an error.");
  });

  it("only clears the tool whose field changed", () => {
    const elements = mount();
    bindPromptRequiredReset(elements);
    pressGenerateWithNoPrompt(elements);
    setOutpaintError(elements, "Enter a prompt before generating Outpaint.");
    setOutpaintStatus(elements, PROMPT_REQUIRED_STATUS, "error");

    typeInto(elements.prompt, "a lighthouse at dusk");

    expect(elements.statusText.textContent).toBe("Ready.");
    expect(elements.outpaintStatusText.textContent).toBe(PROMPT_REQUIRED_STATUS);
    expect(elements.outpaintErrorMessage.hidden).toBe(false);
  });

  it("survives a UXP-style null value without throwing", () => {
    const elements = mount();
    bindPromptRequiredReset(elements);
    pressGenerateWithNoPrompt(elements);
    Object.defineProperty(elements.prompt, "value", { configurable: true, get: () => null });

    expect(() => elements.prompt.dispatchEvent(new Event("input", { bubbles: true }))).not.toThrow();
    expect(elements.statusText.textContent).toBe(PROMPT_REQUIRED_STATUS);
  });

  it("does not break the panel when a field is missing", () => {
    const elements = mount();
    const broken = [{ ...PROMPT_REQUIRED_TOOLS[0], prompt: "doesNotExist" as never }];

    expect(() => bindPromptRequiredReset(elements, broken)).not.toThrow();
  });
});

describe("finding 4: loading a prompt from the Wallet", () => {
  it("clears Text to Image's Prompt required error", () => {
    savePromptWallet([
      {
        id: "1",
        name: "Lighthouse",
        positivePrompt: "a lighthouse at dusk",
        negativePrompt: "blurry",
        pinned: false,
        createdAt: "2026-11-05T00:00:00.000Z"
      }
    ]);
    const elements = mount();
    // Same order as renderApp: the Wallet, then the reset.
    bindPromptWallet(elements, PROMPT_WALLET_TOOLS, () => undefined);
    bindPromptRequiredReset(elements);
    setGlobalStatus(elements, "Ready.", "idle");
    pressGenerateWithNoPrompt(elements);

    elements.promptWalletLoad.click();
    const use = elements.promptWalletList.querySelector<HTMLButtonElement>(".prompt-wallet-use");
    expect(use).not.toBeNull();
    use!.click();

    expect(elements.prompt.value).toBe("a lighthouse at dusk");
    expect(elements.statusText.textContent).toBe("Ready.");
    expect(elements.statusPill.classList.contains("error")).toBe(false);
    expect(elements.errorMessage.hidden).toBe(true);
    expect(elements.diagnosticsText.textContent).toBe("Prompt loaded from Wallet.");
  });
});

describe("prompt-required registration", () => {
  const app = readFileSync(resolve(__dirname, "../../src/ui/App.ts"), "utf8");

  it("is the only way App.ts spells the prompt-required status", () => {
    expect(app).not.toContain('"Prompt required."');
  });

  it("lists every tool App.ts stops with Prompt required", () => {
    const setters = [...app.matchAll(/(set\w+Status)\(elements, PROMPT_REQUIRED_STATUS, "error"\)/g)].map(
      (match) => match[1]
    );
    const registered = PROMPT_REQUIRED_TOOLS.map((tool) => tool.setStatus.name);

    expect(setters.length).toBeGreaterThan(0);
    for (const setter of setters) {
      expect(registered).toContain(setter);
    }
  });

  it("covers Inpaint, which reaches the same status through its readiness gate", () => {
    expect(getInpaintReadinessStatusLabel("prompt-missing")).toBe(PROMPT_REQUIRED_STATUS);
    expect(PROMPT_REQUIRED_TOOLS.map((tool) => tool.setStatus.name)).toContain("setInpaintStatus");
  });

  it("pairs each tool's prompt field with its own status bar", () => {
    for (const tool of PROMPT_REQUIRED_TOOLS) {
      // A fresh panel per tool, so a wrong pairing cannot pass by reading a
      // status bar an earlier iteration already wrote.
      const elements = mount();
      expect(elements[tool.prompt]).toBeInstanceOf(HTMLTextAreaElement);
      tool.setStatus(elements, PROMPT_REQUIRED_STATUS, "error");
      expect((elements[tool.statusText] as HTMLElement).textContent).toBe(PROMPT_REQUIRED_STATUS);
    }
  });
});
