// Every OpenLayer-created temporary file uses one of these prefixes: the plain
// saveBlobToTemporaryFile call sites (OpenLayer_Generated, OpenLayer_Inpaint,
// OpenLayer_Source, OpenLayer_Canvas, OpenLayer_Live), the exact-mask import's
// double-underscore mask file (__OpenLayer_InpaintMask_...), and the Inpaint
// debug copies (OpenLayer_Inpaint_Debug_..._source/mask/raw-result.png). A
// prefix match keeps this independent of any one caller's exact naming.
const SWEEPABLE_NAME_PATTERN = /^_{0,2}OpenLayer_.*\.png$/i;

export type SweepableFileSystemEntry = Readonly<{
  name: string;
  isFile: boolean;
}>;

export function isSweepableTemporaryFileName(name: string) {
  return SWEEPABLE_NAME_PATTERN.test(name);
}

// Pure selection logic: given a directory listing, which entries are OpenLayer's
// own leftover temporary files. Kept separate from the UXP filesystem calls that
// produce the listing and perform the deletion, so the decision is unit-testable
// without a Photoshop host.
export function selectStaleTemporaryFileNames(entries: readonly SweepableFileSystemEntry[]) {
  return entries
    .filter((entry) => entry.isFile && isSweepableTemporaryFileName(entry.name))
    .map((entry) => entry.name);
}
