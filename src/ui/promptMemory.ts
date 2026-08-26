import { AppElements } from "./appMarkup";

/**
 * An undo stack for every prompt field.
 *
 * Ctrl+Z in a prompt was previously whatever the host happened to provide,
 * which is not something worth assuming in UXP. This gives each field its own
 * history, independent of the host entirely.
 *
 * Prompt text deliberately does NOT persist past the panel closing. It stays
 * while you move between tools -- the screens are hidden rather than rebuilt,
 * so the text is simply still there -- and a reopened panel starts empty. An
 * earlier version of this saved drafts to localStorage and restored them on
 * launch; that was more than was asked for, and a prompt reappearing in a
 * fresh panel reads as a bug rather than a convenience.
 *
 * IMPORTANT, and the reason every read goes through `readValue`: in Photoshop
 * UXP an empty <textarea> reports `.value` as `null`, where every browser and
 * jsdom report `""`. So `field.value.length` and `field.value.trim()`
 * typecheck, pass the whole suite, and then throw `Cannot read properties of
 * null` the moment the panel loads in the host. An earlier attempt at this
 * feature did exactly that, and because the throw landed partway through
 * renderApp it took out every binding registered after it -- theme switching,
 * the sticky header wrapper -- so it surfaced as "themes are broken" rather
 * than as anything to do with prompts.
 */

/** UXP returns null for an empty textarea; every browser returns "". */
function readValue(field: HTMLTextAreaElement): string {
  return field.value ?? "";
}

/**
 * Every field the artist types prompt text into.
 *
 * Deliberately excludes the two textareas the panel writes rather than the
 * artist: the Prompt from Layer caption box (regenerated on every run) and
 * the Settings diagnostics report (a readonly log).
 */
const PROMPT_FIELDS: ReadonlyArray<keyof AppElements> = [
  "prompt",
  "negativePrompt",
  "imgPrompt",
  "imgNegativePrompt",
  "sketchPrompt",
  "sketchNegativePrompt",
  "inpaintPrompt",
  "inpaintNegativePrompt",
  "outpaintPrompt",
  "livePrompt",
  "liveNegativePrompt"
];

/**
 * How long typing must pause before it becomes its own undo step. This is the
 * backstop for text with no word breaks in it; ordinary prose gets a step per
 * word from the boundary check below, which is what makes repeated Ctrl+Z
 * walk back through a prompt instead of emptying it in one go.
 */
const COMMIT_DELAY_MS = 500;

/** Bounded so a long session cannot grow the stack without limit. */
const HISTORY_LIMIT = 200;

/** True when this keystroke finished a word, i.e. added trailing whitespace. */
function completedAWord(current: string, previous: string): boolean {
  return current.length > previous.length && /\s$/.test(current);
}

function attachField(field: HTMLTextAreaElement) {
  const history: string[] = [readValue(field)];
  let redo: string[] = [];
  let lastValue = readValue(field);
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
    lastValue = value;

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
    const current = readValue(field);
    const finishedWord = completedAWord(current, lastValue);
    lastValue = current;

    if (finishedWord) {
      commit();
      return;
    }

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
 * isolated too, so one bad element cannot cost the other ten their undo.
 */
export function bindPromptMemory(elements: AppElements) {
  for (const name of PROMPT_FIELDS) {
    try {
      attachField(elements[name] as HTMLTextAreaElement);
    } catch (error) {
      console.log(`[OpenLayer] prompt undo failed for ${String(name)}:`, error);
    }
  }
}
