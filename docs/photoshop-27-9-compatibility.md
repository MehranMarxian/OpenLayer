# Photoshop 27.9 UI Backend — Compatibility Pass

Adobe shipped an infrastructure-level change to Photoshop's UI backend in 27.9 — not a visual
redesign, but a change to how the UI layer itself is built, publicly rolled out starting **July
26, 2026** (confirmed against Adobe's developer blog, checked live 2026-08-23). It already
shipped; this isn't a future risk to prepare for, it's current state to verify against. Adobe's
own guidance names three test priorities for UXP plugin developers:

1. **Workflow functionality** — do your plugin's primary workflows still behave correctly?
2. **Visual rendering** — layout shifts, clipping, positioning issues in panels/dialogs/controls.
3. **Event handling** — are listeners and callbacks still firing when they should?

This can't be done from this repo — it needs Photoshop 27.9 actually open with the panel loaded.
What follows is a targeted list, not the full manual smoke test (`docs/release-checklist.md`
already has that): specifically the places in this codebase most likely to be sensitive to a UI
backend change, found by grepping for exactly the patterns Adobe's three categories point at.

## Priority 1 — the styling override surface

`src/styles.css` has **1,107 `!important` declarations**. Most exist to override Photoshop's own
native UXP styling (fighting the host's default look is the normal reason `!important` shows up
this often in a UXP plugin). This is precisely the surface a UI-backend infrastructure change is
most likely to disturb — if Photoshop's internal rendering changed *how* it applies its own
defaults, styles built to fight the old defaults can land differently against the new ones. Test
first, not last:

- Every screen at both the panel's minimum (320×480) and maximum (720×1200) declared sizes in
  `src/manifest.json` — resize through the full range, don't just eyeball the default size.
- Theme switching — Compact Adobe Dark, Artist-Friendly Dark, and Classic v0.4 — since each
  overrides a different slice of the same override stack.
- The Artist-Friendly Dark slider controls specifically — per project history, sliders already
  needed real-Photoshop verification once (UXP ignored `step` in earlier testing) precisely
  because native-control behavior doesn't always match its browser-preview appearance.
- Sticky elements: the progress bar and status header, both already the subject of a past
  UXP-only layout bug (`docs/roadmap.md` / project history — the header/progress overlap issue).

## Priority 2 — entry-point timing

`src/panelBootstrap.js` exists solely to work around Adobe bug PS-57605: `entrypoints.setup()`
throws if called more than ~20ms after plugin start. This is exactly the kind of "event handling"
risk Adobe's own guidance calls out — an infrastructure change to the UI backend could plausibly
shift that timing window in either direction.

- Cold-launch Photoshop fully (not just close/reopen the panel — quit Photoshop entirely) and open
  OpenLayer, at least 5 times in a row.
- Confirm the panel renders every time. If it doesn't, the first thing to check is whether
  `bootstrap.registered` ever comes back `false` — see the comment block at the top of
  `panelBootstrap.js` for what that means.
- Do the same for the second entrypoint, **OpenLayer Preview**, since it shares the same bootstrap
  script and has its own timing-sensitive registration.

## Priority 3 — the new welcome overlay specifically

Built this session, never seen inside real Photoshop. It's a `position: fixed` overlay
(`.welcome-overlay` in `src/styles.css`) — fixed positioning inside a UXP panel is a reasonable
but unverified assumption here, since UXP's rendering of `fixed` has had quirks with panel resize
and scroll before (per project history: "no sticky reflow" was a past UXP-specific gotcha).

- First launch after a clean install (or clear the `openlayer.welcomeSeen.v1` key from panel
  storage) — confirm the overlay actually covers the full panel and doesn't scroll away or clip at
  small panel sizes.
- Resize the panel while the overlay is showing.
- Confirm **Skip** and **Continue** both actually dismiss it and it doesn't reappear on next
  launch.

## Standard checks, re-run against 27.9 specifically

Everything in `docs/release-checklist.md`'s "Manual Smoke Test" section still applies — this is
additive, not a replacement. The point of doing it again here isn't that the steps changed, it's
that a passing run on an older Photoshop build doesn't confirm anything about 27.9's new backend.

## Reporting back

If anything breaks, the file/line most likely responsible is probably in this list — say what you
saw and where, and it's a fast fix rather than a fresh investigation.
