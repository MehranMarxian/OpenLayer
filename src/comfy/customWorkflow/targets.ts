/*
 * Ported from Geekatplay Photoshop Bridge, photoshop/workflow.js at commit da5c617
 * (https://github.com/GeekatplayStudio/ComfyUI-Photoshop), by Geekatplay Studio -
 * Vladimir Chopine (https://www.geekatplay.com).
 *
 * MIT License
 *
 * Copyright (c) 2026 Geekatplay Studio - Vladimir Chopine
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Where the artist's layer and prompt go in somebody else's API workflow.
 *
 * `customWorkflowValidation.ts` declined to map injections at all, because a
 * wrong guess runs and silently ignores what the artist typed. Geekatplay's
 * answer is a resolution ladder that only guesses when exactly one candidate
 * fits, asks when there are several, and always shows the outcome:
 *
 *   1. a node the workflow author marked (here: "OpenLayer" in its title);
 *   2. graph structure: the text that feeds a sampler's `positive` input (or a
 *      Guider's `conditioning`), keeping positive and negative apart through
 *      nodes that carry both, and every Load Image something reads;
 *   3. otherwise the artist chooses.
 *
 * What changed in the port, beyond types:
 * - The marker is "OpenLayer" in a node title. Geekatplay's own node classes
 *   and its "Photoshop" title rule are gone: OpenLayer ships no node pack, and
 *   the ladder must work on any graph.
 * - Images get the same ladder as the prompt. Geekatplay gives every Load Image
 *   its own source (active layer, next selected layer...), which moves to v0.51.
 *   In v0.50 one layer goes into one slot, so two or more unmarked slots mean
 *   the artist chooses (`imageAuto` is null) rather than slot 0 being filled
 *   blindly; the spike measured why (see tests/comfy/customWorkflow/).
 * - When text nodes exist but none feeds a sampler, the artist chooses.
 *   Geekatplay's rule returned an empty list there and the prompt went
 *   nowhere; the spike found two shipped graphs (SAM 3.1 select, SuperPrompt)
 *   where that happens.
 * - resolveTargets returns what it needs the artist to choose instead of
 *   throwing an artist-facing sentence; the panel owns the wording.
 * - Role ordering uses a small natural compare instead of
 *   `localeCompare(..., { numeric: true })`, so it does not depend on how much
 *   of Intl the UXP host implements.
 *
 * Pure functions over parsed JSON, like the rest of src/comfy.
 */

import { ComfyWorkflow, ComfyWorkflowNode } from "../types";
import { UiLinkObject, UiLinkTuple, UiNode, UiWorkflow } from "./convert";

/** A node whose title contains this is used without guessing. */
const MARKER = /openlayer/i;
const PLACEABLE = /\.(png|jpe?g|webp)$/i;
const TEXT_KEYS = ["text", "prompt", "value", "string"];
// Preview nodes that show the input next to the result; they do not name an image's role.
const PREVIEWS = new Set(["ImageCompare", "PreviewImage"]);

export type TargetCandidate = {
  id: string;
  key: string;
  /** "Title (#id)", for the Inputs summary. */
  label: string;
};

export type ImageSlot = TargetCandidate & {
  /** The input the image feeds (`pixels`, `image1`, `reference_image2`...). */
  role: string;
};

export type FoundTargets = {
  /** Every Load Image something reads: marked ones first, then in role order. */
  image: ImageSlot[];
  /** The slot that gets the layer when the artist has not chosen; null when there are several. */
  imageAuto: ImageSlot | null;
  prompt: {
    candidates: TargetCandidate[];
    /**
     * The nodes that get the prompt when the artist has not chosen: the marked
     * ones, otherwise the one text feeding a sampler's positive input. Null
     * when the artist has to choose: several feed a sampler, or text nodes
     * exist and none does. An empty list means the graph has no text input.
     */
    auto: TargetCandidate[] | null;
  };
};

