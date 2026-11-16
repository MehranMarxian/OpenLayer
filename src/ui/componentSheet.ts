import { createButtonMarkup, escapeMarkup } from "./buttonMarkup";

/**
 * The UI sheet: a hidden screen, opened from Settings, that draws every panel
 * component in every state in the current theme.
 *
 * It exists because a browser render proves nothing about the panel. UXP 9 on
 * Photoshop 28 paints its own face over native <button>s, does not draw inline
 * `opacity`, and ignores flex `gap`; Photoshop 2025 differs again. So a look is
 * approved only from this sheet, captured in Photoshop 28 and 2025 in both
 * themes, and screens are later assembled from components that passed
 * (docs/ui-audit-ps28.md, sections 1 and 5, item U0).
 *
 * Each component is drawn twice where that is the question: as the panel builds
 * it today (a native <button>), and as the div primitive from buttonMarkup.ts
 * with the same classes. Secondary buttons get every candidate side by side:
 * the native tag, the two Spectrum widgets UXP ships, and a div styled from the
 * host's own --uxp-host-* variables.
 *
 * The sheet is markup only. Nothing in it has a data-openlayer-action, so no
 * control here can run anything; the one script entry point fills in the
 * versions, theme and width shown at the top, which a capture must carry.
 *
 * Copy here renders as plain text in the panel: no markdown, no double hyphen.
 */

export const COMPONENT_SHEET_VIEW_ID = "ui-sheet-view";

type SheetCell = { caption: string; markup: string };

function cell(caption: string, markup: string): SheetCell {
  return { caption, markup };
}

function row(title: string, cells: SheetCell[], note?: string) {
  const cellsMarkup = cells
    .map(
      (entry) =>
        `<div class="ui-sheet-cell"><div class="ui-sheet-cell-body">${entry.markup}</div><div class="ui-sheet-caption">${escapeMarkup(entry.caption)}</div></div>`
    )
    .join("");
  const noteMarkup = note ? `<div class="ui-sheet-note">${escapeMarkup(note)}</div>` : "";

  return `
    <div class="ui-sheet-row">
      <div class="ui-sheet-row-title">${escapeMarkup(title)}</div>
      <div class="ui-sheet-cells">${cellsMarkup}</div>
      ${noteMarkup}
    </div>`;
}

function group(title: string, subtitle: string, body: string) {
  return `
    <section class="panel-section ui-sheet-group" aria-label="${escapeMarkup(title)}">
      <div class="section-heading">
        <span class="label">${escapeMarkup(title)}</span>
        <span class="muted-label">${escapeMarkup(subtitle)}</span>
      </div>
      ${body}
    </section>`;
}

/**
 * A native <button> exactly as appMarkup.ts writes one today. `disabled` here
 * mirrors runtime: setActionDisabled sets the class and ARIA, never the
 * attribute, so a disabled native button in the panel looks like this.
 */
function nativeButton(label: string, classes: string, options: { disabled?: boolean; pressed?: boolean } = {}) {
  const classList = options.disabled ? `${classes} is-disabled` : classes;
  const pressed =
    options.pressed === undefined ? "" : ` aria-pressed="${options.pressed ? "true" : "false"}"`;
  const disabled = options.disabled ? ` aria-disabled="true" tabindex="-1"` : "";

  return `<button class="${classList}" type="button"${pressed}${disabled}>${escapeMarkup(label)}</button>`;
}

function infoBlock() {
  return `
    <div class="ui-sheet-info">
      <div class="ui-sheet-info-line"><span>Photoshop</span><strong id="ui-sheet-host-version">Not read</strong></div>
      <div class="ui-sheet-info-line"><span>UXP</span><strong id="ui-sheet-uxp-version">Not read</strong></div>
      <div class="ui-sheet-info-line"><span>UI brightness</span><strong id="ui-sheet-host-theme">Not read</strong></div>
      <div class="ui-sheet-info-line"><span>Panel theme</span><strong id="ui-sheet-panel-theme">Not read</strong></div>
      <div class="ui-sheet-info-line"><span>Panel width</span><strong id="ui-sheet-width">Not read</strong></div>
    </div>`;
}

