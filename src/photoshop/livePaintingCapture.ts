import { createOpenLayerError, getErrorMessage } from "../utils/errors";
import { encodeRgbaPng } from "../utils/png";
import { convertPixelsToRgba } from "./photoshopAdapter";
import {
  createPhotoshopDocumentIdentity,
  PhotoshopDocumentIdentity
} from "./documentContext";

// Spike telemetry: which capture path this Photoshop build actually supports.
// "non-modal" means imaging.getPixels ran without executeAsModal, so capture
// does not interrupt the user's brush. "scaled" means the host honored
// targetSize and downscaled server-side.
export type LiveCaptureMode =
  | "non-modal-scaled"
  | "non-modal-full"
  | "modal-scaled"
  | "modal-full";

export type LiveCaptureResult = {
  blob: Blob;
  width: number;
  height: number;
  mode: LiveCaptureMode;
  captureMs: number;
  originatingDocument: PhotoshopDocumentIdentity;
};

type LivePhotoshopModule = {
  app: {
    activeDocument?: {
      id?: number;
      title?: string;
      name?: string;
      width?: number;
      height?: number;
    };
  };
  core: {
    executeAsModal: <T>(command: () => Promise<T>, options: { commandName: string }) => Promise<T>;
  };
  imaging?: {
    getPixels: (options: Record<string, unknown>) => Promise<{
      imageData?: {
        width?: number;
        height?: number;
        components?: number;
        componentSize?: number;
        getData?: (options?: Record<string, unknown>) => Promise<ArrayBuffer | Uint8Array | number[]> | ArrayBuffer | Uint8Array | number[];
        dispose?: () => void;
      };
    }>;
  };
};

export async function captureCanvasForLivePainting(maxDimension = 512): Promise<LiveCaptureResult> {
  const photoshop = require("photoshop") as LivePhotoshopModule;
  const document = photoshop.app.activeDocument;

  if (!document || typeof document.id !== "number") {
    throw createOpenLayerError(
      "PHOTOSHOP_NO_DOCUMENT",
      "Open a Photoshop document before starting a Live Painting session."
    );
  }

  const imaging = photoshop.imaging;

  if (!imaging?.getPixels) {
    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      "This Photoshop build does not expose the Imaging API needed for Live Painting capture."
    );
  }

  const documentWidth = Number(document.width ?? 0);
  const documentHeight = Number(document.height ?? 0);
  const originatingDocument = createPhotoshopDocumentIdentity(
    document.id,
    document.title ?? document.name ?? "Untitled document"
  );
  const target = createLiveTargetSize(documentWidth, documentHeight, maxDimension);
  const baseOptions: Record<string, unknown> = {
    documentID: document.id,
    componentSize: 8,
    colorSpace: "RGB",
    applyAlpha: true
  };

  const attempts: { mode: LiveCaptureMode; useModal: boolean; options: Record<string, unknown> }[] = [
    ...(target
      ? [{ mode: "non-modal-scaled" as const, useModal: false, options: { ...baseOptions, targetSize: target } }]
      : []),
    { mode: "non-modal-full", useModal: false, options: { ...baseOptions } },
    ...(target
      ? [{ mode: "modal-scaled" as const, useModal: true, options: { ...baseOptions, targetSize: target } }]
      : []),
    { mode: "modal-full", useModal: true, options: { ...baseOptions } }
  ];

  const failures: string[] = [];
  const startedAt = Date.now();

  for (const attempt of attempts) {
    try {
      const result = attempt.useModal
        ? await photoshop.core.executeAsModal(
          () => capturePixelsAsPng(imaging, attempt.options),
          { commandName: "OpenLayer Live Capture" }
        )
        : await capturePixelsAsPng(imaging, attempt.options);

      return {
        ...result,
        mode: attempt.mode,
        captureMs: Date.now() - startedAt,
        originatingDocument
      };
    } catch (caughtError) {
      failures.push(`${attempt.mode}: ${getErrorMessage(caughtError)}`);
    }
  }

  throw createOpenLayerError(
    "PHOTOSHOP_EXPORT_FAILED",
    "Live Painting could not capture the canvas with any supported method.",
    failures.join(" | ")
  );
}

async function capturePixelsAsPng(
  imaging: NonNullable<LivePhotoshopModule["imaging"]>,
  options: Record<string, unknown>
): Promise<{ blob: Blob; width: number; height: number }> {
  let imageData: Awaited<ReturnType<NonNullable<LivePhotoshopModule["imaging"]>["getPixels"]>>["imageData"];

  try {
    const pixelResult = await imaging.getPixels(options);
    imageData = pixelResult.imageData;

    if (!imageData || typeof imageData.getData !== "function") {
      throw new Error("Photoshop returned no readable image data.");
    }

    const width = Number(imageData.width ?? 0);
    const height = Number(imageData.height ?? 0);
    const components = Number(imageData.components ?? 4);
    const componentSize = Number(imageData.componentSize ?? 8);

    if (width <= 0 || height <= 0) {
      throw new Error("Photoshop returned image data without valid dimensions.");
    }

    if (componentSize !== 8) {
      throw new Error(`Expected 8-bit pixels, received ${componentSize}-bit data.`);
    }

    const raw = toUint8Array(await imageData.getData());
    const rgba = convertPixelsToRgba(raw, width, height, components);
    const png = encodeRgbaPng({ width, height, rgba });

    return {
      blob: new Blob([toArrayBuffer(png)], { type: "image/png" }),
      width,
      height
    };
  } finally {
    imageData?.dispose?.();
  }
}

export function createLiveTargetSize(
  documentWidth: number,
  documentHeight: number,
  maxDimension: number
): { width: number; height: number } | null {
  if (
    !Number.isFinite(documentWidth) ||
    !Number.isFinite(documentHeight) ||
    documentWidth <= 0 ||
    documentHeight <= 0
  ) {
    return null;
  }

  const largest = Math.max(documentWidth, documentHeight);
  const scale = largest > maxDimension ? maxDimension / largest : 1;
  const width = snapLiveDimension(documentWidth * scale);
  const height = snapLiveDimension(documentHeight * scale);

  if (width === Math.round(documentWidth) && height === Math.round(documentHeight)) {
    return null;
  }

  return { width, height };
}

function snapLiveDimension(value: number) {
  return Math.max(64, Math.round(value / 8) * 8);
}

function toUint8Array(data: ArrayBuffer | Uint8Array | number[]) {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  return new Uint8Array(data);
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
