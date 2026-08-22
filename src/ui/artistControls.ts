import { snapToStep } from "../utils/snapToStep";

/**
 * Artist-Friendly Dark's slider face for the numeric parameter fields.
 *
 * The number input stays the single source of truth. The slider is built only
 * while Artist-Friendly Dark is active and torn out again on the way back, so
 * Compact Adobe Dark's DOM is byte-identical to what it was before this file
 * existed. That is stricter than hiding with CSS, and deliberately so -- see
 * the two traps below, both of which were found in Photoshop the hard way.
 *
 * TRAP 1: the compact stylesheet contains
 *     .app-shell.theme-compact ... > .field > input { display: block !important; width: 96px !important }
 * An injected <input type="range"> IS an input, so it matched, and at
 * specificity (0,5,1) with !important it beat a plain `display: none` -- and
 * would beat [hidden] too. Hence the .artist-row wrapper: the compact rules use
 * child combinators, so a GRANDCHILD escapes them entirely. Do not flatten it.
 *
 * TRAP 2: nothing in the app listens to these inputs -- generation reads
 * `.value` directly at submit time. So re-dispatching input/change had no real
 * consumer, while its own sync listener was subscribed to it. If UXP fires
 * `input` on a programmatic `.value` assignment (it is not a standard DOM and
 * cannot be assumed to match one), that is unbounded recursion, and a stack
 * overflow inside UXP takes Photoshop down with it. The event is still
 * dispatched so later observers work, but `syncing` makes re-entry impossible.
 *
 * Also settled in Photoshop (see openlayer-uxp-slider-findings): an IMPLICIT
 * step is ignored, so every range declares `step`; and the native track and
 * thumb cannot be recoloured by any CSS route, so branding lives in the label.
 */

