import { AppElements } from "./appMarkup";
import {
  createPromptWalletId,
  loadPromptWallet,
  PromptWalletEntry,
  savePromptWallet
} from "../utils/preferences";

/**
 * The Prompt Wallet: prompts the artist saved, and the small green control
 * under each tool's Prompt field that puts them there.
 *
 * One library shared by every tool, deliberately. A prompt worth keeping is
 * worth reaching from Inpaint as easily as from Text to Image, and per-tool
 * libraries would only mean the same text saved several times.
 *
 * Positive and negative are saved together because they are one thought: a
 * negative prompt is tuned against the positive it accompanies, so recalling
 * one without the other loses half the work. That pairing is the thing a
 * clipboard-based prompt manager cannot do, and it is why this eventually
 * writes into the fields rather than the clipboard.
 *
 * IMPORTANT: every field read goes through `readValue`. In UXP an empty
 * textarea or input reports `.value` as `null`, where every browser and jsdom
 * report `""`, so a bare `.value.trim()` typechecks, passes the suite, then
 * throws `Cannot read properties of null` in the host -- partway through
 * renderApp, silently disabling every binding registered after it.
 */

/** UXP returns null for an empty field; every browser returns "". */
function readValue(field: { value: string | null } | null | undefined): string {
  return field?.value ?? "";
}

export type PromptWalletTool = {
  /** The tool's positive prompt field. */
  positive: keyof AppElements;
  /** Absent on Outpaint, which has no negative prompt field at all. */
  negative?: keyof AppElements;
  saveButton: keyof AppElements;
  /** Where this tool reports "Prompt saved to Wallet." */
  report: (elements: AppElements, message: string) => void;
};

const NAME_MAX_LENGTH = 40;

/** Collapses whitespace and trims a prompt down to a card title. */
export function createWalletEntryName(positivePrompt: string): string {
  const collapsed = positivePrompt.trim().replace(/\s+/g, " ");

  if (!collapsed) {
    return "Untitled prompt";
  }

  return collapsed.length > NAME_MAX_LENGTH
    ? collapsed.slice(0, NAME_MAX_LENGTH - 1) + "…"
    : collapsed;
}

/**
 * Pinned first, then newest first. Sorting on read rather than on write means
 * pinning takes effect immediately without rewriting the stored order.
 */
export function sortWalletEntries(entries: readonly PromptWalletEntry[]): PromptWalletEntry[] {
  return [...entries].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

/** Matches the search box against the name and both prompt bodies. */
export function filterWalletEntries(
  entries: readonly PromptWalletEntry[],
  query: string
): PromptWalletEntry[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return [...entries];
  }

  return entries.filter((entry) =>
    (entry.name + " " + entry.positivePrompt + " " + entry.negativePrompt).toLowerCase().includes(needle)
  );
}

function formatSavedAt(createdAt: string): string {
  const parsed = new Date(createdAt);

  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString();
}

