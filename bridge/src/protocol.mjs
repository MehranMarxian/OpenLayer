/**
 * The wire format between the bridge process and the OpenLayer panel.
 *
 * This file is the canonical definition. `src/ui/agentProtocol.ts` mirrors it
 * on the panel side, and `tests/scripts/agentProtocolParity.test.ts` builds the
 * same messages through both and asserts they are byte-identical — the two
 * copies exist because the panel is TypeScript bundled into UXP and the bridge
 * is plain Node ESM that must never enter that bundle, not because anyone is
 * free to change one alone.
 *
 * ## Shape
 *
 * Every frame is a JSON object carrying `v` and `type`. Direction is fixed per
 * type, so a message can never be ambiguous about who was supposed to send it:
 *
 * - `command` — bridge to panel. "Run this tool with these parameters."
 * - `hello`   — panel to bridge, once on connect. Announces the panel's version
 *               and which tools it actually registered, so the bridge can
 *               reject a call for a tool this panel build does not have rather
 *               than time out waiting for a reply that will never come.
 * - `result`  — panel to bridge, exactly one per `command`, matched by `id`.
 * - `event`   — panel to bridge, unsolicited. Busy-state and status changes.
 * - `ask`     — panel to bridge, Phase 3's bidirectional half. Reserved and
 *               parsed now so an older bridge gives a clear version error
 *               instead of "unknown type" when a newer panel starts sending it.
 *
 * ## Why `ok` is not the same as "no exception"
 *
 * A `result` carries `ok` *and* `status`. The panel's tool handlers swallow
 * their own errors — they catch, write the tool's status bar, and return — so
 * the panel side cannot learn success from an absent throw and neither can we.
 * `ok` is the panel's reading of its own status bar, and `status` is the text it
 * read, passed through so the agent can relay the real message to the user
 * rather than a generic failure. See `docs/mcp-bridge.md` §2.
 */

/**
 * Bumped only for a breaking change to the shapes below. The handshake compares
 * it in both directions, because the bridge is installed separately from the
 * plugin (`npx openlayer-mcp-bridge`) and so the two can drift by a release in
 * a way an all-in-one plugin never could.
 */
export const PROTOCOL_VERSION = 1;

/** Loopback port the panel dials. Never bound on 0.0.0.0 — see server.mjs. */
export const DEFAULT_PORT = 8199;

/**
 * The tools the bridge may ask for, in `docs/mcp-bridge.md` §3.1 order.
 *
 * This is the bridge's view of what *could* exist. What a given panel actually
 * registered arrives in its `hello`, and the two are intersected: a panel built
 * before a tool existed simply does not list it.
 */
export const AGENT_TOOLS = [
  "text_to_image",
  "image_to_image",
  "sketch_to_image",
  "inpaint",
  "outpaint",
  "upscale",
  "prompt_from_layer"
];

const INBOUND_TYPES = new Set(["hello", "result", "event", "ask"]);

/** Builds the one frame the bridge sends. */
export function buildCommand({ id, tool, params }) {
  if (typeof id !== "string" || id === "") {
    throw new TypeError("A command needs a non-empty string id.");
  }

  if (!AGENT_TOOLS.includes(tool)) {
    throw new TypeError(`Unknown tool ${JSON.stringify(tool)}.`);
  }

  return {
    v: PROTOCOL_VERSION,
    type: "command",
    id,
    tool,
    // Always an object, never null: the panel writes these into DOM fields by
    // key, and an absent params is the same request as an empty one.
    params: params ?? {}
  };
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses a frame from the panel.
 *
 * Returns a discriminated result rather than throwing, because every caller is
 * a socket data handler: an exception there takes down a relay that is supposed
 * to survive one bad frame. The `reason` is written to be read by a human in
 * the bridge's stderr log, since that is the only place it will ever surface.
 */
export function parseInbound(raw) {
  let parsed;

  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : String(raw));
  } catch {
    return { ok: false, reason: "Frame was not valid JSON." };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, reason: "Frame was not a JSON object." };
  }

  if (parsed.v !== PROTOCOL_VERSION) {
    // Named in both directions on purpose. This is the error a tester hits
    // after updating the plugin but not the separately installed bridge, and
    // "expected 1, got 2" is the difference between a five-second fix and a
    // bug report.
    return {
      ok: false,
      reason:
        `Protocol version mismatch: this bridge speaks v${PROTOCOL_VERSION}, the panel sent ` +
        `v${JSON.stringify(parsed.v)}. Update whichever of the two is older.`
    };
  }

  if (typeof parsed.type !== "string" || !INBOUND_TYPES.has(parsed.type)) {
    return { ok: false, reason: `Unknown message type ${JSON.stringify(parsed.type)}.` };
  }

  if (parsed.type === "hello") {
    if (typeof parsed.panelVersion !== "string") {
      return { ok: false, reason: "hello is missing a string panelVersion." };
    }

    if (!Array.isArray(parsed.tools) || parsed.tools.some((tool) => typeof tool !== "string")) {
      return { ok: false, reason: "hello is missing a string[] tools." };
    }

    return { ok: true, message: parsed };
  }

  if (parsed.type === "result") {
    if (typeof parsed.id !== "string" || parsed.id === "") {
      return { ok: false, reason: "result is missing a non-empty string id." };
    }

    if (typeof parsed.ok !== "boolean") {
      return { ok: false, reason: "result is missing a boolean ok." };
    }

    if (typeof parsed.status !== "string") {
      return { ok: false, reason: "result is missing a string status." };
    }

    return { ok: true, message: parsed };
  }

  if (parsed.type === "event") {
    if (typeof parsed.name !== "string" || parsed.name === "") {
      return { ok: false, reason: "event is missing a non-empty string name." };
    }

    return { ok: true, message: parsed };
  }

  // ask
  if (typeof parsed.id !== "string" || parsed.id === "") {
    return { ok: false, reason: "ask is missing a non-empty string id." };
  }

  if (typeof parsed.question !== "string" || parsed.question === "") {
    return { ok: false, reason: "ask is missing a non-empty string question." };
  }

  return { ok: true, message: parsed };
}
