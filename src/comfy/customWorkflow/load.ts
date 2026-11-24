import { ComfyWorkflow } from "../types";
import { parseCustomWorkflowText } from "../customWorkflowValidation";
import {
  ConversionError,
  convertUiWorkflow,
  isActiveNodeMode,
  isFrontendOnlyNodeType,
  isUnconvertibleNodeType,
  LEGACY_GROUP_NODES_MESSAGE,
  ObjectInfo,
  UiNode,
  UiWorkflow,
  uiNodeTypes,
  unconvertibleNodeMessage
} from "./convert";
import { imageRoles } from "./targets";

/**
 * Pasted text to a runnable API graph, for the Workflow screen (v0.50 PR 4).
 *
 * An API export (File > Export (API)) is used as it is, with no request. An
 * editor save (File > Save, File > Export) is converted in the panel with
 * the ported converter (convert.ts), driven by this ComfyUI's own
 * `/object_info` entries for the classes the save uses. Check This Workflow
 * and Run Workflow both go through here, so the graph that is checked is the
 * graph that runs.
 *
 * What is refused, and when:
 * - Before any request: legacy group nodes, and active 3D, webcam or
 *   audio-recording nodes. The converter refuses them too, but only after
 *   it has their definitions; an artist should not wait on ComfyUI to hear
 *   that a file can never be read.
 * - After the definitions: every class this ComfyUI does not have, named
 *   with its node pack where the save records one. The converter stops at
 *   the first missing class something depends on; the artist needs the
 *   whole list to install once.
 *
 * Every string reaches the panel through textContent: plain text, no
 * backticks, no markdown, no double hyphens.
 */

export type LoadedCustomWorkflow = Readonly<{
  workflow: ComfyWorkflow;
  format: "api" | "ui";
  /** Load Image roles from the save's input labels (imageRoles); empty for an API export. */
  roles: Record<string, string>;
  /** What the conversion did that the artist should know: shown on the Inputs lines. */
  notes: readonly string[];
}>;

export type CustomWorkflowLoadResult =
  | Readonly<{ ok: true; loaded: LoadedCustomWorkflow }>
  | Readonly<{
      ok: false;
      reason: string;
      hint?: string;
      /** Classes this ComfyUI does not have, with their node pack where known. */
      missing?: readonly MissingNodeClass[];
    }>;

export type MissingNodeClass = Readonly<{ classType: string; pack: string | null }>;

export type CustomWorkflowLoadDeps = Readonly<{
  /** Throws when ComfyUI does not answer, with the panel's usual message. */
  checkOnline(): Promise<void>;
  /**
   * Raw `/object_info` entries for these classes, GET only. A class ComfyUI
   * does not know is left out. A failed request throws: it is not a missing
   * class.
   */
  getRawNodeDefinitions(classTypes: readonly string[]): Promise<ObjectInfo>;
}>;

/** Every node of the save, root graph and subgraph definitions alike. */
function allNodes(ui: UiWorkflow): UiNode[] {
  return [ui, ...(ui.definitions?.subgraphs ?? [])].flatMap((graph) => graph.nodes ?? []);
}

/**
 * Refusals that need no server: legacy group nodes, and an active node the
 * converter can never rebuild. Muted and bypassed ones are skipped, as the
 * converter skips them.
 */
export function precheckUiWorkflow(ui: UiWorkflow): string | null {
  if (ui.extra?.groupNodes && Object.keys(ui.extra.groupNodes).length) {
    return LEGACY_GROUP_NODES_MESSAGE;
  }

  const blocked = allNodes(ui).find((node) => isUnconvertibleNodeType(node.type) && isActiveNodeMode(node.mode));
  return blocked ? unconvertibleNodeMessage(blocked.type) : null;
}

/**
 * The node pack a save says a class comes from: `cnr_id` (the registry id,
 * such as comfyui-kjnodes) or `aux_id` (a GitHub owner/repo). Core nodes and
 * saves that record neither give null.
 */
export function nodePackOf(ui: UiWorkflow, classType: string): string | null {
  for (const node of allNodes(ui)) {
    if (node.type !== classType) continue;
    const props = node.properties ?? {};
    for (const key of ["cnr_id", "aux_id"]) {
      const value = props[key];
      if (typeof value === "string" && value.trim() && value !== "comfy-core") return value.trim();
    }
  }
  return null;
}

function describeMissing(missing: readonly MissingNodeClass[]): string {
  return missing.map((entry) => (entry.pack ? `${entry.classType} (from ${entry.pack})` : entry.classType)).join(", ");
}

/** The classes the converter needs definitions for: frontend-only types are never sent. */
export function classesToLookUp(ui: UiWorkflow): string[] {
  return uiNodeTypes(ui)
    .filter((type) => !isFrontendOnlyNodeType(type))
    .sort();
}

/** The line shown when a converted save left nodes out. */
export function describeSkipped(ui: UiWorkflow, skipped: readonly string[]): string | null {
  if (!skipped.length) return null;
  const names = describeMissing([...skipped].sort().map((classType) => ({ classType, pack: nodePackOf(ui, classType) })));
  return skipped.length === 1
    ? `Left out: ${names}. This ComfyUI does not have it, and the workflow was converted without it.`
    : `Left out: ${names}. This ComfyUI does not have them, and the workflow was converted without them.`;
}

/**
 * Parses the pasted text and, for an editor save, converts it. API exports
 * make no request; editor saves make GET requests only.
 */
export async function loadCustomWorkflowText(
  text: string,
  deps: CustomWorkflowLoadDeps,
  random: () => number = Math.random
): Promise<CustomWorkflowLoadResult> {
  const parsed = parseCustomWorkflowText(text);

  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason, hint: parsed.hint };
  }

  if (parsed.format === "api") {
    return { ok: true, loaded: { workflow: parsed.workflow, format: "api", roles: {}, notes: [] } };
  }

  const ui = parsed.ui;
  const refusal = precheckUiWorkflow(ui);
  if (refusal) {
    return { ok: false, reason: "OpenLayer cannot read that saved workflow.", hint: refusal };
  }

  await deps.checkOnline();
  const classTypes = classesToLookUp(ui);
  const defs = classTypes.length ? await deps.getRawNodeDefinitions(classTypes) : {};

  // Same guard as the Check button: an empty answer for a graph with nodes
  // is a server that stopped answering, not one that has none of them.
  if (classTypes.length > 0 && Object.keys(defs).length === 0) {
    await deps.checkOnline();
  }

  const missing = classTypes
    .filter((classType) => !defs[classType])
    .map((classType) => ({ classType, pack: nodePackOf(ui, classType) }));

  let converted: ReturnType<typeof convertUiWorkflow>;
  try {
    converted = convertUiWorkflow(ui, defs, random);
  } catch (error) {
    if (!(error instanceof ConversionError)) throw error;
    if (missing.length) {
      return {
        ok: false,
        reason: missing.length === 1 ? "That workflow needs a node this ComfyUI does not have." : "That workflow needs nodes this ComfyUI does not have.",
        hint: `Not installed: ${describeMissing(missing)}. Install the node packs that provide them (ComfyUI Manager can find missing nodes), restart ComfyUI, then check again.`,
        missing
      };
    }
    return { ok: false, reason: "OpenLayer could not read that saved workflow.", hint: error.message };
  }

  const notes = ["Read from a saved ComfyUI workflow and converted for this ComfyUI."];
  const skippedLine = describeSkipped(ui, converted.skipped);
  if (skippedLine) notes.push(skippedLine);

  return { ok: true, loaded: { workflow: converted.prompt, format: "ui", roles: imageRoles(ui), notes } };
}
