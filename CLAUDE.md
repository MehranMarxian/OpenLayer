# CLAUDE.md

OpenLayer is a free, open-source (MIT) UXP plugin for Photoshop that drives a **local ComfyUI**
server. Solo author: Mehran Ahmadi (artist who codes, uses GitHub Desktop). Verified on
Windows 11 + Photoshop 2025; macOS is untested. Version lives in `package.json`.

Read this first, then `docs/ORCHESTRATION.md` §2 (safety invariants) and §3 (CSS traps) before
touching `src/photoshop/`, `generationController`, or `styles.css`. `docs/codebase-review.md` has
the latest ranked findings; `docs/roadmap.md` is the plan.

## How we work (permanent rules)

- **Always branch; never commit to `main`** (protected). Names: `feat/…`, `fix/…`, `docs/…`,
  `chore/…`, `release/vX.Y.Z`.
- **One task, one branch, one PR, then stop** and wait for Mehran's review. Don't start the next
  task until he says "go". Several asks: propose an order, do them one PR at a time.
- **PR description:** what changed and why; what was verified (paste real command output); what
  could NOT be verified; a short **"What Mehran should check in Photoshop"** list with exact
  click paths. Open questions go in the PR, not silent assumptions.
- **Before every PR:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, all green.
- **Commits:** imperative subject + a body explaining why. Small enough to revert alone.
- **Git instructions for Mehran** are GitHub Desktop click paths, not CLI.
- **Be honest.** One recommendation with reasons, not a menu. Say what's unverified. Never
  invent test results.
- **Propose, don't just do**, for anything beyond the asked task. Activation (install friction,
  first-run setup, clear errors, a working demo) beats tool #15.

## Commands

```
npm ci                 install (Node 22 in CI; Node >= 20 needed for vitest 4 and the bridge)
npm run typecheck      tsc --noEmit, src/ ONLY (tests/ is not type-checked)
npm run lint           eslint . (bans TextEncoder/TextDecoder in src/)
npm test               vitest, node env, tests/** except tests/e2e (~1,100 tests, ~25 s)
npm run test:e2e       spawns the bridge hub on a real port; not run in CI
npm run build          tsc + vite build + scripts/copy-uxp-assets.mjs -> dist/
npm run package        build + zip + .ccx into packages/ (incl. openlayer-latest.*)
npm run setup-pack     GENERATED from presetRegistry; never hand-edit its output
npm run audit-css      measures CSS redeclarations
cd bridge && npm ci    the MCP bridge is a separate package with its own lockfile
```

Load `dist/` in Photoshop with UXP Developer Tool (Add Plugin → `dist/manifest.json` → Load).

## Architecture

- `src/panelBootstrap.js`: plain, non-deferred script loaded from `index.html` `<head>`. Claims
  `entrypoints.setup()` for both panels within UXP's ~20 ms window (PS-57605). Keep it tiny,
  ES5, dependency-free. `copy-uxp-assets.mjs` asserts it stays ahead of the deferred bundle.
- `src/main.ts` → `ui/App.ts` `renderApp` (main panel) and `ui/previewPanel.ts` (Preview panel).
- `src/ui/App.ts` (~10k lines): one `renderApp` closure holding state and every tool handler.
  Don't grow it: new tools go in `src/ui/tools/<name>.ts` (see `livePainting.ts`, `layerTools.ts`).
- `src/ui/generationController.ts`: the only way to run a generation (submit → WS progress →
  poll `/history` → fetch `/view` → commit). Exactly one active run; stale runs cannot commit.
- `src/comfy/presetRegistry.ts`: source of truth for every preset (34): API workflow file, node
  ids + `class_type` + required inputs, injection targets, model loader, required models with
  download URL/size/licence gate. Setup screen, health checks, setup pack and hardware advisor
  derive from it (Live Painting graphs are the exception).
- `src/comfy/workflowBuilder.ts`: clones the bundled API JSON, validates against the preset,
  injects values via `setPresetInput`, splices LoRA, validates again.
- `src/workflows/api/*.json` runnable graphs (bundled); `src/workflows/source/*.workflow.json`
  GUI twins, kept equivalent by `tests/comfy/workflowSourceEquivalence.test.ts`.
- `src/photoshop/photoshopAdapter.ts`: capture and import (batchPlay, `executeAsModal`, masks,
  canvas growth, layer stacks). Pure helpers sit beside it and are tested; the host calls are not.
- `bridge/`: `hub.mjs` owns `ws://127.0.0.1:8199`; `main.mjs` is the MCP stdio agent an AI client
  launches. `bridge/src/protocol.mjs` and `src/ui/agentProtocol.ts` must match
  (`tests/scripts/agentProtocolParity.test.ts`). Off by default in the panel.
