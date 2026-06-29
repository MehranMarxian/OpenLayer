import { createLayerName, saveBlobToTemporaryFile } from "../utils/fileUtils";

export type ImageDimensions = {
  width: number;
  height: number;
};

export type InpaintMaskPolarity = "white-repaints";
export type InpaintImportMode = "transparent-outside-mask" | "aligned-context-fallback";
export type InpaintOutputKind = "full-context" | "cropped-or-unknown";
export type TransparentInpaintProcessingStatus = "created" | "skipped" | "timed-out";

export type TransparentInpaintProcessingResult = {
  blob: Blob | null;
  status: TransparentInpaintProcessingStatus;
  message: string;
};

export const TRANSPARENT_INPAINT_TIMEOUT_MS = 1800;

export type InpaintOutputAnalysis = {
  presetId: string;
  sourceDimensions: ImageDimensions;
  maskDimensions?: ImageDimensions | null;
  resultDimensions?: ImageDimensions | null;
  importMode: InpaintImportMode;
  maskPolarity: InpaintMaskPolarity;
};

export type InpaintDebugBlobSet = {
  sourceBlob: Blob;
  maskBlob?: Blob | null;
  resultBlob: Blob;
  prefix?: string;
};

export function validateInpaintOutputDimensions(analysis: InpaintOutputAnalysis) {
  const problems: string[] = [];

  if (!hasDimensions(analysis.sourceDimensions)) {
    problems.push("Inpaint source dimensions are unknown.");
  }

  if (!analysis.maskDimensions || !hasDimensions(analysis.maskDimensions)) {
    problems.push("Inpaint mask dimensions are unknown.");
  }

  if (!analysis.resultDimensions || !hasDimensions(analysis.resultDimensions)) {
    problems.push("Inpaint result dimensions are unknown.");
  }

  if (
    analysis.maskDimensions &&
    hasDimensions(analysis.sourceDimensions) &&
    hasDimensions(analysis.maskDimensions) &&
    !dimensionsMatch(analysis.sourceDimensions, analysis.maskDimensions)
  ) {
    problems.push(
      `Inpaint source and mask dimensions differ: source ${formatDimensions(analysis.sourceDimensions)}, mask ${formatDimensions(analysis.maskDimensions)}.`
    );
  }

  return problems;
}

export function classifyInpaintOutputKind(analysis: InpaintOutputAnalysis): InpaintOutputKind {
  if (analysis.resultDimensions && dimensionsMatch(analysis.sourceDimensions, analysis.resultDimensions)) {
    return "full-context";
  }

  return "cropped-or-unknown";
}

export function formatInpaintOutputDiagnostics(analysis: InpaintOutputAnalysis) {
  const outputKind = classifyInpaintOutputKind(analysis);
  const validation = validateInpaintOutputDimensions(analysis);
  const parts = [
    `Inpaint debug: preset ${analysis.presetId}.`,
    `Source ${formatDimensions(analysis.sourceDimensions)}.`,
    `Mask ${formatDimensions(analysis.maskDimensions)}.`,
    `Raw result ${formatDimensions(analysis.resultDimensions)}.`,
    `Output kind: ${formatOutputKind(outputKind)}.`,
    `Import mode: ${formatImportMode(analysis.importMode)}.`,
    "Mask polarity: white = repaint.",
    validation.length > 0 ? `Check: ${validation.join(" ")}` : ""
  ];

  return parts.filter(Boolean).join(" ");
}

