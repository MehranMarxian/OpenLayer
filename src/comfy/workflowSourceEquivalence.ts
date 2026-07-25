import { ComfyWorkflow } from "./types";

/**
 * Checks that a GUI-editable workflow (`src/workflows/source/*.workflow.json`)
 * still describes the same graph as the API workflow OpenLayer actually submits
 * (`src/workflows/api/*.json`).
 *
 * Nothing compared these before. `build-setup-pack.mjs` noticed a *missing*
 * source and `workflowFiles.test.ts` compares the API JSON against the preset
 * registry, but no check existed between the two workflow formats — so the
 * setup pack could, and did, advertise an "editable source" describing a
 * different graph from the one the plugin runs.
 *
 * ## What is compared, and what deliberately is not
 *
 * **Structure**: which node classes are present, how many of each, and how they
 * are wired together. That is the part where drift is a real defect — a node
 * added, removed, or rewired changes what the graph does.
 *
 * **Not values.** Widget values are compared by nothing here, on purpose.
 * OpenLayer injects prompts, seeds, dimensions, model names, steps, CFG and
 * denoise at submit time, so the numbers sitting in both files are placeholders
 * that were never required to agree; a vendor's demo graph legitimately ships
 * 9 steps where OpenLayer's preset default is 4. Comparing them would produce a
 * stream of false failures, and false failures are how a check gets switched
 * off. It would also require knowing each node class's widget order, which is
 * only discoverable from a running ComfyUI's `/object_info` — a dependency this
 * has no business acquiring to answer a structural question.
 *
 * ## Why node ids are ignored
 *
 * The two formats do not agree on ids and were never going to. ComfyUI assigns
 * ids as nodes are created, so a graph rebuilt in the editor gets fresh ones —
 * `upscale-basic` is hand-authored with ids 1-4 against the API's 9-12, while
 * `prompt-from-layer-florence2` is a real export whose ids match. Both are
 * legitimate. Everything below therefore compares *class-typed* nodes and
 * edges, never identities.
 */

/** GUI-only annotation nodes. They never reach an API export. */
const ANNOTATION_NODE_TYPES = new Set(["Note", "MarkdownNote"]);

/**
 * Nodes that rewrite topology rather than compute anything. A Reroute is a
 * visual waypoint that the API export collapses, so a graph containing one
 * cannot have its edges compared naively — the source would show
 * `A -> Reroute -> B` where the API shows `A -> B`. Their presence downgrades
 * the check to inventory-only rather than producing a false failure.
 */
const PASSTHROUGH_NODE_TYPES = new Set(["Reroute", "RerouteNode", "PrimitiveNode"]);

/**
 * litegraph node modes. 0 is "always"; a muted (2) or bypassed (4) node does not
 * execute and is absent from an API export, so it must be absent here too.
 *
 * The two are not equivalent beyond that. A muted node breaks the chain it sits
 * in, while a **bypassed** node passes its input straight through to its output,
 * so the API export shows the neighbours wired directly to each other. Dropping
 * a bypassed node and its links therefore invents a missing connection: the
 * Z-Image source bypasses a LoRA loader between UNETLoader and
 * ModelSamplingAuraFlow, and the first run of this check duly reported that edge
 * as absent when the graphs actually agree.
 *
 * Rather than reimplement litegraph's type-matching pass-through rules, a
 * bypassed node downgrades the comparison to inventory-only, the same as a
 * reroute. The alternative is a false difference, and false differences are how
 * a check gets ignored and then deleted.
 */
const MODE_ALWAYS = 0;
const MODE_BYPASS = 4;

type SourceNodeInput = {
  name?: string;
  link?: number | null;
};

export type SourceWorkflowNode = {
  id?: number;
  type?: string;
  mode?: number;
  inputs?: SourceNodeInput[];
};

/** `[linkId, originNodeId, originSlot, targetNodeId, targetSlot, dataType]` */
export type SourceWorkflowLink = [number, number, number, number, number, string?];

export type SourceWorkflowSubgraph = {
  id?: string;
  name?: string;
  nodes?: SourceWorkflowNode[];
};

export type SourceWorkflowGraph = {
  nodes?: SourceWorkflowNode[];
  links?: SourceWorkflowLink[];
  definitions?: {
    subgraphs?: SourceWorkflowSubgraph[];
  };
};

export type WorkflowEquivalenceReport = {
  equivalent: boolean;
  /** Every structural disagreement, each naming the class and the counts. */
  differences: string[];
  /** Why part of the comparison was skipped, when it was. */
  notes: string[];
};