- `docs/`: GitHub Pages site (`index.html`, `llms.txt`, privacy, terms) plus design notes.
- `.claude/agents/`: OP (paints through the real panel), PAM (promotion), WFL (model research).

## Adding or changing a preset

1. Export the API graph from ComfyUI into `src/workflows/api/`, the GUI graph into `source/`.
2. Add the entry in `presetRegistry.ts` by copying an existing one of the same family exactly:
   node ids, `requiredNodes`, `injections`, `modelSource`, `requiredModels` (HEAD-verify every
   `downloadUrl` and record its Content-Length), `licenseGate` when the licence is not permissive.
3. Register the template in `WORKFLOW_TEMPLATES` (`workflowBuilder.ts`).
4. Check node inputs against a real ComfyUI `/object_info` rather than guessing.
5. `npm test` covers build/injection/equivalence; Photoshop is still required for proof.

## UXP traps (tests, jsdom and `vite dev` do NOT prove the panel works)

- No `TextEncoder`/`TextDecoder` (lint enforces; use `utils/multipart.ts` `encodeUtf8`).
- `FormData` drops filenames: build multipart bodies by hand (`utils/multipart.ts`).
- Sliders ignore `step` (`utils/snapToStep.ts`). Data-URI SVGs render blank: use PNG files.
- Flex `gap` is inert in the compact panel: use margins. `visibility:hidden` is ignored.
- `entrypoints.setup()` must run within ~20 ms (see `panelBootstrap.js`).
- Methods pulled off UXP objects lose `this` (`utils/saveFile.ts` `openSaveDialog`).
- `placeEvent` centres on an active selection: always position explicitly after placing.
- Compact theme: `.app-shell.theme-compact …` rules, often `!important`, override base rules;
  grep for them and for attribute selectors (`button[aria-pressed]`) before styling.
- **Anything touching `src/styles.css`, panel markup (`appMarkup.ts`) or Photoshop calls ships as
  ONE small change per PR and waits for Mehran's real Photoshop screenshot.**

## ComfyUI rules

- Shared instance on `127.0.0.1:8188`. **Never interrupt globally, never clear the queue, never
  reboot or reset.** Cancel only our own prompt id. (Today `ComfyClient.cancelPrompt` still falls
  back to a global `/interrupt`: see codebase-review finding 1. Don't copy that pattern.)
- Read-only queries (`/object_info`, `/system_stats`, `/queue`) are fine for checking facts.
- Models in the wrong folder are the most common "bug": `CheckpointLoaderSimple` reads
  `models/checkpoints/`, `UNETLoader` reads `models/diffusion_models/`. `modelFolders.ts` maps them.

## Wording and legal (Adobe rejected a submission over this)

- Say "plugin for Photoshop". Never "Photoshop plugin", never "Photoshop" as an adjective
  ("Photoshop layer", "Photoshop panel", "Photoshop UXP plugin").
- Never claim OpenLayer is "the first" (NimaNzrii/comfyui-photoshop exists).
- Label licences honestly: Qwen-Image 2.1 (research only) and FLUX dev presets are
  non-commercial. For client work point to Apache-2.0: FLUX.2 Klein 4B, Qwen-Image-Layered.
- Never promise face likeness from Multi-Reference.
- Panel status/health strings render via `textContent`: plain text, no backticks, no `--`, no
  markdown.
- LLMs (ChatGPT is the #1 referrer) quote `README.md`, `docs/llms.txt` and `docs/index.html`
  (including its meta description and JSON-LD). Update them with every feature change.

## Releases (only when Mehran asks)

1. Branch `release/vX.Y.Z`. First commit: bump `package.json`, then run `npm test`;
   `tests/scripts/versionConsistency.test.ts` names every other file that disagrees. Fix those.
   Don't work from a memorised list.
2. CHANGELOG section (house format), README "New in" list, `docs/index.html`, per
   `docs/release-checklist.md`. Check every claim against `git log <lasttag>..main` and the code.
3. After Mehran merges, from `main`: `npm run package`, `npm run setup-pack`, annotated tag,
   `gh release create --prerelease` with the zip, `.ccx`, setup pack and `checksums.txt`.
4. Refresh the permanent `latest` release (`openlayer-latest.zip`/`.ccx`) or the README Download
   button serves an old build.

## Conventions

- TypeScript strict, no framework, ES2020. Pure logic goes in small modules with tests; DOM and
  host code stays thin. Comments explain why (the codebase's comments are long and deliberate).
- Errors: `createOpenLayerError(code, message, details)`; artist-facing copy lives in
  `ui/toolErrorMessages.ts`. Don't show raw HTTP bodies to artists.
- `.claude/settings.local.json` and `.claude/launch.json` are local; never commit them.
- Freshness: a monthly PR is proposed for dependency updates, ComfyUI `object_info` drift against
  presets, new models/nodes worth a preset, and broken setup-pack URLs (see roadmap).
