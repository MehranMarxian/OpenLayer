# OpenLayer codebase review

Reviewed at `v0.37.0` (`main` at `ce740d3`, 2026-09-30). This review changes no product code; the
findings feed the prioritised plan in [`roadmap.md`](roadmap.md). Line numbers refer to that commit.

Severity: **High** means it can hurt a user, their shared ComfyUI or the Exchange listing now.
**Med** means it costs reliability or maintenance time regularly. **Low** is housekeeping.

## Summary of findings

| # | Sev | Area | Finding | Where |
|---|-----|------|---------|-------|
| 1 | High | Shared ComfyUI | Cancel falls back to a global `POST /interrupt`, which can stop another client's job | `src/comfy/comfyClient.ts:501-526`, `src/comfy/generationCancel.ts:8-15` |
| 2 | High | Shared ComfyUI | Live Painting cancels prompts that have already finished, so it hits finding 1 on almost every superseded cycle | `src/ui/tools/livePainting.ts:601,621,631,650,761-770` |
| 3 | High | Security | The Agent Bridge hub checks neither the WebSocket `Origin` nor a token, so any web page open in a browser can drive the panel while the hub runs | `bridge/src/hub.mjs:59-76`, `bridge/src/hubRouter.mjs:295-327` |
| 4 | High | Wording/legal | Landing-page meta description and JSON-LD still say "Photoshop UXP plugin", and these are the strings search engines and LLMs quote | `docs/index.html:10`, `docs/index.html:38` |
| 5 | Med | Security | Bridge runtime dependencies have 1 high and 3 moderate advisories (`fast-uri`, `hono`, `ip-address`, `qs`) | `bridge/package-lock.json` |
| 6 | Med | Reliability | Model downloads write straight to the final filename; an interrupted download leaves a truncated `.safetensors` that ComfyUI lists as a real model | `src/photoshop/modelFileDestination.ts:43-46` |
| 7 | Med | Reliability | Downloads are verified by size only, with no hash | `src/comfy/modelDownload.ts`, `src/comfy/presetRegistry.ts` (34 `downloadUrl`s) |
| 8 | Med | Ease of use | A rejected workflow reaches the artist as "ComfyUI rejected the workflow with HTTP 400." with the raw JSON in diagnostics; Text to Image has no friendly mapping at all | `src/comfy/comfyClient.ts:461-479`, `src/ui/App.ts:3071`, `src/ui/App.ts:3304` |
| 9 | Med | Reliability | No `fetch` in `ComfyClient` has a timeout, so a wedged ComfyUI hangs Check ComfyUI and generation start indefinitely | `src/comfy/comfyClient.ts:154,170,371,423,451` |
| 10 | Med | Tech debt | `App.ts` is 9,976 lines and has regrown past its pre-refactor size (8,149 → 5,842 → 9,976); `renderApp` alone runs from line 546 to the end | `src/ui/App.ts:546` |
| 11 | Med | Tests | `tests/` is not type-checked; including it produces 102 `tsc` errors (some need `@types/node`, some are real type drift) | `tsconfig.json:17` |
| 12 | Med | CI | CI never installs the bridge or runs `npm run test:e2e`; the bridge unit tests resolve the root's zod 4 while the bridge ships zod 3 | `.github/workflows/ci.yml`, `bridge/package.json:22`, `tests/scripts/bridgeTools.test.ts:2` |
| 13 | Med | Staying current | No Dependabot or equivalent; Vite is two majors behind (6 → 8), TypeScript one (5.9 → 7), Vitest one (4 → 5) | `package.json` |
| 14 | Med | Staying current | Preset node mappings are only checked against a live ComfyUI at runtime; nothing catches `object_info` drift before a release | `src/comfy/workflowHealth.ts` |
| 15 | Low | Dead code | Unused exports and orphan files (listed below) | see "Dead code" |
| 16 | Low | Wording | "Photoshop UXP plugin" also in `README.md:637` and `CONTRIBUTING.md:3`; "Photoshop panel" in `README.md:47` and `bridge/package.json:5`; more "Photoshop layer" uses in `docs/index.html` | as listed |
| 17 | Low | Build | One 698 KB JS chunk; all 28 API workflow JSONs are bundled *and* the whole `src/workflows/` tree (including 364 KB of GUI source workflows) is copied into `dist/` | `src/comfy/workflowBuilder.ts:1-28`, `scripts/copy-uxp-assets.mjs:9` |
| 18 | Low | Docs drift | `CONTRIBUTING.md` says Node 18 and omits lint; the e2e config says "750 tests in three seconds" (now 1,094 in ~24 s); `docs/ORCHESTRATION.md` is dated 2026-08-01, gives App.ts as 5,842 lines and ComfyUI as `:8190` | `CONTRIBUTING.md:7`, `vitest.e2e.config.ts:8`, `docs/ORCHESTRATION.md:38,75` |
| 19 | Low | Registry | `txt2img-flux1-dev-fp8` is `status: "stable"` but its description starts "Experimental" | `src/comfy/presetRegistry.ts:2472` |
| 20 | Low | Security | `network.domains: "all"` and `localFileSystem: "fullAccess"` are the broadest grants; both are justified in `docs/exchange-permission-justification.md` and should stay documented rather than change | `src/manifest.json:14-22` |

