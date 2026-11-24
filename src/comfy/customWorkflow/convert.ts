/*
 * Ported from Geekatplay Photoshop Bridge, photoshop/convert.js at commit da5c617
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
 * Turns a workflow saved with Workflow > Save (the editor graph) into the API
 * format `/prompt` accepts, following what the ComfyUI frontend does when it
 * queues: widget values come from `widgets_values` laid out the way the
 * frontend builds widgets, links are resolved through reroutes, primitives,
 * bypassed nodes and subgraphs, and muted nodes drop out. `defs` is the raw
 * `/object_info` of the server the graph will run on.
 *
 * OpenLayer's port is a line-for-line translation to strict TypeScript. The
 * logic is Geekatplay's; what changed is types, and two places where the
 * JavaScript would have thrown a TypeError on an impossible lookup now throw a
 * ConversionError that says so. It is pure (no fetch, no host calls), so the
 * spike tests in tests/comfy/customWorkflow/ exercise every branch without a
 * server. The Workflow screen calls it through customWorkflow/load.ts (v0.50
 * PR 4), which also refuses group nodes and 3D or webcam nodes before any
 * request, and names every missing class.
 *
 * Mirrors frontend 1.53. The spike checks it against a fresh 1.57.6 export too;
 * a future frontend can still change the widget layout under it, which is why
 * the object_info drift check should cover these fixtures as well.
 */

import { ComfyWorkflow, ComfyWorkflowNode } from "../types";

// ---------------------------------------------------------------------------
// Shapes. Both formats are parsed JSON from somebody else's ComfyUI, so every
// field is optional and the code reads them the way the frontend does.
// ---------------------------------------------------------------------------

export type UiNodeId = number | string;

export type UiNodeInput = {
  name: string;
  type?: string;
  link?: number | null;
  label?: string;
  widget?: { name: string };
};

export type UiNodeOutput = {
  name?: string;
  type?: string;
  links?: number[] | null;
  widget?: { name: string };
};

/** `[innerNodeId, widgetName, ...]` per widget a subgraph node shows. */
export type UiProxyWidget = [UiNodeId, string, ...unknown[]];

export type UiNode = {
  id: UiNodeId;
  type: string;
  mode?: number;
  title?: string;
  inputs?: UiNodeInput[];
  outputs?: UiNodeOutput[];
  /** Positional in core nodes; some custom node frontends save an object keyed by name. */
  widgets_values?: unknown[] | Record<string, unknown>;
  properties?: {
    proxyWidgets?: UiProxyWidget[] | string;
    [key: string]: unknown;
  };
};

/** `[linkId, originId, originSlot, targetId, targetSlot, type]`, the root graph's form. */
export type UiLinkTuple = [number, UiNodeId, number, UiNodeId, number, string?];

/** The object form subgraph definitions use. */
export type UiLinkObject = {
  id: number;
  origin_id: UiNodeId;
  origin_slot: number;
  target_id: UiNodeId;
  target_slot: number;
  type?: string;
};

export type UiSubgraphSlot = {
  name: string;
  type?: string;
  label?: string;
  linkIds?: number[];
};

export type UiGraphData = {
  id?: string;
  name?: string;
  nodes?: UiNode[];
  links?: Array<UiLinkTuple | UiLinkObject>;
  inputs?: UiSubgraphSlot[];
  outputs?: UiSubgraphSlot[];
  definitions?: { subgraphs?: UiSubgraph[] };
};

export type UiSubgraph = UiGraphData & { id: string };

export type UiWorkflow = UiGraphData & {
  nodes: UiNode[];
  last_node_id?: number;
  state?: { lastNodeId?: number };
  extra?: { groupNodes?: Record<string, unknown>; [key: string]: unknown };
};

export type ObjectInfoInputOptions = {
  default?: unknown;
  forceInput?: boolean;
  widgetType?: string;
  control_after_generate?: unknown;
  multi_select?: unknown;
  remote?: { refresh_button?: unknown };
  component?: string;
  image_upload?: unknown;
  animated_image_upload?: unknown;
  video_upload?: unknown;
  audio_upload?: unknown;
  dynamicPrompts?: unknown;
  /** A new-style combo's choices, or a dynamic combo's `{ key, inputs }` entries. */
  options?: unknown[];
  [key: string]: unknown;
};

/** `[socketType or choice list, options]`, as `/object_info` returns it. */
export type ObjectInfoInputSpec = [unknown, ObjectInfoInputOptions?];

