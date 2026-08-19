import { snapToStep } from "../utils/snapToStep";

/**
 * Artist-Friendly Dark's slider face for the numeric parameter fields.
 *
 * The number input stays the single source of truth. A slider is injected
 * beside it, writes through to it, and re-dispatches input/change so every
 * existing handler fires exactly as it did before -- no handler is rebound and
 * no view code is refactored. Compact Adobe Dark keeps showing the number
 * input and never sees the slider; CSS decides which face is visible, so there
 * is only ever ONE control and the two faces cannot drift apart.
 *
 * UXP constraints this is built around (see openlayer-uxp-slider-findings):
 *   - an IMPLICIT step is ignored, so every range declares `step` explicitly;
 *   - the native track and thumb cannot be recoloured by any CSS route, so the
 *     branding lives in the label row rather than in the control.
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
  /** Renders the value shown in the label. */
  format: (value: number) => string;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const decimal = (places: number) => (value: number) => value.toFixed(places);

/**
 * Soft ranges deliberately narrower than the typed input allows: steps go to
 * 150 and CFG to 30 in the markup, but a slider that spends 90% of its travel
 * in territory nobody uses is a worse control than a narrow one. widenToFit
 * below extends the range rather than clamping if a real value lands outside,
 * so nothing is ever silently changed. This is SwarmUI's ViewMax idea.
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

const SLIDER_SUFFIX = "-artist-slider";
const LABEL_SUFFIX = "-artist-label";

function dispatch(target: HTMLElement, type: string): void {
  // UXP's Event constructor is available, but guard anyway: a failure here
  // would silently stop generation parameters from updating.
  try {
    target.dispatchEvent(new Event(type, { bubbles: true }));
  } catch {
    /* no-op: the value is already written, only observers miss the notice */
  }
}

function syncSliderFromInput(
  input: HTMLInputElement,
  slider: HTMLInputElement,
  label: HTMLElement,
  spec: ArtistControlSpec
): void {
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

/**
 * Injects the slider face for every control whose number input is present.
 * Safe to call once; returns how many controls were wired.
 */
export function wireArtistControls(root: ParentNode): number {
  let wired = 0;

  for (const spec of ARTIST_CONTROLS) {
    const input = root.querySelector<HTMLInputElement>(`#${spec.inputId}`);
    if (!input) {
      continue;
    }
    const field = input.parentElement;
    if (!field || field.querySelector(`#${spec.inputId}${SLIDER_SUFFIX}`)) {
      continue;
    }

    const doc = input.ownerDocument;
    const label = doc.createElement("span");
    label.className = "artist-label";
    label.id = `${spec.inputId}${LABEL_SUFFIX}`;

    const slider = doc.createElement("input");
    slider.type = "range";
    slider.className = "artist-slider";
    slider.id = `${spec.inputId}${SLIDER_SUFFIX}`;
    // Explicit step is mandatory: UXP does not apply the implicit default and
    // hands back continuous floats without it.
    slider.step = String(spec.step);
    slider.setAttribute("aria-label", spec.label);

    field.classList.add("has-artist-slider");
    field.insertBefore(label, input);
    field.insertBefore(slider, input);

    slider.addEventListener("input", () => {
      const value = snapToStep(Number(slider.value), Number(slider.min), Number(slider.max), spec.step);
      input.value = String(value);
      label.textContent = formatArtistLabel(spec, value);
      // Drive the existing handlers rather than reimplementing them.
      dispatch(input, "input");
      dispatch(input, "change");
    });

    // Presets and restored preferences write straight to the number input.
    input.addEventListener("input", () => syncSliderFromInput(input, slider, label, spec));
    input.addEventListener("change", () => syncSliderFromInput(input, slider, label, spec));

    syncSliderFromInput(input, slider, label, spec);
    wired += 1;
  }

  return wired;
}

/**
 * Re-reads every number input into its slider.
 *
 * Code that assigns `input.value` without dispatching an event leaves the
 * slider stale, which is invisible until the theme is switched and a wrong
 * number appears. Calling this on theme change closes that gap cheaply.
 */
export function syncArtistControls(root: ParentNode): void {
  for (const spec of ARTIST_CONTROLS) {
    const input = root.querySelector<HTMLInputElement>(`#${spec.inputId}`);
    const slider = root.querySelector<HTMLInputElement>(`#${spec.inputId}${SLIDER_SUFFIX}`);
    const label = root.querySelector<HTMLElement>(`#${spec.inputId}${LABEL_SUFFIX}`);
    if (input && slider && label) {
      syncSliderFromInput(input, slider, label, spec);
    }
  }
}
