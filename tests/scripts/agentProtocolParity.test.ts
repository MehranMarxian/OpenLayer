import { describe, expect, it } from "vitest";

import {
  AGENT_TOOL_IDS,
  buildAsk as buildPanelAsk,
  buildEvent,
  buildHello,
  buildResult,
  parsePanelFrame,
  PROTOCOL_VERSION as PANEL_VERSION
} from "../../src/ui/agentProtocol";

// @ts-expect-error -- bridge/ is plain .mjs and sits outside the tsconfig `include`.
import {
  AGENT_TOOLS,
  buildAsk as buildHubAsk,
  buildCommand,
  buildResult as buildHubResult,
  parseFrame,
  PROTOCOL_VERSION as BRIDGE_VERSION
} from "../../bridge/src/protocol.mjs";

/**
 * The wire format is written twice — `bridge/src/protocol.mjs` for the Node
 * process, `src/ui/agentProtocol.ts` for the UXP bundle — because neither build
 * can import the other without dragging one runtime into the other's package.
 *
 * That is a reasonable trade only while something proves the two agree. This is
 * that something: it builds frames with one side and parses them with the
 * other, in both directions, so a field renamed in one copy fails here rather
 * than in Photoshop with a silent no-op.
 */

describe("bridge and panel protocol parity", () => {
  it("agrees on the protocol version", () => {
    expect(PANEL_VERSION).toBe(BRIDGE_VERSION);
  });

  it("agrees on the tool list, in the same order", () => {
    expect([...AGENT_TOOL_IDS]).toEqual([...AGENT_TOOLS]);
  });

  it("parses the bridge's command with the panel's parser", () => {
    const command = buildCommand({
      id: "req-1",
      tool: "text_to_image",
      params: { prompt: "a cat", steps: 30 }
    });

    const parsed = parsePanelFrame(JSON.stringify(command));

    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.frame.kind).toBe("command");
    expect(parsed.ok && parsed.frame.kind === "command" && parsed.frame.command).toEqual({
      v: PANEL_VERSION,
      type: "command",
      id: "req-1",
      tool: "text_to_image",
      params: { prompt: "a cat", steps: 30 }
    });
  });

  it("round-trips an ask in both directions", () => {
    // The panel asks, the hub relays under its own id, an agent answers, and
    // the hub relays the answer back. Every hop crosses the two copies of the
    // protocol, so this is where they would silently disagree.
    const fromPanel = buildPanelAsk("panel-1", "Suggest a prompt");
    const atHub = parseFrame(JSON.stringify(fromPanel));

    expect(atHub.ok).toBe(true);
    expect(atHub.message.type).toBe("ask");
    expect(atHub.message.question).toBe("Suggest a prompt");

    // The hub re-mints the id before forwarding, exactly as it does for commands.
    const toAgent = buildHubAsk({ id: "ask-1", question: atHub.message.question });

    expect(parseFrame(JSON.stringify(toAgent)).ok).toBe(true);

    const answer = buildHubResult({ id: "panel-1", ok: true, status: "a red fox in snow" });
    const atPanel = parsePanelFrame(JSON.stringify(answer));

    expect(atPanel.ok && atPanel.frame.kind).toBe("answer");
    expect(atPanel.ok && atPanel.frame.kind === "answer" && atPanel.frame.answer).toEqual({
      id: "panel-1",
      ok: true,
      status: "a red fox in snow"
    });
  });

  it("parses the panel's hello, result and event with the bridge's parser", () => {
    expect(parseFrame(JSON.stringify(buildHello("0.15.0", ["text_to_image"]))).ok).toBe(true);
    expect(parseFrame(JSON.stringify(buildResult("req-1", true, "Done."))).ok).toBe(true);
    expect(parseFrame(JSON.stringify(buildEvent("busy", { isBusy: true }))).ok).toBe(true);
  });

  it("reads the panel's hello as the panel role", () => {
    const parsed = parseFrame(JSON.stringify(buildHello("0.15.0", ["text_to_image"])));

    expect(parsed.ok && parsed.message.role).toBe("panel");
  });

  it("still reads a role-less hello as a panel, so an installed build keeps working", () => {
    // The panel shipped before `role` existed. A tester who updates the bridge
    // but not the plugin should get a working system, not a version error.
    const legacy = JSON.stringify({
      v: PANEL_VERSION,
      type: "hello",
      panelVersion: "0.15.0",
      tools: ["text_to_image"]
    });

    const parsed = parseFrame(legacy);

    expect(parsed.ok && parsed.message.role).toBe("panel");
  });

  it("rejects each other's version mismatch the same way", () => {
    const staleFromBridge = JSON.stringify({ ...buildCommand({ id: "req-1", tool: "upscale" }), v: 99 });
    const staleFromPanel = JSON.stringify({ ...buildResult("req-1", true, "Done."), v: 99 });

    const panelSaw = parsePanelFrame(staleFromBridge);
    const bridgeSaw = parseFrame(staleFromPanel);

    expect(panelSaw.ok).toBe(false);
    expect(bridgeSaw.ok).toBe(false);
    // Both name their own version and the one they received, so a tester who
    // updated only one half is told which one is behind.
    expect(!panelSaw.ok && panelSaw.reason).toContain("99");
    expect(bridgeSaw.reason).toContain("99");
  });
});
