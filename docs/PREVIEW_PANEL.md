# Separated Resizable Preview Panel — Design

Status: **implemented (steps 1–3).** Host unknown #1 resolved 2026-07-24 in Photoshop 26.1.
Read `docs/ORCHESTRATION.md` first.

## Goal

A second, dockable UXP panel showing only the current preview — resizable/dockable like any
Photoshop panel, so artists can park a large preview next to their canvas while the main OpenLayer
panel stays compact.

It **mirrors** the dashboard's in-panel preview; it does not replace it. Relocating the preview out
of the dashboard was considered and rejected: the panel is optional and closable, so an artist who
never opens it would lose previews entirely, and the Import buttons sit beside the small preview
because that is where the import decision is made.

## How UXP multi-panel works — resolved, with the answers

- One plugin declares multiple panels as separate `entrypoints` in `manifest.json`. **Same
  JavaScript context** — both panels share one JS runtime, so no messaging layer is needed and a
  module singleton is sufficient plumbing. Confirmed: one console, one bootstrap log, both panels.
- **Unknown #1 (answered): the main panel does NOT have to migrate.** `entrypoints.setup()` with
  both panels registered works, and the main panel keeps rendering through `index.html`. The
  in-host log:

  ```
  +0ms   early script running, typeof require = function
  +1ms   attempt both registered openlayer.panel + openlayerPreview
  +263ms create() fired for openlayer.panel      -> rendering
  +264ms create() fired for openlayerPreview     -> rendering
  ```

  So this is an additive feature, not a bootstrap migration.
- **`entrypoints.setup()` must be called within ~20ms of plugin start** or it throws
  `TypeError: Cannot read properties of undefined (reading '_isSet')` — Adobe's PS-57605. The
  application bundle is deferred and always misses that window. Registration therefore lives in
  `src/panelBootstrap.js`, a plain **undeferred** script loaded from `index.html`'s head, which only
  claims the panels and remembers the root nodes; `main.ts` supplies the renderers when it loads.
  `copy-uxp-assets.mjs` asserts that file is present, undeferred, and ahead of the bundle.
- Panel ids: **no Adobe sample uses a dotted id**, so the new panel is `openlayerPreview`. The main
  panel stays `openlayer.panel` because saved user workspaces reference it. (The dotted id turned
  out not to be the blocker — the first ladder rung registered both — but the convention is kept.)
- **UXP DT's Reload does not re-read `entrypoints`.** A manifest entrypoint change needs the plugin
  removed and re-added, or the new panel never appears in the Plugins menu.
- Panels are user-resizable when docked or floating, but a panel that never initialised collapses to
  its `minimumSize` and does not behave like a real panel. An explicit `maximumSize` is declared.

## Implementation

### State plumbing — one seam
`src/ui/previewHub.ts`: `createPreviewHub()` with `publish`, `clear`, `latest`, and `subscribe`
(which replays the current publication immediately, so a panel opened *after* a generation still
shows it).

**The hub carries blobs, not object URLs.** This is the design decision worth remembering: A5
requires every object URL to have exactly one owner that revokes it, and handing a URL created by the
main panel to a second panel would give it two owners, with teardown order deciding whether the
second panel shows a dead image. Passing the blob lets each surface mint and own its own URL, and
neither has to reason about the other's lifetime.

`createResultPreviewPanel` takes optional `hub` and `toolLabel` and publishes on `showResult(blob)`
and `showProgress(_, blob)` — one line each, no behaviour change to the main panel. All six result
panels are wired. `disposeAppResources` calls `previewHub.clear()`, so a lingering preview panel does
not keep showing a result from a closed session.

### Preview panel UI
`src/ui/previewPanel.ts`. One persistent `<img>` (the no-flicker pattern), `object-fit: contain`,
checkerboard stage, fluid throughout — no fixed heights anywhere in the chain. Header is a muted
tool badge (`Inpaint · generating`, amber while live) and a **1:1 / Fit** toggle; 1:1 switches to
`object-fit: none` and lets the stage scroll. Empty state: "Previews appear here while you generate."

The registry and URL slot are module-level, because UXP can call `create()` again after a `destroy()`
and a per-mount registry would strand one object URL per remount.

CSS is deliberately self-contained — this panel renders outside the `.app-shell` theme root, so none
of the compact theme's `!important` rules reach it (ORCHESTRATION §3).

## Remaining steps

4. **Follow / pin** — the panel currently always follows whichever tool published last. A
   "pin to tool" dropdown is designed but unbuilt; nobody has asked for it yet.
5. **Live Painting publishes to the hub** — one line in `updateLivePreview`
   (`docs/LIVE_PAINTING_V2.md` §3.6). This panel is its intended large surface.
