import { OpenLayerTheme } from "../utils/preferences";

export const DEFAULT_SERVER_URL = "http://127.0.0.1:8190";
export const APP_VERSION = "0.18.0";
export const DEVELOPER_GITHUB = "https://github.com/MehranMarxian";
export const HISTORY_LIMIT = 5;
export const COMFY_PORT_CANDIDATES = [8190, 8188, 8189, 8191, 8192, 8193, 7860];
export const DEFAULT_WORKFLOW = "txt2img-basic";
export const DEFAULT_IMAGE_WORKFLOW = "img2img-basic";
export const DEFAULT_SKETCH_WORKFLOW = "sketch2img-linecn-basic";
export const DEFAULT_INPAINT_WORKFLOW = "inpaint-basic";
export const DEFAULT_OUTPAINT_WORKFLOW = "outpaint-flux-fill-basic";
export const DEFAULT_THEME: OpenLayerTheme = "compact";
export const DEFAULT_UPSCALE_WORKFLOW = "upscale-basic";
export const DEFAULT_STYLE_REFERENCE_WORKFLOW = "style-reference-sd15";
export const FALLBACK_UPSCALE_MODELS = ["4x-UltraSharp.pth", "RealESRGAN_x4plus.pth"];
export const RECOMMENDED_SKETCH_CHECKPOINT = "epicrealism_naturalSinRC1VAE.safetensors";
export const RECOMMENDED_STYLE_REFERENCE_CHECKPOINT = "epicrealism_naturalSinRC1VAE.safetensors";
export const DEFAULT_WIDTH = "512";
export const DEFAULT_HEIGHT = "512";
export const DEFAULT_STEPS = "20";
export const DEFAULT_CFG = "7";
export const DEFAULT_IMG2IMG_STEPS = "12";
export const DEFAULT_IMG2IMG_DENOISE = "0.55";
export const DEFAULT_SKETCH_STEPS = "20";
export const DEFAULT_SKETCH_DENOISE = "1";
export const DEFAULT_SKETCH_CONTROL_STRENGTH = "0.8";
export const DEFAULT_STYLE_REFERENCE_CONTROL_STRENGTH = "1";
/** One control drives both strength_model and strength_clip; 0.8 is the usual starting point. */
export const DEFAULT_LORA_STRENGTH = "0.8";
export const DEFAULT_INPAINT_STEPS = "16";
export const DEFAULT_INPAINT_DENOISE = "0.75";
export const DEFAULT_OUTPAINT_STEPS = "20";
export const DEFAULT_OUTPAINT_GUIDANCE = "10";
export const DEFAULT_OUTPAINT_DENOISE = "1";
export const DEFAULT_OUTPAINT_LEFT = "400";
export const DEFAULT_OUTPAINT_TOP = "0";
export const DEFAULT_OUTPAINT_RIGHT = "400";
export const DEFAULT_OUTPAINT_BOTTOM = "400";
export const DEFAULT_OUTPAINT_FEATHERING = "40";
export const DEFAULT_PROMPT_LAYER_TASK = "detailed_caption";
export const DEFAULT_PROMPT_LAYER_NUM_BEAMS = "12";
export const PROMPT_LAYER_TASKS = [
  { value: "detailed_caption", label: "Detailed caption" },
  { value: "caption", label: "Caption" },
  { value: "more_detailed_caption", label: "More detailed caption" }
];
export const FALLBACK_CHECKPOINTS = [
  "epicrealism_naturalSinRC1VAE.safetensors",
  "epicrealism_pureEvolutionV5-inpainting.safetensors",
  "flux1-dev-fp8.safetensors",
  "model.safetensors",
  "sd3.5_large.safetensors",
  "sd3_medium_incl_clips_t5xxlfp8.safetensors",
  "sd_xl_base_1.0.safetensors",
  "sd_xl_refiner_1.0.safetensors"
];

export type AppView =
  | "home"
  | "text-to-image"
  | "image-to-image"
  | "sketch-to-image"
  | "inpaint"
  | "outpaint"
  | "prompt-from-layer"
  | "upscale"
  | "live-painting"
  | "style-reference"
  | "workflow-presets"
  | "custom-workflow"
  | "settings"
  | "setup"
  | "history"
  | "layer-tools"
  | "prompt-wallet";
export type ToolCardStatus = "available" | "experimental" | "coming-soon";