export type TargetChoice = {
  /** Candidate id the artist picked for the prompt. */
  prompt?: string;
  /** Image slot id the artist picked for the layer. */
  image?: string;
  /**
   * The artist chose to send no layer: every image slot keeps the
   * workflow's own picture. Mehran's call for v0.50: even a graph with one
   * Load Image offers this, so it can run as it was exported.
   */
  keepImages?: boolean;
};

export type ResolvedImageSlot = ImageSlot & {
  /** "layer": the artist's selection or layer goes here. "keep": the workflow's own image stays. */
  source: "layer" | "keep";
};

export type ResolvedTargets =
  | { ok: true; image: ResolvedImageSlot[]; prompt: TargetCandidate[]; found: FoundTargets }
  | { ok: false; choose: "prompt"; candidates: TargetCandidate[]; found: FoundTargets }
  | { ok: false; choose: "image"; candidates: ImageSlot[]; found: FoundTargets };

function isLink(value: unknown): value is [string, number] {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "string";
}

function label(id: string, node: ComfyWorkflowNode): string {
  return `${node._meta?.title ?? node.class_type} (#${id})`;
}

function isMarked(node: ComfyWorkflowNode | undefined): boolean {
  return MARKER.test(node?._meta?.title ?? "");
}

/**
 * Natural order for role names: digit runs compare as numbers, so image2 sorts
 * before image10. Case-insensitive first, then exact, so the order is total.
 */
