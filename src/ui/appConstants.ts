import { OpenLayerTheme } from "../utils/preferences";

export const DEFAULT_SERVER_URL = "http://127.0.0.1:8190";
export const APP_VERSION = "0.6.0";
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
export const FALLBACK_UPSCALE_MODELS = ["4x-UltraSharp.pth", "RealESRGAN_x4plus.pth"];
export const RECOMMENDED_SKETCH_CHECKPOINT = "epicrealism_naturalSinRC1VAE.safetensors";
export const DEFAULT_WIDTH = "512";
export const DEFAULT_HEIGHT = "512";
export const DEFAULT_STEPS = "20";
export const DEFAULT_CFG = "7";
export const DEFAULT_IMG2IMG_STEPS = "12";
export const DEFAULT_IMG2IMG_DENOISE = "0.55";
export const DEFAULT_SKETCH_STEPS = "20";
export const DEFAULT_SKETCH_DENOISE = "1";
export const DEFAULT_SKETCH_CONTROL_STRENGTH = "0.8";
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
  | "settings"
  | "history";
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
  | "style"
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
    icon: "style",
    status: "available",
    view: "live-painting"
  },
  {
    id: "style-reference",
    title: "Style Reference",
    subtitle: "Match mood, color, or visual language",
    icon: "style",
    status: "coming-soon"
  },
  {
    id: "workflow-presets",
    title: "Workflow Presets",
    subtitle: "Manage reusable ComfyUI workflows",
    icon: "control",
    status: "coming-soon"
  },
  {
    id: "workflow",
    title: "Workflow",
    subtitle: "Build and test custom ComfyUI graphs",
    icon: "workflow",
    status: "coming-soon"
  },
  {
    id: "layer-tools",
    title: "Layer Tools",
    subtitle: "Export layers, selections, and masks",
    icon: "layers",
    status: "coming-soon"
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
    toolIds: ["text-to-image", "image-to-image", "lineart", "inpaint", "outpaint", "upscale", "prompt-from-layer", "live-painting"]
  },
  {
    title: "Workflow",
    toolIds: ["workflow-presets", "workflow", "style-reference"]
  },
  {
    title: "Tools & History",
    toolIds: ["layer-tools", "history"]
  },
  {
    title: "Preferences",
    toolIds: ["settings"]
  }
];
