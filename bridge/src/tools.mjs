import * as z from "zod";

/**
 * The MCP tool surface, and the parameters each one may set.
 *
 * ## Why the schemas are all-optional
 *
 * Every field here is optional, including `prompt`. That looks wrong for a
 * text-to-image tool and is deliberate: the panel executes a command by writing
 * these values into the very DOM fields a person types into, then invoking the
 * handler that a person's click would have invoked (`docs/mcp-bridge.md` §3.2).
 * An omitted field therefore means "leave what is already in the panel alone",
 * which is the behaviour that makes conversational use work — "try that again
 * at 30 steps" should change the step count and nothing else, and an agent
 * should not have to restate a prompt it never saw.
 *
 * The cost is that validation happens where it always did, in the panel, and a
 * nonsensical value surfaces as the same inline error a person typing garbage
 * would get, relayed back as the result's status text. That is the already
 * trusted path, and duplicating it here would create a second opinion about
 * what a valid width is.
 *
 * ## Why the ranges that *are* here exist
 *
 * `width`/`height`/`steps`/`cfg` carry bounds because an agent inventing
 * `width: 100000` costs a tester a hung Photoshop and a VRAM crash on a 12 GB
 * card, and the round trip to find that out is minutes long. These are sanity
 * rails against nonsense, not a model of what the panel accepts.
 */

/**
 * How long to wait for the panel's reply, per tool.
 *
 * Sized to the slowest plausible run rather than the typical one. Under-waiting
 * is the worse failure: the generation is still going in Photoshop, the agent
 * has been told it failed, and a retry queues a second run behind the first.
 */
export const GENERATION_TIMEOUT_MS = 10 * 60 * 1000;
export const CAPTION_TIMEOUT_MS = 2 * 60 * 1000;

const dimension = z.number().int().min(64).max(4096);

export const TEXT_TO_IMAGE_SCHEMA = {
  prompt: z.string().describe("What to generate. Omit to reuse the prompt already in the panel."),
  negativePrompt: z.string().optional().describe("What to avoid."),
  workflow: z.string().optional().describe("Workflow preset id, e.g. txt2img-basic."),
  checkpoint: z.string().optional().describe("Checkpoint filename as listed by ComfyUI."),
  width: dimension.optional(),
  height: dimension.optional(),
  steps: z.number().int().min(1).max(150).optional(),
  cfg: z.number().min(0).max(30).optional(),
  seed: z.number().int().optional().describe("Omit for a random seed.")
};

/**
 * The tools this bridge exposes over MCP.
 *
 * Phase 1 is `text_to_image` only, proving the full chain end to end
 * (`docs/mcp-bridge.md` §4). The remaining six handlers are already registered
 * on the panel side and named in `AGENT_TOOLS`; they gain MCP surface in Phase 2
 * once the one path is trusted. `get_panel_state` is not in this table because
 * it never reaches the panel — it answers from the link's own state.
 */
export const MCP_TOOLS = [
  {
    name: "text_to_image",
    title: "Text to Image",
    description:
      "Generate an image from a text prompt in the OpenLayer Photoshop panel and import it as a " +
      "new layer. Only the parameters you pass are changed; anything omitted keeps the value " +
      "currently in the panel. Returns the panel's own status message.",
    schema: TEXT_TO_IMAGE_SCHEMA,
    timeoutMs: GENERATION_TIMEOUT_MS
  }
];
