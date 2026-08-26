import { describe, expect, it } from "vitest";
import { z } from "zod";

// @ts-expect-error -- bridge/ is plain .mjs and sits outside the tsconfig `include`.
import { MCP_TOOLS } from "../../bridge/src/tools.mjs";
// @ts-expect-error -- see above.
import { AGENT_TOOLS } from "../../bridge/src/protocol.mjs";
import { AGENT_TOOL_IDS } from "../../src/ui/agentProtocol";

describe("MCP_TOOLS", () => {
  it("names exactly the eight tools the protocol knows about, in the same order", () => {
    expect(MCP_TOOLS.map((tool: { name: string }) => tool.name)).toEqual([...AGENT_TOOLS]);
    expect([...AGENT_TOOLS]).toEqual([...AGENT_TOOL_IDS]);
  });

  it("makes every schema field optional, including prompt", () => {
    // Phase 1 shipped text_to_image with a required prompt, which broke the
    // stated design — "try that again at 30 steps" would have forced restating
    // a prompt the agent never touched. Every schema is checked here so the
    // mistake cannot recur on any of the other six without a test noticing.
    for (const tool of MCP_TOOLS as { name: string; schema: Record<string, z.ZodTypeAny> }[]) {
      for (const [field, definition] of Object.entries(tool.schema)) {
        const accepts = definition.safeParse(undefined);

        expect(accepts.success, `${tool.name}.${field} must accept an omitted value`).toBe(true);
      }
    }
  });

  it("gives every source-requiring tool a description that says it needs a capture", () => {
    // The panel already refuses these cleanly with no source captured, but an
    // agent should not have to burn a call to learn that image_to_image needs
    // a captured layer. Every tool but text_to_image needs one.
    const sourceRequiring = MCP_TOOLS.filter((tool: { name: string }) => tool.name !== "text_to_image");

    for (const tool of sourceRequiring as { name: string; description: string }[]) {
      expect(tool.description.toLowerCase()).toContain("captured in the panel first");
    }
  });

  it("gives prompt_from_layer a shorter timeout than a full generation", () => {
    // Captioning is a round trip to Florence-2, not a diffusion run — sized
    // separately so a genuinely stuck captioner is reported in two minutes
    // rather than ten.
    const captioning = MCP_TOOLS.find((tool: { name: string }) => tool.name === "prompt_from_layer") as {
      timeoutMs: number;
    };
    const generation = MCP_TOOLS.find((tool: { name: string }) => tool.name === "text_to_image") as {
      timeoutMs: number;
    };

    expect(captioning.timeoutMs).toBeLessThan(generation.timeoutMs);
  });
});