## 1. Architecture map

```
src/                 the plugin (TypeScript, Vite, no framework)
  index.html         loads panelBootstrap.js (plain, non-deferred) then the bundle
  panelBootstrap.js  claims entrypoints.setup() inside UXP's ~20 ms window (PS-57605)
  main.ts            registers renderers for the main panel and the Preview panel
  manifest.json      UXP manifest v5, PS >= 25.0.0, permissions
  ui/                App.ts (renderApp closure, all tool handlers), appMarkup.ts (HTML),
                     generationController.ts (single active run, submit/watch/poll/commit),
                     agentBridge/agentConnection/agentProtocol (panel half of the MCP bridge),
                     pure view models (setupTabModel, workflowPresetsModel, toolDescriptors...)
    tools/           livePainting.ts, layerTools.ts (the "new tool = new module" pattern)
  comfy/             presetRegistry.ts (5,197 lines, 34 presets: nodes, injections, models,
                     licences, download URLs), workflowBuilder.ts, comfyClient.ts, health,
                     setup manifest/requirements, model download, ComfyUI-Manager client
  photoshop/         photoshopAdapter.ts (3,361 lines: capture, import, masks, transactions)
                     plus pure helpers (selectionUtils, outpaintExpansion, unflattenLayerStack...)
  workflows/api/     28 runnable ComfyUI API graphs, imported into the bundle
  workflows/source/  GUI-editable twins, checked by workflowSourceEquivalence
  utils/             errors, png encoder, multipart (no TextEncoder), preferences, files
bridge/              separate Node package: hub.mjs (WebSocket on 127.0.0.1:8199),
                     main.mjs (MCP stdio agent), tools.mjs (zod schemas), protocol.mjs
scripts/             copy-uxp-assets (post-build patch of index.html), package (zip + .ccx),
                     build-setup-pack (generated from the registry), audit-css
tests/               Vitest, node environment, 110 files / 1,094 tests, pure logic only;
                     tests/e2e spawns the bridge and is excluded from `npm test`
docs/                GitHub Pages site (index.html, llms.txt, privacy, terms) plus ~40
                     design notes, gate findings, plans and Exchange paperwork
```

## 2. How a preset becomes a layer (Text to Image as the example)

1. **Registry.** `WORKFLOW_PRESETS` in `src/comfy/presetRegistry.ts:2416` declares each preset: its
   mode, `workflowFile`, `requiredNodes` (node id, `class_type`, required inputs), `injections`
   (which node input receives prompt, seed, size, etc.), `modelSource` (which loader's
   `object_info` lists the models), `requiredModels` with download URL, size and licence gate.
2. **Screen.** `App.ts` reads the chosen preset and model from the panel (`App.ts:2960-2996`),
   checks ComfyUI is up (`/system_stats`) and that the model exists
   (`hasModelForPreset` via `/object_info/<Loader>`).
