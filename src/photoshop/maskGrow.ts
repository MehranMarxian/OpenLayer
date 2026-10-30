import { decodeRgbaPng, encodeRgbaPng } from "../utils/png";

/**
 * Grows a black-and-white selection mask outward by `pixels`.
 *
 * Why it exists, measured in Photoshop on 2026-10-30 with Remove object
 * (LaMa + Klein): a Select by Text `person` selection hugs the person exactly,
 * so the 1-2 px edge just outside it still holds the person's dark outline.
 * LaMa spreads those colours inward, and Klein reads the person-shaped smear
 * as a person -- it painted him back, seen from behind, at denoise 0.75 and
 * at 1.0. The same mask grown 24 px came back clean. Growing only inside the
 * ComfyUI graph was not enough either: the import masks the layer to the
 * captured selection, so the original outline survived as a thin ring. The
 * grown mask has to drive both the upload and the import, which is why this
 * runs on the captured mask in the panel.
 *
 * A square (Chebyshev) dilation, done as two separable passes of a running
 * maximum, so the cost is linear in the pixel count whatever `pixels` is.
 * Corners grow slightly further than edges (up to pixels x 1.41), which only
 * helps here. The red channel is read as the mask, matching ImageToMask(red)
 * in the graphs; the output is grey with alpha preserved.
 */
export function growMaskRgba(rgba: Uint8Array, width: number, height: number, pixels: number): Uint8Array {
  const radius = Math.max(0, Math.floor(pixels));
  const values = new Uint8Array(width * height);

  for (let index = 0; index < values.length; index += 1) {
    values[index] = rgba[index * 4] ?? 0;
  }

  const grown = radius === 0 ? values : dilateColumns(dilateRows(values, width, height, radius), width, height, radius);
  const output = new Uint8Array(rgba);

  for (let index = 0; index < grown.length; index += 1) {
    const value = grown[index] ?? 0;
    output[index * 4] = value;
    output[index * 4 + 1] = value;
    output[index * 4 + 2] = value;
  }

  return output;
}

export async function growMaskPng(blob: Blob, pixels: number): Promise<Blob> {
  const decoded = decodeRgbaPng(new Uint8Array(await blob.arrayBuffer()));
  const rgba = growMaskRgba(decoded.rgba, decoded.width, decoded.height, pixels);
  const png = encodeRgbaPng({ width: decoded.width, height: decoded.height, rgba });
  const buffer = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: "image/png" });
}

function dilateRows(values: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const output = new Uint8Array(values.length);
  const line = new Uint8Array(width);

  for (let y = 0; y < height; y += 1) {
    line.set(values.subarray(y * width, (y + 1) * width));
    output.set(runningMax(line, radius), y * width);
  }

  return output;
}

function dilateColumns(values: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const output = new Uint8Array(values.length);
  const line = new Uint8Array(height);

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) line[y] = values[y * width + x] ?? 0;
    const maxima = runningMax(line, radius);
    for (let y = 0; y < height; y += 1) output[y * width + x] = maxima[y] ?? 0;
  }

  return output;
}

/**
 * Maximum over [i - radius, i + radius] for every i, in O(n) (van Herk /
 * Gil-Werman): blocks of the window's width, a running max forward and
 * backward inside each block, and every window is the max of one suffix and
 * one prefix.
 */
function runningMax(line: Uint8Array, radius: number): Uint8Array {
  // Padded with `radius` zeros on both sides so every window is exactly
  // `window` wide. The block trick is only correct for full windows: a window
  // clamped at the line's end would read a whole block's maximum and grow the
  // mask past the radius.
  const length = line.length;
  const window = radius * 2 + 1;
  const padded = new Uint8Array(length + radius * 2);
  padded.set(line, radius);
  const forward = new Uint8Array(padded.length);
  const backward = new Uint8Array(padded.length);

  for (let index = 0; index < padded.length; index += 1) {
    const value = padded[index] ?? 0;
    forward[index] = index % window === 0 ? value : Math.max(forward[index - 1] ?? 0, value);
  }

  for (let index = padded.length - 1; index >= 0; index -= 1) {
    const value = padded[index] ?? 0;
    backward[index] = index === padded.length - 1 || (index + 1) % window === 0 ? value : Math.max(backward[index + 1] ?? 0, value);
  }

  const output = new Uint8Array(length);

  // Output pixel i is the window [i, i + 2 * radius] of the padded line.
  for (let index = 0; index < length; index += 1) {
    output[index] = Math.max(backward[index] ?? 0, forward[index + radius * 2] ?? 0);
  }

  return output;
}
