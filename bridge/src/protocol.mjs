/**
 * The wire format spoken on the hub's socket.
 *
 * `src/ui/agentProtocol.ts` mirrors the panel's half of this, and
 * `tests/scripts/agentProtocolParity.test.ts` builds frames through both and
 * parses them with the other so the two copies cannot drift silently.
 *
 * ## Who talks to whom
 *
 * One long-lived hub owns the socket. Two kinds of client dial it:
 *
 * ```
 * Photoshop panel ──role:"panel"──┐
 *                                  ├──▶ openlayer-hub (owns 127.0.0.1:8199)
 * Claude / Codex / VS Code ──stdio──▶ mcp client ──role:"agent"──┘
 * ```
 *
 * The hub is the only party that sees both sides, so the same frame type can
 * travel in both directions without ambiguity: an agent sends `command` to the
 * hub, and the hub sends `command` to the panel. The ids differ — the hub mints
 * its own toward the panel and maps the reply back — because two agents must be
 * free to pick the same id without their results crossing.
 *
 * ## Why `role` is optional and defaults to "panel"
 *
 * The panel shipped first and sends a `hello` with no `role`. Treating an
 * absent role as "panel" keeps an already-loaded plugin working against a newer
 * hub, which is worth more than the tidiness of requiring the field: a tester
 * who updates the bridge but not the plugin gets a working system rather than a
 * version error. Agents are new code and always send theirs.
 *
 * `PROTOCOL_VERSION` is therefore unchanged. Bump it only when a frame changes
 * shape in a way an older peer cannot ignore.
 */

export const PROTOCOL_VERSION = 1;

/** Loopback port the hub owns and both client kinds dial. */
export const DEFAULT_PORT = 8199;

export const ROLES = ["panel", "agent"];

export const AGENT_TOOLS = [
  "text_to_image",
  "image_to_image",
  "sketch_to_image",
  "inpaint",
  "outpaint",
  "upscale",
  "prompt_from_layer",
  "style_reference",
  "multi_reference"
];

