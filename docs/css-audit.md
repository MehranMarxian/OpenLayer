# CSS audit — `src/styles.css`

Task 9 of v0.8. **Measurement only: no CSS was changed.** Regenerate with `npm run audit-css`;
the numbers come from parsing the stylesheet and cross-referencing every class name against
`src/` and `scripts/`.

## Size

| | |
|---|---:|
| Lines | 7451 |
| Rule blocks | 929 |
| Distinct selectors | 678 |
| Selectors declared more than once | 261 |
| `!important` declarations | 1049 |
| …of those, inside a `theme-compact` rule | 1046 |

## The two themes

`theme-compact` and `theme-classic` are both selectable in Settings ("Compact Adobe Dark" and
"Classic v0.4"). Compact is the default and the shipped look. Classic is not a dead code path —
it is what the 309 unscoped rules render.

| | rules | lines |
|---|---:|---:|
| Scoped to `.theme-compact` | 611 | 5798 |
| Scoped to `.theme-classic` | 9 | 76 |
| Unscoped (base — what Classic renders) | 309 | 2443 |

65.8% of all rules are compact overrides and they carry
99.7% of the `!important` in the file. **137** base selectors have a
`theme-compact` counterpart.

That last number is the override tax, and it is the mechanism behind the trap recorded in
`docs/ORCHESTRATION.md` §3: a base rule that looks correct is often beaten by a compact
`!important` block hundreds of lines further down. Grep `theme-compact <selector>` before
concluding a base rule is what renders.

## Most-redeclared selectors

| times | selector |
|---:|---|
| 19 | `.app-shell.theme-compact .source-action-row` |
| 17 | `.app-shell.theme-compact .generation-status-panel` |
| 15 | `.app-shell.theme-compact .generator-panel` |
| 14 | `.app-shell.theme-compact .settings-panel` |
| 13 | `.app-shell.theme-compact .panel-section` |
| 13 | `.app-shell.theme-compact .result-panel` |
| 13 | `.app-shell.theme-compact .history-panel` |
| 12 | `.app-shell.theme-compact .input` |
| 12 | `.app-shell.theme-compact .select` |
| 11 | `.app-shell.theme-compact .settings-grid .field` |
| 11 | `.app-shell.theme-compact .img2img-settings-grid .field` |
| 11 | `.app-shell.theme-compact .app-footer` |
| 10 | `.app-shell.theme-compact` |
| 10 | `.app-shell.theme-compact .home-view` |
| 10 | `.app-shell.theme-compact .generator-view` |
| 10 | `.app-shell.theme-compact .image-to-image-view` |
| 10 | `.app-shell.theme-compact .settings-view` |
| 10 | `.app-shell.theme-compact .history-view` |
| 10 | `.app-shell.theme-compact .screen-nav` |
| 10 | `.app-shell.theme-compact .textarea` |

## Unreferenced classes

28 class names appear in the stylesheet and nowhere in `src/` or `scripts/`. Rules that match
only those names span **630 lines across 83 rule blocks** — roughly 8.5% of the file.

### `ol-*` (the pre-v0.5 naming)

`.ol-button`, `.ol-button-orange`, `.ol-field`, `.ol-footer`, `.ol-form-grid`, `.ol-input`, `.ol-label`, `.ol-panel`, `.ol-pill-ready`, `.ol-row-status`, `.ol-select`, `.ol-textarea`

### Everything else

`.connection-panel`, `.field-row`, `.footer-link`, `.home-tool-section`, `.icon-glyph`, `.icon-svg`, `.screen-tool-icon`, `.settings-actions`, `.settings-shortcut`, `.shortcut-label`, `.shortcut-note`, `.text-image-shortcuts`, `.tool-card-header`, `.tool-grid`, `.tool-status`, `.version-badge`

### Checked, and NOT dead

10 `is-*` names never appear as literals because they are assembled at runtime from
`is-${card.status}` (`ToolCardStatus`), `is-${item.state}` (`WorkflowHealthState`) and
`is-${card.state}` (the diagnostics summary cards). A text search calls them unused. They are
not. Do not delete these:

`.is-available`, `.is-coming-soon`, `.is-experimental`, `.is-future`, `.is-missing-model`, `.is-missing-node`, `.is-missing-workflow`, `.is-ready`, `.is-setup`, `.is-setup-required`

## What the numbers say

1. **Deleting the dead classes is the cheap, safe win** — about 630 lines, no live selector
   touched. It still needs a real Photoshop pass, because the check is "no literal mention in
   the source", and only the host can prove nothing regressed.
2. **Consolidation is a bigger job than it looks, and it is not deletion.** Both themes ship,
   so the 137 shadowed selectors cannot simply collapse into one rule; that work is merging
   two designs, and it belongs behind a decision about whether Classic still earns its place.
3. **The `!important` count is a symptom, not the disease.** 99.7% of it sits in compact
   overrides fighting base rules. It shrinks when the theme layering is fixed, not by editing
   the declarations.
