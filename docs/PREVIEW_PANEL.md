# Separated Resizable Preview Panel — Design

Status: **specified, not implemented.** Written 2026-07-18 (Fable 5). Read `docs/ORCHESTRATION.md` first.

## Goal

A second, dockable UXP panel showing only the current preview — resizable/dockable like any Photoshop panel, so artists can park a large preview next to their canvas while the main OpenLayer panel stays compact. Replaces the cramped in-panel preview boxes as the *primary* viewing surface (the small in-panel previews stay).

## How UXP multi-panel works (the key facts)

- One plugin can declare multiple panels as separate `entrypoints` in `manifest.json` (`"type": "panel"`, unique `id`, own `label` and `minimumSize`/`preferredDockedSize`). **Same JavaScript context** — both panels share the plugin's single JS runtime, so no messaging layer is needed; the preview panel can directly subscribe to the same state the main panel writes.
- Each panel gets show/create events (`uxpShowPanel` / entrypoints `create(rootNode)` callbacks depending on setup style — this plugin uses the plain `index.html` + script style, so the second panel needs the `entrypoints` API: `require("uxp").entrypoints.setup({ panels: { openlayerPreview: { create(rootNode) {...} } } })`). **Host-dependent unknown #1:** verify which panel-setup style coexists with the current single-`index.html` approach; may require migrating the main panel into `entrypoints.setup` too. This is the first thing to test in Photoshop.
- Panels are user-resizable by default when docked/floating; content must be fluid (percent sizing), not fixed-height like the in-panel preview boxes.

## Design

### Manifest
Add to `manifest.json` `entrypoints`: panel id `openlayerPreview`, label "OpenLayer Preview", `minimumSize` ~ {width: 220, height: 220}. Keep the main panel's id untouched (users' saved workspaces reference it).

### State plumbing — one new seam, tiny
`previewState.ts` gains a **preview hub**: `createPreviewHub()` with `publish(source: { toolType, kind: "live" | "result", blob })` and `subscribe(listener)`. The existing `createResultPreviewPanel` factories get an optional `hub` option and publish on every `showResult`/`showProgress(blob)` — one line each; no behavior change to the main panel. (A5 rule: the hub creates its OWN object URLs via the registry for the big panel's img — never share/steal the main panel's owned URLs, or teardown ordering breaks.)

### Preview panel UI
- One persistent `<img>` (the no-flicker pattern), `width/height: 100%`, `object-fit: contain`, checkerboard background — fills whatever size the user drags the panel to. No fixed heights anywhere.
- Header row: tool badge ("Inpaint — live" / "Text to Image — result"), a Follow mode dropdown (`Follow active` default | pin to a specific tool), 1:1 / Fit toggle (1:1 = `object-fit: none` + scrollable container).
- Empty state: "Previews appear here while you generate."
- Live Painting v2 (docs/LIVE_PAINTING_V2.md §3.6) publishes through the same hub — this panel is its intended large surface.

### Lifecycle
- The hub holds only the latest publication (no history). Its owned URL is revoked on replacement and on plugin teardown via the shared registry (`disposeAppResources` already calls `revokeAll` — the hub's slot rides on the same registry).
- If the preview panel was never opened, the hub still publishes (cheap: one extra object URL per result, revoked on replacement). Optional micro-optimization later: skip publishing while the panel is hidden (`uxpShowPanel`/`uxpHidePanel` events set a flag).

## Implementation plan (delegable to Codex after unknown #1 is answered in-host)

1. **Spike (Mehran + any model, 30 min):** add the second entrypoint to the manifest with placeholder content; confirm both panels open and the existing panel still works. Answers unknown #1. Nothing else proceeds until this passes.
2. Hub in `previewState.ts` + publish hooks + unit tests (URL ownership + latest-wins).
3. Preview panel markup/render + CSS (fluid, both themes — remember the compact `!important` trap, ORCHESTRATION §3).
4. Follow/pin + 1:1/Fit controls.
5. Live Painting publishes to the hub (one line in `updateLivePreview`).

Smoke per step; step 1 gates everything.