export type ObjectInfoInputs = {
  required?: Record<string, ObjectInfoInputSpec>;
  optional?: Record<string, ObjectInfoInputSpec>;
  [key: string]: unknown;
};

export type ObjectInfoNodeDef = {
  input?: ObjectInfoInputs;
  input_order?: { required?: string[]; optional?: string[]; [key: string]: unknown };
  display_name?: string;
  [key: string]: unknown;
};

export type ObjectInfo = Record<string, ObjectInfoNodeDef | undefined>;

/** An input the workflow author put forward: a promoted subgraph widget or a titled primitive. */
export type ExposedInput = {
  id: string;
  key: string;
  label: string;
  group: string;
};

export type ConvertResult = {
  prompt: ComfyWorkflow;
  /** Classes left out because this server does not know them and nothing depends on them. */
  skipped: string[];
  exposed: ExposedInput[];
};

// ---------------------------------------------------------------------------

const SUBGRAPH_INPUT = -10;
const MUTED = 2;
const BYPASSED = 4;

// Input types the frontend turns into widgets (ComfyWidgets plus core extension widgets).
const WIDGET_TYPES = new Set([
  "INT", "FLOAT", "BOOLEAN", "STRING", "COMBO", "MARKDOWN", "IMAGEUPLOAD", "COLOR", "IMAGECOMPARE",
  "BOUNDING_BOX", "CHART", "GALLERIA", "PAINTER", "COMPOSITOR", "TEXTAREA", "CURVE", "RANGE", "VIDEO_EDIT",
  "RESOLUTION_PREVIEW", "BOUNDING_BOXES", "COLORS", "COMFY_DYNAMICCOMBO_V3"
]);

// Core nodes whose frontend adds widgets that cannot be derived from their definition.
const UNCONVERTIBLE = new Set([
  "Load3D", "Load3DAdvanced", "Preview3DAdvanced", "Save3DAdvanced", "PreviewGaussianSplat", "PreviewPointCloud",
  "SaveGaussianSplat", "SavePointCloud", "WebcamCapture", "RecordAudio"
]);

// Frontend-only nodes that are never part of a prompt, so leaving them out is not worth reporting.
const FRONTEND_ONLY = new Set(["Note", "MarkdownNote", "Reroute", "PrimitiveNode", "SetNode", "GetNode"]);

// OpenLayer: the refusals below are also checked before any request
// (src/comfy/customWorkflow/load.ts), so their wording lives here, once.
// Geekatplay's said "register a Workflow > Export (API) file", which is
// their panel's verb and ComfyUI's old menu name.

/** Why a saved workflow with legacy group nodes is refused. */
export const LEGACY_GROUP_NODES_MESSAGE =
  "This workflow uses legacy group nodes, which OpenLayer cannot read from a saved workflow. In ComfyUI, convert them to subgraphs and save again, or paste a File > Export (API) file instead.";

/** Why a saved workflow with a 3D, webcam or audio-recording node is refused. */
export function unconvertibleNodeMessage(type: string): string {
  return `${type} cannot be read from a saved workflow, because ComfyUI's editor adds settings to it that the file does not hold. Paste a File > Export (API) file instead.`;
}

/** Core nodes whose editor widgets cannot be rebuilt from /object_info (3D, webcam, audio recording). */
export function isUnconvertibleNodeType(type: string): boolean {
  return UNCONVERTIBLE.has(type);
}

/** Notes, reroutes, primitives and Set/Get nodes: never sent to ComfyUI, so never looked up. */
export function isFrontendOnlyNodeType(type: string): boolean {
  return FRONTEND_ONLY.has(type);
}

/**
 * An unknown node the converter may pass through: a wildcard ("*") input or
 * output, as every reroute has, or "Reroute" in its type. Anything else
 * unknown that the graph depends on is a missing node.
 */
function isRerouteLike(node: UiNode): boolean {
  const wildcard = (type: string | undefined) => type === "*" || type === "";
  return /reroute/i.test(node.type) || wildcard(node.inputs?.[0]?.type) || wildcard(node.outputs?.[0]?.type);
}

/** False for muted (never runs) and bypassed (passes its input through) nodes. */
export function isActiveNodeMode(mode: number | undefined): boolean {
  return mode !== MUTED && mode !== BYPASSED;
}

const PRIMITIVES = new Set(["PrimitiveInt", "PrimitiveFloat", "PrimitiveBoolean", "PrimitiveString", "PrimitiveStringMultiline"]);

