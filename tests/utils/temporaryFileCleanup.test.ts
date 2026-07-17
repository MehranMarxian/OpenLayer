import { describe, expect, it } from "vitest";
import {
  isSweepableTemporaryFileName,
  selectStaleTemporaryFileNames
} from "../../src/utils/temporaryFileCleanup";

describe("temporary file sweep eligibility", () => {
  // Every createLayerName() prefix that reaches saveBlobToTemporaryFile, whether
  // the name is built inside the adapter or passed down from a panel handler.
  it.each([
    "OpenLayer_Generated_20260716_2010.png",
    "OpenLayer_Img2Img_20260716_2010.png",
    "OpenLayer_Inpaint_20260716_2010.png",
    "OpenLayer_Outpaint_20260716_2010.png",
    "OpenLayer_Sketch_20260716_2010.png",
    "OpenLayer_Upscale_20260716_2010.png",
    "OpenLayer_Live_20260716_2010.png"
  ])("sweeps the import temporary file %s", (name) => {
    expect(isSweepableTemporaryFileName(name)).toBe(true);
  });

  it("sweeps the exact-mask import's double-underscore mask file", () => {
    expect(isSweepableTemporaryFileName("__OpenLayer_InpaintMask_1737054000000_ab12cd.png")).toBe(true);
  });

  // These outlive their generation on purpose, so the startup sweep is the only
  // thing that ever removes them.
  it.each([
    "OpenLayer_Inpaint_Debug_20260716_2010_source.png",
    "OpenLayer_Inpaint_Debug_20260716_2010_mask.png",
    "OpenLayer_Inpaint_Debug_20260716_2010_raw-result.png"
  ])("sweeps the Inpaint debug copy %s", (name) => {
    expect(isSweepableTemporaryFileName(name)).toBe(true);
  });

  it("does not match a file that only happens to contain the word OpenLayer", () => {
    expect(isSweepableTemporaryFileName("MyOpenLayer_Generated_20260716_2010.png")).toBe(false);
    expect(isSweepableTemporaryFileName("notes about OpenLayer.txt")).toBe(false);
  });

  it("does not match a non-PNG file", () => {
    expect(isSweepableTemporaryFileName("OpenLayer_Generated_20260716_2010.json")).toBe(false);
  });

  it("does not match an unrelated file left by another plugin", () => {
    expect(isSweepableTemporaryFileName("some-other-plugin-temp.png")).toBe(false);
  });

  it("selects only files, never folders, matching the pattern", () => {
    const entries = [
      { name: "OpenLayer_Generated_20260716_2010.png", isFile: true },
      { name: "OpenLayer_Backups", isFile: false },
      { name: "vacation-photo.png", isFile: true },
      { name: "__OpenLayer_InpaintMask_1737054000000_ab12cd.png", isFile: true }
    ];

    expect(selectStaleTemporaryFileNames(entries)).toEqual([
      "OpenLayer_Generated_20260716_2010.png",
      "__OpenLayer_InpaintMask_1737054000000_ab12cd.png"
    ]);
  });

  it("selects nothing from an empty or fully unrelated listing", () => {
    expect(selectStaleTemporaryFileNames([])).toEqual([]);
    expect(selectStaleTemporaryFileNames([{ name: "readme.txt", isFile: true }])).toEqual([]);
  });
});
