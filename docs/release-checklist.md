# OpenLayer Release Checklist

Use this checklist before publishing an OpenLayer alpha release.

## Local Verification

- Run `npm ci` when dependencies need a clean reinstall.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `npm run package`.
- Confirm the package file exists in `packages/`.

## Version Consistency

**`npm test` now checks this.** `tests/scripts/versionConsistency.test.ts` treats
`package.json` as the source of truth and fails if `package-lock.json` (both root-project
fields), `src/manifest.json`, `APP_VERSION` in `src/ui/appConstants.ts`, `docs/index.html`,
`docs/become-a-tester.html`, or README's checkpoint line and package filenames disagree with
it. Bump `package.json` first, then run `npm test` and fix what it names.

This list used to be a manual grep, and it failed silently twice: v0.14.0 shipped with the
panel footer still reading v0.13.0 (`APP_VERSION` had moved file, so the bump commit's list of
"all four sites" quietly dropped it), and `package-lock.json` sat at 0.12.0 for two releases.
Naming files is what failed — a location that moves between files stops being checked while
the list still looks complete. The test names values and reads them out of the real files.

Still manual, because no test can judge them:

- Confirm `CHANGELOG.md` has a section for this release and that every claim in it survives a
  reading of `git log <lasttag>..main` — not of the task list.
- Confirm README's "New in `vX.Y.Z-alpha`" list describes *this* release, not the last one.
  The test pins README's version numbers, not its prose.
- Confirm the package name matches the release, for example `openlayer-v0.7.0-alpha.zip`.

## Public Alpha Truth Check

- Confirm Inpaint/Repaint Selection is marked experimental.
- Confirm Outpaint is marked experimental.
- Confirm the landing page does not claim production-ready inpainting.
- Confirm Flux Fill is described as experimental or setup-required.
- Confirm Prompt from Layer is described as a Florence-2 text workflow that requires local custom nodes and model files.
- Confirm custom workflow import is listed as future work.
- Confirm LoRA browser, batch variants, generative/tiled upscale, and persistent metadata are listed as future work.
- Confirm CI limitations are clear: Photoshop, UXP, and ComfyUI integration tests are manual.

## GitHub Release

- Create a git tag, for example `v0.7.0-alpha`.
- Create a GitHub Release from the tag.
- Mark the release as a pre-release.
- Attach the package zip from `packages/`.
- Include known limitations in the release notes.
- Include basic tester instructions for Photoshop, UXP Developer Tool, and ComfyUI on port `8190`.

## Manual Smoke Test

- Load `dist/manifest.json` in Adobe UXP Developer Tool.
- Open Photoshop and launch OpenLayer.
- Run `Check ComfyUI`.
- Run `Check Workflow Health`.
- Run `Copy Diagnostics`.
- Generate one Text to Image result and import it.
- Capture source and run one Image to Image result.
- Toggle Image to Image `Import Automatically` and confirm the result imports after generation.
- Capture source and run one Upscale result with a local upscale model.
- Capture source and run one Sketch to Image result.
- Test Inpaint only as experimental.
- Test Outpaint only as experimental.
- Test Z_image_Turbo and Flux1-dev fp8 Text to Image if the required local models are installed.
- Test Prompt from Layer if the Florence-2 PromptGen workflow is installed.
- Start and cancel one longer generation, then confirm the next generation still works.
- Open History and confirm prompt, model, workflow, seed, dimensions, source mode, tool type, timestamp, and import status are recorded where available.