function primaryActionsGroup() {
  return group(
    "Primary actions",
    "OpenLayer colours",
    [
      row("Generate", [
        cell("native, today", nativeButton("Generate", "button button-primary button-generate button-wide")),
        cell("div primitive", createButtonMarkup({ label: "Generate", tone: "generate", wide: true }))
      ]),
      row("Generate, disabled", [
        cell("native, today", nativeButton("Generate", "button button-primary button-generate button-wide", { disabled: true })),
        cell("div primitive", createButtonMarkup({ label: "Generate", tone: "generate", wide: true, disabled: true }))
      ]),
      row("Capture", [
        cell(
          "native, today",
          `<div class="source-action-row">${nativeButton("Capture Active Layer", "button source-action-button")}${nativeButton("Capture Canvas", "button source-action-button")}</div>`
        ),
        cell(
          "div primitive",
          `<div class="source-action-row">${createButtonMarkup({ label: "Capture Active Layer", tone: "capture" })}${createButtonMarkup({ label: "Capture Canvas", tone: "capture" })}</div>`
        )
      ]),
      row("Import", [
        cell(
          "native, today",
          `<div class="import-actions">${nativeButton("Import to Layers", "button button-import button-import-blue")}</div>`
        ),
        cell("div primitive", `<div class="import-actions">${createButtonMarkup({ label: "Import to Layers", tone: "import" })}</div>`)
      ]),
      row("Import, disabled", [
        cell(
          "native, today",
          `<div class="import-actions">${nativeButton("Import to Layers", "button button-import button-import-blue", { disabled: true })}</div>`
        ),
        cell(
          "div primitive",
          `<div class="import-actions">${createButtonMarkup({ label: "Import to Layers", tone: "import", disabled: true })}</div>`
        )
      ]),
      row("Cancel", [
        cell("native, today", nativeButton("Cancel Generation", "button button-wide cancel-generation-button")),
        cell("div primitive", createButtonMarkup({ label: "Cancel Generation", tone: "cancel", wide: true }))
      ])
    ].join("")
  );
}

function secondaryButtonsGroup() {
  const hostButton = (label: string, extra = "") =>
    `<div class="ui-sheet-host-button${extra}" role="button" tabindex="0">${escapeMarkup(label)}</div>`;

  return group(
    "Secondary buttons",
    "Which look to keep",
    [
      row(
        "Today",
        [
          cell("native, button class", nativeButton("Copy Prompt", "button")),
          cell("native, disabled", nativeButton("Copy Prompt", "button", { disabled: true })),
          cell("div primitive", createButtonMarkup({ label: "Copy Prompt" })),
          cell("div, disabled", createButtonMarkup({ label: "Copy Prompt", disabled: true }))
        ],
        "The first two are what the panel ships. The div keeps the same classes."
      ),
      row(
        "Native look",
        [
          cell("bare native button", `<button type="button">Copy Prompt</button>`),
          cell("bare native, disabled", `<button type="button" disabled>Copy Prompt</button>`),
          cell("sp-button secondary", `<sp-button variant="secondary">Copy Prompt</sp-button>`),
          cell("sp-button, disabled", `<sp-button variant="secondary" disabled>Copy Prompt</sp-button>`),
          cell("sp-button quiet", `<sp-button variant="secondary" quiet>Copy Prompt</sp-button>`),
          cell("sp-action-button", `<sp-action-button>Copy Prompt</sp-action-button>`)
        ],
        "Photoshop draws these itself. Keep one only if it matches on Photoshop 2025 and 28."
      ),
      row(
        "Host colours",
        [
          cell("div, 24 px, radius 4", hostButton("Copy Prompt")),
          cell("div, 24 px pill", hostButton("Copy Prompt", " is-pill")),
          cell("div, disabled", `<div class="ui-sheet-host-button is-disabled" role="button" tabindex="-1" aria-disabled="true">Copy Prompt</div>`)
        ],
        "Styled only from the host variables, so it follows the Photoshop brightness setting."
      )
    ].join("")
  );
}

function stateControlsGroup() {
  return group(
    "Toggles, chips, disclosures",
    "On and off",
    [
      row("Toggle", [
        cell("native, off", nativeButton("Import Automatically", "button auto-import-toggle", { pressed: false })),
        cell("native, on", nativeButton("Import Automatically", "button auto-import-toggle is-active", { pressed: true })),
        cell("div, off", createButtonMarkup({ label: "Import Automatically", tone: "toggle", state: "off" })),
        cell("div, on", createButtonMarkup({ label: "Import Automatically", tone: "toggle", state: "on" }))
      ]),
      row("Filter chip", [
        cell("native, off", nativeButton("Inpaint", "setup-filter-chip", { pressed: false })),
        cell("native, on", nativeButton("Inpaint", "setup-filter-chip is-active", { pressed: true })),
        cell("div, off", createButtonMarkup({ label: "Inpaint", tone: "chip", state: "off" })),
        cell("div, on", createButtonMarkup({ label: "Inpaint", tone: "chip", state: "on" }))
      ]),
      row("Disclosure", [
        cell("native", nativeButton("Show Negative Prompt", "button disclosure-button")),
        cell("div primitive", createButtonMarkup({ label: "Show Negative Prompt", tone: "disclosure" }))
      ]),
      row("Small info button", [
        cell("native, today", `<button class="info-toggle" type="button" title="Show setup note"><span class="info-toggle-glyph" aria-hidden="true">?</span></button>`),
        cell(
          "div",
          `<div class="info-toggle" role="button" tabindex="0" title="Show setup note"><span class="info-toggle-glyph" aria-hidden="true">?</span></div>`
        )
      ])
    ].join("")
  );
}

