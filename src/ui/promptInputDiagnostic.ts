/**
 * SPIKE / TEMPORARY: delete this file and its two call sites in App.ts once
 * the prompt hard-stop is understood.
 *
 * Measures whether a prompt textarea actually stops ACCEPTING input past a
 * certain length, or merely stops SHOWING it. Those two have identical
 * symptoms from the artist's chair -- you type and nothing appears -- but
 * completely different fixes, and guessing wrong has already cost two broken
 * builds.
 *
 * Deliberately built to be incapable of breaking layout: no stylesheet rule,
 * no markup change, no class anyone else styles. The readout is one element
 * injected after the field with inline styles, and every listener is passive.
 *
 * What the numbers mean:
 * - `chars` climbing while the text stops moving on screen  -> a RENDER /
 *   scroll problem; the value is fine, the host just isn't showing the caret.
 * - `chars` frozen and `blocked` climbing as you keep typing -> a real INPUT
 *   cap in the host; the keystroke never reaches the value at all. This is
 *   the same shape as the seed field's native-number-input truncation, and
 *   would mean the fix is to stop relying on the native control.
 * - `peak` is the high-water mark, so a value that grows and then gets
 *   silently truncated back still leaves evidence behind.
 */

type DiagnosticState = {
  blocked: number;
  peak: number;
};

export function attachPromptInputDiagnostic(field: HTMLTextAreaElement, label: string) {
  const state: DiagnosticState = { blocked: 0, peak: field.value.length };

  const readout = document.createElement("div");
  readout.style.color = "#ffd479";
  readout.style.fontSize = "11px";
  readout.style.marginTop = "4px";
  readout.style.marginBottom = "4px";
  field.insertAdjacentElement("afterend", readout);

  const render = () => {
    readout.textContent =
      `[diag ${label}] chars ${field.value.length} · peak ${state.peak} · blocked ${state.blocked}` +
      ` · box ${field.clientHeight}/${field.scrollHeight} · top ${field.scrollTop}`;
  };

  field.addEventListener("keydown", (event) => {
    // Only ordinary character keys. A modifier chord or an arrow key not
    // changing the length is expected, not evidence of anything.
    const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (!isPrintable) {
      return;
    }

    const before = field.value.length;

    // Read back after the host has had a turn to apply the keystroke --
    // during keydown the value has not been updated yet.
    window.setTimeout(() => {
      const after = field.value.length;
      state.peak = Math.max(state.peak, after);

      if (after === before) {
        state.blocked += 1;
        console.log(
          `[OpenLayer][prompt-diag] ${label} REJECTED a keystroke at ${before} chars` +
            ` (key "${event.key}", caret ${field.selectionStart}, box ${field.clientHeight}/${field.scrollHeight})`
        );
      } else if (after < before) {
        console.log(`[OpenLayer][prompt-diag] ${label} TRUNCATED ${before} -> ${after} chars`);
      }

      render();
    }, 0);
  });

  field.addEventListener("input", render);
  render();

  console.log(`[OpenLayer][prompt-diag] attached to ${label}`);
}
