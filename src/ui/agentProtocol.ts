/**
 * The panel's half of the bridge wire format.
 *
 * `bridge/src/protocol.mjs` is the canonical definition; this mirrors it.
 * `tests/scripts/agentProtocolParity.test.ts` builds the same frames through
 * both and asserts they are byte-identical, so the two cannot drift silently.
 *
 * The duplication is not laziness. The bridge is a separate npm package running
 * in Node, and this file is bundled into the UXP panel; importing one from the
 * other would either drag `bridge/` into the plugin bundle or make the bridge
 * depend on TypeScript build output. Two small mirrored files plus a test that
 * fails when they disagree is the cheaper trade.
 */

/** Must match `PROTOCOL_VERSION` in `bridge/src/protocol.mjs`. */
export const PROTOCOL_VERSION = 1;

/**
 * The tools an agent may drive, named as the MCP surface names them.
 *
 * Deliberately *not* `PreviewToolId`. That type is the panel's own
 * hyphenated vocabulary (`"text-to-image"`) for a different set of surfaces,
 * and reusing it would tie the MCP tool names an agent sees to an internal id
 * that exists for the Preview panel's benefit. They are converted at exactly
 * one place, in `App.ts`'s registration table.
 */
export const AGENT_TOOL_IDS = [
  "text_to_image",
  "image_to_image",
  "sketch_to_image",
  "inpaint",
  "outpaint",
  "upscale",
  "prompt_from_layer",
  "style_reference",
  "multi_reference"
] as const;

export type AgentToolId = (typeof AGENT_TOOL_IDS)[number];

/** Parameters an agent may set. Values are written into form fields as text. */
export type AgentParams = Record<string, string | number | boolean>;

export type AgentCommand = {
  v: number;
  type: "command";
  id: string;
  tool: AgentToolId;
  params: AgentParams;
};

/** An agent's answer to a question the panel asked. */
export type AgentAnswer = {
  id: string;
  ok: boolean;
  status: string;
};

/**
 * What the panel can receive: a command to run, or an answer to something it
 * asked. Discriminated by `kind` rather than by which key is present, so a
 * caller that forgets a case fails to compile.
 */
export type PanelFrame =
  | { kind: "command"; command: AgentCommand }
  | { kind: "answer"; answer: AgentAnswer };

export type ParsedPanelFrame =
  | { ok: true; frame: PanelFrame }
  | { ok: false; reason: string };

/**
 * The panel's opening frame.
 *
 * `role` is sent explicitly even though the hub defaults a missing one to
 * "panel" for the benefit of already-installed builds. Relying on that default
 * from new code would leave the wire ambiguous for no gain.
 */
export function buildHello(panelVersion: string, tools: readonly AgentToolId[]) {
  return {
    v: PROTOCOL_VERSION,
    type: "hello" as const,
    role: "panel" as const,
    panelVersion,
    tools: [...tools]
  };
}

export function buildResult(id: string, ok: boolean, status: string) {
  return { v: PROTOCOL_VERSION, type: "result" as const, id, ok, status };
}

export function buildEvent(name: string, payload?: unknown) {
  return { v: PROTOCOL_VERSION, type: "event" as const, name, payload };
}

/**
 * The panel asking a connected agent a question.
 *
 * The only frame that runs against MCP's grain — see `buildAsk` in
 * `bridge/src/protocol.mjs` for why it needs sampling, and why the hub refuses
 * it outright rather than trying when no connected agent can answer.
 */
export function buildAsk(id: string, question: string) {
  return { v: PROTOCOL_VERSION, type: "ask" as const, id, question };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses a frame from the hub: a `command` to run, or a `result` answering
 * something this panel asked.
 *
 * Returns a result rather than throwing: this runs on a socket's message
 * handler, where an exception would tear down a connection that should survive
 * one bad frame.
 */
export function parsePanelFrame(raw: unknown): ParsedPanelFrame {
  let parsed: unknown;

  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : String(raw));
  } catch {
    return { ok: false, reason: "Frame was not valid JSON." };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, reason: "Frame was not a JSON object." };
  }

  if (parsed.v !== PROTOCOL_VERSION) {
    return {
      ok: false,
      reason:
        `Protocol version mismatch: this panel speaks v${PROTOCOL_VERSION}, the bridge sent ` +
        `v${JSON.stringify(parsed.v)}. Update whichever of the two is older.`
    };
  }

  if (parsed.type !== "command" && parsed.type !== "result") {
    return { ok: false, reason: `Unexpected message type ${JSON.stringify(parsed.type)}.` };
  }

  if (typeof parsed.id !== "string" || parsed.id === "") {
    return { ok: false, reason: `${parsed.type} is missing a non-empty string id.` };
  }

  if (parsed.type === "result") {
    if (typeof parsed.ok !== "boolean") {
      return { ok: false, reason: "result is missing a boolean ok." };
    }

    if (typeof parsed.status !== "string") {
      return { ok: false, reason: "result is missing a string status." };
    }

    return {
      ok: true,
      frame: { kind: "answer", answer: { id: parsed.id, ok: parsed.ok, status: parsed.status } }
    };
  }

  if (!AGENT_TOOL_IDS.includes(parsed.tool as AgentToolId)) {
    return { ok: false, reason: `Unknown tool ${JSON.stringify(parsed.tool)}.` };
  }

  if (parsed.params !== undefined && !isPlainObject(parsed.params)) {
    return { ok: false, reason: "command params must be an object when present." };
  }

  return {
    ok: true,
    frame: {
      kind: "command",
      command: {
        v: PROTOCOL_VERSION,
        type: "command",
        id: parsed.id,
        tool: parsed.tool as AgentToolId,
        params: (parsed.params ?? {}) as AgentParams
      }
    }
  };
}
