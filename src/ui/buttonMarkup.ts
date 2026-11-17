/**
 * The panel's button primitive: one place that writes the markup for a control
 * the artist presses.
 *
 * Why a div and not a <button>: on Photoshop 28 (UXP 9.4.1) the host paints its
 * own grey face over every native <button>, whatever the stylesheet says. The
 * computed background is still ours, so no CSS route can win: inline
 * !important, appearance:none and a coloured child were all tried and all lost
 * (docs/ui-audit-ps28.md, V1 to V5). A <div role="button"> with the same classes
 * draws exactly as styled on Photoshop 28 and 2025.
 *
 * The div keeps everything the native tag gave for free, by hand:
 * - role="button" and tabindex="0" so it is announced and reachable by Tab.
 * - Enter and Space activate it: bindActionControl and the delegated action
 *   binding in appBindings.ts already handle both keys for any element.
 * - Disabled is the is-disabled class plus aria-disabled="true" plus
 *   tabindex="-1", the same three things setActionDisabled writes at runtime,
 *   so a control can be born disabled and later enabled by the existing code.
 *   The native `disabled` attribute means nothing on a div and is never used.
 *
 * On/off controls (toggles, filter chips) carry their state in data-state for
 * styling and aria-pressed for screen readers. The stylesheet must never key
 * on aria-pressed: `.theme-compact button[aria-pressed]` already turned a
 * filter chip into a gold switch once (docs/ORCHESTRATION.md section 3, trap 3).
 *
 * Pure: it returns a string and touches no DOM, so it is tested in node.
 */

/**
 * The looks a button can have. Each maps to the classes the panel already
 * styles, so converting a native button to this primitive changes its tag and
 * nothing else about how the stylesheet sees it.
 */
export type ButtonTone =
  /** Plain action: Copy Prompt, Check ComfyUI, Save Settings. */
  | "secondary"
  /** Blue filled action: Continue, Try again. */
  | "primary"
  /** The orange Generate button. */
  | "generate"
  /** Capture Active Layer, Capture Canvas. */
  | "capture"
  /** Import to Layers. */
  | "import"
  /** Cancel Generation. */
  | "cancel"
  /** An on/off switch such as Import Automatically. */
  | "toggle"
  /** A filter chip, as on the Setup screen. */
  | "chip"
  /** Show Negative Prompt, Advanced settings. */
  | "disclosure";

export type ButtonState = "on" | "off";

export interface ButtonSpec {
  label: string;
  tone?: ButtonTone;
  id?: string;
  /** data-openlayer-action: what the delegated action binding runs. */
  action?: string;
  /** data-openlayer-view: the screen the tool-card binding opens. */
  view?: string;
  disabled?: boolean;
  /** Full width of its row. */
  wide?: boolean;
  /** Only meaningful for "toggle" and "chip"; defaults to "off" for those. */
  state?: ButtonState;
  /** Extra classes, appended after the tone's own. */
  className?: string;
  /** Tooltip, also used as the accessible name when the label is a glyph. */
  title?: string;
  hidden?: boolean;
}

const TONE_CLASSES: Record<ButtonTone, string> = {
  secondary: "button",
  primary: "button button-primary",
  generate: "button button-primary button-generate",
  capture: "button source-action-button",
  import: "button button-import button-import-blue",
  cancel: "button cancel-generation-button",
  toggle: "button auto-import-toggle",
  // No "button" class: the Setup chips never had one, and adding it would pull
  // in every compact .button rule and turn a quiet pill into a full button.
  chip: "setup-filter-chip",
  disclosure: "button disclosure-button"
};

const STATEFUL_TONES: ReadonlySet<ButtonTone> = new Set<ButtonTone>(["toggle", "chip"]);

/**
 * Escapes text for an HTML attribute or text node. Labels are plain text by
 * the panel's copy rule, but an id or title built from data must never be able
 * to close the attribute it sits in.
 */
export function escapeMarkup(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buttonClassName(
  spec: Pick<ButtonSpec, "tone" | "wide" | "disabled" | "className" | "action" | "state">
) {
  const tone = spec.tone ?? "secondary";
  const classes = [TONE_CLASSES[tone]];

  // The base stylesheet already draws an "on" toggle or chip from is-active
  // (.auto-import-toggle.is-active, .setup-filter-chip.is-active), so it is
  // kept alongside data-state until U1b moves those rules over.
  if (STATEFUL_TONES.has(tone) && spec.state === "on") {
    classes.push("is-active");
  }

  if (spec.wide) {
    classes.push("button-wide");
  }

  // action-control is what the busy lockout and the agent bridge look for on
  // an actionable control. A demo control with no action must not carry it,
  // or a running generation would "lock" a button that does nothing.
  if (spec.action) {
    classes.push("action-control");
  }

  if (spec.className) {
    classes.push(spec.className.trim());
  }

  if (spec.disabled) {
    classes.push("is-disabled");
  }

  return classes.filter(Boolean).join(" ");
}

export function createButtonMarkup(spec: ButtonSpec) {
  const tone = spec.tone ?? "secondary";
  const attributes: string[] = [`class="${escapeMarkup(buttonClassName(spec))}"`, `role="button"`];

  attributes.push(`tabindex="${spec.disabled ? "-1" : "0"}"`);
  attributes.push(`aria-disabled="${spec.disabled ? "true" : "false"}"`);

  if (spec.id) {
    attributes.push(`id="${escapeMarkup(spec.id)}"`);
  }

  if (spec.action) {
    attributes.push(`data-openlayer-action="${escapeMarkup(spec.action)}"`);
  }

  if (spec.view) {
    attributes.push(`data-openlayer-view="${escapeMarkup(spec.view)}"`);
  }

  if (STATEFUL_TONES.has(tone)) {
    const state: ButtonState = spec.state ?? "off";
    attributes.push(`data-state="${state}"`);
    attributes.push(`aria-pressed="${state === "on" ? "true" : "false"}"`);
  }

  if (spec.title) {
    attributes.push(`title="${escapeMarkup(spec.title)}"`);
  }

  if (spec.hidden) {
    attributes.push("hidden");
  }

  return `<div ${attributes.join(" ")}>${escapeMarkup(spec.label)}</div>`;
}