/**
 * `code` and `classType` are OpenLayer additions: the panel names every
 * missing class only when the conversion really stopped on one, and keeps
 * other failures (a circular link, a Get node with no Set) as they are.
 */
export class ConversionError extends Error {
  constructor(
    message: string,
    readonly code: "missing-node" | "other" = "other",
    readonly classType?: string
  ) {
    super(message);
    this.name = "ConversionError";
  }
}

function isWidgetType(type: unknown): boolean {
  return Array.isArray(type) || (typeof type === "string" && WIDGET_TYPES.has(type));
}

function validConnection(first: unknown, second: unknown): boolean {
  let a = first === "" || first === "*" ? 0 : first;
  let b = second === "" || second === "*" ? 0 : second;
  if (!a || !b || a === b) return true;
  a = String(a).toLowerCase();
  b = String(b).toLowerCase();
  const left = a as string;
  const right = b as string;
  if (!left.includes(",") && !right.includes(",")) return left === right;
  return left.split(",").some((x) => right.split(",").some((y) => validConnection(x, y)));
}

/** Same as the frontend's processDynamicPrompt: strips comments and picks one option of each {a|b}. */
export function processDynamicPrompt(input: string, random: () => number): string {
  const text = input.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  let i = 0;
  const escape = () => "\\" + text[i++];
  const choice = (): string => {
    const options: string[] = [];
    let current = "";
    let depth = 0;
    while (i < text.length) {
      const c = text[i++];
      if (c === "\\") {
        current += escape();
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        if (!depth) break;
        depth--;
      } else if (c === "|" && !depth) {
        options.push(current);
        current = "";
        continue;
      }
      current += c;
    }
    options.push(current);
    return processDynamicPrompt(options[Math.floor(random() * options.length)], random);
  };
  let out = "";
  while (i < text.length) {
    const c = text[i++];
    out += c === "\\" ? escape() : c === "{" ? choice() : c;
  }
  return out.replace(/\\([{}|])/g, "$1");
}

export type Widget = {
  name: string;
  type: string;
  opts: ObjectInfoInputOptions;
  options?: unknown[];
};

type DynamicComboOption = { key: unknown; inputs?: ObjectInfoInputs };

function specEntry(specs: Record<string, ObjectInfoInputSpec>, key: string): [unknown, ObjectInfoInputOptions] {
  const spec = specs[key];
  return [spec?.[0], spec?.[1] ?? {}];
}

/**
 * The node's widgets in frontend order. Entries with a widget are sent to the
 * API; null entries only take a widgets_values slot (control_after_generate,
 * control_filter_list, upload buttons). A dynamic combo is followed by the
 * widgets of its selected option, so the layout depends on the saved values:
 * saved(name, index) returns one, or undefined.
 */
export function widgetLayout(def: ObjectInfoNodeDef, saved: (name: string, index: number) => unknown): Array<Widget | null> {
  const layout: Array<Widget | null> = [];
  let upload = false;
  const walk = (inputs: ObjectInfoInputs | undefined, order: ObjectInfoNodeDef["input_order"] | null, prefix: string) => {
    for (const group of ["required", "optional"] as const) {
      const specs = inputs?.[group] ?? {};
      for (const key of order?.[group] ?? Object.keys(specs)) {
        const [socketType, opts] = specEntry(specs, key);
        const type = opts.widgetType ?? socketType;
        const name = prefix + key;
        if (opts.forceInput || !isWidgetType(type)) continue;
        if (type === "COMFY_DYNAMICCOMBO_V3") {
          const entries = (opts.options ?? []) as DynamicComboOption[];
          const keys = entries.map((o) => o.key);
          layout.push({ name, type: "COMBO", opts: {}, options: keys });
          const value = saved(name, layout.length - 1) ?? keys[0];
          const chosen = entries.find((o) => o.key === value);
          if (chosen) walk(chosen.inputs, null, `${name}.`);
          continue;
        }
        if (type === "RESOLUTION_PREVIEW") {
          layout.push(null);
          continue;
        }
        const combo = Array.isArray(type) || type === "COMBO";
        layout.push({ name, type: combo ? "COMBO" : String(type), opts, options: Array.isArray(type) ? type : opts.options });
        if (opts.remote?.refresh_button) layout.push(null, null); // auto-refresh toggle, refresh button
        const control = type === "INT" ? opts.control_after_generate ?? ["seed", "noise_seed"].includes(name) : opts.control_after_generate;
        if (control) {
          layout.push(null);
          if (combo && !opts.multi_select) layout.push(null);
        }
        if (opts.component === "ImageCrop") layout.push(null, null, null, null); // x, y, width, height
        if (combo && (opts.image_upload || opts.animated_image_upload || opts.video_upload || opts.audio_upload)) upload = true;
      }
    }
  };
  walk(def.input, def.input_order, "");
  if (upload) layout.push(null); // the upload button comes after all other widgets
  return layout;
}