function fieldsGroup() {
  return group(
    "Fields",
    "Pickers and inputs",
    [
      row("Picker", [
        cell(
          "select",
          `<select class="select"><option value="klein" selected>FLUX.2 Klein 4B</option><option value="standard">Standard checkpoint</option></select>`
        ),
        cell("select, disabled", `<select class="select" disabled><option value="klein" selected>FLUX.2 Klein 4B</option></select>`)
      ]),
      row("Text", [
        cell("text field", `<input class="input" type="text" value="http://127.0.0.1:8188" />`),
        cell("number field", `<input class="input input-compact" type="number" min="1" max="60" step="1" value="20" />`),
        cell("disabled", `<input class="input" type="text" value="Locked by preset" disabled />`)
      ]),
      row("Prompt", [
        cell("textarea", `<textarea class="textarea compact-textarea" maxlength="10000">A lighthouse at dusk, oil paint</textarea>`)
      ]),
      row(
        "Slider",
        [cell("range, step 1", `<div class="artist-row"><input class="artist-slider" type="range" min="1" max="60" step="1" value="20" /></div>`)],
        "UXP ignores the step while dragging; the panel snaps the value afterwards."
      )
    ].join("")
  );
}

function statusGroup() {
  const statusBar = (text: string, pillClass: string, pill: string) =>
    `<div class="status-bar"><span class="status-text">${escapeMarkup(text)}</span><span class="status-pill ${pillClass}">${escapeMarkup(pill)}</span></div>`;

  return group(
    "Status and messages",
    "Feedback",
    [
      row("Status bar", [
        cell("idle", statusBar("Foundation ready.", "idle", "Status")),
        cell("working", statusBar("Generating, step 3 of 4.", "working", "Working")),
        cell("ready", statusBar("Imported as a new layer.", "ready", "Ready")),
        cell("error", statusBar("ComfyUI is not reachable.", "error", "Error"))
      ]),
      row("Progress", [cell("40 percent", `<div class="status-progress"><span style="width: 40%"></span></div>`)]),
      row("Warning", [
        cell(
          "tool warning",
          `<div class="tool-warning" role="note">This model can invent detail that was not in the source.</div>`
        )
      ]),
      row("Error", [cell("error message", `<div class="error-message">ComfyUI is not reachable at 127.0.0.1:8188.</div>`)]),
      row("Hint", [cell("diagnostics line", `<div class="diagnostics-line">Capture a layer or the canvas first.</div>`)])
    ].join("")
  );
}

/**
 * The checks the audit could not settle (docs/ui-audit-ps28.md, section 2):
 * stylesheet opacity, hover and focus on a div button, and whether the host
 * variables exist. Every probe has a control beside it so the capture alone
 * answers the question, without anyone having to remember what it should look like.
 */
