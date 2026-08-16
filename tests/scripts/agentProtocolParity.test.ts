import { describe, expect, it } from "vitest";

import {
  AGENT_TOOL_IDS,
  buildEvent,
  buildHello,
  buildResult,
  parseCommand,
  PROTOCOL_VERSION as PANEL_VERSION
} from "../../src/ui/agentProtocol";

// @ts-expect-error -- bridge/ is plain .mjs and sits outside the tsconfig `include`.
import {
  AGENT_TOOLS,
  buildCommand,
  parseInbound,
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

    const parsed = parseCommand(JSON.stringify(command));

    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.command).toEqual({
      v: PANEL_VERSION,
      type: "command",
      id: "req-1",
      tool: "text_to_image",
      params: { prompt: "a cat", steps: 30 }
    });
  });

  it("parses the panel's hello, result and event with the bridge's parser", () => {
    expect(parseInbound(JSON.stringify(buildHello("0.15.0", ["text_to_image"]))).ok).toBe(true);
    expect(parseInbound(JSON.stringify(buildResult("req-1", true, "Done."))).ok).toBe(true);
    expect(parseInbound(JSON.stringify(buildEvent("busy", { isBusy: true }))).ok).toBe(true);
  });

  it("rejects each other's version mismatch the same way", () => {
    const staleFromBridge = JSON.stringify({ ...buildCommand({ id: "req-1", tool: "upscale" }), v: 99 });
    const staleFromPanel = JSON.stringify({ ...buildResult("req-1", true, "Done."), v: 99 });

    const panelSaw = parseCommand(staleFromBridge);
    const bridgeSaw = parseInbound(staleFromPanel);

    expect(panelSaw.ok).toBe(false);
    expect(bridgeSaw.ok).toBe(false);
    // Both name their own version and the one they received, so a tester who
    // updated only one half is told which one is behind.
    expect(!panelSaw.ok && panelSaw.reason).toContain("99");
    expect(bridgeSaw.reason).toContain("99");
  });
});
