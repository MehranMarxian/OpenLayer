import { describe, expect, it } from "vitest";
import {
  isSweepableTemporaryFileName,
  selectStaleTemporaryFileNames
} from "../../src/utils/temporaryFileCleanup";

describe("temporary file sweep eligibility", () => {
  it("matches every real OpenLayer temporary file name pattern", () => {
    // From fileUtils.createLayerName() + saveBlobToTemporaryFile() call sites.
    expect(isSweepableTemporaryFileName("OpenLayer_Generated_20260716_2010.png")).toBe(true);
    expect(isSweepableTemporaryFileName("OpenLayer_Inpaint_20260716_2010.png")).toBe(true);
    expect(isSweepableTemporaryFileName("OpenLayer_Source_20260716_2010.png")).toBe(true);
    expect(isSweepableTemporaryFileName("OpenLayer_Canvas_20260716_2010.png")).toBe(true);
    expect(isSweepableTemporaryFileName("OpenLayer_Live_20260716_2010.png")).toBe(true);
    // From importImageAlignedToSelectionWithLayerMask's mask file.
    expect(isSweepableTemporaryFileName("__OpenLayer_InpaintMask_1737054000000_ab12cd.png")).toBe(true);
    // From saveInpaintDebugBlobsToTemporaryFiles.
    expect(isSweepableTemporaryFileName("OpenLayer_Inpaint_Debug_20260716_2010_source.png")).toBe(true);
    expect(isSweepableTemporaryFileName("OpenLayer_Inpaint_Debug_20260716_2010_mask.png")).toBe(true);
    expect(isSweepableTemporaryFileName("OpenLayer_Inpaint_Debug_20260716_2010_raw-result.png")).toBe(true);
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
