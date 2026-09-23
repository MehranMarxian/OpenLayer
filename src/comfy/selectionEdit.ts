/**
 * Editing only a Photoshop selection with an instruction-edit preset.
 *
 * The model repaints the whole context crop, and untouched areas come back a
 * few levels darker. Composited straight back, that shows as an edge in smooth
 * areas like sky (measured: -1.96 levels, sharp). The graph therefore colour-
 * matches the edit to the original using only the untouched ring around the
 * selection before feathering it in (measured: -0.12, invisible at a 6x
 * contrast boost). See docs/v0.36-plan.md for the spike.
 *
 * The match is a whole-image colour transfer computed from a frame that holds
 * the original inside the selection and the edit outside it, so the
 * selection's own pixels contribute nothing to the difference -- which
 * dilutes the correction by (1 - f), f being the selection's share of the
 * crop. Strength 1 / (1 - f) undoes that dilution.
 */

/** Share of the mask that is selected (at least half-on in any channel). */
export function measureSelectionFraction(maskRgba: Uint8Array): number {
  const pixels = Math.floor(maskRgba.length / 4);

  if (pixels === 0) {
    return 0;
  }

  let selected = 0;

  for (let offset = 0; offset < pixels * 4; offset += 4) {
    if (Math.max(maskRgba[offset], maskRgba[offset + 1], maskRgba[offset + 2]) >= 128) {
      selected += 1;
    }
  }

  return selected / pixels;
}

/** Capped at 4: a selection filling three quarters of its crop leaves too thin a ring to trust further. */
export const MAX_SELECTION_EDIT_STRENGTH = 4;

export function selectionEditStrength(selectedFraction: number): number {
  const fraction = Math.min(Math.max(selectedFraction, 0), 0.99);
  const strength = 1 / (1 - fraction);

  return Math.round(Math.min(strength, MAX_SELECTION_EDIT_STRENGTH) * 1000) / 1000;
}