/** The frontend's migrateWidgetsValues: very old saves kept a widgets_values slot for forceInput inputs. */
function migrateValues(def: ObjectInfoNodeDef | undefined, values: unknown[]): unknown[] {
  const flags: boolean[] = [];
  for (const group of ["required", "optional"] as const) {
    const specs = def?.input?.[group] ?? {};
    for (const key of def?.input_order?.[group] ?? Object.keys(specs)) {
      const [type, opts] = specEntry(specs, key);
      if (!opts.forceInput && !isWidgetType(type)) continue;
      flags.push(!!opts.forceInput);
      if (opts.control_after_generate) flags.push(false);
    }
  }
  return flags.length === values.length && flags.some(Boolean) ? values.filter((_, i) => !flags[i]) : values;
}

function defaultValue(widget: Widget): unknown {
  if (widget.opts.default !== undefined) return widget.opts.default;
  if (widget.type === "COMBO") return widget.options?.[0];
  const defaults: Record<string, unknown> = { INT: 0, FLOAT: 0, BOOLEAN: false, STRING: "" };
  return defaults[widget.type];
}

function apiValue(widget: Widget, value: unknown): unknown {
  if (widget.type === "IMAGECOMPARE") return { __value__: ["", ""] }; // preview-only; the frontend always sends this
  if (widget.type === "CURVE" && value != null) return { __type__: "CURVE", __value__: value };
  return Array.isArray(value) ? { __value__: value } : value;
}

function flattenSubgraphs(list: UiSubgraph[]): UiSubgraph[] {
  return list.flatMap((sub) => [sub, ...flattenSubgraphs(sub.definitions?.subgraphs ?? [])]);
}

function asLinkObject(link: UiLinkTuple | UiLinkObject): UiLinkObject {
  return Array.isArray(link)
    ? { id: link[0], origin_id: link[1], origin_slot: link[2], target_id: link[3], target_slot: link[4], type: link[5] }
    : link;
}

/** [[innerNodeId, widgetName], ...] of the inner widgets shown on a subgraph node, if saved that way. */
function proxyWidgets(node: UiNode): UiProxyWidget[] | undefined {
  const proxies = node.properties?.proxyWidgets;
  return typeof proxies === "string" ? (JSON.parse(proxies) as UiProxyWidget[]) : proxies;
}

/**
 * The frontend keeps node ids unique across the workflow: an inner node whose
 * id is already taken (by a root node or an earlier subgraph) gets the next free
 * id after last_node_id. Execution ids are built from these ids, so do the same.
 */
function renumberSubgraphNodes(ui: UiWorkflow, subgraphs: UiSubgraph[]): void {
  const used = new Set(ui.nodes.map((n) => String(n.id)));
  let last = Number(ui.state?.lastNodeId ?? ui.last_node_id ?? 0);
  const remaps = new Map<string, Map<string, number>>();
  for (const sub of subgraphs) {
    const remap = new Map<string, number>();
    for (const node of sub.nodes ?? []) {
      const id = String(node.id);
      if (used.has(id)) {
        do last++;
        while (used.has(String(last)));
        remap.set(id, last);
        node.id = last;
        used.add(String(last));
      } else {
        used.add(id);
        if (Number.isInteger(Number(id))) last = Math.max(last, Number(id));
      }
    }
    if (!remap.size) continue;
    remaps.set(sub.id, remap);
    for (const raw of sub.links ?? []) {
      // Subgraph definitions save links as objects; a tuple here would be a
      // malformed save, and the frontend would not renumber it either.
      if (Array.isArray(raw)) continue;
      raw.origin_id = remap.get(String(raw.origin_id)) ?? raw.origin_id;
      raw.target_id = remap.get(String(raw.target_id)) ?? raw.target_id;
    }
  }
  for (const node of [...ui.nodes, ...subgraphs.flatMap((s) => s.nodes ?? [])]) {
    const remap = remaps.get(node.type);
    const proxies = proxyWidgets(node);
    if (remap && proxies && node.properties) {
      node.properties.proxyWidgets = proxies.map(([id, ...rest]) => [String(remap.get(String(id)) ?? id), ...rest] as UiProxyWidget);
    }
  }
}