3. **Graph.** `buildTxt2ImgWorkflow` (`workflowBuilder.ts:91`) deep-clones the bundled API JSON,
   validates it against the preset's `requiredNodes`, injects values through `setPresetInput`,
   splices a LoRA loader if asked, and validates again.
4. **Run.** `generation.runPipeline` (`generationController.ts:221`) posts to `/prompt` with the
   client id, opens the `/ws` progress socket, polls `/history/<id>` (woken early by the socket),
   then fetches the image from `/view`. Only the current, uncancelled run may commit (invariant A4).
5. **Layer.** `importGeneratedImageAsLayer` (`photoshopAdapter.ts:300`) checks the active document is
   still the originating one (invariant A1), writes a temp PNG, makes a session token, and inside
   `executeAsModal` places, renames and positions the layer, then deletes the temp file.

Inpaint, Outpaint, Upscale and Unflatten follow the same shape with their own capture step first
(`uploadImage` to `/upload/image`) and their own import function that handles masks, canvas
growth or layer stacks.

## 3. Test coverage

What is covered well: the registry and builder (every preset builds, injections resolve, source and
API graphs match), the generation controller's cancel and stale-run rules, error copy, setup and
download logic, the bridge router and the panel/bridge protocol parity, PNG and multipart encoding,
and the version-consistency check. All of it runs in the node environment.

What is not covered, in order of risk:

- **Everything inside `renderApp`** (`App.ts`, 9,976 lines, no test imports it). Tool handlers,
  busy locking in practice, and error-to-copy wiring are only proven by hand in Photoshop.
- **The Photoshop half of `photoshopAdapter.ts`** (batchPlay, `executeAsModal`, placement). Pure
  helpers are tested; the calls are not and cannot be outside the host.
- **Files with no test at all**: `previewPanel.ts` (296), `livePaintingCapture.ts` (236),
  `modelFileDestination.ts` (100), `fileUtils.ts` (77), `comfyPortDiscovery.ts` (69), `main.ts`.
- **Real ComfyUI.** No test talks to one; drift in node inputs shows up only in a user's Workflow
  Health card.
- **The bridge end to end** exists (`tests/e2e`) but is never run by CI.
- **Tests are not type-checked** (finding 11), so a renamed type can leave a test compiling in
  Vitest's loose transpile while asserting the wrong shape.

## 4. Tech debt

- **`App.ts` size.** The v0.8 plan was to extract the module-level functions below `renderApp` and
  leave the closure alone. The closure itself has since grown by roughly 4,000 lines, one tool
  handler at a time. New tools already follow the better pattern (`src/ui/tools/*.ts`); the
  cheapest real win is moving each existing handler into its tool module behind the same
  `generation.runPipeline` contract, one tool per PR.
- **`presetRegistry.ts` size.** 5,197 lines in one file; the roadmap already plans a split by model
  family.
- **`styles.css`.** 8,791 lines with two themes and repeated compact overrides (see
  `docs/ORCHESTRATION.md` §3 traps). Not worth touching without a Photoshop screenshot per change.
- **Dead code** (defined, exported, referenced nowhere in `src/` or `tests/`):
  - `getActiveSelectionInfo` (`photoshopAdapter.ts:473`), `importImageAlignedToSelection`
    (`photoshopAdapter.ts:976`), `preserveSelection` (`photoshopAdapter.ts:2060`)
  - `getPresetCompatibilityNote` (`modelCompatibility.ts:129`), `isWorkflowPreset`
    (`presetRegistry.ts:5084`), `listAllPresetIds` (`setupManifest.ts:337`)
  - `DEVELOPER_GITHUB` (`appConstants.ts:19`), `DEFAULT_UNFLATTEN_CFG` (`appConstants.ts:45`)
  - Orphan files nothing imports: `src/utils/logger.ts`, `src/photoshop/layerImport.ts`,
    `src/photoshop/documentInfo.ts` (both one-line re-exports)
  - Method: every `export` in `src/` grepped for other references. Dynamic access would not show
    up in a grep, so each removal still needs a build and a Photoshop load.
