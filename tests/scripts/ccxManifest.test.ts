import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// @ts-expect-error -- scripts/ is plain .mjs and sits outside the tsconfig `include`.
import { narrowManifestHostForCcx } from "../../scripts/lib/ccxManifest.mjs";

describe("narrowManifestHostForCcx", () => {
  it("rewrites a single-host array to the object form Adobe's packager emits", () => {
    const { json, narrowed } = narrowManifestHostForCcx(
      JSON.stringify({
        id: "com.openlayer.photoshop",
        host: [{ app: "PS", minVersion: "25.0.0" }],
        main: "index.html"
      })
    );

    expect(narrowed).toBe(true);
    expect(JSON.parse(json).host).toEqual({ app: "PS", minVersion: "25.0.0" });
  });

  it("keeps every other field and their order untouched", () => {
    const { json } = narrowManifestHostForCcx(
      JSON.stringify({
        manifestVersion: 5,
        id: "com.openlayer.photoshop",
        host: [{ app: "PS", minVersion: "25.0.0" }],
        entrypoints: [{ type: "panel", id: "openlayer.panel" }]
      })
    );

    // Key order matters only for keeping a diff against the plugin zip's own
    // manifest readable, but that is the whole reason the object is rebuilt
    // rather than mutated, so it is worth pinning.
    expect(Object.keys(JSON.parse(json))).toEqual([
      "manifestVersion",
      "id",
      "host",
      "entrypoints"
    ]);
    expect(JSON.parse(json).entrypoints).toEqual([{ type: "panel", id: "openlayer.panel" }]);
  });

  it("leaves a multi-host array alone rather than choosing a target app", () => {
    const source = JSON.stringify({
      host: [
        { app: "PS", minVersion: "25.0.0" },
        { app: "ID", minVersion: "18.0.0" }
      ]
    });
    const { json, narrowed } = narrowManifestHostForCcx(source);

    expect(narrowed).toBe(false);
    expect(json).toBe(source);
  });

  it("leaves an already-narrowed host alone, so packaging stays idempotent", () => {
    const source = JSON.stringify({ host: { app: "PS", minVersion: "25.0.0" } });
    const { json, narrowed } = narrowManifestHostForCcx(source);

    expect(narrowed).toBe(false);
    expect(json).toBe(source);
  });

  it("narrows this repo's real manifest, which is the only one that ships", async () => {
    const manifestPath = resolve(__dirname, "../../src/manifest.json");
    const { json, narrowed } = narrowManifestHostForCcx(await readFile(manifestPath, "utf8"));
    const manifest = JSON.parse(json);

    expect(narrowed).toBe(true);
    expect(manifest.host).toEqual({ app: "PS", minVersion: "25.0.0" });
    // A .ccx whose manifest lost its entrypoints installs and then does nothing,
    // which is the failure that would be hardest to diagnose remotely.
    expect(Array.isArray(manifest.entrypoints)).toBe(true);
    expect(manifest.entrypoints.length).toBeGreaterThan(0);
    expect(manifest.id).toBe("1e827d3d");
  });
});