type Graph = {
  data: UiGraphData;
  links: Map<number, UiLinkObject>;
  /** "node:slot" -> first link ending there */
  linksByTarget: Map<string, UiLinkObject>;
  nodes: Map<UiNodeId, UiNode>;
};

type Dto = {
  id: string;
  node: UiNode;
  graph: Graph;
  path: UiNodeId[];
  host: Dto | null;
  subgraph?: Graph;
};

type Resolved = { id: string; slot: number } | { widgetValue: unknown };

class Converter {
  private readonly subgraphs: Map<string, Graph>;
  private readonly root: Graph;
  /** node -> { widgetName: value } set by PrimitiveNodes */
  private readonly overrides = new Map<UiNode, Record<string, unknown>>();
  private readonly dtos = new Map<string, Dto>();
  readonly skipped = new Set<string>();

  constructor(
    source: UiWorkflow,
    private readonly defs: ObjectInfo,
    private readonly random: () => number
  ) {
    const ui = JSON.parse(JSON.stringify(source)) as UiWorkflow;
    const subgraphs = flattenSubgraphs(ui.definitions?.subgraphs ?? []);
    renumberSubgraphNodes(ui, subgraphs);
    this.subgraphs = new Map(subgraphs.map((sub) => [sub.id, this.graph(sub)]));
    this.root = this.graph(ui);
  }

  private graph(data: UiGraphData): Graph {
    const links = new Map<number, UiLinkObject>();
    const linksByTarget = new Map<string, UiLinkObject>();
    for (const raw of data.links ?? []) {
      const link = asLinkObject(raw);
      links.set(link.id, link);
      const target = `${link.target_id}:${link.target_slot}`;
      if (!linksByTarget.has(target)) linksByTarget.set(target, link);
    }
    return { data, links, linksByTarget, nodes: new Map((data.nodes ?? []).map((n) => [n.id, n])) };
  }

  /** The link into an input. Like the frontend on load, a reference to a link ending at another node is replaced by the link ending at this slot. */
  private inputLink(dto: Dto, slot: number): UiLinkObject | undefined {
    const id = dto.node.inputs?.[slot]?.link;
    const link = id == null ? undefined : dto.graph.links.get(id);
    if (link && String(link.target_id) === String(dto.node.id)) return link;
    return dto.graph.linksByTarget.get(`${dto.node.id}:${slot}`);
  }

  private isSubgraph(node: UiNode): boolean {
    return this.subgraphs.has(node.type);
  }

  private dtoAt(path: UiNodeId[]): Dto {
    const dto = this.dtos.get(path.join(":"));
    if (!dto) throw new ConversionError(`Node ${path.join(":")} is linked but could not be found in the workflow.`);
    return dto;
  }

  private addNodes(graph: Graph, path: UiNodeId[], host: Dto | null): void {
    for (const node of graph.nodes.values()) {
      const dto: Dto = { id: [...path, node.id].join(":"), node, graph, path, host };
      this.dtos.set(dto.id, dto);
      // Like the frontend, only root-level muted or bypassed subgraphs leave their nodes out.
      if (this.isSubgraph(node) && (path.length || (node.mode !== MUTED && node.mode !== BYPASSED))) {
        const subgraph = this.subgraphs.get(node.type) as Graph;
        dto.subgraph = subgraph;
        this.addNodes(subgraph, [...path, node.id], dto);
      }
    }
  }

  private applyPrimitives(graph: Graph): void {
    for (const node of graph.nodes.values()) {
      if (node.type !== "PrimitiveNode") continue;
      for (const linkId of node.outputs?.[0]?.links ?? []) {
        const link = graph.links.get(linkId);
        const target = link && graph.nodes.get(link.target_id);
        const name = target?.inputs?.find((input) => input.link === linkId)?.widget?.name;
        if (!target || !name) continue;
        const overrides = this.overrides.get(target) ?? {};
        this.overrides.set(target, overrides);
        overrides[name] = Array.isArray(node.widgets_values) ? node.widgets_values[0] : undefined;
      }
    }
  }

  private def(dto: Dto): ObjectInfoNodeDef {
    const def = this.defs[dto.node.type];
    if (!def) {
      throw new ConversionError(
        `Node "${dto.node.title ?? dto.node.type}" (${dto.node.type}) is not installed on this ComfyUI.`,
        "missing-node",
        dto.node.type
      );
    }
    return def;
  }

