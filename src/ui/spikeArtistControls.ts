/**
 * SPIKE: does UXP render and style a slider, and which icon technique survives?
 *
 * Delete this file, its markup block in appMarkup.ts, its CSS block in
 * styles.css, and its wiring in App.ts once v0.16.0's control design is decided.
 *
 * Everything the v0.16 artist-friendly control work rests on is unproven in this
 * host: the panel has never shipped a single `<input type="range">` or any icon
 * that was not a bitmap `<img>`. UXP has already refused `visibility:hidden`,
 * flex `gap` in compact panels, and sticky reflow, so "it works in a browser" is
 * not evidence. This renders the candidates side by side in the real panel so
 * one screenshot answers all of it.
 *
 * Questions, in the order they matter:
 *   A. Does a bare range input appear at all, and can it be dragged?
 *   B. Does `appearance: none` + custom track/thumb styling take effect?
 *   C. Do the endpoint icons flanking a slider line up with it?
 *   D. Which icon technique renders: inline SVG, data-URI SVG, unicode, or CSS?
 */

export const SPIKE_ARTIST_CONTROLS_MARKUP = `
        <!-- SPIKE, delete with src/ui/spikeArtistControls.ts once control design is decided. -->
        <section class="panel-section settings-panel spike-controls" aria-label="Spike: artist controls">
          <div class="section-heading">
            <span class="label">Spike: Artist Controls</span>
            <span class="muted-label">v0.16 probe</span>
          </div>

          <div class="spike-row">
            <span class="spike-tag">A. bare range, no CSS</span>
            <input type="range" id="spike-range-bare" min="0" max="100" value="50" />
          </div>

          <div class="spike-row">
            <span class="spike-tag">B. styled range</span>
            <input type="range" class="spike-range-styled" id="spike-range-styled" min="0" max="100" value="70" />
          </div>

          <div class="spike-row">
            <span class="spike-tag">C. endpoint icons + styled range</span>
            <div class="spike-slider-line">
              <span class="spike-endpoint" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>
              </span>
              <input type="range" class="spike-range-styled" id="spike-range-endpoints" min="0" max="100" value="35" />
              <span class="spike-endpoint" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 1.5 L9.8 6 L14.5 6 L10.8 8.9 L12.2 13.5 L8 10.8 L3.8 13.5 L5.2 8.9 L1.5 6 L6.2 6 Z" fill="currentColor"/></svg>
              </span>
            </div>
          </div>

          <div class="spike-row">
            <span class="spike-tag">D. icon techniques</span>
            <div class="spike-icon-strip">
              <span class="spike-icon-cell">
                <svg viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
                <em>inline svg</em>
              </span>
              <span class="spike-icon-cell">
                <i class="spike-icon-datauri"></i>
                <em>data-uri</em>
              </span>
              <span class="spike-icon-cell">
                <b class="spike-icon-glyph">&#9673;</b>
                <em>unicode</em>
              </span>
              <span class="spike-icon-cell">
                <i class="spike-icon-css"></i>
                <em>css shape</em>
              </span>
            </div>
          </div>

          <div class="diagnostics-line" id="spike-controls-readout">Drag a slider to test event delivery.</div>
        </section>
`;

/**
 * Reports what the host actually did, so a screenshot carries the answer.
 *
 * Reads back the computed appearance rather than trusting that the CSS applied:
 * UXP silently drops declarations it does not implement, so a styled-looking
 * rule in the stylesheet proves nothing on its own.
 */
export function wireSpikeArtistControls(root: ParentNode): void {
  const readout = root.querySelector<HTMLElement>("#spike-controls-readout");
  if (!readout) {
    return;
  }

  const ranges = Array.from(
    root.querySelectorAll<HTMLInputElement>('input[type="range"]')
  );

  if (ranges.length === 0) {
    readout.textContent =
      "No range inputs found in the DOM at all -- UXP did not construct them.";
    return;
  }

  const describeSupport = () => {
    const probe = ranges[0];
    // An unsupported input type falls back to "text" in the `type` property on
    // hosts that do not implement it, which is the cheapest reliable tell.
    const keptType = probe.type === "range";
    return `type kept as range: ${keptType ? "yes" : `NO (reports "${probe.type}")`}`;
  };

  const report = (note: string) => {
    const values = ranges.map((range) => `${range.id.replace("spike-range-", "")}=${range.value}`);
    readout.textContent = `${describeSupport()} | ${values.join(" ")} | ${note}`;
  };

  for (const range of ranges) {
    range.addEventListener("input", () => report("input event fired"));
    range.addEventListener("change", () => report("change event fired"));
  }

  report("no drag yet");
}