export async function readImageDimensionsFromBlob(blob: Blob): Promise<ImageDimensions | null> {
  if (!blob || blob.size === 0) {
    return null;
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  return readPngDimensions(bytes) ?? readJpegDimensions(bytes);
}

export async function createTransparentInpaintResultBlob(
  resultBlob: Blob,
  maskBlob: Blob,
  timeoutMs = TRANSPARENT_INPAINT_TIMEOUT_MS
): Promise<Blob | null> {
  try {
    const resultImage = await loadImageElement(resultBlob, timeoutMs);
    const maskImage = await loadImageElement(maskBlob, timeoutMs);

    if (!resultImage || !maskImage) {
      return null;
    }

    const width = readLoadedImageWidth(resultImage);
    const height = readLoadedImageHeight(resultImage);
    const maskWidth = readLoadedImageWidth(maskImage);
    const maskHeight = readLoadedImageHeight(maskImage);

    if (width <= 0 || height <= 0 || width !== maskWidth || height !== maskHeight) {
      return null;
    }

    const resultCanvas = createCanvas(width, height);
    const maskCanvas = createCanvas(width, height);

    if (!resultCanvas || !maskCanvas) {
      return null;
    }

    const resultContext = resultCanvas.getContext("2d");
    const maskContext = maskCanvas.getContext("2d");

    if (!resultContext || !maskContext) {
      return null;
    }

    resultContext.drawImage(resultImage, 0, 0, width, height);
    maskContext.drawImage(maskImage, 0, 0, width, height);

    const resultData = resultContext.getImageData(0, 0, width, height);
    const maskData = maskContext.getImageData(0, 0, width, height);

    for (let index = 0; index < resultData.data.length; index += 4) {
      const red = maskData.data[index] ?? 0;
      const green = maskData.data[index + 1] ?? red;
      const blue = maskData.data[index + 2] ?? red;
      resultData.data[index + 3] = Math.max(red, green, blue);
    }

    resultContext.putImageData(resultData, 0, 0);
    return await canvasToPngBlob(resultCanvas, timeoutMs);
  } catch {
    return null;
  }
}

export async function tryCreateTransparentInpaintResultBlob(
  resultBlob: Blob,
  maskBlob: Blob,
  timeoutMs = TRANSPARENT_INPAINT_TIMEOUT_MS
): Promise<TransparentInpaintProcessingResult> {
  const outcome = await resolveWithTimeout(
    createTransparentInpaintResultBlob(resultBlob, maskBlob, timeoutMs),
    timeoutMs,
    null
  );

  if (outcome.value) {
    return {
      blob: outcome.value,
      status: "created",
      message: "Prepared transparent inpaint patch using the captured mask."
    };
  }

  if (outcome.timedOut) {
    return {
      blob: null,
      status: "timed-out",
      message: "Transparent mask compositing timed out in Photoshop UXP. Aligned context fallback used."
    };
  }

  return {
    blob: null,
    status: "skipped",
    message: "Transparent mask compositing skipped or unavailable in Photoshop UXP. Aligned context fallback used."
  };
}

export function resolveWithTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  fallbackValue: T
): Promise<{ value: T; timedOut: boolean }> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return task
      .then((value) => ({ value, timedOut: false }))
      .catch(() => ({ value: fallbackValue, timedOut: false }));
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setSafeTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({ value: fallbackValue, timedOut: true });
    }, timeoutMs);

    task
      .then((value) => {
        if (settled) {
          return;
        }

        settled = true;
        clearSafeTimeout(timeoutId);
        resolve({ value, timedOut: false });
      })
      .catch(() => {
        if (settled) {
          return;
        }

        settled = true;
        clearSafeTimeout(timeoutId);
        resolve({ value: fallbackValue, timedOut: false });
      });
  });
}

export async function saveInpaintDebugBlobsToTemporaryFiles(blobs: InpaintDebugBlobSet) {
  const prefix = blobs.prefix ?? createLayerName("OpenLayer_Inpaint_Debug");
  const savedFiles: string[] = [];

  await saveBlobToTemporaryFile(blobs.sourceBlob, `${prefix}_source.png`);
  savedFiles.push(`${prefix}_source.png`);

  if (blobs.maskBlob) {
    await saveBlobToTemporaryFile(blobs.maskBlob, `${prefix}_mask.png`);
    savedFiles.push(`${prefix}_mask.png`);
  }

  await saveBlobToTemporaryFile(blobs.resultBlob, `${prefix}_raw-result.png`);
  savedFiles.push(`${prefix}_raw-result.png`);

  return savedFiles;
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.byteLength < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }

  return {
    width: readUint32(bytes, 16),
    height: readUint32(bytes, 20)
  };
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const blockLength = readUint16(bytes, offset + 2);

    if (isJpegStartOfFrame(marker) && blockLength >= 7) {
      return {
        height: readUint16(bytes, offset + 5),
        width: readUint16(bytes, offset + 7)
      };
    }

    offset += 2 + Math.max(blockLength, 2);
  }

  return null;
}

