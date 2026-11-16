# Panel UI audit on Photoshop 28.0, and the plan to fix it

Run on 2026-11-16 by Claude, driving Mehran's machine through computer use. Captures cover the
panel region only, on a new untitled document. The audit changes no product code.

| | |
|---|---|
| Photoshop | 28.0.0 (Photoshop 2027), Windows 11, UI theme "dark" (`document.theme.getCurrent()`) |
| UXP | 9.4.1 (`require('uxp').versions.uxp`) |
| OpenLayer | 0.41.0, the dev build loaded from UXP Developer Tool |
| Panel | 477 CSS px wide as docked (`#app-shell` width) |
| Themes | Artist-Friendly Dark (every screen), Compact Adobe Dark (key screens), Classic v0.4 (key screens) |
| Baseline | `00-ps2025-baseline-compact-text-to-image.jpg`, the same build on Photoshop 2025 (26.x), captured 2026-11-05 |

Evidence images are in [`ui-audit/ps28/`](ui-audit/ps28/). The Prompt Wallet screen was
deliberately not captured, because it holds Mehran's saved prompts.

## 1. Summary

1. **Photoshop 28 draws every native `<button>` with its own grey face.**
   - Our background colour is ignored. Only our border, radius and size survive.
   - That is the "grey box inside a coloured border" on Generate, the capture buttons and every other button.
   - It affects 114 `<button>` tags in `appMarkup.ts` and 20 more created in code, on every screen, in every theme.
   - Photoshop 2025 draws the same build correctly.
   - This fails beta gate G7 (newest Photoshop) as it stands.
2. **`<div role="button">` renders our CSS exactly on Photoshop 28.**
   - The Home cards and "Back to Tools" are already built this way and look right.
   - The app already handles keyboard activation and disabled state through ARIA, not the native `disabled` attribute (`appBindings.ts` `bindActionControl`, `setActionDisabled`). So the tag can change without changing behaviour.
3. **The three themes are not three themes.**
   - Of 922 colour declarations in `styles.css`, 347 use a theme token and 380 are hard-coded (220 distinct colours), with 1,215 `!important`.
   - A theme reaches only a third of the panel, which is why Classic v0.4 looks like Compact.
   - Mehran's decision, 2026-11-16: keep **two** themes, made complete. Retire Classic.
4. **Photoshop exposes its own UI colours and font size to plugins.**
   - `var(--uxp-host-background-color)` and its siblings render Photoshop's own panel grey and type size in the panel.
   - The Adobe theme can follow the artist's Photoshop brightness setting instead of hard-coding `#535353`.
5. **Beyond rendering:**
   - Two generations of screen design live side by side.
   - Three different verbs are used for the same capture action.
   - A debug line shows on Text to Image.
   - Readiness messages say "needs setup" when only a capture is missing.
   - Preset ids appear where artist names exist.

**Why the earlier mockup did not survive contact with Photoshop, and the rule from now on.** A
browser draws `<button>`, `opacity` and `gap` the way CSS says. UXP 9 does not. So no design is
approved from a browser again. Every component is first built in the real panel, on a component
sheet (U0 below), and shown in Photoshop 28 and Photoshop 2025, in both themes. Screens are then
assembled only from components that passed. A mockup can propose a layout. Only the sheet can
approve a look.

## 2. What was verified about UXP 9.4.1, and how

Each line is an experiment run in the panel through UXP Developer Tool › Debug, then looked at in
Photoshop 28.

