import { AppElements } from "./appMarkup";
import { loadPromptDrafts, savePromptDraft } from "../utils/preferences";

/**
 * Prompt text that survives, plus an undo stack per field.
 *
 * Two things the panel did not do before: prompt text was never persisted
 * anywhere (`OpenLayerPreferences` only ever covered the numeric generation
 * defaults), so closing the panel threw away whatever you had written; and
 * Ctrl+Z was whatever the host happened to provide, which is not something to
 * assume in UXP.
 *
 * IMPORTANT, and the reason this module reads every value through
 * `readValue`: in Photoshop UXP an empty <textarea> reports `.value` as
 * `null`, where every browser and jsdom report `""`. So `field.value.length`
 * and `field.value.trim()` typecheck, pass the whole suite, and then throw
 * `Cannot read properties of null` the moment the panel loads in the host.
 * An earlier attempt at this feature did exactly that, and because the throw
 * landed partway through renderApp it took out every binding registered after
 * it -- theme switching, the sticky header wrapper -- so it surfaced as
 * "themes are broken" rather than as anything to do with prompts.
 */

/** UXP returns null for an empty textarea; every browser returns "". */
function readValue(field: HTMLTextAreaElement): string {
  return field.value ?? "";
}

/**
 * Every field the artist types prompt text into, keyed by its element id.
 *
 * Deliberately excludes the two textareas the panel writes rather than the
 * artist: the Prompt from Layer caption box (regenerated on every run) and
 * the Settings diagnostics report (a readonly log).
 */
const PROMPT_FIELDS: ReadonlyArray<{ element: keyof AppElements; storageId: string }> = [
  { element: "prompt", storageId: "prompt" },
  { element: "negativePrompt", storageId: "negative-prompt" },
  { element: "imgPrompt", storageId: "img-prompt" },
  { element: "imgNegativePrompt", storageId: "img-negative-prompt" },
  { element: "sketchPrompt", storageId: "sketch-prompt" },
  { element: "sketchNegativePrompt", storageId: "sketch-negative-prompt" },
  { element: "inpaintPrompt", storageId: "inpaint-prompt" },
  { element: "inpaintNegativePrompt", storageId: "inpaint-negative-prompt" },
  { element: "outpaintPrompt", storageId: "outpaint-prompt" },
  { element: "livePrompt", storageId: "live-prompt" },
  { element: "liveNegativePrompt", storageId: "live-negative-prompt" }
];

/**
 * How long typing must pause before it becomes one undo step. Without this,
 * Ctrl+Z would step back one character at a time, which is not what anyone
 * means by undo.
 */
const COMMIT_DELAY_MS = 500;

/** Bounded so a long session cannot grow the stack without limit. */
const HISTORY_LIMIT = 100;

function attachField(field: HTMLTextAreaElement, storageId: string, draft: string | undefined) {
  // Only restore into a field the panel has not already filled. A value that
  // is already there came from somewhere with a better claim than storage --
  // a History entry being reused, or a prompt sent over from another tool.
  if (draft && !readValue(field)) {
    field.value = draft;
  }

  const history: string[] = [readValue(field)];
  let redo: string[] = [];
  let commitTimer: ReturnType<typeof setTimeout> | undefined;

  const commit = () => {
    if (commitTimer !== undefined) {
      clearTimeout(commitTimer);
      commitTimer = undefined;
    }

    const current = readValue(field);

    if (history[history.length - 1] === current) {
      return;
    }

    history.push(current);
    // A fresh edit invalidates anything that was undone -- the standard
    // behaviour, and the only one that cannot resurrect unrelated text.
    redo = [];

    if (history.length > HISTORY_LIMIT) {
      history.shift();
    }
  };

  const applyValue = (value: string) => {
    field.value = value;
    savePromptDraft(storageId, value);

    // Undo that leaves the caret at the start is disorienting. Not supported
    // everywhere, and not worth failing over if it is not.
    try {
      field.selectionStart = value.length;
      field.selectionEnd = value.length;
    } catch {
      // Caret placement is a nicety; the value is what matters.
    }
  };

  field.addEventListener("input", () => {
    savePromptDraft(storageId, readValue(field));

    if (commitTimer !== undefined) {
      clearTimeout(commitTimer);
    }

    commitTimer = setTimeout(commit, COMMIT_DELAY_MS);
  });

  field.addEventListener("keydown", (event) => {
    const key = event.key?.toLowerCase();

    if (!key || !(event.ctrlKey || event.metaKey) || (key !== "z" && key !== "y")) {
      return;
    }

    const isRedo = key === "y" || event.shiftKey;
    event.preventDefault();

    if (isRedo) {
      const value = redo.pop();

      if (value === undefined) {
        return;
      }

      history.push(value);
      applyValue(value);
      return;
    }

    // Fold any in-progress typing into the stack first, so the first Ctrl+Z
    // after typing undoes what was just typed rather than the step before it.
    commit();

    if (history.length <= 1) {
      return;
    }

    redo.push(history.pop() as string);
    applyValue(history[history.length - 1]);
  });
}

/**
 * Never allowed to break the panel: a throw here would land partway through
 * renderApp and silently disable every binding after it. Each field is
 * isolated too, so one bad element cannot cost the other ten their memory.
 */
export function bindPromptMemory(elements: AppElements) {
  let drafts: Record<string, string> = {};

  try {
    drafts = loadPromptDrafts();
  } catch (error) {
    console.log("[OpenLayer] could not read saved prompts:", error);
  }

  for (const { element, storageId } of PROMPT_FIELDS) {
    try {
      attachField(elements[element] as HTMLTextAreaElement, storageId, drafts[storageId]);
    } catch (error) {
      console.log(`[OpenLayer] prompt memory failed for ${storageId}:`, error);
    }
  }
}
