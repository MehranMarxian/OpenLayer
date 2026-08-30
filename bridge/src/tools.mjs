import * as z from "zod";

/**
 * The MCP tool surface, and the parameters each one may set.
 *
 * ## Why every schema field is optional
 *
 * Including `prompt` — which looked required in Phase 1's schema and was a bug,
 * fixed here. The panel executes a command by writing these values into the
 * very DOM fields a person types into, then invoking the handler a person's
 * click would have invoked (`docs/mcp-bridge.md` §3.2). An omitted field means
 * "leave what is already in the panel alone", which is the behaviour that
 * makes conversational use work — "try that again at 30 steps" should change
 * the step count and nothing else, and "regenerate" should not force restating
 * a prompt the agent never touched. A required `prompt` broke exactly that.
 *
 * The cost is that validation happens where it always did, in the panel, and a
 * nonsensical value surfaces as the same inline error a person typing garbage
 * would get, relayed back as the result's status text. That is the already
 * trusted path, and duplicating it here would create a second opinion about
 * what a valid width is.
 *
 * ## Why the numeric ranges exist at all
 *
 * `width`/`steps`/`cfg`/`denoise` and the rest carry bounds because an agent
 * inventing `width: 100000` costs a tester a hung Photoshop and a VRAM crash on
 * a 12 GB card, and the round trip to find that out is minutes long. Each range
 * is copied from that field's own `<input min max>` in `appMarkup.ts` — a
 * sanity rail against nonsense, not a second model of what the panel accepts.
 *
 * ## Why source-requiring tools have no `source` parameter
 *
 * `image_to_image`, `sketch_to_image`, `inpaint`, `outpaint` and `upscale` all
 * need a Photoshop layer or selection captured before they can run, and an
 * agent cannot do that capturing — there is no MCP verb for "select this layer
 * in Photoshop". Calling one of these with nothing captured is not an error to
 * design around: the handler already refuses with a clear status ("Capture the
 * active Photoshop layer before generating...") exactly as it would for a
 * person who clicked Generate too early, and that status is what comes back.
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
const steps = z.number().int().min(1).max(150).optional();
const cfg = z.number().min(0).max(30).optional();
const seed = z.number().int().optional().describe("Omit for a random seed.");
const denoise = z
  .number()
  .min(0.05)
  .max(1)
  .optional()
  .describe("How much to change the source. Low keeps it close to the original; high is closer to a fresh generation.");
const prompt = z.string().optional().describe("What to generate. Omit to reuse the prompt already in the panel.");
const negativePrompt = z.string().optional().describe("What to avoid.");
const workflow = z.string().optional().describe("Workflow preset id, as listed in the panel.");
const checkpoint = z.string().optional().describe("Checkpoint filename as listed by ComfyUI.");

export const TEXT_TO_IMAGE_SCHEMA = {
  prompt,
  negativePrompt,
  workflow,
  checkpoint,
  width: dimension.optional(),
  height: dimension.optional(),
  steps,
  cfg,
  seed
};

export const IMAGE_TO_IMAGE_SCHEMA = {
  prompt,
  negativePrompt,
  workflow,
  checkpoint,
  steps,
  cfg,
  seed,
  denoise
};

export const SKETCH_TO_IMAGE_SCHEMA = {
  prompt,
  negativePrompt,
  workflow,
  checkpoint,
  steps,
  cfg,
  seed,
  denoise,
  controlStrength: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .describe("How closely the result follows the sketch's lines.")
};

export const INPAINT_SCHEMA = {
  prompt,
  negativePrompt,
  workflow,
  checkpoint,
  steps,
  cfg,
  seed,
  denoise
};

export const OUTPAINT_SCHEMA = {
  prompt,
  workflow,
  checkpoint,
  steps,
  guidance: z.number().min(0).max(60).optional(),
  seed,
  denoise,
  left: z.number().int().min(0).max(2048).optional().describe("Pixels to extend on the left edge."),
  top: z.number().int().min(0).max(2048).optional().describe("Pixels to extend on the top edge."),
  right: z.number().int().min(0).max(2048).optional().describe("Pixels to extend on the right edge."),
  bottom: z.number().int().min(0).max(2048).optional().describe("Pixels to extend on the bottom edge."),
  feathering: z.number().int().min(0).max(256).optional().describe("Blend width at the seam, in pixels.")
};

export const UPSCALE_SCHEMA = {
  workflow,
  model: z.string().optional().describe("Upscale model filename as listed by ComfyUI.")
};

export const PROMPT_FROM_LAYER_SCHEMA = {
  task: z.string().optional().describe("Captioning task id, as listed in the panel."),
  numBeams: z.number().int().min(1).max(32).optional()
};

export const STYLE_REFERENCE_SCHEMA = {
  prompt,
  negativePrompt,
  workflow,
  checkpoint,
  width: dimension.optional(),
  height: dimension.optional(),
  steps,
  cfg,
  seed,
  controlStrength: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .describe("How strongly the reference layer's mood, color, and composition come through.")
};

/**
 * No width, height or denoise: the first reference sets the output canvas and
 * denoise is fixed at 1, so offering either would let an agent set a value the
 * workflow then ignores.
 */
/**
 * No cfg, width, height or denoise. The latent is sized from the captured
 * source and the graph takes an existing picture apart rather than re-sampling
 * it, so those parameters have nothing to set; cfg is fixed at 2.5 as part of
 * the technique. layerCount is capped at the range the gate measured.
 */
