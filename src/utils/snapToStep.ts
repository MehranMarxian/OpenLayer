/**
 * Quantises a value onto a control's declared step grid.
 *
 * UXP applies an explicit `step` attribute correctly, so a slider the user
 * drags already returns clean values. This exists for the values that do NOT
 * come from a control: workflow preset recommendations and persisted
 * preferences are plain numbers, bound by nothing, and would otherwise print
 * as 0.30000000000000004 or land between two legal stops.
 *
 * Measured UXP behaviour behind this lives in the openlayer-uxp-slider-findings
 * memory: an IMPLICIT default step is ignored, which is why every range input
 * in the panel must declare `step` even when the value looks like the default.
 */
export function snapToStep(rawValue: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(rawValue) || step <= 0) {
    return rawValue;
  }
  const clamped = Math.min(max, Math.max(min, rawValue));
  const snapped = min + Math.round((clamped - min) / step) * step;
  // Re-round to the step's own precision so float dust does not escape.
  const decimals = (String(step).split(".")[1] || "").length;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(decimals));
}