- **Stale design docs.** `docs/ORCHESTRATION.md` is the richest hand-over document in the repo and
  still correct about invariants and CSS traps, but its roadmap section and sizes are two months
  old. `docs/v0.35-plan.md`, `v0.36-plan.md` and `testing-v0.1-alpha.md` are history.

## 5. Security

- **Finding 3, the Agent Bridge.** Browsers do not apply CORS to WebSockets, so a page on any site
  can open `ws://127.0.0.1:8199`. The loopback check in `hub.mjs:67` passes because the browser
  itself is local. That page can then say `hello` as an agent and run any of the 13 tools, or say
  `hello` as a panel, which makes the hub drop the real panel (`hubRouter.mjs:310-316`). The risk
  is bounded (the hub is off by default and only runs while the artist starts it, and
  `SECURITY.md` says there is no token) but a malicious page does not need the artist to do
  anything else. The fix is small: reject any upgrade that carries an `Origin` header (UXP and
  the Node agent send none or a known value; confirm what UXP sends first), then add the
  per-session token the roadmap already names.
- **Finding 1 and 2** are safety rather than security, but they are the one place OpenLayer can
  damage someone else's work on a shared ComfyUI. ComfyUI's `/interrupt` stops *whatever is
  running*. Recent ComfyUI builds accept `{"prompt_id": ...}` in the body and only interrupt when
  that prompt is the one running; this needs confirming against the installed ComfyUI version
  before relying on it. Until then, the safe rule is: if our prompt is not pending and not
  running, do nothing.
- **ComfyUI HTTP.** The server URL is user-set and plain HTTP; OpenLayer sends images only to it.
  Nothing is uploaded elsewhere. Fine for a local tool.
- **File paths.** Temp files use generated names; model downloads use filenames from the registry,
  not from the network, and the destination folder is picked by the artist. No path traversal
  route found. Findings 6 and 7 are integrity issues, not traversal.
- **Dependencies.** Root advisories (6) are all in dev tooling (`vitest`, `postcss`, `nanoid`,
  `undici`, `brace-expansion`) and never ship in the plugin. Bridge advisories (4) are in runtime
  dependencies of the MCP SDK and should be cleared with `npm audit fix` in `bridge/`.

## 6. Dependency freshness (`npm outdated`, 2026-09-30)

| Package | Current | Latest | Note |
|---|---|---|---|
| vite | 6.4.3 | 8.3.1 | two majors; `copy-uxp-assets.mjs` string-patches Vite's output and asserts it, so an upgrade fails loudly rather than silently |
| typescript | 5.9.3 | 7.0.2 | major; check `moduleResolution: "Node"` is still accepted |
| vitest | 4.1.9 | 5.0.3 | major; 4.1.11 clears the `@vitest/mocker` advisory without a major |
| eslint, typescript-eslint, globals, jsdom, zod | minor/patch behind | | safe in-range updates |
| bridge: @modelcontextprotocol/sdk, ws | in range | | `npm audit fix` in `bridge/` |
| bridge: zod | ^3.25 | 4.6.5 | the root already uses zod 4 for the bridge tests (finding 12) |

## 7. CI health

The one workflow (`.github/workflows/ci.yml`) runs `npm ci`, typecheck, lint, test and build on
Node 22 for pushes to `main` and PRs. The last 15 runs are all green and take about a minute.
Gaps: the bridge package is never installed or tested on its own dependencies, the e2e suite never
runs, tests are not type-checked, there is no dependency or link check, and nothing exercises the
registry against a recorded ComfyUI `object_info`.

## 8. Verified locally for this review

```
npm run typecheck   exit 0
npm run lint        exit 0
npm test            Test Files 110 passed (110), Tests 1094 passed (1094), 24.09s
npm run build       exit 0; dist/assets/index-*.js 697.87 kB (gzip 153.18 kB)
npm audit           6 vulnerabilities (2 moderate, 4 high), all dev dependencies
bridge: npm audit --package-lock-only   4 vulnerabilities (3 moderate, 1 high)
```

Not verified: anything in Photoshop, anything against a running ComfyUI (including the
`/interrupt` `prompt_id` behaviour and what `Origin` UXP's WebSocket sends), macOS, and the
accuracy of every claim in README and `docs/llms.txt`.