export function naturalCompare(a: string, b: string): number {
  const chunks = (s: string) => s.toLowerCase().match(/\d+|\D+/g) ?? [];
  const left = chunks(a);
  const right = chunks(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const x = left[i];
    const y = right[i];
    if (x === y) continue;
    const bothNumbers = /^\d/.test(x) && /^\d/.test(y);
    if (bothNumbers && Number(x) !== Number(y)) return Number(x) - Number(y);
    return x < y ? -1 : 1;
  }
  if (left.length !== right.length) return left.length - right.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Ids of the nodes that feed the given input, walking upstream. Nodes that pass positive and negative through keep the two apart. */
function upstream(api: ComfyWorkflow, id: string, key: string, seen: Set<string> = new Set()): Set<string> {
  const value = api[id]?.inputs[key];
  if (!isLink(value) || !api[value[0]]) return seen;
  const [origin, slot] = value;
  const mark = `${origin}:${slot}`;
  if (seen.has(mark)) return seen;
  seen.add(mark);
  seen.add(origin);
  const inputs = api[origin].inputs;
  const paired = "positive" in inputs && "negative" in inputs;
  for (const input of Object.keys(inputs)) {
    if (paired && ((slot === 0 && input === "negative") || (slot === 1 && input === "positive"))) continue;
    upstream(api, origin, input, seen);
  }
  return seen;
}

function textKey(node: ComfyWorkflowNode): string | undefined {
  return TEXT_KEYS.find((key) => typeof node.inputs[key] === "string");
}

/** The name of the first input the image output of node `id` feeds, e.g. "image_1" for an "images.image_1" key. */
function consumerKey(api: ComfyWorkflow, id: string): string | null {
  for (const node of Object.values(api)) {
    if (PREVIEWS.has(node.class_type)) continue;
    for (const [key, value] of Object.entries(node.inputs)) {
      if (isLink(value) && value[0] === id && value[1] === 0) return key.split(".").pop() ?? key;
    }
  }
  return null;
}

/**
 * Roles of the Load Image nodes of an editor save: the label of the input each
 * one feeds, which template authors name image1, reference_image2 and so on.
 * Returns { nodeId: role }. Root graph only, like Geekatplay's.
 */
export function imageRoles(ui: UiWorkflow): Record<string, string> {
  const links = new Map<number, Pick<UiLinkObject, "target_id" | "target_slot">>(
    (ui.links ?? []).map((l: UiLinkTuple | UiLinkObject) =>
      Array.isArray(l) ? [l[0], { target_id: l[3], target_slot: l[4] }] : [l.id, l]
    )
  );
  const nodes = new Map<UiNode["id"], UiNode>((ui.nodes ?? []).map((n) => [n.id, n]));
  const roles: Record<string, string> = {};
  for (const node of nodes.values()) {
    if (!/LoadImage/i.test(node.type)) continue;
    const targets = (node.outputs?.[0]?.links ?? [])
      .map((id) => links.get(id))
      .filter((link): link is Pick<UiLinkObject, "target_id" | "target_slot"> => {
        const target = link && nodes.get(link.target_id);
        return !!target && !PREVIEWS.has(target.type);
      });
    const inputs = targets
      .map((link) => nodes.get(link.target_id)?.inputs?.[link.target_slot])
      .filter((input): input is NonNullable<typeof input> => !!input);
    const input = inputs.find((i) => i.label) ?? inputs[0];
    if (input) roles[String(node.id)] = input.label ?? input.name;
  }
  return roles;
}

const byRole = (a: ImageSlot, b: ImageSlot) => naturalCompare(a.role, b.role) || naturalCompare(a.id, b.id);

/**
 * Where the layer and the prompt go in an API workflow. `roles` comes from
 * imageRoles() when the workflow arrived as an editor save; an API export has
 * no input labels, so its roles are the input names the images feed.
 */
export function findTargets(api: ComfyWorkflow, roles: Record<string, string> = {}): FoundTargets {
  const entries = Object.entries(api);

  // Load Image nodes nothing reads (a bypassed branch, say) get no slot.
  const slots: ImageSlot[] = [];
  for (const [id, node] of entries) {
    if (!/LoadImage/i.test(node.class_type) || typeof node.inputs.image !== "string") continue;
    const consumer = consumerKey(api, id);
    if (!consumer) continue;
    slots.push({ id, key: "image", label: label(id, node), role: roles[id] ?? consumer ?? "image" });
  }
  const markedImages = slots.filter((slot) => isMarked(api[slot.id])).sort(byRole);
  const image = [...markedImages, ...slots.filter((slot) => !markedImages.includes(slot)).sort(byRole)];
  const imageAuto = markedImages.length === 1 ? markedImages[0] : markedImages.length === 0 && image.length === 1 ? image[0] : null;

  const candidates: TargetCandidate[] = [];
  for (const [id, node] of entries) {
    const key = textKey(node);
    if (key && /text|prompt|string/i.test(node.class_type)) candidates.push({ id, key, label: label(id, node) });
  }
  let auto: TargetCandidate[] | null = candidates.filter((candidate) => isMarked(api[candidate.id]));
  if (!auto.length) {
    const positive = new Set<string>();
    for (const [id, node] of entries) {
      for (const key of ["positive", "conditioning"]) {
        if (key === "conditioning" && !/Guider/.test(node.class_type)) continue;
        upstream(api, id, key, positive);
      }
    }
    const fed = candidates.filter((candidate) => positive.has(candidate.id));
    // Geekatplay returns `fed` whenever it has at most one entry, so a graph
    // with text nodes but no sampler (SAM 3.1 select, the SuperPrompt
    // expander) got an empty list and the prompt was dropped without a word.
    // The spike counted that as silently wrong; the artist chooses instead.
    // An empty list now means the graph has no text input at all.
    auto = fed.length === 1 ? fed : fed.length === 0 && candidates.length === 0 ? [] : null;
  }
  return { image, imageAuto, prompt: { candidates, auto } };
}

/**
 * Applies the artist's saved choice to findTargets(). Returns the targets, or
 * what the artist still has to choose: the prompt node when several fit, then
 * the image slot when there are several and none is marked.
 */
export function resolveTargets(api: ComfyWorkflow, choice: TargetChoice = {}, roles?: Record<string, string>): ResolvedTargets {
  const found = findTargets(api, roles);

  const chosenPrompt = choice.prompt ? found.prompt.candidates.find((c) => c.id === choice.prompt) : undefined;
  const prompt = chosenPrompt ? [chosenPrompt] : found.prompt.auto;
  if (!prompt) return { ok: false, choose: "prompt", candidates: found.prompt.candidates, found };

  const chosenImage = choice.image ? found.image.find((slot) => slot.id === choice.image) : undefined;
  const layerSlot = choice.keepImages ? null : chosenImage ?? found.imageAuto;
  if (found.image.length && !layerSlot && !choice.keepImages) return { ok: false, choose: "image", candidates: found.image, found };

  const image = found.image.map((slot): ResolvedImageSlot => ({ ...slot, source: slot === layerSlot ? "layer" : "keep" }));
  return { ok: true, image, prompt, found };
}

/**
 * Width and height with the shape of `size` and about `area` pixels, in
 * multiples of 16: a generated image takes the selection's or canvas's shape
 * and keeps the workflow's pixel count.
 */
export function fitSize(size: { width: number; height: number }, area: number): { width: number; height: number } {
  const scale = Math.sqrt(area / (size.width * size.height));
  const snap = (v: number) => Math.max(16, Math.round((v * scale) / 16) * 16);
  return { width: snap(size.width), height: snap(size.height) };
}

export type HistoryImage = { filename: string; subfolder?: string; type?: string };

export type HistoryEntry = {
  outputs?: Record<string, { images?: HistoryImage[] } | undefined>;
};

export type ResultChoice = {
  /** The output node whose first image is imported. */
  nodeId: string;
  tier: "saved" | "preview";
  /** Placeable images that node returned; only the first is imported. */
  imageCount: number;
  /** Other nodes in the same tier that also returned an image. */
  others: string[];
  /** Nodes left out because they only show the workflow's own input image. */
  skippedInputPreviews: string[];
};

/** True for a node whose every linked input comes straight from an image loader: a before view, not a result. */
function showsOnlyAnInput(workflow: ComfyWorkflow, nodeId: string): boolean {
  const links = Object.values(workflow[nodeId]?.inputs ?? {}).filter(isLink);
  return links.length > 0 && links.every(([origin]) => /LoadImage/i.test(workflow[origin]?.class_type ?? ""));
}

/**
 * OpenLayer addition. Which output node to import from: saved images first,
 * previews last, as resultImages() orders them, and never a node that only
 * shows the input. The stock OneReward template is why: its SaveImage is
 * bypassed and one of its two previews is of the input image, so "first
 * preview" would be the artist's own picture coming back.
 *
 * History lists outputs by node id (JavaScript orders integer keys
 * ascending), not by execution order, so with several candidates the lowest
 * id wins. `others` and `imageCount` let the panel say so. Null when nothing
 * placeable is left.
 */
export function chooseResultNode(workflow: ComfyWorkflow, historyEntry: HistoryEntry): ResultChoice | null {
  const saved: Array<{ nodeId: string; count: number }> = [];
  const previews: Array<{ nodeId: string; count: number }> = [];
  const skippedInputPreviews: string[] = [];
  for (const [nodeId, output] of Object.entries(historyEntry.outputs ?? {})) {
    const images = (output?.images ?? []).filter((image) => PLACEABLE.test(image.filename));
    if (!images.length) continue;
    if (showsOnlyAnInput(workflow, nodeId)) {
      skippedInputPreviews.push(nodeId);
      continue;
    }
    (images.some((image) => image.type === "output") ? saved : previews).push({ nodeId, count: images.length });
  }
  const tier = saved.length ? "saved" : "preview";
  const pool = saved.length ? saved : previews;
  if (!pool.length) return null;
  return {
    nodeId: pool[0].nodeId,
    tier,
    imageCount: pool[0].count,
    others: pool.slice(1).map((entry) => entry.nodeId),
    skippedInputPreviews
  };
}

/** Images to place from a finished /history entry: saved images, else previews. */
export function resultImages(historyEntry: HistoryEntry): HistoryImage[] {
  const saved: HistoryImage[] = [];
  const previews: HistoryImage[] = [];
  for (const output of Object.values(historyEntry.outputs ?? {})) {
    for (const image of output?.images ?? []) {
      if (!PLACEABLE.test(image.filename)) continue;
      if (image.type === "output") saved.push(image);
      else previews.push(image);
    }
  }
  return saved.length ? saved : previews;
}
