import type { SelectedRegionSourceImage } from "../photoshop/photoshopAdapter";

export type InpaintImportContext<TSource, TResult> = Readonly<{
  source: TSource;
  result: TResult;
}>;

export function createInpaintImportContext<TSource, TResult>(
  source: TSource,
  result: TResult
): InpaintImportContext<TSource, TResult> {
  return Object.freeze({ source, result });
}

export function resolveInpaintImportContext<TSource, TResult>(
  savedHistoryContext: InpaintImportContext<TSource, TResult> | null | undefined,
  activeResultContext: InpaintImportContext<TSource, TResult> | null
) {
  return savedHistoryContext ?? activeResultContext;
}

export function createInpaintSourceSnapshot(
  source: SelectedRegionSourceImage
): SelectedRegionSourceImage {
  const selection = Object.freeze({
    ...source.selection,
    bounds: Object.freeze({ ...source.selection.bounds }),
    contextBounds: Object.freeze({ ...source.selection.contextBounds })
  });
  const mask = source.mask
    ? Object.freeze({
      ...source.mask,
      bounds: Object.freeze({ ...source.mask.bounds })
    })
    : undefined;

  return Object.freeze({
    ...source,
    selection,
    ...(mask ? { mask } : {})
  });
}