export const UNFLATTEN_SCHEMA = {
  prompt,
  workflow,
  checkpoint,
  layerCount: z
    .number()
    .int()
    .min(2)
    .max(4)
    .optional()
    .describe(
      "How many layers to separate into. Four is the measured best setting; two fuses distinct " +
      "objects into one layer and more than four returns empty ones."
    ),
  steps,
  seed
};

export const MULTI_REFERENCE_SCHEMA = {
  prompt,
  negativePrompt,
  workflow,
  checkpoint,
  steps,
  cfg,
  seed
};

/**
 * The tools this bridge exposes over MCP, in `docs/mcp-bridge.md` §3.1 order.
 *
 * `get_panel_state` is not in this table because it never reaches the panel —
 * it answers from the hub's own routing state.
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
  },
  {
    name: "image_to_image",
    title: "Image to Image",
    description:
      "Regenerate the layer or canvas already captured for Image to Image in the OpenLayer panel. " +
      "Requires a source captured in the panel first — this tool cannot capture one. Only the " +
      "parameters you pass are changed. Returns the panel's own status message.",
    schema: IMAGE_TO_IMAGE_SCHEMA,
    timeoutMs: GENERATION_TIMEOUT_MS
  },
  {
    name: "sketch_to_image",
    title: "Sketch to Image",
    description:
      "Render the sketch already captured for Sketch to Image in the OpenLayer panel. Requires a " +
      "source captured in the panel first — this tool cannot capture one. Only the parameters you " +
      "pass are changed. Returns the panel's own status message.",
    schema: SKETCH_TO_IMAGE_SCHEMA,
    timeoutMs: GENERATION_TIMEOUT_MS
  },
  {
    name: "inpaint",
    title: "Inpaint",
    description:
      "Inpaint the selection already captured for Inpaint in the OpenLayer panel. Requires a " +
      "source captured in the panel first — this tool cannot capture one. Only the parameters you " +
      "pass are changed. Returns the panel's own status message.",
    schema: INPAINT_SCHEMA,
    timeoutMs: GENERATION_TIMEOUT_MS
  },
  {
    name: "outpaint",
    title: "Outpaint",
    description:
      "Extend the canvas already captured for Outpaint in the OpenLayer panel. Requires a source " +
      "captured in the panel first — this tool cannot capture one. Only the parameters you pass " +
      "are changed. Returns the panel's own status message.",
    schema: OUTPAINT_SCHEMA,
    timeoutMs: GENERATION_TIMEOUT_MS
  },
  {
    name: "upscale",
    title: "Upscale",
    description:
      "Upscale the layer or canvas already captured for Upscale in the OpenLayer panel. Requires " +
      "a source captured in the panel first — this tool cannot capture one. Only the parameters " +
      "you pass are changed. Returns the panel's own status message.",
    schema: UPSCALE_SCHEMA,
    timeoutMs: GENERATION_TIMEOUT_MS
  },
  {
    name: "prompt_from_layer",
    title: "Prompt from Layer",
    description:
      "Caption the layer or canvas already captured for Prompt from Layer in the OpenLayer panel, " +
      "using Florence-2 PromptGen. Requires a source captured in the panel first — this tool " +
      "cannot capture one. Only the parameters you pass are changed. Returns the panel's own " +
      "status message with the generated caption text included.",
    schema: PROMPT_FROM_LAYER_SCHEMA,
    timeoutMs: CAPTION_TIMEOUT_MS
  },
  {
    name: "style_reference",
    title: "Style Reference",
    description:
      "Generate an image whose mood, color, and composition weight follow the reference layer " +
      "already captured for Style Reference in the OpenLayer panel, guided by a text prompt. " +
      "Requires a source captured in the panel first — this tool cannot capture one. Only the " +
      "parameters you pass are changed. Returns the panel's own status message.",
    schema: STYLE_REFERENCE_SCHEMA,
    timeoutMs: GENERATION_TIMEOUT_MS
  },
  {
    name: "multi_reference",
    title: "Multi-Reference Composition",
    description:
      "Compose one image from the ordered list of reference layers already captured in the " +
      "OpenLayer panel, guided by a text prompt. Requires those layers captured in the panel " +
      "first — this tool cannot capture them, add to the list, or reorder it. Clothing, props, " +
      "setting and lighting carry across from the references; faces do not, so this cannot place " +
      "a specific person in a picture. The first reference sets the output size. Only the " +
      "parameters you pass are changed. Returns the panel's own status message.",
    schema: MULTI_REFERENCE_SCHEMA,
    timeoutMs: GENERATION_TIMEOUT_MS
  },
  {
    name: "unflatten",
    title: "Unflatten",
    description:
      "Split the flat layer already captured in the OpenLayer panel into separate layers with " +
      "real transparency, and import them into the open Photoshop document in stacking order. " +
      "Requires that layer captured in the panel first \u2014 this tool cannot capture it. " +
      "It needs a picture with something standing in front of something else: a close-up that " +
      "fills the frame has no front and back to find and comes back unseparated, whether it is " +
      "a photograph or a generated image. The number of layers requested is a ceiling rather " +
      "than a promise, so some may come back empty. Results are re-rendered at 640px on the " +
      "long side, so layers are softer than the original on a large document. Takes about two " +
      "minutes. Only the parameters you pass are changed. Returns the panel's own status " +
      "message.",
    schema: UNFLATTEN_SCHEMA,
    timeoutMs: GENERATION_TIMEOUT_MS
  }
];
