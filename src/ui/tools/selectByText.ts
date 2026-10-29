/**
 * Select by Text: the decisions that do not need Photoshop or ComfyUI.
 *
 * The tool sends a captured layer and a prompt to SAM 3.1 and turns the mask
 * that comes back into the document's live selection. Two things here decide
 * whether Photoshop is touched at all, and both are pure so they can be tested:
 *
 * - SAM's bounding-box report (a PreviewAny in the graph) says how many objects
 *   were found. The panel cannot decode ComfyUI's compressed PNGs, so this text
 *   is the only way to know a mask is empty before loading it -- and loading an
 *   empty mask raises Photoshop's own "No pixels are selected" dialog.
 * - The wording the artist reads. It goes through textContent, so it is plain
 *   text: no backticks, no markdown, no double hyphens.
 */

export type SelectionReport = Readonly<{
  objectCount: number;
}>;

/**
 * Reads PreviewAny's rendering of SAM3_Detect's bounding boxes: a JSON list
 * with one list per image, one object per detection. Measured on ComfyUI 0.37:
 * two umbrellas came back as `[[{x, y, width, height, score}, {...}]]` and a
 * subject that was not there as `[[]]`.
 *
 * Returns null when the text is missing or is not that shape, so the caller
 * can tell "nothing was found" apart from "the report could not be read".
 */
export function parseSelectionReport(text: string | null | undefined): SelectionReport | null {
  if (!text) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || !parsed.every((perImage) => Array.isArray(perImage))) {
    return null;
  }

  const objectCount = (parsed as unknown[][]).reduce((total, perImage) => total + perImage.length, 0);
  return { objectCount };
}

export function describeSelectionMade(objectCount: number): string {
  return objectCount === 1 ? "Selected 1 object." : `Selected ${objectCount} objects.`;
}

export function describeNothingFound(prompt: string): string {
  const subject = prompt.trim();
  return `Nothing matching "${subject}" was found, so the selection was left as it was. Try a plainer word, such as chair or person.`;
}

/**
 * What to do with a finished run. An unreadable report still selects: the mask
 * is the real result and the report is only a guard, so a ComfyUI that renders
 * the boxes differently should not stop the tool from working. The empty case
 * is the one that must never reach Photoshop.
 */
export type SelectionOutcome =
  | Readonly<{ kind: "select"; message: string }>
  | Readonly<{ kind: "nothing-found"; message: string }>;

export function decideSelectionOutcome(report: SelectionReport | null, prompt: string): SelectionOutcome {
  if (report && report.objectCount === 0) {
    return { kind: "nothing-found", message: describeNothingFound(prompt) };
  }

  return {
    kind: "select",
    message: report ? describeSelectionMade(report.objectCount) : "Selection made."
  };
}
