/**
 * The "Import Automatically" switch for tools that gained one after the first
 * seven (Text to Image, Image to Image, Inpaint, Upscale, Remove Background,
 * Layer Maps, Live Painting each carry their own hand-written copy in App.ts).
 *
 * One small object holds every tool's on/off flag and repaints the matching
 * button, instead of seven more copies of "a let, a toggle handler, a paint
 * function". App.ts stays the place that knows how to import: it asks
 * `isOn(tool)` once a generation succeeds and calls the tool's own import
 * handler, exactly as the older tools do.
 *
 * The flag is session-only on purpose, like every other tool's: it resets when
 * the panel is reopened, so an artist never imports into a document by surprise
 * because of a switch they flipped last week.
 *
 * The button text, `aria-pressed` and `is-active` class are what
 * `updateAutoImportToggle` and its siblings in App.ts write, and the stylesheet
 * draws the "on" look from `.auto-import-toggle.is-active`. Panel text renders
 * via textContent, so these labels are plain text.
 */

/**
 * The tools this module drives, with the name each one uses in its status
 * line. Keyed by the same ids as `HistoryToolType`, so App.ts can reuse its
 * per-tool diagnostics table.
 */
export const AUTO_IMPORT_TOOL_NAMES = {
  "sketch-to-image": "Sketch to Image",
  outpaint: "Outpaint",
  "style-reference": "Style Reference",
  "multi-reference": "Multi-Reference",
  unflatten: "Unflatten",
  "camera-angle": "Camera Angle"
} as const;

export type AutoImportTool = keyof typeof AUTO_IMPORT_TOOL_NAMES;

export const AUTO_IMPORT_OFF_LABEL = "Import Automatically";
export const AUTO_IMPORT_ON_LABEL = "Auto Import On";

export function paintAutoImportToggle(toggle: HTMLElement, isEnabled: boolean) {
  toggle.textContent = isEnabled ? AUTO_IMPORT_ON_LABEL : AUTO_IMPORT_OFF_LABEL;
  toggle.setAttribute("aria-pressed", String(isEnabled));
  toggle.classList.toggle("is-active", isEnabled);
}

export interface AutoImportFlags<Tool extends string> {
  isOn: (tool: Tool) => boolean;
  /** Flips the flag, repaints that tool's button, and returns the new state. */
  toggle: (tool: Tool) => boolean;
  /** Paints every button from its flag; called once when the panel starts. */
  paintAll: () => void;
}

export function createAutoImportFlags<Tool extends string>(
  toggles: Readonly<Record<Tool, HTMLElement>>
): AutoImportFlags<Tool> {
  const enabled = new Set<Tool>();
  const tools = Object.keys(toggles) as Tool[];

  return {
    isOn: (tool) => enabled.has(tool),
    toggle: (tool) => {
      if (enabled.has(tool)) {
        enabled.delete(tool);
      } else {
        enabled.add(tool);
      }

      const isEnabled = enabled.has(tool);
      paintAutoImportToggle(toggles[tool], isEnabled);
      return isEnabled;
    },
    paintAll: () => {
      for (const tool of tools) {
        paintAutoImportToggle(toggles[tool], enabled.has(tool));
      }
    }
  };
}