function dimensionsMatch(first: ImageDimensions, second: ImageDimensions) {
  return Math.round(first.width) === Math.round(second.width) && Math.round(first.height) === Math.round(second.height);
}

function hasDimensions(dimensions: ImageDimensions | null | undefined): dimensions is ImageDimensions {
  return Boolean(
    dimensions &&
      Number.isFinite(dimensions.width) &&
      Number.isFinite(dimensions.height) &&
      dimensions.width > 0 &&
      dimensions.height > 0
  );
}

function formatDimensions(dimensions: ImageDimensions | null | undefined) {
  if (!hasDimensions(dimensions)) {
    return "unknown size";
  }

  return `${Math.round(dimensions.width)} x ${Math.round(dimensions.height)}`;
}

function formatOutputKind(outputKind: InpaintOutputKind) {
  return outputKind === "full-context" ? "full context" : "cropped or unknown";
}

function formatImportMode(importMode: InpaintImportMode) {
  return importMode === "transparent-outside-mask"
    ? "transparent outside mask"
    : "aligned context fallback";
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function readUint16(bytes: Uint8Array, offset: number) {
  return (((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0)) >>> 0;
}

function isJpegStartOfFrame(marker: number | undefined) {
  return marker !== undefined && marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined" || !document.createElement) {
    return null;
  }

  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas.width = width;
  canvas.height = height;

  return typeof canvas.getContext === "function" ? canvas : null;
}

function loadImageElement(blob: Blob, timeoutMs: number): Promise<HTMLImageElement | null> {
  if (typeof document === "undefined" || typeof URL === "undefined" || !document.createElement) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const image = document.createElement("img") as HTMLImageElement;
    const url = URL.createObjectURL(blob);
    let settled = false;

    const cleanup = () => {
      clearSafeTimeout(timeoutId);
      URL.revokeObjectURL(url);
    };

    const timeoutId = setSafeTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(null);
      }
    }, timeoutMs);

    image.onload = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(image);
      }
    };
    image.onerror = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(null);
      }
    };
    image.src = url;
  });
}

function readLoadedImageWidth(image: HTMLImageElement) {
  return Math.round(image.naturalWidth || image.width || 0);
}

function readLoadedImageHeight(image: HTMLImageElement) {
  return Math.round(image.naturalHeight || image.height || 0);
}

function canvasToPngBlob(canvas: HTMLCanvasElement, timeoutMs: number): Promise<Blob | null> {
  if (typeof canvas.toBlob === "function") {
    return new Promise((resolve) => {
      let settled = false;
      const timeoutId = setSafeTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, timeoutMs);

      canvas.toBlob((blob) => {
        if (!settled) {
          settled = true;
          clearSafeTimeout(timeoutId);
          resolve(blob);
        }
      }, "image/png");
    });
  }

  if (typeof canvas.toDataURL === "function" && typeof fetch === "function") {
    return resolveWithTimeout(
      fetch(canvas.toDataURL("image/png")).then((response) => response.blob()),
      timeoutMs,
      null
    ).then((outcome) => outcome.value);
  }

  return Promise.resolve(null);
}

function setSafeTimeout(callback: () => void, timeoutMs: number) {
  return globalThis.setTimeout(callback, Math.max(1, Math.round(timeoutMs)));
}

function clearSafeTimeout(timeoutId: ReturnType<typeof setTimeout>) {
  globalThis.clearTimeout(timeoutId);
}
