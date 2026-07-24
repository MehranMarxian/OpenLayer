# ComfyUI Setup Pack

A downloadable zip that takes a machine from bare ComfyUI to "OpenLayer works". Build it with:

```powershell
npm run setup-pack
```

Output: `packages/openlayer-comfyui-setup-<version>.zip` (gitignored — attach it to a release).

## The one rule

**Nothing in the pack is written by hand.** `scripts/build-setup-pack.mjs` generates all of it from
`src/comfy/setupManifest.ts`, which reads the preset registry. A setup guide maintained separately
drifts from the software the first time a preset changes, and a setup guide that is wrong about
which folder a model belongs in is worse than no guide at all — ComfyUI does not warn about a model
in the wrong folder, it simply cannot see it.

If you find yourself editing `REQUIREMENTS.md` or `requirements.json` directly, you are editing a
build artifact. Change the registry instead.

## What ships

| Path in the zip | Generated from |
| --- | --- |
| `README.md` | The manifest plus the port-8190 setup from `docs/setup-windows.md` |
| `REQUIREMENTS.md` | The manifest: models, exact target folders, custom node repos, per-preset breakdown |
| `requirements.json` | The manifest verbatim (`schemaVersion: 1`) |
| `Install-OpenLayerModels.ps1` | Static script; reads `requirements.json` at run time |
| `workflows/api/*`, `workflows/source/*` | Copied from `src/workflows/` |

**No model weights.** They are ~85 GB, and two are licence-restricted. The pack ships the list and
the downloader; the user needs an internet connection.

## The downloader

`Install-OpenLayerModels.ps1 -ComfyUIRoot <path>` reads `requirements.json` and fetches each model
into its target folder. Behaviour worth knowing:

- **Skips files already present.** Safe to re-run.
- **Downloads to `.partial` first**, then renames. An interrupted run never leaves a truncated file
  that looks installed to both this script and ComfyUI.
- **Verifies size** against the registry's recorded `Content-Length` and deletes the download on
  mismatch.
- **Refuses licence-gated models** without `-AcceptLicenseRestrictedModels`, printing the licence
  name, a one-line summary, and the terms URL.
- **Will not fetch `repo-folder` models** (the Florence model is a directory, not a file). It prints
  the `git clone` command instead — a single-file fetch would produce a broken install that looks
  complete.
- `-WhatIf` works throughout.

Rigs using `extra_model_paths.yaml` have more than one model root. `-ComfyUIRoot` writes to one of
them; the folder table in `REQUIREMENTS.md` covers moving files by hand.

## Why the zip is written by hand

`scripts/lib/zipWriter.mjs` is a small spec-correct ZIP writer rather than a call to
`Compress-Archive`. Windows PowerShell 5.1 runs on .NET Framework, which stores entry paths with
**backslashes**; the ZIP specification requires forward slashes. The existing release zip carries 40
such entries. Windows tooling tolerates it, other unzippers are entitled not to, and this pack goes
to strangers' machines. See `docs/DISTRIBUTION_SPIKE.md` for how that surfaced.

`scripts/package.mjs` is untouched and still uses `Compress-Archive`. Fixing the plugin zip is worth
doing when `.ccx` generation is automated, since they would share a writer.

## Known gaps

- Four presets (`txt2img-basic`, `img2img-basic`, `sketch2img-linecn-basic`, `inpaint-basic`) declare
  a `sourceWorkflowFile` that was never exported to `src/workflows/source/`. The generator prints a
  note and omits those lines rather than advertising files the zip does not contain.
- `acceptedModelNames` fallbacks (`t5xxl_fp8_e4m3fn.safetensors`, `RealESRGAN_x4plus.pth`) carry no
  download URLs — the model type has one URL per entry. They are listed as "also accepted".
- The pack does not check a running server. That is the in-panel Setup tab (ORCHESTRATION §6 item 2),
  which is meant to read this same `requirements.json` structure.
