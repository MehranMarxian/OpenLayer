import type { AppElements } from "./appMarkup";
import type { HistoryToolType } from "./historyMetadata";

// Keys of AppElements whose element type actually carries a .disabled property,
// so a table entry pointing at a plain HTMLElement is a compile error rather
// than a silent no-op at runtime.
export type DisableableElementKey = {
  [K in keyof AppElements]: AppElements[K] extends { disabled: boolean } ? K : never;
}[keyof AppElements];

// Keys naming a single HTMLElement (the action buttons are generic elements
// driven through setActionDisabled, not native form controls).
export type ActionElementKey = {
  [K in keyof AppElements]: AppElements[K] extends HTMLElement ? K : never;
}[keyof AppElements];

export type BusyFieldGroupName = HistoryToolType | "global";

// Form fields are locked only for the tool performing the current operation.
// Global fields remain locked for every operation because changing them can
// disrupt the active request.
export const BUSY_DISABLED_FIELD_GROUPS: Readonly<
  Record<BusyFieldGroupName, readonly DisableableElementKey[]>
> = {
  global: ["serverUrl"],
  "text-to-image": [
    "prompt",
    "negativePrompt",
    "workflow",
    "checkpoint",
    "width",
    "height",
    "steps",
    "cfg",
    "seed"
  ],
  "image-to-image": [
    "imgPrompt",
    "imgNegativePrompt",
    "imgWorkflow",
    "imgCheckpoint",
    "imgSteps",
    "imgCfg",
    "imgSeed",
    "imgDenoise"
  ],
  "sketch-to-image": [
    "sketchPrompt",
    "sketchNegativePrompt",
    "sketchWorkflow",
    "sketchCheckpoint",
    "sketchSteps",
    "sketchCfg",
    "sketchSeed",
    "sketchDenoise",
    "sketchControlStrength"
  ],
  inpaint: [
    "inpaintPrompt",
    "inpaintNegativePrompt",
    "inpaintWorkflow",
    "inpaintCheckpoint",
    "inpaintSteps",
    "inpaintCfg",
    "inpaintSeed",
    "inpaintDenoise"
  ],
  outpaint: [
    "outpaintPrompt",
    "outpaintWorkflow",
    "outpaintCheckpoint",
    "outpaintSteps",
    "outpaintGuidance",
    "outpaintSeed",
    "outpaintDenoise",
    "outpaintLeft",
    "outpaintTop",
    "outpaintRight",
    "outpaintBottom",
    "outpaintFeathering"
  ],
  upscale: ["upscaleWorkflow", "upscaleModel"],
  "prompt-from-layer": [
    "promptLayerTask",
    "promptLayerNumBeams",
    "promptLayerGeneratedText"
  ]
};

// Actions that are unavailable during every operation. The two primary
// buttons here join the gated Generate buttons below to preserve the
// generation controller's single-active-run contract.
export const BUSY_ALWAYS_DISABLED_ACTIONS: readonly ActionElementKey[] = [
  "checkButton",
  "findPortButton",
  "detectHardwareButton",
  "checkWorkflowHealthButton",
  "copyDiagnosticsButton",
  "saveSettingsButton",
  "resetSettingsButton",
  "generateButton",
  "generatePromptLayerButton",
  "clearHistoryButton"
];

// These actions were part of the old panel-wide busy lock. They deliberately
// remain live so another tool can be prepared or its source recaptured while
// the current operation continues.
export const BUSY_ALLOWED_ACTIONS: readonly ActionElementKey[] = [
  "negativePromptToggle",
  "autoImportToggle",
  "imgAutoImportToggle",
  "upscaleAutoImportToggle",
  "captureLayerButton",
  "captureCanvasButton",
  "experimentalCheckpointToggle",
  "captureSketchLayerButton",
  "captureSketchCanvasButton",
  "captureInpaintSelectionButton",
  "captureInpaintActiveLayerButton",
  "captureOutpaintLayerButton",
  "captureOutpaintCanvasButton",
  "captureUpscaleLayerButton",
  "captureUpscaleCanvasButton",
  "capturePromptLayerButton",
  "capturePromptCanvasButton",
  "copyPromptLayerButton",
  "sendPromptLayerButton"
];

// Tool state a gated button also needs before it can be enabled: generate
// buttons need their captured source, import buttons need their result.
export type BusyGateName =
  | "result"
  | "imageSource"
  | "imageResult"
  | "sketchSource"
  | "sketchResult"
  | "inpaintSource"
  | "inpaintResult"
  | "outpaintSource"
  | "outpaintResult"
  | "upscaleSource"
  | "upscaleResult";

export type BusyGatedAction = Readonly<{
  button: ActionElementKey;
  gate: BusyGateName;
}>;

export const BUSY_GATED_ACTIONS: readonly BusyGatedAction[] = [
  { button: "importButton", gate: "result" },
  { button: "generateImg2ImgButton", gate: "imageSource" },
  { button: "importImg2ImgButton", gate: "imageResult" },
  { button: "generateSketchButton", gate: "sketchSource" },
  { button: "importSketchButton", gate: "sketchResult" },
  { button: "generateInpaintButton", gate: "inpaintSource" },
  { button: "importInpaintButton", gate: "inpaintResult" },
  { button: "generateOutpaintButton", gate: "outpaintSource" },
  { button: "importOutpaintButton", gate: "outpaintResult" },
  { button: "generateUpscaleButton", gate: "upscaleSource" },
  { button: "importUpscaleButton", gate: "upscaleResult" }
];
