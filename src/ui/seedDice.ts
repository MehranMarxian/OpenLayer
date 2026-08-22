/**
 * Artist-Friendly Dark's "Roll" button for the seed fields.
 *
 * Nobody should have to type a 64-bit integer as the primary way to pick a
 * seed. The text input stays -- it is still the fastest way to reproduce a
 * seed you already know, e.g. from History -- but a Roll button sits beside
 * it and generates a fresh one on click.
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
 * The seed fields are <input type="text">, not type="number", and that is
 * load-bearing -- see the note in appMarkup.ts. A UXP number input clamps at
 * roughly 214748.36 (2147483647 scaled by 1/10000), so every seed wider than
 * six digits came back as that identical mangled string. Two rounds of capping
 * the roll chased that ceiling without reaching it; the input type was the
 * actual cause.
 *
 * With a text input there is no clamp, so this matches the range
 * createRandomSeed in comfy/settings.ts already uses server-side. One concept
 * of "a seed", one range.
 */
const MAX_ROLLED_SEED = Number.MAX_SAFE_INTEGER;

/** A fresh seed in [0, MAX_SAFE_INTEGER), matching the server-side roll. */
export function rollSeed(): number {
  return Math.floor(Math.random() * MAX_ROLLED_SEED);
}

const ROW_CLASS = "seed-row";
const FIELD_CLASS = "has-seed-dice";

/**
 * The button is labelled with a word, not drawn as a die.
 *
 * Two icon techniques were tried in Photoshop and BOTH painted an empty box:
 * an inline <svg> assigned through innerHTML, and three CSS-shape pips
 * positioned on the diagonal. A data-URI SVG background renders nothing at
 * all, and emoji/geometric glyphs are already known-unreliable here (hence the
 * plain-text caret in bindAdvancedToggles). Text is the one thing in this host
 * that has never failed to render.
 *
 * It also happens to be the better control for the audience this theme is for:
 * "Roll" states what the button does, where a die face has to be interpreted.
 */
const BUTTON_LABEL = "Roll";

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

  button.textContent = BUTTON_LABEL;

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