  /** [[widget, value], ...] for the widgets sent to the API, as the frontend holds them after loading. */
  widgetValues(node: UiNode): Array<[Widget, unknown]> {
    const def = this.defs[node.type] ?? {};
    // widgets_values is positional; some custom node frontends save an object keyed by name.
    // (widgets_values_named is ignored like the frontend does by default; it can be stale.)
    const stored = node.widgets_values;
    const positional = Array.isArray(stored) ? migrateValues(def, stored) : null;
    const saved = (name: string, i: number): unknown =>
      positional ? positional[i] : stored && !Array.isArray(stored) ? stored[name] : undefined;
    const overrides = this.overrides.get(node) ?? {};
    return widgetLayout(def, saved).flatMap((widget, i): Array<[Widget, unknown]> => {
      if (!widget) return [];
      let value = saved(widget.name, i);
      if (value === undefined) value = defaultValue(widget);
      if (widget.name in overrides) value = overrides[widget.name];
      if (value == null && widget.type === "COMBO") value = widget.options?.[0];
      return [[widget, value]];
    });
  }

  private widgetInputs(dto: Dto): Record<string, unknown> {
    this.def(dto);
    if (UNCONVERTIBLE.has(dto.node.type)) {
      throw new ConversionError(unconvertibleNodeMessage(dto.node.type));
    }
    const inputs: Record<string, unknown> = {};
    for (const [widget, value] of this.widgetValues(dto.node)) {
      inputs[widget.name] =
        widget.type === "STRING" && widget.opts.dynamicPrompts === true && typeof value === "string"
          ? processDynamicPrompt(value, this.random)
          : apiValue(widget, value);
    }
    const saved = dto.node.widgets_values;
    if (dto.node.type === "CustomCombo" && Array.isArray(saved)) {
      // The frontend adds the selected index and the user's options after the combo; the node reads them.
      inputs.index = saved[1];
      saved.slice(2).forEach((option, i) => (inputs[`option${i + 1}`] = option));
    }
    return inputs;
  }

  private resolveInput(dto: Dto, slot: number, visited: Set<string>, type?: string): Resolved | undefined {
    const key = `${dto.id}[I]${slot}`;
    if (visited.has(key)) throw new ConversionError(`Circular link at node ${dto.id}.`);
    visited.add(key);
    const input = dto.node.inputs?.[slot];
    const link = input && this.inputLink(dto, slot);
    if (!input || !link) return undefined;

    if (dto.host && link.origin_id === SUBGRAPH_INPUT) {
      const host = dto.host;
      const subInput = host.subgraph?.data.inputs?.[link.origin_slot];
      const hostSlot = host.node.inputs?.findIndex((i) => i.name === subInput?.name) ?? -1;
      if (hostSlot !== -1 && this.inputLink(host, hostSlot)) return this.resolveInput(host, hostSlot, visited);
      return this.promotedValue(host, link.origin_slot);
    }

    const origin = dto.graph.nodes.get(link.origin_id);
    if (!origin) return undefined;
    return this.resolveOutput(this.dtoAt([...dto.path, origin.id]), link.origin_slot, type ?? input.type, visited);
  }

  /** Value of a subgraph input that is shown as a widget on the subgraph node and not linked outside. */
  private promotedValue(host: Dto, inputIndex: number): Resolved | undefined {
    const sub = host.subgraph as Graph;
    const proxies = proxyWidgets(host.node);
    if (proxies) {
      // OpenLayer addition, not in Geekatplay's convert.js. Some saves (the
      // bundled txt2img-z-image-turbo source, frontend 1.38) promote a
      // subgraph *input* as ["-1", inputName]. Its value sits on the subgraph
      // node, at that entry's index in widgets_values, and frontend 1.57.6
      // queues that value, not the inner node's copy: checked on 2026-11-24
      // with app.graphToPrompt() on a save whose two copies differ
      // (tests/fixtures/customWorkflow/frontend-1.57.6/z-image-proxy-host-edited.api.json).
      // Without this branch the inner, possibly stale, copy was sent.
      const subInput = sub.data.inputs?.[inputIndex];
      const index = subInput ? proxies.findIndex(([id, widget]) => String(id) === "-1" && widget === subInput.name) : -1;
      const values = host.node.widgets_values;
      if (index !== -1 && Array.isArray(values) && index < values.length && values[index] != null) {
        return { widgetValue: values[index] };
      }
      // The promoted widget is an inner widget fed by this input; its value is sent as is.
      for (const link of sub.links.values()) {
        if (link.origin_id !== SUBGRAPH_INPUT || link.origin_slot !== inputIndex) continue;
        const target = sub.nodes.get(link.target_id);
        const name = target?.inputs?.find((i) => i.link === link.id)?.widget?.name;
        if (!target || !name || !this.defs[target.type]) continue;
        if (!proxies.some(([id, widget]) => String(id) === String(target.id) && widget === name)) continue;
        const entry = this.widgetValues(target).find(([widget]) => widget.name === name);
        if (entry) return { widgetValue: entry[1] };
      }
      return undefined;
    }
    // Older saves keep promoted widget values on the subgraph node, one per widget-typed input.
    const values = host.node.widgets_values;
    if (!Array.isArray(values) || !values.length) return undefined;
    const subInputs = sub.data.inputs ?? [];
    const promoted = subInputs.filter((i) => isWidgetType(i.type));
    const index = promoted.indexOf(subInputs[inputIndex]);
    return index === -1 || index >= values.length ? undefined : { widgetValue: values[index] };
  }

