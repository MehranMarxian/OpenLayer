import type { AppElements } from "./appMarkup";

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

// Every form field the panel locks while a generation or import is running.
export const BUSY_DISABLED_FIELDS: readonly DisableableElementKey[] = [
  "serverUrl",
  "prompt",
  "negativePrompt",
  "workflow",
  "checkpoint",
  "width",
  "height",
  "steps",
  "cfg",
  "seed",
  "imgPrompt",
  "imgNegativePrompt",
  "imgWorkflow",
  "imgCheckpoint",
  "imgSteps",
  "imgCfg",
  "imgSeed",
  "imgDenoise",
  "sketchPrompt",
  "sketchNegativePrompt",
  "sketchWorkflow",
  "sketchCheckpoint",
  "sketchSteps",
  "sketchCfg",
  "sketchSeed",
  "sketchDenoise",
  "sketchControlStrength",
  "inpaintPrompt",
  "inpaintNegativePrompt",
  "inpaintWorkflow",
  "inpaintCheckpoint",
  "inpaintSteps",
  "inpaintCfg",
  "inpaintSeed",
  "inpaintDenoise",
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
  "outpaintFeathering",
  "upscaleWorkflow",
  "upscaleModel",
  "promptLayerTask",
  "promptLayerNumBeams",
  "promptLayerGeneratedText"
];

// Action buttons that are simply unavailable while busy.
export const BUSY_DISABLED_ACTIONS: readonly ActionElementKey[] = [
  "checkButton",
  "findPortButton",
  "detectHardwareButton",
  "checkWorkflowHealthButton",
  "copyDiagnosticsButton",
  "saveSettingsButton",
  "resetSettingsButton",
  "negativePromptToggle",
  "autoImportToggle",
  "imgAutoImportToggle",
  "upscaleAutoImportToggle",
  "generateButton",
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
  "generatePromptLayerButton",
  "copyPromptLayerButton",
  "sendPromptLayerButton",
  "clearHistoryButton"
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
