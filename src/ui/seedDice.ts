/**
 * Artist-Friendly Dark's dice button for the seed fields.
 *
 * Nobody should have to type a 64-bit integer as the primary way to pick a
 * seed. The number input stays -- it is still the fastest way to reproduce a
 * seed you already know, e.g. from History -- but a dice button sits beside
 * it and rolls a fresh one on click.
 *
 * Built only while Artist-Friendly Dark is active and torn down on the way
 * back, same lifecycle as the sliders in artistControls.ts, for the same
 * reason: it moves the input out from being a direct child of `.field` into
 * a wrapper, so none of the compact sheet's `.field > input { ... !important }`
 * rules can reach it. See openlayer-uxp-slider-findings for why re-parenting
 * beats re-specifying here.
 *
 * No re-entrancy latch is needed. Unlike the sliders, there is no second
 * widget mirroring the input's value, and nothing anywhere listens for
 * input/change on a seed field -- generation reads `.value` directly at
 * submit time, same as steps/cfg/denoise before their sliders existed. A
 * click writes the value once and dispatches once; there is no listener
 * registered on the input itself to call back into, so there is no loop to
 * guard against.
 */

const SEED_INPUT_IDS = ["seed", "img-seed", "sketch-seed", "inpaint-seed", "outpaint-seed"];

const MAX_SEED = Number.MAX_SAFE_INTEGER;

/** A fresh seed in the same [0, MAX_SAFE_INTEGER) range the server itself uses. */
export function rollSeed(): number {
  return Math.floor(Math.random() * MAX_SEED);
}

const ROW_CLASS = "seed-row";
const FIELD_CLASS = "has-seed-dice";

// Minimal six-face die outline with three pips. Inline SVG, not a data-URI --
// the spike found data-URI SVG backgrounds render nothing in UXP, and this
// codebase has not shipped an emoji glyph anywhere for the same reason
// (see the advanced-toggle comment in appBindings.ts).
const DICE_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">' +
  '<rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.4"></rect>' +
  '<circle cx="5" cy="5" r="1.15" fill="currentColor"></circle>' +
  '<circle cx="8" cy="8" r="1.15" fill="currentColor"></circle>' +
  '<circle cx="11" cy="11" r="1.15" fill="currentColor"></circle>' +
  "</svg>";

function dispatch(target: HTMLElement, type: string): void {
  try {
    target.dispatchEvent(new Event(type, { bubbles: true }));
  } catch {
    /* the value is already written; only observers miss the notice */
  }
}

function build(input: HTMLInputElement): void {
  const field = input.parentElement;
  // Once built, the input's parent IS the row -- see the same guard in
  // artistControls.ts and the test that caught its absence.
  if (!field || field.classList.contains(ROW_CLASS) || field.querySelector(`.${ROW_CLASS}`)) {
    return;
  }
  const doc = input.ownerDocument;

  const row = doc.createElement("div");
  row.className = ROW_CLASS;

  const button = doc.createElement("button");
  button.type = "button";
  button.className = "seed-dice-button";
  button.setAttribute("aria-label", "Roll a new seed");
  button.title = "Roll a new seed";
  button.innerHTML = DICE_ICON;

  field.classList.add(FIELD_CLASS);
  field.insertBefore(row, input);
  row.append(input, button);

  button.addEventListener("click", () => {
    input.value = String(rollSeed());
    dispatch(input, "input");
    dispatch(input, "change");
  });
}

function teardown(input: HTMLInputElement): void {
  const row = input.parentElement;
  if (!row || !row.classList.contains(ROW_CLASS)) {
    return;
  }
  const field = row.parentElement;
  if (!field) {
    return;
  }
  field.insertBefore(input, row);
  row.remove();
  field.classList.remove(FIELD_CLASS);
}

/**
 * Builds the dice button when Artist-Friendly Dark is active and removes it
 * entirely otherwise. Returns how many seed fields are present on this screen.
 */
export function setSeedDiceEnabled(root: ParentNode, enabled: boolean): number {
  let found = 0;

  for (const inputId of SEED_INPUT_IDS) {
    const input = root.querySelector<HTMLInputElement>(`#${inputId}`);
    if (!input) {
      continue;
    }
    found += 1;
    if (enabled) {
      build(input);
    } else {
      teardown(input);
    }
  }

  return found;
}
