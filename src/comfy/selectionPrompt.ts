/**
 * How many objects SAM 3.1 may return for each comma-separated subject when the
 * artist does not say.
 *
 * Measured on 2026-10-29 against ComfyUI 0.37's own SAM3_Detect: a bare subject
 * returns ONE object. "umbrella" found one of two umbrellas, "chair" one of
 * about fifteen, and lowering the threshold to 0.3 did not change that. The
 * `subject:N` suffix is a ceiling, not a target: "umbrella:10" returned exactly
 * the two umbrellas and nothing else, and "chair:20" found nearly every chair.
 * So a generous default costs nothing in precision. It does cost time, which
 * grows with the count (7.6 s for chair:20 against 1.3 s for one object), which
 * is why the default is 10 rather than something larger.
 */
export const DEFAULT_SELECTION_COUNT = 10;

const COUNT_SUFFIX = /:\s*\d+\s*$/;

/**
 * Turns what the artist typed into SAM 3.1's prompt syntax: every subject gets
 * a `:N` ceiling, and any subject that already has one keeps it. Empty parts
 * left by stray commas are dropped, so "car,, tree" becomes "car:10, tree:10".
 */
export function normalizeSelectionPrompt(text: string, defaultCount: number = DEFAULT_SELECTION_COUNT): string {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => (COUNT_SUFFIX.test(part) ? part : `${part}:${defaultCount}`))
    .join(", ");
}