export type ToolCard = {
  id: string;
  title: string;
  subtitle: string;
  icon: ToolIconName;
  status: ToolCardStatus;
  view?: AppView;
};

export type ToolIconName =
  | "image"
  | "imagePlus"
  | "brush"
  | "expand"
  | "lineart"
  | "promptFromLayer"
  | "upscale"
  | "livePainting"
  | "styleReference"
  | "control"
  | "workflow"
  | "layers"
  | "history"
  | "settings";

export const TOOL_CARDS: ToolCard[] = [
  {
    id: "text-to-image",
    title: "Text to Image",
    subtitle: "Generate a new layer from a prompt",
    icon: "imagePlus",
    status: "available",
    view: "text-to-image"
  },
  {
    id: "image-to-image",
    title: "Image to Image",
    subtitle: "Use the active layer as visual input",
    icon: "image",
    status: "available",
    view: "image-to-image"
  },
  {
    id: "inpaint",
    title: "Inpaint",
    subtitle: "Repaint a selection in place",
    icon: "brush",
    status: "available",
    view: "inpaint"
  },
  {
    id: "prompt-from-layer",
    title: "Prompt from Layer",
    subtitle: "Describe a layer into prompt text",
    icon: "promptFromLayer",
    status: "available",
    view: "prompt-from-layer"
  },
  {
    id: "outpaint",
    title: "Outpaint",
    subtitle: "Extend canvas content beyond edges",
    icon: "expand",
    status: "available",
    view: "outpaint"
  },
  {
    id: "lineart",
    title: "Sketch to Image",
    subtitle: "Guide generation with lineart",
    icon: "lineart",
    status: "available",
    view: "sketch-to-image"
  },
  {
    id: "upscale",
    title: "Upscale",
    subtitle: "Enhance generated or selected layers",
    icon: "upscale",
    status: "available",
    view: "upscale"
  },
  {
    id: "live-painting",
    title: "Live Painting",
    subtitle: "Paint and watch AI respond live",
    icon: "livePainting",
    status: "available",
    view: "live-painting"
  },
  {
    id: "style-reference",
    title: "Style Reference",
    // Deliberately narrower than it used to read. Measured against a flat
    // cartoon reference, this borrows palette and mood and little else -- it
    // is not a "make my picture look like that picture" tool, and promising
    // visual language set an expectation the model does not meet.
    subtitle: "Borrow a reference layer's mood and colour",
    icon: "styleReference",
    status: "available",
    view: "style-reference"
  },
  {
    id: "workflow-presets",
    title: "Workflow Presets",
    subtitle: "Browse every preset and what it needs",
    icon: "control",
    status: "available",
    view: "workflow-presets"
  },
  {
    id: "workflow",
    title: "Workflow",
    subtitle: "Check a custom ComfyUI graph against this server",
    icon: "workflow",
    status: "available",
    view: "custom-workflow"
  },
  {
    id: "layer-tools",
    title: "Layer Tools",
    subtitle: "Export layers, selections, and masks",
    icon: "layers",
    status: "available",
    view: "layer-tools"
  },
  {
    id: "history",
    title: "History",
    subtitle: "Review recent generations",
    icon: "history",
    status: "available",
    view: "history"
  },
  {
    id: "prompt-wallet",
    title: "Prompt Wallet",
    subtitle: "Save and reuse favorite prompts",
    icon: "promptFromLayer",
    status: "available",
    view: "prompt-wallet"
  },
  {
    id: "setup",
    title: "Setup",
    subtitle: "Models and nodes you still need",
    icon: "control",
    status: "available",
    view: "setup"
  },
  {
    id: "settings",
    title: "Settings",
    subtitle: "Defaults, ports, paths, and diagnostics",
    icon: "settings",
    status: "available",
    view: "settings"
  }
];

export const HOME_TOOL_SECTIONS = [
  {
    title: "Generate",
    toolIds: ["text-to-image", "image-to-image", "lineart", "inpaint", "outpaint", "upscale", "prompt-from-layer", "live-painting", "style-reference"]
  },
  {
    title: "Workflow",
    toolIds: ["workflow-presets", "workflow"]
  },
  {
    title: "Tools & History",
    toolIds: ["layer-tools", "history", "prompt-wallet"]
  },
  {
    title: "Preferences",
    toolIds: ["setup", "settings"]
  }
];
