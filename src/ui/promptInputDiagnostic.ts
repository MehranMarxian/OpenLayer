/**
 * SPIKE / TEMPORARY: delete this file and its call sites in App.ts once the
 * prompt hard-stop is understood.
 *
 * Measures whether a prompt textarea actually stops ACCEPTING input past a
 * certain length, or merely stops SHOWING it. Those two have identical
 * symptoms from the artist's chair -- you type and nothing appears -- but
 * opposite fixes.
 *
 * READ THIS BEFORE TOUCHING A TEXTAREA VALUE ANYWHERE IN THIS CODEBASE:
 * in Photoshop UXP, an empty <textarea>'s `.value` is `null`, not `""`.
 * Every browser and jsdom return `""`, so `field.value.length`,
 * `field.value.trim()` and friends typecheck, pass the whole suite, and then
 * throw `Cannot read properties of null` the moment the panel loads in the
 * host. Three consecutive builds were broken by exactly this: each threw
 * partway through renderApp, so every binding registered after the throw --
 * theme switching, the sticky header wrapper, the tool warnings -- silently
 * never ran. The visible symptoms were "themes are broken" and "the header
 * is wrong", which is a long way from the actual cause. Always read a
 * textarea through `readValue` below, or `?? ""`.
 */

/** UXP returns null for an empty textarea; every browser returns "". */
function readValue(field: HTMLTextAreaElement): string {
  return field.value ?? "";
}

function attach(field: HTMLTextAreaElement, readout: HTMLElement, label: string) {
  let blocked = 0;
  let peak = readValue(field).length;

  const render = (note: string) => {
    readout.textContent =
      `[${label}] chars ${readValue(field).length} peak ${peak} blocked ${blocked}` +
      ` | ch ${field.clientHeight} sh ${field.scrollHeight} top ${field.scrollTop}` +
      ` val ${field.value === null ? "NULL" : "str"} ${note}`;
  };

  field.addEventListener("keydown", (event) => {
    // Only ordinary character keys. An arrow key or a modifier chord not
    // changing the length is expected, not evidence of anything.
    const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (!isPrintable) {
      return;
    }

    const before = readValue(field).length;

    // Read back after the host has had a turn: during keydown the value has
    // not been updated yet.
    window.setTimeout(() => {
      const after = readValue(field).length;
      peak = Math.max(peak, after);

      if (after === before) {
        blocked += 1;
        render(`REJECTED@${before}`);
        console.log(`[OpenLayer][prompt-diag] ${label} REJECTED keystroke at ${before} chars`);
        return;
      }

      render(after < before ? `TRUNC ${before}->${after}` : "");
    }, 0);
  });

  field.addEventListener("input", () => render(""));
  render("ready");
}

/**
 * Never allowed to break the panel. A spike that takes renderApp down with it
 * destroys the very thing it was added to observe -- which is exactly what
 * happened on the first attempt.
 */
export function attachPromptInputDiagnostic(
  field: HTMLTextAreaElement,
  readout: HTMLElement,
  label: string
) {
  try {
    attach(field, readout, label);
  } catch (error) {
    console.log(`[OpenLayer][prompt-diag] ${label} failed to attach:`, error);
  }
}