export interface ArtistControlSpec {
  /** id of the existing number input this slider drives. */
  inputId: string;
  /** Artist word first, jargon in parentheses, per the naming decision. */
  label: string;
  /** Soft slider range. The typed input keeps its own wider min/max. */
  softMin: number;
  softMax: number;
  step: number;
  format: (value: number) => string;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const decimal = (places: number) => (value: number) => value.toFixed(places);

/**
 * Soft ranges deliberately narrower than the typed input allows: steps go to
 * 150 and CFG to 30 in the markup, but a slider that spends most of its travel
 * in territory nobody uses is a worse control than a short one. widenToFit
 * extends the range rather than clamping if a real value lands outside, so a
 * theme switch can never silently rewrite a setting. SwarmUI's ViewMax idea.
 */
export const ARTIST_CONTROLS: ArtistControlSpec[] = [
  // Text to Image
  { inputId: "steps", label: "Detail (steps)", softMin: 1, softMax: 60, step: 1, format: decimal(0) },
  { inputId: "cfg", label: "Guidance (CFG)", softMin: 1, softMax: 12, step: 0.5, format: decimal(1) },
  // Image to Image
  { inputId: "img-steps", label: "Detail (steps)", softMin: 1, softMax: 60, step: 1, format: decimal(0) },
  { inputId: "img-cfg", label: "Guidance (CFG)", softMin: 1, softMax: 12, step: 0.5, format: decimal(1) },
  { inputId: "img-denoise", label: "Strength (denoise)", softMin: 0.05, softMax: 1, step: 0.05, format: percent },
  // Sketch to Image
  { inputId: "sketch-steps", label: "Detail (steps)", softMin: 1, softMax: 60, step: 1, format: decimal(0) },
  { inputId: "sketch-cfg", label: "Guidance (CFG)", softMin: 1, softMax: 12, step: 0.5, format: decimal(1) },
  { inputId: "sketch-denoise", label: "Strength (denoise)", softMin: 0.05, softMax: 1, step: 0.05, format: percent },
  {
    inputId: "sketch-control-strength",
    label: "Sketch influence",
    softMin: 0,
    softMax: 2,
    step: 0.05,
    format: decimal(2)
  },
  // Inpaint
  { inputId: "inpaint-steps", label: "Detail (steps)", softMin: 1, softMax: 60, step: 1, format: decimal(0) },
  { inputId: "inpaint-cfg", label: "Guidance (CFG)", softMin: 1, softMax: 12, step: 0.5, format: decimal(1) },
  { inputId: "inpaint-denoise", label: "Strength (denoise)", softMin: 0.05, softMax: 1, step: 0.05, format: percent },
  // Outpaint
  { inputId: "outpaint-steps", label: "Detail (steps)", softMin: 1, softMax: 60, step: 1, format: decimal(0) },
  { inputId: "outpaint-denoise", label: "Strength (denoise)", softMin: 0.05, softMax: 1, step: 0.05, format: percent },
  // Live painting
  { inputId: "live-denoise", label: "Strength (denoise)", softMin: 0.2, softMax: 0.95, step: 0.05, format: percent }
];

/**
 * Widens a soft range so it can represent `value`.
 *
 * A preset recommendation or a preference saved before the soft range existed
 * can legitimately sit outside it. Clamping would silently rewrite the user's
 * setting the moment they switched theme, so the range gives way instead.
 */
export function widenToFit(
  value: number,
  softMin: number,
  softMax: number
): { min: number; max: number } {
  if (!Number.isFinite(value)) {
    return { min: softMin, max: softMax };
  }
  return { min: Math.min(softMin, value), max: Math.max(softMax, value) };
}

/** Builds the label text for a control, e.g. "Strength (denoise): 60%". */
export function formatArtistLabel(spec: ArtistControlSpec, value: number): string {
  if (!Number.isFinite(value)) {
    return `${spec.label}: --`;
  }
  return `${spec.label}: ${spec.format(value)}`;
}

const ROW_CLASS = "artist-row";
const FIELD_CLASS = "has-artist-slider";

/**
 * Re-entrancy latch. See TRAP 2: this is the only thing standing between a
 * programmatic `.value` assignment and an unbounded event cycle if UXP echoes
 * one back as an `input` event. Never remove it on the grounds that the
 * browser would not recurse -- UXP is not the browser.
 */
let syncing = false;

function withSyncLatch(run: () => void): void {
  if (syncing) {
    return;
  }
  syncing = true;
  try {
    run();
  } finally {
    syncing = false;
  }
}

function dispatch(target: HTMLElement, type: string): void {
  try {
    target.dispatchEvent(new Event(type, { bubbles: true }));
  } catch {
    /* the value is already written; only observers miss the notice */
  }
}

function render(row: HTMLElement, input: HTMLInputElement, spec: ArtistControlSpec): void {
  const label = row.querySelector<HTMLElement>(`.artist-label`);
  const slider = row.querySelector<HTMLInputElement>(`.artist-slider`);
  if (!label || !slider) {
    return;
  }
  const raw = Number(input.value);
  if (!Number.isFinite(raw)) {
    label.textContent = formatArtistLabel(spec, Number.NaN);
    return;
  }
  const { min, max } = widenToFit(raw, spec.softMin, spec.softMax);
  slider.min = String(min);
  slider.max = String(max);
  slider.value = String(raw);
  label.textContent = formatArtistLabel(spec, raw);
}

/** The field's own <span class="label">, if it still has one. */
function findOwnLabel(field: HTMLElement): HTMLElement | null {
  for (const child of Array.from(field.children)) {
    if (child.classList.contains("label")) {
      return child as HTMLElement;
    }
  }
  return null;
}

function build(input: HTMLInputElement, spec: ArtistControlSpec): void {
  const field = input.parentElement;
  // Once built, the input's parent IS the row -- checking only for a
  // descendant row would look inside it and happily nest another one.
  if (!field || field.classList.contains(ROW_CLASS) || field.querySelector(`.${ROW_CLASS}`)) {
    return;
  }
  const doc = input.ownerDocument;

  // The wrapper is load-bearing, not cosmetic. See TRAP 1.
  const row = doc.createElement("div");
  row.className = ROW_CLASS;

  const label = doc.createElement("span");
  label.className = "artist-label";

  const slider = doc.createElement("input");
  slider.type = "range";
  slider.className = "artist-slider";
  // Explicit step is mandatory: UXP does not apply the implicit default.
  slider.step = String(spec.step);
  slider.setAttribute("aria-label", spec.label);

  row.append(label, slider);
  field.classList.add(FIELD_CLASS);
  field.insertBefore(row, input);

  // Move the compact face INSIDE the row. Hiding it in place meant winning a
  // specificity fight against `.field > .label` / `.field > input` rules that
  // are restated per view with different weights -- Sketch to Image showed all
  // three faces at once because one of those variants outranked the override.
  // As grandchildren they match no `.field > X` rule at all, in any view, so
  // there is no fight left to lose. Order is restored on teardown.
  const ownLabel = findOwnLabel(field);
  if (ownLabel) {
    row.appendChild(ownLabel);
  }
  row.appendChild(input);

  slider.addEventListener("input", () => {
    withSyncLatch(() => {
      const value = snapToStep(Number(slider.value), Number(slider.min), Number(slider.max), spec.step);
      input.value = String(value);
      label.textContent = formatArtistLabel(spec, value);
      dispatch(input, "input");
    });
  });

  // `change` fires once when the drag ends, not on every pixel of travel.
  slider.addEventListener("change", () => {
    withSyncLatch(() => dispatch(input, "change"));
  });

  // Presets and restored preferences write straight to the number input.
  const follow = () => withSyncLatch(() => render(row, input, spec));
  input.addEventListener("input", follow);
  input.addEventListener("change", follow);

  withSyncLatch(() => render(row, input, spec));
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
  // Put the compact face back exactly where it was: label first, then the
  // number input, both immediately before the row that is about to go.
  const ownLabel = findOwnLabel(row);
  if (ownLabel) {
    field.insertBefore(ownLabel, row);
  }
  field.insertBefore(input, row);
  row.remove();
  field.classList.remove(FIELD_CLASS);
}

/**
 * Builds the slider face when Artist-Friendly Dark is active and removes it
 * entirely otherwise. Returns the number of controls currently built.
 *
 * Tearing down rather than hiding is what guarantees Compact Adobe Dark is
 * unaffected: with the row gone there is no element left for a stray
 * `!important` rule to paint, and no extra child in the settings grid.
 */
export function setArtistControlsEnabled(root: ParentNode, enabled: boolean): number {
  let built = 0;

  for (const spec of ARTIST_CONTROLS) {
    const input = root.querySelector<HTMLInputElement>(`#${spec.inputId}`);
    if (!input) {
      continue;
    }
    if (enabled) {
      build(input, spec);
      built += 1;
    } else {
      teardown(input);
    }
  }

  return built;
}

/**
 * Re-reads every number input into its slider.
 *
 * Code that assigns `input.value` without dispatching an event leaves the
 * slider stale, which is invisible until the slider is the visible face.
 */
export function syncArtistControls(root: ParentNode): void {
  for (const spec of ARTIST_CONTROLS) {
    const input = root.querySelector<HTMLInputElement>(`#${spec.inputId}`);
    const parent = input?.parentElement;
    const row = parent?.classList.contains(ROW_CLASS) ? parent : null;
    if (input && row) {
      withSyncLatch(() => render(row, input, spec));
    }
  }
}
