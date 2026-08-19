/**
 * SPIKE round 2: how do we get a usable slider out of UXP's NATIVE range widget?
 *
 * Delete this file, its markup block in appMarkup.ts, its CSS block in
 * styles.css, and its wiring in App.ts once v0.16.0's control design is decided.
 *
 * Round 1 settled the premise and killed two assumptions:
 *   - `type="range"` survives, renders, drags, and fires change events. Good.
 *   - UXP IGNORES `step`. With no step attribute (HTML default 1) it returned
 *     40.541, 47.147, 45.675. Continuous floats. So quantisation is ours to do.
 *   - `appearance:none` + `::-webkit-slider-thumb` did NOT take. The gradient
 *     track never painted and the thumb collapsed to a faint notch. The BARE
 *     native slider looked better than the styled one, so round 2 works with
 *     the native widget instead of against it.
 *   - Inline SVG, unicode and CSS shapes all render. A data-URI SVG background
 *     renders NOTHING -- do not use that technique anywhere in the panel.
 *
 * Round 2 questions:
 *   E. Does an EXPLICIT step attribute quantise, or is step ignored outright?
 *   F. Does `accent-color` brand the native slider? (cheapest possible win)
 *   G. Can JS snapping produce clean values from a continuous input?
 *   H. Does the label-as-prefix row survive a narrow panel? (Krita AI's trick)
 */

export const SPIKE_ARTIST_CONTROLS_MARKUP = `
        <!-- SPIKE, delete with src/ui/spikeArtistControls.ts once control design is decided. -->
        <section class="panel-section settings-panel spike-controls" aria-label="Spike: artist controls">
          <div class="section-heading">
            <span class="label">Spike: Artist Controls 2</span>
            <span class="muted-label">v0.16 probe</span>
          </div>

          <div class="spike-row">
            <span class="spike-tag">E1. explicit step="1" (0-100)</span>
            <input type="range" id="spike-step-int" min="0" max="100" step="1" value="50" />
          </div>

          <div class="spike-row">
            <span class="spike-tag">E2. explicit step="0.05" (0-1, denoise shape)</span>
            <input type="range" id="spike-step-frac" min="0" max="1" step="0.05" value="0.6" />
          </div>

          <div class="spike-row">
            <span class="spike-tag">F. accent-color on native widget</span>
            <input type="range" class="spike-accent" id="spike-accent" min="0" max="100" step="1" value="60" />
          </div>

          <div class="spike-row">
            <span class="spike-tag">G. JS-snapped to whole steps (4-60)</span>
            <input type="range" id="spike-snapped" min="4" max="60" step="1" value="20" />
            <div class="diagnostics-line" id="spike-snapped-readout">Steps: 20</div>
          </div>

          <div class="spike-row">
            <span class="spike-tag">H. label-as-prefix row (Krita AI trick)</span>
            <div class="spike-prefix-row">
              <span class="spike-prefix-label" id="spike-prefix-readout">Strength (denoise): 60%</span>
              <input type="range" class="spike-accent" id="spike-prefix" min="0" max="100" step="1" value="60" />
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

  const snappedInput = root.querySelector<HTMLInputElement>("#spike-snapped");
  const snappedReadout = root.querySelector<HTMLElement>("#spike-snapped-readout");
  const prefixInput = root.querySelector<HTMLInputElement>("#spike-prefix");
  const prefixReadout = root.querySelector<HTMLElement>("#spike-prefix-readout");

  const report = () => {
    // Whether an explicit step actually quantised is the whole question, so
    // report the raw values verbatim rather than anything already rounded.
    const parts = ranges
      .filter((range) => range.id === "spike-step-int" || range.id === "spike-step-frac")
      .map((range) => `${range.id.replace("spike-step-", "")}=${range.value}`);
    readout.textContent = `raw with explicit step: ${parts.join(" ")}`;
  };

  for (const range of ranges) {
    range.addEventListener("input", () => {
      report();
      if (snappedInput && snappedReadout && range === snappedInput) {
        const steps = snapToStep(Number(snappedInput.value), 4, 60, 1);
        snappedReadout.textContent = `Steps: ${steps}`;
      }
      if (prefixInput && prefixReadout && range === prefixInput) {
        const pct = snapToStep(Number(prefixInput.value), 0, 100, 1);
        prefixReadout.textContent = `Strength (denoise): ${pct === 0 ? "Off" : `${pct}%`}`;
      }
    });
  }

  report();
}
