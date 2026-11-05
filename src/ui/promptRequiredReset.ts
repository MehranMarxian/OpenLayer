import { AppElements } from "./appMarkup";
import {
  StatusTone,
  setImageError,
  setImageStatus,
  setInpaintError,
  setInpaintStatus,
  setMultiReferenceError,
  setMultiReferenceStatus,
  setOutpaintError,
  setOutpaintStatus,
  setSketchError,
  setSketchStatus,
  setStyleReferenceError,
  setStyleReferenceStatus,
  setTextToImageError,
  setTextToImageStatus
} from "./statusBars";

/**
 * Clears a tool's "Prompt required." error as soon as its prompt field has
 * text again.
 *
 * Pressing Generate with an empty prompt sets two things: the status bar reads
 * "Prompt required." with the red Error pill, and the error line under it says
 * "Enter a prompt before generating." Nothing took them back down until the
 * next Generate. So loading a prompt from the Wallet left the screen showing a
 * full prompt field directly above an error saying there was none (G4 smoke
 * run, 2026-11-05, finding 4). Typing had the same problem; the Wallet just
 * made it obvious, because Load sends the artist away and back.
 *
 * It listens on the field's "input" event rather than inside the Wallet,
 * because every way a prompt arrives already fires one: typing, Wallet Load
 * (`promptWallet.ts` `useEntry`), the agent bridge (`notifyFieldChanged`) and
 * prompt-memory undo. One listener covers them all, and the Wallet stays
 * ignorant of status bars.
 *
 * It only ever clears the prompt error. The status text is the evidence: the
 * handlers write exactly PROMPT_REQUIRED_STATUS in that branch and nowhere
 * else, and any later run, failure or global message overwrites it. So a
 * "Generation failed." or "ComfyUI is offline." is never touched by typing.
 */

/** What every tool's status bar reads when Generate was pressed with no prompt. */
export const PROMPT_REQUIRED_STATUS = "Prompt required.";

/** The status a tool shows at startup, and returns to once the error is stale. */
const READY_STATUS = "Ready.";

/**
 * True when the status bar still says "Prompt required." but the field now
 * holds a prompt, i.e. the error describes a state that no longer exists.
 *
 * Takes nullable strings on purpose: UXP reports an empty textarea's `.value`
 * as null, where browsers and jsdom report "" (see `textareaValue.ts`).
 */
export function isPromptRequiredErrorStale(
  statusText: string | null | undefined,
  promptText: string | null | undefined
): boolean {
  return (statusText ?? "").trim() === PROMPT_REQUIRED_STATUS && (promptText ?? "").trim() !== "";
}

export type PromptRequiredTool = {
  /** The prompt field Generate checks. */
  prompt: keyof AppElements;
  /** The status text that shows "Prompt required.". */
  statusText: keyof AppElements;
  setStatus: (elements: AppElements, status: string, tone: StatusTone) => void;
  setError: (elements: AppElements, message: string) => void;
};

// Every tool whose Generate stops with "Prompt required.". Inpaint reaches it
// through `inpaintReadiness.ts` ("prompt-missing") rather than inline, but it
// lands on the same status text. Live Painting, Unflatten and Prompt from Layer
// have Wallet dots but no prompt-required stop, so they are not listed.
export const PROMPT_REQUIRED_TOOLS: readonly PromptRequiredTool[] = [
  { prompt: "prompt", statusText: "statusText", setStatus: setTextToImageStatus, setError: setTextToImageError },
  { prompt: "imgPrompt", statusText: "imgStatusText", setStatus: setImageStatus, setError: setImageError },
  { prompt: "sketchPrompt", statusText: "sketchStatusText", setStatus: setSketchStatus, setError: setSketchError },
  { prompt: "inpaintPrompt", statusText: "inpaintStatusText", setStatus: setInpaintStatus, setError: setInpaintError },
  { prompt: "outpaintPrompt", statusText: "outpaintStatusText", setStatus: setOutpaintStatus, setError: setOutpaintError },
  {
    prompt: "styleReferencePrompt",
    statusText: "styleReferenceStatusText",
    setStatus: setStyleReferenceStatus,
    setError: setStyleReferenceError
  },
  {
    prompt: "multiReferencePrompt",
    statusText: "multiReferenceStatusText",
    setStatus: setMultiReferenceStatus,
    setError: setMultiReferenceError
  }
];

/**
 * Never allowed to break the panel: a throw here lands partway through
 * renderApp and silently disables every binding registered after it.
 */
export function bindPromptRequiredReset(
  elements: AppElements,
  tools: readonly PromptRequiredTool[] = PROMPT_REQUIRED_TOOLS
) {
  try {
    for (const tool of tools) {
      const field = elements[tool.prompt] as HTMLTextAreaElement;
      const status = elements[tool.statusText] as HTMLElement;

      field.addEventListener("input", () => {
        if (isPromptRequiredErrorStale(status.textContent, field.value)) {
          tool.setError(elements, "");
          tool.setStatus(elements, READY_STATUS, "idle");
        }
      });
    }
  } catch (error) {
    console.log("[OpenLayer] prompt-required reset failed to bind:", error);
  }
}