export function createPromptWallet(elements: AppElements, tools: readonly PromptWalletTool[]) {
  let entries = loadPromptWallet();

  const setDisabled = (element: HTMLElement, isDisabled: boolean) => {
    element.classList.toggle("is-disabled", isDisabled);
    element.setAttribute("aria-disabled", String(isDisabled));
  };

  const syncSaveButtons = () => {
    for (const tool of tools) {
      const positive = elements[tool.positive] as HTMLTextAreaElement;
      const button = elements[tool.saveButton] as HTMLElement;
      setDisabled(button, !readValue(positive).trim());
    }
  };

  const setWalletNote = (message: string) => {
    elements.promptWalletCount.textContent = message;
  };

  const persist = () => {
    savePromptWallet(entries);
    render();
    syncSaveButtons();
  };

  function createCard(entry: PromptWalletEntry) {
    const card = document.createElement("div");
    card.className = "history-card prompt-wallet-card";

    const body = document.createElement("div");
    body.className = "history-body";

    const name = document.createElement("input");
    name.className = "input prompt-wallet-name";
    name.type = "text";
    name.value = entry.name;
    name.setAttribute("aria-label", "Saved prompt name");
    name.addEventListener("change", () => {
      const next = readValue(name).trim();
      entry.name = next || createWalletEntryName(entry.positivePrompt);
      persist();
    });
    body.append(name);

    const positive = document.createElement("div");
    positive.className = "prompt-wallet-text";
    positive.textContent = entry.positivePrompt;
    body.append(positive);

    if (entry.negativePrompt) {
      const negative = document.createElement("div");
      negative.className = "prompt-wallet-text is-negative";
      negative.textContent = "Negative: " + entry.negativePrompt;
      body.append(negative);
    }

    const meta = document.createElement("div");
    meta.className = "history-time";
    meta.textContent = [entry.pinned ? "Pinned" : "", formatSavedAt(entry.createdAt)]
      .filter(Boolean)
      .join(" · ");
    body.append(meta);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "button history-button";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", () => {
      const text = entry.negativePrompt
        ? entry.positivePrompt + "\n\nNegative: " + entry.negativePrompt
        : entry.positivePrompt;
      void navigator.clipboard?.writeText(text);
      setWalletNote("Prompt copied.");
    });
    actions.append(copyButton);

    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.className = "button history-button";
    pinButton.textContent = entry.pinned ? "Unpin" : "Pin";
    pinButton.addEventListener("click", () => {
      entry.pinned = !entry.pinned;
      persist();
    });
    actions.append(pinButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button history-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      entries = entries.filter((item) => item.id !== entry.id);
      persist();
      setWalletNote("Prompt deleted.");
    });
    actions.append(deleteButton);

    body.append(actions);
    card.append(body);
    return card;
  }

  function render() {
    const container = elements.promptWalletList;
    container.innerHTML = "";

    const visible = sortWalletEntries(
      filterWalletEntries(entries, readValue(elements.promptWalletSearch))
    );

    if (entries.length === 0) {
      elements.promptWalletCount.textContent = "";
    } else if (visible.length === entries.length) {
      elements.promptWalletCount.textContent = entries.length + " saved";
    } else {
      elements.promptWalletCount.textContent = visible.length + " of " + entries.length;
    }

    if (visible.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent =
        entries.length === 0
          ? "No saved prompts yet. Press the green + under any tool's Prompt field to save one."
          : "No prompts match that search.";
      container.append(empty);
      return;
    }

    for (const entry of visible) {
      container.append(createCard(entry));
    }
  }

  function saveFromTool(tool: PromptWalletTool) {
    const positivePrompt = readValue(elements[tool.positive] as HTMLTextAreaElement).trim();

    if (!positivePrompt) {
      tool.report(elements, "Type a prompt before saving it to the Wallet.");
      return;
    }

    const negativePrompt = tool.negative
      ? readValue(elements[tool.negative] as HTMLTextAreaElement).trim()
      : "";

    // Saving the same pair twice is almost always a double press, not an
    // intention to keep two copies of one prompt.
    const isDuplicate = entries.some(
      (entry) => entry.positivePrompt === positivePrompt && entry.negativePrompt === negativePrompt
    );

    if (isDuplicate) {
      tool.report(elements, "That prompt is already in your Wallet.");
      return;
    }

    entries = [
      {
        id: createPromptWalletId(),
        name: createWalletEntryName(positivePrompt),
        positivePrompt,
        negativePrompt,
        pinned: false,
        createdAt: new Date().toISOString()
      },
      ...entries
    ];
    persist();
    tool.report(elements, "Prompt saved to Wallet.");
  }

  for (const tool of tools) {
    const positive = elements[tool.positive] as HTMLTextAreaElement;
    const button = elements[tool.saveButton] as HTMLElement;

    positive.addEventListener("input", syncSaveButtons);
    button.addEventListener("click", () => {
      if (button.classList.contains("is-disabled")) {
        return;
      }

      saveFromTool(tool);
    });
  }

  elements.promptWalletSearch.addEventListener("input", render);

  syncSaveButtons();
  render();

  return { render };
}

/**
 * Never allowed to break the panel: a throw here lands partway through
 * renderApp and silently disables every binding registered after it.
 */
export function bindPromptWallet(elements: AppElements, tools: readonly PromptWalletTool[]) {
  try {
    return createPromptWallet(elements, tools);
  } catch (error) {
    console.log("[OpenLayer] prompt wallet failed to bind:", error);
    return null;
  }
}