| # | Test | Result | Evidence |
|---|---|---|---|
| V1 | `<button>` with the Generate classes; computed style | Computed `background-color` is `#D98B2A` (our orange), yet it draws grey. The CSS is right; the host paints over it. | `01-button-vs-div-experiment.jpg` (top row) |
| V2 | `<div role="button">` with the same classes | Draws orange, exactly as styled | `01-…` row A |
| V3 | `<button>` with inline `background-color … !important` | Still grey | `01-…` row B |
| V4 | `<button>` with `appearance: none` | Still grey | `01-…` row D |
| V5 | `<button>` with a full-size coloured `<span>` inside | Still grey: the native face covers its children | `02-child-face-and-input-experiment.jpg` row H |
| V6 | `<input type="button">` | Takes the colour, but its label is left-aligned and small | `02-…` row K |
| V7 | `<sp-button variant="cta">` | Spectrum blue pill; it cannot be orange | `01-…` row E |
| V8 | A bare `<button>` with no class | Photoshop 28's native grey pill: this is the "native secondary" look | `01-…` row C |
| V9 | Inline `opacity: 0.3` on a div | **Not drawn**: the strip stays fully opaque (computed opacity reads 0.3) | `03-opacity-vs-rgba.jpg` row Q |
| V10 | `rgba()` background on a div | Drawn dimmed, as expected | `03-…` row R |
| V11 | `var(--uxp-host-background-color, magenta)` and the text, hover, border and font-size siblings | Draw Photoshop's own grey, light text, hover grey, border and font size; no fallback colour shows | `04-host-theme-variables.jpg` |
| V12 | `document.theme.getCurrent()` | Returns `"dark"` | console |
| V13 | `getComputedStyle(...).getPropertyValue('--x')` and `var()` in computed values | Not resolved (empty, or "initial"): computed style cannot be used to test variables | console |
| V14 | `window.matchMedia`, `eval` | Not available (`matchMedia` undefined; `eval` refused by the panel's content policy) | console |

Settled on the component sheet (U0, 2026-11-16), on Photoshop 28.0.0 (UXP 9.4.1) and Photoshop
2025 26.1.0 (UXP 8.1.0), both themes. Evidence in [`ui-audit/sheet/`](ui-audit/sheet/).

| # | Check | Photoshop 28 | Photoshop 2025 |
|---|---|---|---|
| S1 | Stylesheet `opacity: 0.3` on a div | **Not drawn** | **Not drawn** |
| S2 | Inline `opacity: 0.3` on a div | Not drawn (V9) | **Not drawn** |
| S3 | `rgba()` background | Drawn | Drawn |
| S4 | `:hover` on a div button | Drawn | Drawn (once the floating panel was active) |
| S5 | `:active` on a div button | Drawn | Drawn |
| S6 | `:focus` on a div button, reached by Tab | Drawn | Drawn |
| S7 | `:focus` after a mouse click on a div | Not focused | Not checked |
| S8 | All 13 `--uxp-host-*` colour and size variables | Present: background `#525252`, border `#444444`, hover `#5a5a5a` | Present, same values |
| S9 | `--uxp-host-text-color-secondary` | Draws the same as `text-color`, so it cannot mark a disabled state | Same |
| S10 | Bare native `<button>` | Grey filled pill | White outlined pill, wider font; the two versions differ |
| S11 | `<sp-button variant="secondary">` | White outlined pill | The same |
| S12 | Native buttons with our classes | Grey face (V1) | Our colours, but a wider font that truncates labels ("Import Automatic…") and hides the "?" glyph of the info button |
| S13 | `require('photoshop').app.version` from the panel | `undefined`; `require('uxp').host.version` gives `28.0.0` | not checked; `uxp.host` gives `26.1.0` |

Consequences: opacity never dimmed anything on either version, so the `.is-coming-soon` cards and
the six `opacity` disabled rules have never looked dimmed. Disabled states need explicit colours
(rule 2). Not checked: Photoshop 2024, the three lighter Photoshop brightness levels, macOS.

## 3. Findings

Severity: **High** is broken or misleading on every screen; **Med** is visible and confusing;
**Low** is polish. "28 only" means the same build looks right on Photoshop 2025.

### Rendering

| Id | Sev | 28 only | Finding | Where | Evidence |
|---|---|---|---|---|---|
| R1 | High | Yes | Every native button shows a grey face. Generate, capture, import, Roll, Ask the Agent, Show Negative Prompt, Check ComfyUI and the rest lose their colours; the colour survives only as a border. | 114 `<button>` in `appMarkup.ts`, 20 `createElement("button")` in `App.ts` (10), `promptWallet.ts` (4), `previewPanel.ts` (3), `appBindings.ts` (2), `seedDice.ts` (1) | `00` vs `20`, `10`, `11` |
| R2 | High | Yes | On/off toggles (Import Automatically, Transparent Background, Experimental Checkpoints) look exactly like action buttons, and their state cannot be seen. | `button[aria-pressed]` rules, `styles.css:7398-7440` | `10`, `20` |
| R3 | High | Yes | Setup's filter chips are identical grey pills; the selected filter is not visible. | `button.setup-filter-chip[aria-pressed]` | `21` |
| R4 | Med | Yes | The "Advanced settings" disclosure is a full-width grey pill; on Photoshop 2025 it is a quiet text line. It reads as an action. | `appMarkup.ts`, the disclosure button | `00` vs `20` |
| R5 | Med | Likely | Six disabled-state rules dim with `opacity`, which UXP 9 did not draw inline (V9). A disabled control may look enabled. | `styles.css`, `:disabled` / `.is-disabled` blocks | V9; to verify on the sheet |

### Layout

| Id | Sev | Finding | Where | Evidence |
|---|---|---|---|---|
| L1 | Med | The Transparent Background toggle sits on the bottom edge of the Model picker, with no gap, on Text to Image in every theme | `#transparent-background-toggle` margins | `10`, `20`, `22` |
| L2 | Med | "Seed" is truncated to "Se…" in Artist-Friendly Dark (seed row label column too narrow) | `.seed-row` in the artist block, `styles.css:8312-8340` | `10`, `11`, `13` |
| L3 | Med | Minimum width is 320 px (`manifest.json`), and at that width the Home list has a wide dead column between the short labels and the chevrons (Mehran, 2026-11-16) | `minimumSize`, `.tool-card` layout | Mehran's screenshot |
| L4 | Low | Status lines truncate mid-sentence ("Setup check found 0 missing, 1 in the wrong folder, 0 not checked, a…"; "Text to Image is experimental for this setup. Text to Image is experimental and shou…") | `.status-text { white-space: nowrap; text-overflow: ellipsis }` | `19`, `20`, `21` |
| L5 | Low | Small targets: Prompt Wallet's +/↓/✦ are 16 × 16, the "?" and "!" info buttons 18 × 18, Artist number fields 18 px tall (sweep, 2026-11-16) | wallet controls, info buttons, `.artist-row > .input` | sweep data |
| L6 | Low | Layer Maps' description is cut with an ellipsis mid-sentence | `#layer-maps` hint | screen |

### Consistency

| Id | Sev | Finding | Evidence |
|---|---|---|---|
| C1 | Med | Three verbs for one action: "Capture Active Layer / Capture Canvas" (most tools), "Add Active Layer / Add Canvas" (Multi-Reference), "Use Active Layer / Use Canvas" (Unflatten). Inpaint reverses the order and the colours ("Capture Visible" green on the left, "Capture Active Layer" blue on the right). | `11`, `13`, `17`, `18` |
| C2 | Med | Two generations of screen design. Older tools: coloured capture borders, "ComfyUI is online. Models loaded. Ready" status, Workflow + Model pickers. Newer tools (Camera Angle, Remove Background, Select by Text, Layer Maps, Unflatten): plain capture buttons and a "Ready. / Status" bar. | `11` vs `15` |
| C3 | Low | "Advanced settings" starts open on most tools and closed on Outpaint. The negative prompt is shown on Image to Image and Edit Image, but hidden behind a button on Text to Image. The picker is labelled "Model" on some tools and "Checkpoint" on others. In Artist theme, Steps/CFG are sliders on some tools and number boxes on others (Style Reference, Multi-Reference, Outpaint). | `10`, `11`, `13`, `18` |
| C4 | Low | The Workflow picker shows a preset id on most tools and a display name on Unflatten | `11`, `17` |

### Copy (all render through `textContent`)

| Id | Sev | Finding | Where |
|---|---|---|---|
| X1 | High | A debug line, "Click test ready for v0.41.0.", is visible under Text to Image's status | `appMarkup.ts:895` |
| X2 | Med | "Image to Image needs setup before it is ready" when the only problem is that nothing is captured yet. On Edit Image it names the wrong tool. | `workflowDiagnostics.ts:68` (`setup-required` summary), `12` |
| X3 | Med | Preset ids in artist copy: every Workflow dropdown (plan item B2); "generate with img2img-basic" while Klein is selected; Upscale's banner names `upscale-basic` and `upscale-seedvr2-3b` | `11`, `14` |
| X4 | Low | `--` appears in 26 strings that render as plain text (2 in `appMarkup.ts`: the Unflatten hint and the Custom Workflow intro; 24 in registry hints and notes shown in the panel), against the CLAUDE.md copy rule | Unflatten, Layer Maps, Custom Workflow, Workflow Presets |
| X5 | Low | "Photoshop selection", "Photoshop layer" and "Photoshop canvas" appear in 46 panel strings. The wording rule is written for public copy, but Exchange reviewers read the panel. | `App.ts:1719` and others |
| X6 | Low | Settings › Workflow readiness prints every preset's technical notes as one paragraph | `19` |

### Functional, found in passing

| Id | Sev | Finding | Evidence |
|---|---|---|---|
| F1 | Med | Select by Text's Workflow picker renders empty (the select has one option, `select-sam31`). Cause not investigated. | `16` |
| F2 | Low | `__olGo`-style navigation away from Live Painting did not respond until Back to Tools was clicked by mouse. This may be by design while a session is armed; noted, not investigated. | session notes |

## 4. Design rules for the panel (the UXP contract)

These are binding for every UI PR from now on. A mockup that breaks one is not reviewed.

1. **No native `<button>` for anything we style.** Use the shared button primitive, a
   `<div role="button" tabindex="0">` built by one markup helper. Native buttons are allowed only
   as the deliberate "native secondary" variant, if U0 shows it looks right on 2024, 2025 and 28.
2. **State through classes and colours, never `opacity`.** Disabled, pressed and selected each have
   explicit colours (`rgba` is fine). Never use `aria-pressed` as a style hook (trap 3); use
   `data-state`.
3. **Spacing through margins and fixed heights.** No flex `gap`, no `visibility:hidden`. Every pill
   states its height, and its radius is half of it (trap 4).
4. **Colours only through tokens.** No hex in a component rule. The Adobe theme maps tokens to the
   `--uxp-host-*` variables, with fallbacks. Artist-Friendly Dark overrides tokens only.
5. **Sizes on one scale.** Type is 11 / 12 / 14 px, Photoshop's own UI font size first. Controls
   are 24 px (compact) and 32 px (primary action). Icons are 16 px inline and 24 px in Home rows.
   Spacing is 4 / 8 / 12 / 16. The numbers are checked against Photoshop's own Layers and Properties
   panels in a side-by-side capture on the sheet.
6. **Every control works at the minimum width.** Text wraps rather than ellipsis-clipping a sentence.
7. **One name per action across tools.** "Capture Layer", "Capture Canvas" and "Capture Selection",
   always in that order, always the same colours.
8. **Proof is a Photoshop capture.** Each UI PR attaches Photoshop 28 and Photoshop 2025 captures of
   the changed screen in both themes, made by Claude through computer use (panel region only, a test
   document). Mehran then looks before merging.

### Photoshop reference for the Adobe theme

Sampled from Photoshop 28's own Layers and History panels on this machine (dark UI), for the sheet
to match. JPEG samples, so treat them as ±3.

| Element | Photoshop 28 |
|---|---|
| Panel body | `#4c4c4c` |
| Panel header strip | `#404040` |
| Dropdown face | `#414141`, about 24 CSS px tall |
| Selected row | `#6a6a6a` |
| Body text | Photoshop's UI font. The panel's own `body` already uses adobe-clean at 12 px. |

Prefer `var(--uxp-host-background-color)` and its siblings over these numbers. They follow the
artist's Photoshop brightness setting (four levels), which these samples cannot.

## 5. Fix plan

One PR each, in order. Each PR is built and checked by Claude in Photoshop 28 and 2025, in both
themes, then reviewed by Mehran. Pre-beta items fix G7 (Photoshop 28) and are bug fixes, not
features.

| # | Item | Size | When | Proof in Photoshop |
|---|---|---|---|---|
| **U0** | **Component sheet.** A hidden "UI sheet" view, opened from Settings › Diagnostics, that draws every component in every state in the current theme: primary, secondary (native and our own, side by side), danger, toggle off/on, chip off/on, disabled, focused, the disclosure, picker, text field, slider, status bar, warning and error box, a Photoshop-reference row. No tool code changes. It settles the "native secondary" question, V-test gaps and the size scale. | M | Pre-beta | Sheet captured in 28 and 2025 × 2 themes |
| **U1a** | **Button primitive + primary actions.** One markup helper that emits the div button. Convert every Generate, capture and import button, and the CSS selectors that name `button`. | M | Pre-beta | Blocks 0 to 2; each converted button on 28 and 2025 |
| **U1b** | **Toggles, chips and disclosures** on the primitive, with `data-state` instead of `aria-pressed` styling (fixes R2, R3, R4) | M | Pre-beta | Setup filters, Import Automatically, Advanced settings, on 28 and 2025 |
| **U1c** | **Buttons made in code**: Prompt Wallet, History, Setup rows, seed dice, Preview panel, Settings | M | Pre-beta | Blocks 4 and 0.5 (Preview panel) |
| **U2** | **Copy fixes**: remove X1. X2 says "Capture a layer or the canvas first" and names the right tool. B2 (artist names in dropdowns, already approved) plus X3. Replace `--` (X4). | S | Pre-beta | Text to Image, Image to Image, Edit Image, Upscale |
| U3 | **Retire Classic v0.4**: a saved `classic` preference becomes `compact`; the option goes; tests updated | S | Post-beta | Settings › theme, both remaining themes |
| U4 | **Tokens everywhere**: replace the 380 hard-coded colours with tokens (in two or three PRs by area), then map the Adobe theme to `--uxp-host-*` | L | Post-beta | Every screen in both themes; Photoshop set to each of its four brightness levels |
| U5 | **Photoshop-parity sizes** for the Adobe theme (rule 5); disabled states by colour (R5); target sizes (L5) | M | Post-beta | Side-by-side with the Layers panel |
| U6 | **Minimum width**: lower `minimumSize` (target 240 px, to be confirmed on the sheet), make Home rows and tool screens work there, wrap status text (L3, L4) | M | Post-beta | Every screen at the minimum and default widths |
| U7 | **Consistency**: one capture vocabulary and order (C1), one status bar (C2), one "Model" label, Advanced closed by default, sliders on every numeric field in Artist (C3, C4) | M | Post-beta | Each tool screen |
| U8 | Select by Text empty picker (F1), Layer Maps hint (L6), Settings readiness to Diagnostics (X6), wording X5 | S | Post-beta | The three screens |

After U0 to U8, the redesign screens in `plan-beta-and-beyond.md` §4 are assembled from verified
components, one screen per PR. The HTML mockup in `docs/mockups/` becomes a layout sketch, not a
spec.

**Effect on the beta plan.**
- U0 to U2 are G7 work: five PRs before the 2026-12-01 checkpoint, which is tight but fits.
- If U1c slips, the beta notes say "Photoshop 28: some secondary buttons draw grey", and it ships in the next build.

## 6. How the panel was inspected (for the next session)

- **Open the debugger.** UXP Developer Tool › the OpenLayer row › Debug opens a console attached to
  the live panel. Pin that window beside the panel, with always-on-top set from PowerShell
  `SetWindowPos`, or a click on the panel hides it and keystrokes reach Photoshop. In Photoshop,
  Ctrl+L is Levels.
- **Running code.** `eval` is refused, so paste code straight into the console. Results can be
  written with `require('fs').writeFileSync('C:/…/scratchpad/x.json', …)` and read from the shell.
- **Navigating.** Click `.tool-card[data-openlayer-view="<view>"]` after Back to Tools, with about
  500 ms between them: action clicks within 350 ms are dropped by the double-fire guard.
- **Capturing.** Use computer-use `zoom` on the panel region only. Saving inside a batch can pull
  focus to the Claude window.
- **Test elements.** Every test element must be removed afterwards, and the artist's theme restored
  (it is saved as a preference).

## 7. Prompt for the build session

Recommended: **Claude Opus 5.5, effort high.** The work is UXP host judgement, CSS-trap avoidance
and computer-use verification, which `docs/ORCHESTRATION.md` §7 reserves for the strongest model.
Start it in a new session on this repository.

```text
You are continuing OpenLayer's Photoshop 28 UI work. Mehran (solo author, GitHub Desktop user) has
approved the direction; you build it one PR at a time.

Read first, in order: CLAUDE.md; docs/ORCHESTRATION.md sections 2 and 3; docs/ui-audit-ps28.md
(the audit, the UXP design rules in section 4 and the fix plan in section 5); docs/uxp-smoke-checklist.md;
docs/beta-gate.md. Then your memory index.

Decisions already made by Mehran (2026-11-16), do not re-ask:
- Two themes: Compact Adobe Dark (default) and Artist-Friendly Dark, both made complete. Classic v0.4
  is retired (later PR U3).
- Primary actions (Generate, capture, import) keep OpenLayer's own coloured look, built as
  div role="button" via one shared helper. Secondary buttons should match Photoshop's own native
  style, especially in the Adobe (Compact) theme: try the native look first, keep it only if it
  renders the same on Photoshop 2025 and 28. Fonts, icon sizes and spacing are matched to
  Photoshop's own panels (Layers, Properties, the right-hand icon sidebar).
- The panel's minimum width should go below 320 px without dead space on Home (later PR U6).
- You check every UI PR yourself in Photoshop 28 and 2025 through computer use, then Mehran looks.

Your task now: PR U0 only, the component sheet described in docs/ui-audit-ps28.md section 5.
- Branch feat/ui-component-sheet from main. No tool code changes; a new hidden view reached from
  Settings > Diagnostics, built as its own module (src/ui/tools/ or src/ui/componentSheet.ts), not
  inside renderApp's closure.
- It draws every component in every state, in the current theme. For secondary buttons, show the
  native <button>, <sp-button variant="secondary"> and our own div styled from
  var(--uxp-host-*) side by side, so the choice is made on evidence.
- Include a row that settles the open checks in audit section 2: stylesheet opacity, hover and
  focus on div buttons, host variables on Photoshop 2025.
- Run npm run typecheck, lint, test and build; add tests for any pure helper (for example the
  button markup helper).
- Verify in Photoshop: load dist/ through UXP Developer Tool in Photoshop 28 (and 2025, which
  needs its own Load), open the sheet, and capture it in both themes. Follow audit section 6 for
  the debugger technique.
- Open one PR with the captures, what passed, what did not, and your recommendation for the
  secondary-button look and the size scale. Then stop and wait for Mehran.

Hard rules:
- Never capture or record Mehran's desktop. Zoom on the panel region only, on a new untitled
  document. Never capture the Prompt Wallet screen.
- Keystrokes go to Photoshop if the debugger loses focus (Ctrl+L is Levels). Pin the debugger
  window, and check History after any slip.
- Restore Mehran's theme preference (Artist-Friendly Dark) and remove every test element when you
  finish.
- ComfyUI on 127.0.0.1:8188 is shared: read-only queries and your own prompts only. Never
  interrupt globally, clear the queue or restart it.
- Wording: "plugin for Photoshop", never Photoshop as an adjective. Panel strings are plain text:
  no markdown, no backticks, no "--".
- Do not post, publish or message anyone. Git steps for Mehran are GitHub Desktop click paths.
- Be honest about what you could not verify.

After Mehran approves U0, the next PRs are U1a, U1b, U1c and U2, one at a time, each with the
same Photoshop proof.
```
