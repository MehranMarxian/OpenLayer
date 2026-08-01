/**
 * Manifest transform for `.ccx` packaging.
 *
 * `docs/DISTRIBUTION_SPIKE.md` Finding 1 compared a `.ccx` produced by Adobe's
 * own `uxp plugin package` CLI against a hand-rolled zip of the same `dist/`.
 * They were the same archive -- no signature file, no extra metadata, 42
 * entries either way -- with exactly one difference in content: the packager
 * rewrites `host` from this repo's array form to a single object when it
 * packages for one target app.
 *
 *   source: "host": [{ "app": "PS", "minVersion": "25.0.0" }]
 *   packed: "host": { "app": "PS", "minVersion": "25.0.0" }
 *
 * Both forms are valid in a source manifest, so this is not a bug fix. It is
 * matched because the open question is whether Creative Cloud's installer
 * agent will accept an unsigned third-party package at all, and the only way
 * to get a clean answer is to differ from Adobe's own output in as few ways as
 * possible. If the install fails while the archive is byte-comparable to a
 * packager-built one, the answer is about trust policy rather than about
 * anything this repo controls.
 */

/**
 * Narrow a UXP manifest's `host` to the single-object form, when it is
 * unambiguous to do so.
 *
 * An array of two or more hosts is left exactly as it is: narrowing it would
 * mean choosing which app the package targets, and silently dropping the
 * others is a worse outcome than shipping the array form the runtime already
 * accepts. This project declares only Photoshop, so the multi-host branch is
 * defensive rather than exercised.
 *
 * @param {string} manifestJson raw contents of manifest.json
 * @returns {{ json: string, narrowed: boolean }}
 */
export function narrowManifestHostForCcx(manifestJson) {
  const manifest = JSON.parse(manifestJson);

  if (!Array.isArray(manifest.host) || manifest.host.length !== 1) {
    return { json: manifestJson, narrowed: false };
  }

  // Rebuilt rather than mutated in place so key order matches the source
  // manifest: `host` keeps its original position, which keeps a diff against
  // the plugin zip's manifest readable.
  const narrowedManifest = {};

  for (const [key, value] of Object.entries(manifest)) {
    narrowedManifest[key] = key === "host" ? value[0] : value;
  }

  return { json: `${JSON.stringify(narrowedManifest, null, 2)}\n`, narrowed: true };
}
