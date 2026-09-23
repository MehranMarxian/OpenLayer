/**
 * Reads a <textarea>'s text the way Photoshop actually reports it.
 *
 * In UXP an EMPTY textarea's `.value` is `null`, where every browser and jsdom
 * return `""` (proved from a real Photoshop console trace, 2026-08-26). So
 * `field.value.trim()` typechecks, passes every test, and then throws
 * `Cannot read properties of null` in the host the moment the field is empty.
 * Inside a click handler that throw is swallowed by `void handler()`, so
 * pressing Generate with an empty prompt showed nothing at all instead of the
 * panel's own "enter a prompt" message. Every textarea read in App.ts goes
 * through here; `tests/ui/textareaValue.test.ts` keeps it that way.
 */
export function readTextareaValue(field: { value: string | null }): string {
  return field.value ?? "";
}
