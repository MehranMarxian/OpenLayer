import { getPrimaryDeviceVramTotalBytes } from "./hardwareAdvisor";
import { ComfySystemStats, WorkflowPresetDefinition, WorkflowUpscaleOutputLimit } from "./types";

type PixelSize = { width: number; height: number };

const BYTES_PER_GIB = 1024 ** 3;

/**
 * Refuses a source whose upscaled result would not fit the card ComfyUI runs on.
 *
 * Only presets that carry `upscaleOutputLimit` are checked. upscale-basic does
 * not: ESRGAN tiles its work, so its cost never reached a ceiling on the dev rig.
 * SeedVR2 is different -- its time and memory follow the output size, and past
 * the card's VRAM ComfyUI starts offloading: on 12 GB a 28.3 MP result ran 2.7x
 * slower per pixel than a 19.7 MP one. A plain refusal with the size that would
 * work is kinder than a four-minute crawl or an out-of-memory error.
 *
 * The limit is the 12 GB measurement moved by the measured VRAM cost of an
 * output pixel, so a 16 GB card is allowed more and a 10 GB card less. Only the
 * 12 GB point was ever run; everything else is that slope extrapolated, and the
 * floor keeps ordinary sizes allowed on cards where the arithmetic runs out.
 *
 * Returns the artist-facing sentence, or null when the source is fine. The text
 * is set via textContent, so it stays plain: no markdown, no double dashes.
 */
export function getUpscaleOutputLimitProblem(
  preset: Pick<WorkflowPresetDefinition, "displayName" | "upscaleOutputLimit">,
  source: PixelSize,
  vramTotalBytes: number | null = null
): string | null {
  const limit = preset.upscaleOutputLimit;

  if (!limit || !isUsableSize(source)) {
    return null;
  }

  const outputWidth = Math.round(source.width * limit.scale);
  const outputHeight = Math.round(source.height * limit.scale);
  const outputPixels = outputWidth * outputHeight;
  const maxOutputPixels = getUpscaleMaxOutputPixels(limit, vramTotalBytes);

  if (outputPixels <= maxOutputPixels) {
    return null;
  }

  const largest = getLargestAllowedSource(source, limit.scale, maxOutputPixels);
  const measured = `${formatMegapixels(limit.measuredMaxOutputPixels)} megapixels measured on ${formatGigabytes(limit.measuredVramTotalBytes)} GB`;
  const limitSentence = isUsableVram(vramTotalBytes)
    ? `With the ${formatGigabytes(vramTotalBytes)} GB of VRAM ComfyUI reports, the limit is ${formatMegapixels(maxOutputPixels)} megapixels (${measured}, scaled by VRAM).`
    : `ComfyUI did not report its VRAM, so the measured limit applies: ${measured}.`;

  return (
    `${preset.displayName} makes a ${limit.scale}x result, and this ${source.width} x ${source.height} source ` +
    `would become ${outputWidth} x ${outputHeight} (${formatMegapixels(outputPixels)} megapixels). ${limitSentence} ` +
    `Crop or reduce the source to about ${largest.width} x ${largest.height}, or choose upscale-basic.`
  );
}

/**
 * The largest output, in pixels, allowed on a card with this much VRAM. Unknown
 * VRAM falls back to the measured card rather than guessing either way.
 */
export function getUpscaleMaxOutputPixels(limit: WorkflowUpscaleOutputLimit, vramTotalBytes: number | null): number {
  if (!isUsableVram(vramTotalBytes)) {
    return limit.measuredMaxOutputPixels;
  }

  const scaled = limit.measuredMaxOutputPixels
    + (vramTotalBytes - limit.measuredVramTotalBytes) / limit.vramBytesPerOutputPixel;

  return Math.max(limit.minOutputPixels, Math.floor(scaled));
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

/**
 * Total VRAM of the card ComfyUI generates on, or null. A failed read is not an
 * error here: the limit simply falls back to the measured card.
 */
export async function readComfyVramTotalBytes(
  client: { getSystemStats(): Promise<ComfySystemStats> }
): Promise<number | null> {
  try {
    return getPrimaryDeviceVramTotalBytes(await client.getSystemStats());
  } catch {
    return null;
  }
}

function isUsableSize(size: PixelSize) {
  return Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;
}

function isUsableVram(vramTotalBytes: number | null): vramTotalBytes is number {
  return typeof vramTotalBytes === "number" && Number.isFinite(vramTotalBytes) && vramTotalBytes > 0;
}

function formatMegapixels(pixels: number) {
  return (pixels / 1_000_000).toFixed(1);
}

function formatGigabytes(bytes: number) {
  return (bytes / BYTES_PER_GIB).toFixed(1);
}
