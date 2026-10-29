import { WorkflowPresetDefinition } from "./types";

type PixelSize = { width: number; height: number };

/**
 * Refuses a source whose upscaled result would pass the preset's measured limit.
 *
 * Only presets that carry `upscaleOutputLimit` are checked. upscale-basic does
 * not: ESRGAN tiles its work, so its cost never reached a ceiling on the dev rig.
 * SeedVR2 is different -- its time and memory follow the output size (about
 * 3 s per megapixel, 11.0 GiB peak at 19.7 MP on a 12 GB card), so an ordinary
 * 4000 x 3000 canvas at 2x asks for 48 MP and would either crawl through
 * ComfyUI's offloading for minutes or fail out of memory. A plain refusal with
 * the size that would work is kinder than either.
 *
 * Returns the artist-facing sentence, or null when the source is fine. The text
 * is set via textContent, so it stays plain: no markdown, no double dashes.
 */
export function getUpscaleOutputLimitProblem(
  preset: Pick<WorkflowPresetDefinition, "displayName" | "upscaleOutputLimit">,
  source: PixelSize
): string | null {
  const limit = preset.upscaleOutputLimit;

  if (!limit || !isUsableSize(source)) {
    return null;
  }

  const outputWidth = Math.round(source.width * limit.scale);
  const outputHeight = Math.round(source.height * limit.scale);
  const outputPixels = outputWidth * outputHeight;

  if (outputPixels <= limit.maxOutputPixels) {
    return null;
  }

  const largest = getLargestAllowedSource(source, limit.scale, limit.maxOutputPixels);

  return (
    `${preset.displayName} makes a ${limit.scale}x result, and this ${source.width} x ${source.height} source ` +
    `would become ${outputWidth} x ${outputHeight} (${formatMegapixels(outputPixels)} megapixels). ` +
    `The largest result measured to fit on a 12 GB card is ${formatMegapixels(limit.maxOutputPixels)} megapixels. ` +
    `Crop or reduce the source to about ${largest.width} x ${largest.height}, or choose upscale-basic.`
  );
}

/** The biggest source with the same aspect ratio whose result stays inside the limit. */
export function getLargestAllowedSource(source: PixelSize, scale: number, maxOutputPixels: number): PixelSize {
  const maxSourcePixels = maxOutputPixels / (scale * scale);
  const aspect = source.width / source.height;
  let width = Math.floor(Math.sqrt(maxSourcePixels * aspect));
  let height = Math.floor(width / aspect);

  // Rounding the result size can push it one row over; step down until it fits.
  while (width > 1 && height > 1 && Math.round(width * scale) * Math.round(height * scale) > maxOutputPixels) {
    width -= 1;
    height = Math.floor(width / aspect);
  }

  return { width: Math.max(1, width), height: Math.max(1, height) };
}

function isUsableSize(size: PixelSize) {
  return Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;
}

function formatMegapixels(pixels: number) {
  return (pixels / 1_000_000).toFixed(1);
}