function countByKey(keys: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function diffCounts(
  apiCounts: Map<string, number>,
  sourceCounts: Map<string, number>,
  describe: (key: string, apiCount: number, sourceCount: number) => string
): string[] {
  const differences: string[] = [];

  for (const key of [...new Set([...apiCounts.keys(), ...sourceCounts.keys()])].sort()) {
    const apiCount = apiCounts.get(key) ?? 0;
    const sourceCount = sourceCounts.get(key) ?? 0;

    if (apiCount !== sourceCount) {
      differences.push(describe(key, apiCount, sourceCount));
    }
  }

  return differences;
}

function collectApiNodes(workflow: ComfyWorkflow) {
  return Object.entries(workflow).map(([id, node]) => ({ id, classType: node.class_type, inputs: node.inputs }));
}

function collectApiEdges(workflow: ComfyWorkflow): string[] {
  const edges: string[] = [];

  for (const [, node] of Object.entries(workflow)) {
    for (const [inputName, value] of Object.entries(node.inputs ?? {})) {
      // A connected input is `[originNodeId, originSlot]`; anything else is a
      // literal widget value, which this does not look at.
      if (!Array.isArray(value) || value.length < 2) {
        continue;
      }

      const [originId, originSlot] = value as [string, number];
      const originClass = workflow[String(originId)]?.class_type ?? "<missing node>";
      edges.push(`${originClass}:${originSlot} -> ${node.class_type}.${inputName}`);
    }
  }

  return edges;
}

/**
 * Expands one level of ComfyUI subgraphs.
 *
 * A subgraph appears at the top level as a single node whose `type` is the
 * subgraph's UUID, with the real nodes living in `definitions.subgraphs`. The
 * API export flattens it, so a source using one would otherwise look almost
 * empty next to its API twin — `txt2img-z-image-turbo` is exactly this: three
 * notes, a SaveImage, and one subgraph holding the other nine nodes.
 */
function expandSubgraphs(graph: SourceWorkflowGraph): { nodes: SourceWorkflowNode[]; expanded: string[] } {
  const definitions = graph.definitions?.subgraphs ?? [];
  const byId = new Map(definitions.filter((entry) => entry.id).map((entry) => [entry.id as string, entry]));
  const nodes: SourceWorkflowNode[] = [];
  const expanded: string[] = [];

  for (const node of graph.nodes ?? []) {
    const definition = node.type ? byId.get(node.type) : undefined;

    if (!definition) {
      nodes.push(node);
      continue;
    }

    expanded.push(definition.name ?? (definition.id as string));
    nodes.push(...(definition.nodes ?? []));
  }

  return { nodes, expanded };
}

function isComparableNode(node: SourceWorkflowNode): boolean {
  const type = node.type ?? "";

  if (!type || ANNOTATION_NODE_TYPES.has(type)) {
    return false;
  }

  // A muted or bypassed node does not run, so the API export does not contain it.
  return (node.mode ?? MODE_ALWAYS) === MODE_ALWAYS;
}

function collectSourceEdges(nodes: SourceWorkflowNode[], links: SourceWorkflowLink[]): string[] {
  const byId = new Map(nodes.filter((node) => node.id !== undefined).map((node) => [node.id as number, node]));
  const edges: string[] = [];

  for (const link of links) {
    const [, originId, originSlot, targetId, targetSlot] = link;
    const origin = byId.get(originId);
    const target = byId.get(targetId);

    // A link touching a node that was filtered out (an annotation, or something
    // muted) has no counterpart in the API export and is not a difference.
    if (!origin || !target) {
      continue;
    }

    const inputName = target.inputs?.[targetSlot]?.name ?? `#${targetSlot}`;
    edges.push(`${origin.type}:${originSlot} -> ${target.type}.${inputName}`);
  }

  return edges;
}

/**
 * Compares an API workflow against its GUI-editable source.
 *
 * The report is deliberately verbose: a check that says only "these differ" is
 * one nobody can act on, so every difference names the node class and both
 * counts.
 */
export function compareWorkflowToSource(
  apiWorkflow: ComfyWorkflow,
  sourceGraph: SourceWorkflowGraph
): WorkflowEquivalenceReport {
  const notes: string[] = [];
  const { nodes: flattened, expanded } = expandSubgraphs(sourceGraph);

  if (expanded.length > 0) {
    notes.push(`expanded ${expanded.length} subgraph(s): ${expanded.join(", ")}`);
  }

  const comparableNodes = flattened.filter(isComparableNode);
  const apiNodes = collectApiNodes(apiWorkflow);

  const differences = diffCounts(
    countByKey(apiNodes.map((node) => node.classType)),
    countByKey(comparableNodes.map((node) => node.type as string)),
    (classType, apiCount, sourceCount) =>
      apiCount > sourceCount
        ? `node ${classType}: the API workflow has ${apiCount}, the source has ${sourceCount}`
        : `node ${classType}: the source has ${sourceCount}, the API workflow has ${apiCount}`
  );

  const hasPassthrough = comparableNodes.some((node) => PASSTHROUGH_NODE_TYPES.has(node.type ?? ""));
  const hasBypassed = flattened.some((node) => node.mode === MODE_BYPASS);

  if (hasPassthrough) {
    notes.push("connections not compared: the source contains reroute/primitive nodes the API export collapses");
  } else if (hasBypassed) {
    notes.push("connections not compared: the source contains bypassed nodes, which pass their input through to their output");
  } else if (expanded.length > 0) {
    // Links inside a subgraph are numbered in their own space and cross the
    // boundary through the subgraph's own input/output slots, so they cannot be
    // matched against a flattened API export without modelling that boundary.
    notes.push("connections not compared: the source uses subgraphs, whose links cross a boundary the API export flattens");
  } else {
    differences.push(
      ...diffCounts(
        countByKey(collectApiEdges(apiWorkflow)),
        countByKey(collectSourceEdges(comparableNodes, sourceGraph.links ?? [])),
        (edge, apiCount, sourceCount) =>
          `connection ${edge}: the API workflow has ${apiCount}, the source has ${sourceCount}`
      )
    );
  }

  return {
    equivalent: differences.length === 0,
    differences,
    notes
  };
}

/** One-line summary suitable for a build log or a test failure message. */
export function formatEquivalenceReport(label: string, report: WorkflowEquivalenceReport): string {
  if (report.equivalent) {
    return `${label}: source matches the API workflow${report.notes.length > 0 ? ` (${report.notes.join("; ")})` : ""}`;
  }

  const lines = [`${label}: source does NOT match the API workflow`];

  for (const difference of report.differences) {
    lines.push(`  - ${difference}`);
  }

  for (const note of report.notes) {
    lines.push(`  note: ${note}`);
  }

  return lines.join("\n");
}
