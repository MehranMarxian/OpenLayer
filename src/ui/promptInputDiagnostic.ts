/**
 * SPIKE / TEMPORARY: delete this file and its call sites in App.ts once the
 * prompt hard-stop is understood.
 *
 * Measures whether a prompt textarea actually stops ACCEPTING input past a
 * certain length, or merely stops SHOWING it. Those two have identical
 * symptoms from the artist's chair -- you type and nothing appears -- but
 * opposite fixes, and guessing wrong has already cost two broken builds.
 *
 * Reports into an element the panel ALREADY renders (a tool's diagnostics
 * line) rather than creating one. The first attempt at this spike injected
 * its own element with `insertAdjacentElement` and nothing appeared in
 * Photoshop at all -- so the measurement is now carried by a surface with
 * proof of life, and this file creates no DOM whatsoever.
 *
 * What the numbers mean:
 * - `sh` (scrollHeight) climbing above `ch` (clientHeight) while the text
 *   stops moving on screen -> a RENDER/scroll problem. The value is fine;
 *   the host is not scrolling the caret into view.
 * - `sh` stuck equal to `ch` while text is clearly longer than the box ->
 *   the host is not measuring overflow at all, which is why the auto-grow
 *   attempt (which trusted scrollHeight) did nothing.
 * - `chars` frozen while `blocked` climbs -> a real INPUT cap in the host,
 *   the same family as the seed field's native-number-input truncation fixed
 *   in v0.16.0, meaning the answer is to stop using the native control.
 */

export function attachPromptInputDiagnostic(
  field: HTMLTextAreaElement,
  readout: HTMLElement,
  label: string
) {
  let blocked = 0;
  let peak = field.value.length;

  const render = (note: string) => {
    readout.textContent =
      `[${label}] chars ${field.value.length} peak ${peak} blocked ${blocked}` +
      ` | ch ${field.clientHeight} sh ${field.scrollHeight} top ${field.scrollTop}` +
      ` rows ${field.rows} ${note}`;
  };

  field.addEventListener("keydown", (event) => {
    // Only ordinary character keys. An arrow key or a modifier chord not
    // changing the length is expected, not evidence of anything.
    const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (!isPrintable) {
      return;
    }

    const before = field.value.length;

    // Read back after the host has had a turn: during keydown the value has
    // not been updated yet.
    window.setTimeout(() => {
      const after = field.value.length;
      peak = Math.max(peak, after);

      if (after === before) {
        blocked += 1;
        render(`REJECTED@${before}`);
        console.log(`[OpenLayer][prompt-diag] ${label} REJECTED keystroke at ${before} chars`);
        return;
      }

      if (after < before) {
        render(`TRUNC ${before}->${after}`);
        console.log(`[OpenLayer][prompt-diag] ${label} TRUNCATED ${before} -> ${after}`);
        return;
      }

      render("");
    }, 0);
  });

  field.addEventListener("input", () => render(""));
  render("ready");
}
