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

/**
 * Rolled seeds stop at 2^31-1, NOT Number.MAX_SAFE_INTEGER.
 *
 * A UXP <input type="number"> cannot hold a value above the signed 32-bit
 * maximum. Anything larger comes back out as "214748.36" -- 2147483647 with a
 * decimal point pushed in -- and it is the SAME mangled value every time, so
 * rolling appeared to do nothing. That display bug predates the dice button
 * (it was visible on the seed field in earlier screenshots) but the button
 * made it reproducible on demand.
 *
 * This range is not a compromise: 2^31 seeds is the range most tools expose,
 * and generation is unaffected either way -- readSeed in comfy/settings.ts
 * still rolls its own full-width seed server-side when the field is blank.
 */
const MAX_ROLLED_SEED = 2147483647;

/** A fresh seed in [0, 2^31-1), the widest range a UXP number input can hold. */
export function rollSeed(): number {
  return Math.floor(Math.random() * MAX_ROLLED_SEED);
}

const ROW_CLASS = "seed-row";
const FIELD_CLASS = "has-seed-dice";

/**
 * The die face is built from three plain <span> pips, not an icon.
 *
 * An inline <svg> assigned through innerHTML rendered as an empty box in
 * Photoshop -- the button painted, the glyph did not. Emoji and geometric
 * glyphs are already known-unreliable here (see the plain-text caret in
 * bindAdvancedToggles), and a data-URI SVG background renders nothing at all.
 * CSS shapes are the one icon technique the spike confirmed does work, so the
 * button's own border is the die outline and these are its pips.
 */
const PIP_COUNT = 3;

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

  for (let index = 0; index < PIP_COUNT; index += 1) {
    const pip = doc.createElement("span");
    pip.className = `seed-pip seed-pip-${index + 1}`;
    button.appendChild(pip);
  }

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