function openChecksGroup() {
  const hostSwatch = (name: string) =>
    `<div class="ui-sheet-swatch-cell"><div class="ui-sheet-swatch ui-sheet-host-${name}"></div><div class="ui-sheet-caption">${escapeMarkup(name)}</div></div>`;
  const hostText = (name: string) =>
    `<div class="ui-sheet-swatch-cell"><div class="ui-sheet-host-text-sample ui-sheet-host-${name}">Aa 12</div><div class="ui-sheet-caption">${escapeMarkup(name)}</div></div>`;

  return group(
    "Open checks",
    "Audit section 2",
    [
      row(
        "Opacity",
        [
          cell("reference, solid", `<div class="ui-sheet-strip"></div>`),
          cell("stylesheet opacity 0.3", `<div class="ui-sheet-strip ui-sheet-probe-opacity"></div>`),
          cell("inline opacity 0.3", `<div class="ui-sheet-strip" style="opacity: 0.3"></div>`),
          cell("rgba background", `<div class="ui-sheet-strip ui-sheet-probe-rgba"></div>`)
        ],
        "A strip as bright as the reference means that opacity is not drawn."
      ),
      row(
        "Hover and focus",
        [
          cell("div: hover turns green", `<div class="ui-sheet-probe-hover" role="button" tabindex="0">Hover</div>`),
          cell("div: focus draws blue", `<div class="ui-sheet-probe-focus" role="button" tabindex="0">Focus</div>`),
          cell("div: press darkens", `<div class="ui-sheet-probe-active" role="button" tabindex="0">Press</div>`),
          cell("native: hover turns green", `<button class="ui-sheet-probe-hover" type="button">Hover</button>`)
        ],
        "Point at, click or Tab to each one and compare it with its resting colour."
      ),
      row(
        "Host colours",
        [
          cell(
            "magenta means missing",
            `<div class="ui-sheet-swatches">${[
              "background-color",
              "border-color",
              "widget-hover-background-color",
              "widget-hover-border-color"
            ]
              .map(hostSwatch)
              .join("")}</div>`
          )
        ]
      ),
      row("Host text", [
        cell(
          "magenta means missing",
          `<div class="ui-sheet-swatches">${[
            "text-color",
            "text-color-secondary",
            "label-text-color",
            "widget-hover-text-color",
            "link-text-color",
            "link-hover-text-color"
          ]
            .map(hostText)
            .join("")}</div>`
        )
      ]),
      row(
        "Host font size",
        [
          cell("font-size", `<div class="ui-sheet-host-fs">Layers 100%</div>`),
          cell("font-size-smaller", `<div class="ui-sheet-host-fs-smaller">Layers 100%</div>`),
          cell("font-size-larger", `<div class="ui-sheet-host-fs-larger">Layers 100%</div>`)
        ],
        "A missing size falls back to 30 px, which cannot be mistaken for a real one."
      )
    ].join("")
  );
}

/**
 * Photoshop's own look beside ours, for the size scale (design rule 5). The
 * sampled colours are from the Layers and History panels on Photoshop 28 with
 * the dark UI (audit section 4), shown next to the live host variable.
 */
function referenceGroup() {
  const sampled = (hex: string, name: string) =>
    `<div class="ui-sheet-swatch-cell"><div class="ui-sheet-swatch" style="background-color: ${hex}"></div><div class="ui-sheet-caption">${escapeMarkup(`${name} ${hex}`)}</div></div>`;
  const typeSample = (px: number) =>
    `<div class="ui-sheet-type-sample" style="font-size: ${px}px">${px} px Opacity 100%</div>`;
  const heightSample = (px: number) =>
    `<div class="ui-sheet-height-cell"><div class="ui-sheet-host-button ui-sheet-height-sample" style="height: ${px}px; line-height: ${px - 2}px">${px} px</div></div>`;
  const iconSample = (px: number) =>
    `<div class="ui-sheet-icon-cell"><img src="icons/tools/layer-tools.png" alt="" aria-hidden="true" width="${px}" height="${px}" style="width: ${px}px; height: ${px}px" /><div class="ui-sheet-caption">${px} px</div></div>`;
  const spacingSample = (px: number) =>
    `<div class="ui-sheet-spacing-cell"><div class="ui-sheet-spacing-bar" style="width: ${px}px"></div><div class="ui-sheet-caption">${px}</div></div>`;

  return group(
    "Photoshop reference",
    "Size scale",
    [
      row("Colours", [
        cell(
          "sampled on Photoshop 28",
          `<div class="ui-sheet-swatches">${sampled("#4c4c4c", "body")}${sampled("#404040", "header")}${sampled("#414141", "dropdown")}${sampled("#6a6a6a", "selected")}<div class="ui-sheet-swatch-cell"><div class="ui-sheet-swatch ui-sheet-host-background-color"></div><div class="ui-sheet-caption">host now</div></div></div>`
        )
      ]),
      row("Type", [cell("11, 12, 14 and host", `${typeSample(11)}${typeSample(12)}${typeSample(14)}<div class="ui-sheet-type-sample ui-sheet-host-fs">host Opacity 100%</div>`)]),
      row("Control height", [cell("20, 24, 28, 32", `<div class="ui-sheet-heights">${[20, 24, 28, 32].map(heightSample).join("")}</div>`)]),
      row("Icons", [cell("16, 18, 24", `<div class="ui-sheet-icons">${[16, 18, 24].map(iconSample).join("")}</div>`)]),
      row("Spacing", [cell("4, 8, 12, 16", `<div class="ui-sheet-spacings">${[4, 8, 12, 16].map(spacingSample).join("")}</div>`)])
    ].join("")
  );
}

