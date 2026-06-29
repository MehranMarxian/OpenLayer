import { decodeRgbaPng, encodeRgbaPng, DecodedRgbaPng } from "../utils/png";
import { createOpenLayerError } from "../utils/errors";

export const FLUX_FILL_EMBEDDED_MASK_FILENAME = "openlayer-flux-fill-source-mask.png";

export type FluxFillEmbeddedMaskSource = {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  message: string;
};

export async function createFluxFillEmbeddedMaskSource(
  sourceBlob: Blob,
  maskBlob: Blob,
  filename = FLUX_FILL_EMBEDDED_MASK_FILENAME
): Promise<FluxFillEmbeddedMaskSource> {
  try {
    const source = decodeRgbaPng(new Uint8Array(await sourceBlob.arrayBuffer()));
    const mask = decodeRgbaPng(new Uint8Array(await maskBlob.arrayBuffer()));
    const rgba = createFluxFillEmbeddedMaskRgba(source, mask);
    const png = encodeRgbaPng({ width: source.width, height: source.height, rgba });

    return {
      blob: new Blob([copyToArrayBuffer(png)], { type: "image/png" }),
      filename,
      width: source.width,
      height: source.height,
      message:
        "Flux Fill source uploaded with an embedded alpha mask for ComfyUI LoadImage. White mask = repaint."
    };
  } catch (error) {
    throw createOpenLayerError(
      "INPAINT_SOURCE_INVALID",
      "Could not prepare the Flux Fill masked source image.",
      `Flux Fill expects one PNG source image with the Photoshop mask embedded as alpha. ${String(error)}`
    );
  }
}

function copyToArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function createFluxFillEmbeddedMaskRgba(source: DecodedRgbaPng, mask: DecodedRgbaPng) {
  if (source.width !== mask.width || source.height !== mask.height) {
    throw new Error(
      `Source and mask dimensions must match. Source is ${source.width} x ${source.height}; mask is ${mask.width} x ${mask.height}.`
    );
  }

  const output = new Uint8Array(source.rgba);

  for (let offset = 0; offset < output.byteLength; offset += 4) {
    const maskRed = mask.rgba[offset] ?? 0;
    const maskGreen = mask.rgba[offset + 1] ?? maskRed;
    const maskBlue = mask.rgba[offset + 2] ?? maskRed;
    const repaintMask = Math.max(maskRed, maskGreen, maskBlue);

    // ComfyUI LoadImage returns mask = 1 - alpha, so OpenLayer's white
    // "repaint here" mask must become transparent alpha in the embedded PNG.
    output[offset + 3] = 255 - repaintMask;
  }

  return output;
}
