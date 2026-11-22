/**
 * Reads a <textarea>'s text the way Photoshop actually reports it.
 *
 * Two UXP quirks live here, both proved in the real panel:
 *
 * 1. An EMPTY textarea's `.value` is `null`, where every browser and jsdom
 *    return `""` (proved from a real Photoshop console trace, 2026-08-26). So
 *    `field.value.trim()` typechecks, passes every test, and then throws
 *    `Cannot read properties of null` in the host the moment the field is empty.
 *    Inside a click handler that throw is swallowed by `void handler()`, so
 *    pressing Generate with an empty prompt showed nothing at all instead of the
 *    panel's own "enter a prompt" message.
 *
 * 2. The placeholder can become REAL text (proved 2026-11-22, Photoshop 28). Empty
 *    a prompt, select all, type `cat`: the box then shows `catDescribe the image
 *    you want to generate...` in placeholder grey and `.value` holds all of it.
 *    Select by Text sent `plantFor example: chair...` to SAM because of this.
 *    Typing into a box that was never emptied is clean, and `<input>` fields
 *    (Seed) do not do it. We cannot fix the host, so the panel removes the
 *    placeholder text wherever it finds it, both as it is typed
 *    (`bindPlaceholderBleedRepair`) and when it is read (here).
 *
 * Every textarea read in App.ts goes through `readTextareaValue`;
 * `tests/ui/textareaValue.test.ts` keeps it that way.
 */

/** The parts of a textarea these helpers touch; real elements and test doubles both fit. */
export type TextareaLike = {
  value: string | null;
  placeholder?: string | null;
  getAttribute?: (name: string) => string | null;
};

/**
 * The placeholder text the field currently shows. The attribute wins because
 * the panel changes it at runtime with `setAttribute` (Edit Image versus Image
 * to Image share one prompt box).
 */
function placeholderOf(field: TextareaLike): string {
  const fromAttribute = field.getAttribute?.("placeholder");
  return fromAttribute ?? field.placeholder ?? "";
}

/**
 * Removes the placeholder sentence from typed text. Wherever it sits, every
 * copy goes: nobody means to write "Describe the image you want to
 * generate..." as a prompt, and the bleed lands after the caret, usually at the
 * end but not always. A field holding only the placeholder becomes empty.
 */
export function stripPlaceholderBleed(text: string, placeholder: string): string {
  if (!placeholder || !text.includes(placeholder)) {
    return text;
  }

  return text.split(placeholder).join("");
}

/**
 * Where the caret belongs once the placeholder is cut out of `raw`: unchanged
 * if it was before the placeholder (the usual case, the caret sits right after
 * what was typed), pulled back by the placeholder's length if it was after it.
 */
export function caretAfterPlaceholderStrip(raw: string, placeholder: string, caret: number): number {
  const start = raw.indexOf(placeholder);

  if (!placeholder || start < 0 || caret <= start) {
    return caret;
  }

  return Math.max(start, caret - placeholder.length);
}

export function readTextareaValue(field: TextareaLike): string {
  return stripPlaceholderBleed(field.value ?? "", placeholderOf(field));
}

type RepairableTextarea = TextareaLike & {
  selectionStart: number | null;
  selectionEnd: number | null;
  addEventListener: (type: "input", listener: () => void) => void;
};

function attachRepair(field: RepairableTextarea) {
  field.addEventListener("input", () => {
    const raw = field.value ?? "";
    const placeholder = placeholderOf(field);
    const clean = stripPlaceholderBleed(raw, placeholder);

    // Idempotent on purpose: if assigning `.value` raises another `input`
    // event in the host, that second pass finds nothing to remove and stops.
    if (clean === raw) {
      return;
    }

    const caret = caretAfterPlaceholderStrip(raw, placeholder, field.selectionStart ?? raw.length);
    field.value = clean;

    // Not supported everywhere, and the text is what matters.
    try {
      field.selectionStart = caret;
      field.selectionEnd = caret;
    } catch {
      // Caret placement is a nicety.
    }
  });
}

/**
 * Cleans the placeholder out of every textarea under `root` as the artist
 * types. Bind it BEFORE `bindPromptMemory`, so the undo history records the
 * repaired text and never the bled one.
 *
 * Never allowed to break the panel: a throw here would land partway through
 * renderApp and silently disable every binding after it (the failure that took
 * out theme switching once, see `promptMemory.ts`), so each field is isolated.
 */
export function bindPlaceholderBleedRepair(root: ParentNode) {
  for (const field of Array.from(root.querySelectorAll("textarea"))) {
    try {
      attachRepair(field);
    } catch (error) {
      console.log("[OpenLayer] placeholder repair failed for a textarea:", error);
    }
  }
}