  private resolveOutput(dto: Dto, slot: number, type: string | undefined, visited: Set<string>): Resolved | undefined {
    const key = `${dto.id}[O]${slot}`;
    if (visited.has(key)) throw new ConversionError(`Circular link at node ${dto.id}.`);
    visited.add(key);
    const { node } = dto;
    if (node.mode === MUTED) return undefined;
    if (node.mode === BYPASSED) {
      const index = this.bypassSlot(node, slot, type);
      return index === -1 ? undefined : this.resolveInput(dto, index, visited);
    }
    if (this.isSubgraph(node)) {
      const sub = dto.subgraph as Graph;
      const linkId = sub.data.outputs?.[slot]?.linkIds?.[0];
      const link = linkId === undefined ? undefined : sub.links.get(linkId);
      if (!link) return undefined;
      const inner = this.dtos.get([...dto.path, node.id, link.origin_id].join(":"));
      if (!inner) throw new ConversionError(`Subgraph "${sub.data.name}" passes an input straight to an output, which ComfyUI cannot queue.`);
      return this.resolveOutput(inner, link.origin_slot, type, visited);
    }
    if (this.defs[node.type]) return { id: dto.id, slot };

    // Frontend-only nodes.
    if (node.type === "GetNode") {
      const name = Array.isArray(node.widgets_values) ? node.widgets_values[0] : undefined;
      const setter = [...dto.graph.nodes.values()].find(
        (n) => n.type === "SetNode" && Array.isArray(n.widgets_values) && n.widgets_values[0] === name
      );
      if (!setter) throw new ConversionError(`Get node "${name}" has no matching Set node.`);
      return this.resolveInput(this.dtoAt([...dto.path, setter.id]), 0, visited, type);
    }
    if (node.type === "PrimitiveNode" || !node.inputs?.length) {
      if (node.type !== "PrimitiveNode") this.def(dto); // not a reroute-like node: report it as missing
      return undefined;
    }
    // Reroute and reroute-like nodes. OpenLayer narrowed Geekatplay's rule
    // ("any unknown node with one input") to nodes that look like a reroute:
    // a missing model patch such as ModelSamplingAuraFlow also has one input,
    // and passing it through ran a different graph with only a note.
    if (node.inputs.length === 1 && isRerouteLike(node)) return this.resolveInput(dto, 0, visited, type);
    this.def(dto); // throws: a node this server does not know, and the graph needs its output
    return undefined;
  }

  /** The frontend's ExecutableNodeDTO._getBypassSlotIndex. */
  private bypassSlot(node: UiNode, slot: number, type: string | undefined): number {
    const inputs = node.inputs ?? [];
    const outputType = node.outputs?.[slot]?.type;
    if (type === "*" || type === "") return inputs.length > slot ? slot : 0;
    const same = inputs[slot];
    if (same && validConnection(same.type, outputType) && validConnection(same.type, type)) return slot;
    const exact = inputs.findIndex((i) => i.type === type);
    return exact !== -1 ? exact : inputs.findIndex((i) => validConnection(i.type, outputType) && validConnection(i.type, type));
  }

