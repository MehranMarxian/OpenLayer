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

- Confirm `package.json` version.
- Confirm `package-lock.json` root version.
- Confirm `src/manifest.json` version.
- Confirm the visible UI version label.
- Confirm `README.md` release version.
- Confirm `CHANGELOG.md` release section.
- Confirm `docs/index.html` landing page version.
- Confirm the package name matches the release, for example `openlayer-v0.4.6-alpha.zip`.

## Public Alpha Truth Check

- Confirm Inpaint/Repaint Selection is marked experimental.
- Confirm the landing page does not claim production-ready inpainting.
- Confirm Flux Fill is described as experimental or setup-required.
- Confirm Prompt from Layer is described as foundation work until Florence-2 text generation is connected.
- Confirm custom workflow import is listed as future work.
- Confirm LoRA browser, batch variants, upscaling, and persistent metadata are listed as future work.
- Confirm CI limitations are clear: Photoshop, UXP, and ComfyUI integration tests are manual.

## GitHub Release

- Create a git tag, for example `v0.4.6-alpha`.
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
- Capture source and run one Sketch to Image result.
- Test Inpaint only as experimental.
