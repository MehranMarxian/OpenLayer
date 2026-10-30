import type { SelectedRegionSourceImage } from "../photoshop/photoshopAdapter";
import { growMaskPng } from "../photoshop/maskGrow";

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

/**
 * The snapshot a run actually uses: the captured one, or, for a preset with
 * `maskGrowPixels`, a copy whose mask is grown. Taken before the upload so the
 * grown mask is the one ComfyUI fills AND the one the import uses as the layer
 * mask -- growing only one of the two leaves the object's outline as a ring.
 */
export async function growInpaintSourceMask(
  source: SelectedRegionSourceImage,
  pixels: number | undefined
): Promise<SelectedRegionSourceImage> {
  if (!pixels || !source.mask) {
    return source;
  }

  const blob = await growMaskPng(source.mask.blob, pixels);
  return createInpaintSourceSnapshot({ ...source, mask: { ...source.mask, blob } });
}