/**
 * The empty, hidden screen that sits in the app markup from the start.
 *
 * The sheet itself is about 28 KB of markup, a sixth of the whole panel, and
 * almost nobody opens it. Parsing it at every panel start would cost every
 * artist startup time for a developer tool, so it is written into this
 * placeholder on first entry instead (refreshComponentSheet).
 */
export function createComponentSheetPlaceholderMarkup() {
  return `
      <section class="ui-sheet-view" id="${COMPONENT_SHEET_VIEW_ID}" aria-label="UI sheet" hidden></section>`;
}

/** The sheet's contents, written into the placeholder on first entry. */
export function createComponentSheetMarkup() {
  return `
        <div class="screen-nav">
          <div class="back-button screen-back-control" role="button" tabindex="0" data-openlayer-view="settings">Back to Settings</div>
          <div class="screen-title-block">
            <span class="screen-kicker screen-icon" aria-label="UI sheet" title="UI sheet"><img class="icon-image" src="icons/tools/settings.png" alt="" aria-hidden="true" /></span>
            <span class="screen-title">UI sheet</span>
          </div>
        </div>
        <section class="panel-section ui-sheet-group" aria-label="About this sheet">
          <div class="diagnostics-line">Every panel control in the current theme, for checking how Photoshop draws it. Nothing here runs anything.</div>
          ${infoBlock()}
        </section>
        ${primaryActionsGroup()}
        ${secondaryButtonsGroup()}
        ${stateControlsGroup()}
        ${fieldsGroup()}
        ${statusGroup()}
        ${openChecksGroup()}
        ${referenceGroup()}`;
}

/** What the sheet prints at the top, so every capture says where it was taken. */
export interface ComponentSheetInfo {
  hostVersion: string;
  uxpVersion: string;
  hostTheme: string;
  panelTheme: string;
  width: string;
}

type HostRequire = (name: string) => unknown;

/**
 * Reads the host facts a capture needs. Each read is guarded on its own: the
 * sheet must still open, and say "Not available", in a host that lacks one.
 */
export function readComponentSheetInfo(panelTheme: string, root: HTMLElement | null, load?: HostRequire): ComponentSheetInfo {
  const host = load ?? (typeof require === "function" ? (require as HostRequire) : undefined);
  const attempt = (read: () => unknown) => {
    try {
      const value = read();
      return typeof value === "string" && value ? value : "Not available";
    } catch {
      return "Not available";
    }
  };

  return {
    // uxp.host, not photoshop.app.version: on Photoshop 28 the latter read back
    // undefined from the panel, while uxp.host gave "Photoshop" and "28.0.0".
    hostVersion: attempt(() => {
      const uxpHost = (host?.("uxp") as { host?: { name?: string; version?: string } } | undefined)?.host;
      return uxpHost?.version ? `${uxpHost.name ?? "Host"} ${uxpHost.version}` : undefined;
    }),
    uxpVersion: attempt(() => (host?.("uxp") as { versions?: { uxp?: string } } | undefined)?.versions?.uxp),
    hostTheme: attempt(() =>
      (document as unknown as { theme?: { getCurrent?: () => string } }).theme?.getCurrent?.()
    ),
    panelTheme,
    // The panel's own width, which is what a size decision is about. The sheet
    // itself measures 0 in the same tick it is unhidden, before UXP lays it out.
    width: attempt(() => {
      const shell = root?.parentElement ?? root;
      const width = shell ? Math.round(shell.getBoundingClientRect().width) : 0;
      return width > 0 ? `${width} px` : undefined;
    })
  };
}

/**
 * Called on every entry to the sheet: draws it the first time, then refreshes
 * the facts at the top. The facts are written through textContent only.
 */
export function refreshComponentSheet(root: HTMLElement, panelTheme: string) {
  if (!root.firstElementChild) {
    root.innerHTML = createComponentSheetMarkup();
  }

  const info = readComponentSheetInfo(panelTheme, root);
  const write = (id: string, value: string) => {
    const element = root.querySelector<HTMLElement>(`#${id}`);

    if (element) {
      element.textContent = value;
    }
  };

  write("ui-sheet-host-version", info.hostVersion);
  write("ui-sheet-uxp-version", info.uxpVersion);
  write("ui-sheet-host-theme", info.hostTheme);
  write("ui-sheet-panel-theme", info.panelTheme);
  write("ui-sheet-width", info.width);
}
