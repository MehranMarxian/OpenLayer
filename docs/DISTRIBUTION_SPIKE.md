# CCX Distribution Spike

Status: **`.ccx` generation is now automated and shipped; the install question is still unanswered
and still needs a clean machine.**
Written 2026-07-24 against `main` at v0.6.0. Read `docs/ORCHESTRATION.md` first.

> **Update 2026-08-01 — the gate at the bottom of this document was reversed, deliberately.**
> This spike ended by saying `.ccx` generation was gated on the install answer, "because building it
> before the gate would be building on a guess". That reasoning has been inverted for one reason:
> the question stayed open across v0.10, v0.11 and v0.12 because **nobody ever had an artifact to
> hand to someone with a clean machine.** Finding 1 says the archive is a plain zip with no signing
> step, so producing it costs nothing and risks nothing, and a GitHub Release asset can be added to
> a published release at any time.
>
> `npm run package` now emits `openlayer-vX.Y.Z-alpha.ccx` beside the plugin zip, built from the
> same entries with the manifest transform in `scripts/lib/ccxManifest.mjs`. What remains gated is
> any *claim* that it installs — the README and release notes ask people to try it and report back,
> and promise nothing.

> **Update 2026-07-31.** Finding 2 was re-verified against the current release and is **live, not a
> v0.6.0 curiosity**: `openlayer-v0.9.0-alpha.zip`, the file testers download today, stores 44 of its
> 47 entries with backslash paths. It is being fixed separately from this spike; see the end of
> Finding 2. The `.ccx` install question below is still open and still needs a clean machine.

## The question

Does a self-signed `.ccx` install by double-click on a machine that has **never** had the UXP
Developer Tool or developer mode enabled?

- **If yes:** `.ccx` generation gets automated into `scripts/package.mjs` and published to GitHub
  Releases, and OpenLayer gets a genuine one-click install.
