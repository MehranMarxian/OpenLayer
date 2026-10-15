import type { SetupRequirementsReport } from "../comfy/setupRequirements";
import { evaluateStarter, STARTER_TOOLS } from "../comfy/starterKit";

/**
 * Which workflow Text to Image and Image to Image open on once the FLUX.2 Klein
 * 4B starter is installed.
 *
 * Both tools have always opened on an SD 1.5 graph, because that was the one
 * model a fresh install was likely to have. After the Start here card the
 * likelier case is Klein, and opening on a graph whose checkpoint is missing
 * is the first-run failure the card exists to remove. So once the three
 * starter files are installed, the tool opens on Klein instead.
 *
 * Only ever a default: it never replaces a workflow the artist picked, and it
 * only moves off the old default, so a stored choice of anything else stays.
 *
 * Roadmap item E3, part 3. Pure: App.ts reads the inventory and applies it.
 */

export type StarterDefaultTool = "Text to Image" | "Image to Image";

export type StarterDefaultInput = {
  report: SetupRequirementsReport;
  tool: StarterDefaultTool;
  /** The tool's workflow right now. */
  current: string;
  /** What the tool opens on without the starter. */
  oldDefault: string;
  /** The artist picked a workflow for this tool themselves. */
  chosen: boolean;
};

/** The starter's preset for a tool, or null when the default should stay. */
export function pickStarterDefault(input: StarterDefaultInput): string | null {
  if (input.chosen || input.current !== input.oldDefault) {
    return null;
  }

  if (evaluateStarter(input.report).state !== "ready") {
    return null;
  }

  return STARTER_TOOLS.find((tool) => tool.toolLabel === input.tool)?.presetId ?? null;
}
