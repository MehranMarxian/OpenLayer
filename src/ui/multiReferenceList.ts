/**
 * List operations for Multi-Reference composition.
 *
 * Pulled out of `App.ts` because these are the only part of the tool with real
 * logic rather than DOM wiring, and because order carries consequences an
 * off-by-one would quietly change: the first entry sets the output canvas, and
 * chain position decides whether a secondary object stays coherent. Gate
 * testing found moving a bicycle one place earlier fixed a duplication that
 * reproduced on every seed -- see `docs/multi-reference-gate-findings.md`.
 *
 * Every function returns a new array rather than mutating, so a caller that
 * re-renders from the returned value cannot show a list the state does not
 * agree with.
 */

/** The minimum an entry needs to take part; the panel's entries carry more. */
export type ReferenceListItem = {
  id: string;
};

export function removeReference<T extends ReferenceListItem>(
  references: readonly T[],
  id: string
): { references: T[]; removed: T | null } {
  const removed = references.find((candidate) => candidate.id === id) ?? null;

  return {
    references: removed ? references.filter((candidate) => candidate.id !== id) : [...references],
    removed
  };
}

/**
 * Moves one reference by `offset` places, clamping at the ends rather than
 * wrapping. Wrapping would turn a repeated press on the top item into a jump to
 * the bottom, which reads as the list losing the entry.
 */
export function moveReference<T extends ReferenceListItem>(
  references: readonly T[],
  id: string,
  offset: number
): { references: T[]; movedTo: number | null } {
  const index = references.findIndex((candidate) => candidate.id === id);

  if (index < 0) {
    return { references: [...references], movedTo: null };
  }

  const target = index + offset;

  if (target < 0 || target >= references.length) {
    return { references: [...references], movedTo: null };
  }

  const reordered = [...references];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(target, 0, moved);

  return { references: reordered, movedTo: target };
}

export function canAddReference(references: readonly ReferenceListItem[], maximum: number) {
  return references.length < maximum;
}

/**
 * The name one reference is uploaded to ComfyUI under.
 *
 * A capture's own filename is not usable here. `createLayerName` stamps them to
 * the minute -- `OpenLayer_Source_20260828_0023.png` -- so two layers captured
 * in the same minute, which is the normal case when building a list, arrive
 * with identical names. Uploads pass `overwrite=true`, so the second one
 * replaced the first in ComfyUI's input folder and every `LoadImage` in the
 * chain then read the same picture: the background silently became a copy of
 * the last reference, and `GetImageSize` reported its size as the canvas.
 *
 * Every other tool uploads exactly one image per run, which is why nothing hit
 * this before. The entry id is unique per capture, so it is what makes the
 * upload unique.
 */
export function createReferenceUploadName(filename: string, id: string) {
  const dot = filename.lastIndexOf(".");
  const extension = dot > 0 ? filename.slice(dot) : ".png";

  return `openlayer-${id}${extension}`;
}

/**
 * The count shown beside the section heading. It names the ceiling as well as
 * the count so the limit is visible before it is hit rather than only in the
 * error that refuses the next capture.
 */
export function describeReferenceCount(references: readonly ReferenceListItem[], maximum: number) {
  if (references.length === 0) {
    return "None captured";
  }

  return `${references.length} of ${maximum}`;
}