- **If no** (Adobe's installer agent refuses non-Marketplace packages): the real one-click path is
  Marketplace submission — Adobe review plus Adobe signing. That is a process decision for Mehran,
  not a coding task.

Nothing in this repo can answer that. It is an empirical question about Creative Cloud desktop's
installer agent, and it must be tested on a clean machine.

## What was actually built

Three packages, all in `packages/` (gitignored, so they are on this machine only). All three
contain the same 42 files: the v0.6.0 `dist/` tree with `manifest.json` and `index.html` at the
archive root.

| File | How it was made | Entry-name separator |
|---|---|---|
| `openlayer-v0.6.0-udt.ccx` | Adobe's official `uxp plugin package` CLI | `/` |
| `openlayer-v0.6.0-zipspec.ccx` | Python `zipfile`, renamed to `.ccx` | `/` |
| `openlayer-v0.6.0-renamedzip.ccx` | PowerShell `Compress-Archive`, renamed to `.ccx` | `\` |

### Finding 1 — a `.ccx` for this plugin is just a zip

Adobe's packaged `.ccx` contains **no signature file and no extra metadata**: 42 entries, exactly
the files that went in. The only differences from a hand-rolled zip are that the packager
re-indents `manifest.json` and rewrites `host` from an array to a single object when packaging for
one app:

```json
"host": { "app": "PS", "minVersion": "25.0.0" }
```

instead of this repo's `"host": [{ "app": "PS", "minVersion": "25.0.0" }]`. Both forms are valid in
the source manifest; the packager narrows it per target app.

That matters for the decision: if the install test passes, automating `.ccx` generation in
`scripts/package.mjs` is a small change, because there is no signing step to reproduce. If the
install test fails, no amount of local packaging will fix it — the gap is the installer agent's
trust policy, not the archive format.

### Finding 2 — `Compress-Archive` writes non-spec entry names

Windows PowerShell 5.1's `Compress-Archive` (.NET Framework) writes entry paths with **backslashes**,
which the ZIP spec does not allow. This is not hypothetical: `packages/openlayer-v0.6.0-alpha.zip`,
the zip produced by `npm run package` and attached to releases, has 40 of its 42 entries stored as
`assets\index-…css` rather than `assets/index-…css`.

Windows Explorer and UDT tolerate it, which is why it has never surfaced. Adobe's installer agent
might not. `openlayer-v0.6.0-renamedzip.ccx` is included in the test set specifically so that a
failure caused by the separator can be told apart from a failure caused by trust policy — if
`zipspec` installs and `renamedzip` does not, the cause is the archive, not the signature.

This also means the release zips themselves are slightly malformed. Not fixed here — it is out of
this spike's scope and has never broken anything — but it should be fixed when `.ccx` generation is
automated, since both would share the same archive writer.

#### Re-verified 2026-07-31: still shipping, and worse than "slightly"

Every release zip from v0.1.0 to **v0.9.0-alpha inclusive** has it — 44 of 47 entries in the current
one. `scripts/package.mjs` still calls `Compress-Archive` on Windows.

"Has never broken anything" is only true of the platforms that have been tried. Windows Explorer and
UDT tolerate backslash entries; **macOS `unzip` does not** — it treats the whole string as one
filename and writes a flat directory of files literally called `assets\index-….js`, producing a
plugin folder with no `assets/` directory at all. A Mac tester would get a plugin that fails to
render with no coherent error to report. macOS is precisely the platform with no coverage, so this
would arrive as an unreproducible bug report.

**The fix needs no new dependency and no `.ccx` decision.** `scripts/lib/zipWriter.mjs` already
exists — a pure-Node, spec-correct writer that normalizes separators itself — and
`scripts/build-setup-pack.mjs` already uses it, which is why `openlayer-comfyui-setup-0.9.0.zip` is
clean while the plugin zip beside it is not. `package.mjs` should walk `dist/` and call `writeZip`,
dropping the win32/posix branch entirely. Tracked separately from this spike.

**Verification trap, recorded because it cost a wrong answer.** Python's `zipfile.namelist()`
silently normalizes backslashes to forward slashes on read, so the obvious check reports a malformed
archive as clean. The only thing that proves separator state is reading the central directory raw —
the `PK\x01\x02` records, filename field at offset 46.

### Finding 3 — the official CLI works, but needs the UDT service and two workarounds

`uxp plugin package` succeeded and validated the manifest against the installed Photoshop
(`Validate command successfull in App with ID PS and Version 26.1.0`), which is a nice free check.
Getting there needed:

1. `npm install @adobe/uxp-devtools-cli` fails on modern npm — `@adobe/uxp-devtools-helper`'s
   postinstall throws `Cannot find module 'tar'`. Workaround: install with `--ignore-scripts`,
   `npm install tar`, then run `node scripts/devtools_setup.js` in the helper package by hand.
2. Packaging connects to the UXP Developer Tool Service on port 14001, so it is not a standalone
   build step — it needs UDT installed on the build machine.

Because of (2), automating `.ccx` in `scripts/package.mjs` should write the zip directly rather than
shell out to the CLI. Finding 1 says that produces the same artifact.

## What Mehran needs to do

**This machine cannot answer the question** — it already has UDT installed at
`C:\Program Files\Adobe\Adobe UXP Developer Tools\`, so a successful install here proves nothing
about a clean machine. The test needs a second Windows machine with Photoshop and Creative Cloud
desktop, and with UDT never installed and developer mode never enabled.

Click-path, on the clean machine, for each of the three files in order:

1. Copy `openlayer-v0.6.0-udt.ccx` to the machine (USB or download — do not install UDT to move it).
2. Double-click the file in Explorer.
3. Record exactly what happens. The interesting outcomes are:
   - Creative Cloud desktop opens and installs the plugin → open Photoshop, check
     **Plugins → OpenLayer** appears and the panel renders.
   - An error dialog → **copy the exact error text**, verbatim, including any error code.
   - Nothing happens / Windows asks which app should open `.ccx` → that is also an answer (no file
     association means no installer agent handling third-party ccx).
4. Repeat with `openlayer-v0.6.0-zipspec.ccx`, then `openlayer-v0.6.0-renamedzip.ccx`.

If step 3 fails for all three, also try Creative Cloud desktop → **Stock & Marketplace → Manage
plugins** and look for any "install from file" affordance, and note whether one exists at all.

The three-file order matters: `udt` is the most-likely-to-work reference, `zipspec` tests whether a
hand-rolled zip is equivalent, and `renamedzip` tests whether the separator bug alone is fatal.

## What this spike deliberately did not do

No changes to `scripts/package.mjs`, no `.ccx` npm script, no release-workflow changes. All of that
is gated on the answer above, and building it before the gate would be building on a guess.

**Superseded 2026-08-01 — see the update at the top.** The packaging half is done:
`scripts/package.mjs` writes a `.ccx` from the same entries as the plugin zip, and
`scripts/lib/ccxManifest.mjs` applies the one content difference Finding 1 measured against Adobe's
own output (`host` narrowed from a single-element array to an object). It is written directly rather
than through `uxp plugin package`, because that CLI talks to the UXP Developer Tool Service on port
14001 and would make UDT a build dependency — Finding 1 says the direct write produces the same
artifact.

The install question itself is untouched by that and is still the only thing that matters here. The
current artifact to test is `openlayer-v0.12.0-alpha.ccx` from the GitHub Release, and the
click-path above applies to it unchanged.