  convert(): ComfyWorkflow {
    for (const graph of [this.root, ...this.subgraphs.values()]) this.applyPrimitives(graph);
    this.addNodes(this.root, [], null);

    const output: ComfyWorkflow = {};
    for (const dto of this.dtos.values()) {
      const { node } = dto;
      if (node.mode === MUTED || node.mode === BYPASSED || this.isSubgraph(node)) continue;
      const def = this.defs[node.type];
      if (!def) {
        // Notes, reroutes, primitives and other frontend-only or missing nodes are not
        // part of the prompt; a missing node that something depends on fails in resolveOutput.
        if (!FRONTEND_ONLY.has(node.type)) this.skipped.add(node.type);
        continue;
      }
      const inputs = this.widgetInputs(dto);
      (node.inputs ?? []).forEach((input, slot) => {
        const resolved = this.resolveInput(dto, slot, new Set());
        if (!resolved) return;
        inputs[input.name] =
          "widgetValue" in resolved
            ? Array.isArray(resolved.widgetValue)
              ? { __value__: resolved.widgetValue }
              : resolved.widgetValue
            : [String(resolved.id), resolved.slot];
      });
      const entry: ComfyWorkflowNode = { inputs, class_type: node.type, _meta: { title: node.title ?? def.display_name ?? node.type } };
      output[dto.id] = entry;
    }
    for (const { inputs } of Object.values(output)) {
      for (const [name, value] of Object.entries(inputs)) {
        if (Array.isArray(value) && value.length === 2 && !output[value[0] as string]) delete inputs[name];
      }
    }
    return output;
  }

  /**
   * The inputs the workflow author put forward, in their order: widgets
   * promoted onto subgraph nodes (proxyWidgets) and titled primitive nodes at
   * the root. Each entry is { id, key, label, group } in terms of the converted
   * prompt.
   */
  exposed(): ExposedInput[] {
    const list: ExposedInput[] = [];
    for (const dto of this.dtos.values()) {
      const { node } = dto;
      if (!dto.path.length && PRIMITIVES.has(node.type) && node.title && node.outputs?.[0]?.links?.length) {
        list.push({ id: dto.id, key: "value", label: node.title, group: "" });
      }
      const proxies = dto.subgraph && proxyWidgets(node);
      for (const [innerId, key] of proxies ?? []) {
        const inner = this.dtos.get([dto.id, ...String(innerId).split(":")].join(":"));
        if (inner) list.push({ id: inner.id, key, label: this.proxyLabel(inner, key), group: node.title ?? dto.subgraph?.data.name ?? "" });
      }
    }
    return list;
  }

  /** A promoted widget is named after the subgraph input that feeds it, else after its node. */
  private proxyLabel(inner: Dto, key: string): string {
    const slot = inner.node.inputs?.findIndex((i) => i.widget?.name === key || i.name === key) ?? -1;
    const link = slot === -1 ? null : this.inputLink(inner, slot);
    const input = link?.origin_id === SUBGRAPH_INPUT ? inner.host?.subgraph?.data.inputs?.[link.origin_slot] : null;
    if (input) return input.label ?? input.name;
    const title = inner.node.title ?? this.defs[inner.node.type]?.display_name ?? inner.node.type;
    return `${title}: ${key}`;
  }
}

/** True for an editor save (Workflow > Save), false for an API export. */
export function isUiWorkflow(data: unknown): data is UiWorkflow {
  return typeof data === "object" && data !== null && Array.isArray((data as { nodes?: unknown }).nodes);
}

/** Node class names the conversion needs definitions for. */
export function uiNodeTypes(ui: UiWorkflow): string[] {
  const subgraphIds = new Set((ui.definitions?.subgraphs ?? []).map((s) => s.id));
  const types = new Set<string>();
  for (const graph of [ui, ...(ui.definitions?.subgraphs ?? [])]) {
    for (const node of graph.nodes ?? []) if (!subgraphIds.has(node.type)) types.add(node.type);
  }
  return [...types];
}

/**
 * Returns { prompt, skipped, exposed }: the API workflow, the types of nodes
 * that were left out because the server does not know them and nothing depends
 * on them, and the inputs the author exposed (see Converter.exposed).
 */
export function convertUiWorkflow(ui: UiWorkflow, defs: ObjectInfo, random: () => number = Math.random): ConvertResult {
  if (ui.extra?.groupNodes && Object.keys(ui.extra.groupNodes).length) {
    throw new ConversionError(LEGACY_GROUP_NODES_MESSAGE);
  }
  const converter = new Converter(ui, defs, random);
  const prompt = converter.convert();
  return { prompt, skipped: [...converter.skipped], exposed: converter.exposed() };
}
