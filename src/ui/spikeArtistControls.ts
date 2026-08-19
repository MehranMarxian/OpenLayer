/**
 * SPIKE round 3: how do we get a usable slider out of UXP's NATIVE range widget?
 *
 * Delete this file, its markup block in appMarkup.ts, its CSS block in
 * styles.css, and its wiring in App.ts once v0.16.0's control design is decided.
 *
 * SETTLED in real Photoshop by rounds 1-2. Do not re-test these:
 *   - `type="range"` survives, renders, drags, and fires change events.
 *   - An EXPLICIT `step` DOES quantise: step="1" gave 44, step="0.05" gave 0.55.
 *     Round 1's continuous floats (40.541, 47.147) came from relying on the
 *     IMPLICIT default step, which UXP ignores. Always declare step explicitly.
 *   - `appearance:none` + `::-webkit-slider-thumb` does NOT take. The gradient
 *     track never painted and the thumb collapsed to a faint notch. The BARE
 *     native slider looked better, so we work with the widget, not against it.
 *   - `accent-color` does NOT take. There is no cheap recolour of the native
 *     track or thumb, so branding has to live in the label row, not the control.
 *   - JS snapping produces clean values, and the Krita AI label-as-prefix row
 *     reads well in a narrow docked panel. Both are keepers.
 *   - Inline SVG, unicode and CSS shapes all render. A data-URI SVG background
 *     renders NOTHING -- do not use that technique anywhere in the panel.
 *
 * Round 3 question:
 *   I. Does `background` on the range ELEMENT paint the track? The pseudo-
 *      element route is dead, but the element's own box may still honour it.
 *      UXP's native default track is #535353, a light bar floating on #2b2b2b.
 *
 * `snapToStep` survives the spike regardless: explicit step covers the widget,
 * but values also arrive from presets and persisted preferences, which are not
 * bound by the control's step and still need quantising before they are shown.
 */

export const SPIKE_ARTIST_CONTROLS_MARKUP = `
        <!-- SPIKE, delete with src/ui/spikeArtistControls.ts once control design is decided. -->
        <section class="panel-section settings-panel spike-controls" aria-label="Spike: artist controls">
          <div class="section-heading">
            <span class="label">Spike: Artist Controls 2</span>
            <span class="muted-label">v0.16 probe</span>
          </div>

          <div class="spike-row">
            <span class="spike-tag">I1. Steps -- Fast .. Detailed</span>
            <div class="spike-prefix-row">
              <span class="spike-prefix-label" id="spike-prefix-steps">Detail (steps): 20</span>
              <input type="range" id="spike-steps" min="4" max="60" step="1" value="20" />
            </div>
          </div>

          <div class="spike-row">
            <span class="spike-tag">I2. Strength -- Off .. Rebuild</span>
            <div class="spike-prefix-row">
              <span class="spike-prefix-label" id="spike-prefix-strength">Strength (denoise): 60%</span>
              <input type="range" id="spike-strength" min="0" max="100" step="5" value="60" />
            </div>
          </div>

          <div class="spike-row">
            <span class="spike-tag">I3. Guidance -- Loose .. Literal</span>
            <div class="spike-prefix-row">
              <span class="spike-prefix-label" id="spike-prefix-guidance">Guidance (CFG): 4.0</span>
              <input type="range" id="spike-guidance" min="1" max="12" step="0.5" value="4" />
            </div>
          </div>

          <div class="diagnostics-line" id="spike-controls-readout">Drag each slider.</div>
        </section>
`;

/** Rounds a continuous UXP range value onto the control's declared step grid. */
export function snapToStep(rawValue: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(rawValue) || step <= 0) {
    return rawValue;
  }
  const clamped = Math.min(max, Math.max(min, rawValue));
  const snapped = min + Math.round((clamped - min) / step) * step;
  // Re-round to the step's own precision so 0.30000000000000004 does not escape.
  const decimals = (String(step).split(".")[1] || "").length;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(decimals));
}

/** Formats a snapped value the way the real control will: artist word, jargon
 *  in parentheses, and a plain word instead of a number at a meaningful end. */
type SpikeFormatter = (value: number) => string;

interface SpikeControl {
  inputId: string;
  labelId: string;
  min: number;
  max: number;
  step: number;
  format: SpikeFormatter;
}

const SPIKE_CONTROLS: SpikeControl[] = [
  {
    inputId: "spike-steps",
    labelId: "spike-prefix-steps",
    min: 4,
    max: 60,
    step: 1,
    format: (value) => `Detail (steps): ${value}`,
  },
  {
    inputId: "spike-strength",
    labelId: "spike-prefix-strength",
    min: 0,
    max: 100,
    step: 5,
    // "Off" rather than "0%" -- at the minimum the control does nothing, and
    // the word says that where the number only implies it.
    format: (value) => `Strength (denoise): ${value === 0 ? "Off" : `${value}%`}`,
  },
  {
    inputId: "spike-guidance",
    labelId: "spike-prefix-guidance",
    min: 1,
    max: 12,
    step: 0.5,
    format: (value) => `Guidance (CFG): ${value.toFixed(1)}`,
  },
];

export function wireSpikeArtistControls(root: ParentNode): void {
  const readout = root.querySelector<HTMLElement>("#spike-controls-readout");
  if (!readout) {
    return;
  }

  const ranges = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="range"]'));
  if (ranges.length === 0) {
    readout.textContent = "No range inputs in the DOM at all.";
    return;
  }

  const report = () => {
    // Round 3 is about the track paint, but keep printing raw values so a
    // regression in step quantisation cannot pass unnoticed.
    const parts = SPIKE_CONTROLS.map((control) => {
      const input = root.querySelector<HTMLInputElement>(`#${control.inputId}`);
      return input ? `${control.inputId.replace("spike-", "")}=${input.value}` : "";
    }).filter(Boolean);
    readout.textContent = `raw: ${parts.join(" ")}`;
  };

  for (const control of SPIKE_CONTROLS) {
    const input = root.querySelector<HTMLInputElement>(`#${control.inputId}`);
    const label = root.querySelector<HTMLElement>(`#${control.labelId}`);
    if (!input || !label) {
      continue;
    }
    const sync = () => {
      const value = snapToStep(Number(input.value), control.min, control.max, control.step);
      label.textContent = control.format(value);
      report();
    };
    input.addEventListener("input", sync);
    sync();
  }
}