const FRAME_TYPES = new Set(["hello", "welcome", "command", "result", "event", "state", "ask"]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * An agent's opening frame. The panel builds its own in `agentProtocol.ts`.
 *
 * `canAnswer` reports whether this agent's *MCP client* declared the sampling
 * capability at initialize. Only a sampling-capable client can answer an `ask`
 * — see `buildAsk` — and the hub needs to know before it routes one, because
 * an ask sent to a client that cannot answer is a guaranteed timeout rather
 * than a refusal anyone can act on.
 */
export function buildAgentHello(client, clientVersion, canAnswer = false) {
  return {
    v: PROTOCOL_VERSION,
    type: "hello",
    role: "agent",
    client: String(client ?? "unknown"),
    clientVersion: String(clientVersion ?? "0"),
    canAnswer: canAnswer === true
  };
}

/**
 * The panel asking a connected agent a question. Panel to hub, hub to agent.
 *
 * This is the one flow that runs against MCP's grain. MCP is client-to-server:
 * an agent calls tools on us, and there is no ordinary way for us to ask it
 * anything back. The mechanism that does exist is *sampling*
 * (`sampling/createMessage`), where a server asks its client for a model
 * completion — but it is optional, and a client that did not declare it will
 * never answer. So the hub only ever routes an ask to an agent whose hello
 * said `canAnswer`, and refuses immediately otherwise. The panel's affordance
 * is a nice-to-have; making it fail visibly and instantly matters more than
 * making it work everywhere.
 */
export function buildAsk({ id, question }) {
  if (typeof id !== "string" || id === "") {
    throw new TypeError("An ask needs a non-empty string id.");
  }

  if (typeof question !== "string" || question === "") {
    throw new TypeError("An ask needs a non-empty question.");
  }

  return { v: PROTOCOL_VERSION, type: "ask", id, question };
}

/**
 * The hub's answer to an agent's hello.
 *
 * Exists so an agent can tell a real hub from *anything else listening on that
 * port*. Without it, connecting to the wrong process looks identical to
 * connecting to the right one — the socket opens, the command goes out, and
 * nothing ever comes back, so the agent waits out the full generation timeout.
 * That is not hypothetical: a stale pre-split bridge left running on 8199
 * accepted an agent connection, mistook it for a panel, kicked the real panel
 * off, and hung the client for minutes.
 *
 * Sent to agents only. The panel ignores unknown frames, so adding it there
 * would mean a plugin change for no gain today.
 */
export function buildWelcome(hubVersion, state) {
  return { v: PROTOCOL_VERSION, type: "welcome", hubVersion: String(hubVersion ?? "0"), state };
}

/** A request to run a tool. Agent to hub, and hub to panel. */
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

/** An agent asking what the hub knows about the panel. */
export function buildStateRequest(id) {
  return { v: PROTOCOL_VERSION, type: "state", id };
}

/**
 * A reply. Panel to hub, and hub to agent.
 *
 * `data` carries structured payloads (the panel state) that `status` cannot,
 * and is omitted rather than null when there is none, so a reply stays the same
 * shape it has always been.
 */
export function buildResult({ id, ok, status, data }) {
  const result = { v: PROTOCOL_VERSION, type: "result", id, ok, status };

  if (data !== undefined) {
    result.data = data;
  }

  return result;
}

/**
 * Parses any frame.
 *
 * Returns a discriminated result rather than throwing, because every caller is
 * a socket data handler: an exception there takes down a process that is
 * supposed to survive one bad frame. Callers check `message.type` themselves —
 * this validates that a frame is well-formed, not that it was expected from
 * that direction, which only the receiver knows.
 */
export function parseFrame(raw) {
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
    // after updating one half and not the other, and "expected 1, got 2" is the
    // difference between a five-second fix and a bug report.
    return {
      ok: false,
      reason:
        `Protocol version mismatch: this build speaks v${PROTOCOL_VERSION}, the peer sent ` +
        `v${JSON.stringify(parsed.v)}. Update whichever of the two is older.`
    };
  }

  if (typeof parsed.type !== "string" || !FRAME_TYPES.has(parsed.type)) {
    return { ok: false, reason: `Unknown message type ${JSON.stringify(parsed.type)}.` };
  }

  if (parsed.type === "hello") {
    // Absent means panel — see the header. Anything else present must be valid.
    const role = parsed.role ?? "panel";

    if (!ROLES.includes(role)) {
      return { ok: false, reason: `Unknown role ${JSON.stringify(parsed.role)}.` };
    }

    if (role === "panel") {
      if (typeof parsed.panelVersion !== "string") {
        return { ok: false, reason: "A panel hello is missing a string panelVersion." };
      }

      if (!Array.isArray(parsed.tools) || parsed.tools.some((tool) => typeof tool !== "string")) {
        return { ok: false, reason: "A panel hello is missing a string[] tools." };
      }
    }

    return { ok: true, message: { ...parsed, role } };
  }

  if (parsed.type === "welcome") {
    if (typeof parsed.hubVersion !== "string") {
      return { ok: false, reason: "welcome is missing a string hubVersion." };
    }

    return { ok: true, message: parsed };
  }

  if (parsed.type === "command") {
    if (typeof parsed.id !== "string" || parsed.id === "") {
      return { ok: false, reason: "command is missing a non-empty string id." };
    }

    if (!AGENT_TOOLS.includes(parsed.tool)) {
      return { ok: false, reason: `Unknown tool ${JSON.stringify(parsed.tool)}.` };
    }

    if (parsed.params !== undefined && !isPlainObject(parsed.params)) {
      return { ok: false, reason: "command params must be an object when present." };
    }

    return { ok: true, message: { ...parsed, params: parsed.params ?? {} } };
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

  if (parsed.type === "state") {
    if (typeof parsed.id !== "string" || parsed.id === "") {
      return { ok: false, reason: "state is missing a non-empty string id." };
    }

    return { ok: true, message: parsed };
  }

  // ask — Phase 3's bidirectional half. Parsed now so a newer panel gets a real
  // answer rather than silence, which looks identical to a hung hub.
  if (typeof parsed.id !== "string" || parsed.id === "") {
    return { ok: false, reason: "ask is missing a non-empty string id." };
  }

  if (typeof parsed.question !== "string" || parsed.question === "") {
    return { ok: false, reason: "ask is missing a non-empty string question." };
  }

  return { ok: true, message: parsed };
}
