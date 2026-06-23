import { createLayerName, saveBlobToTemporaryFile } from "../utils/fileUtils";
import { createOpenLayerError, getErrorMessage } from "../utils/errors";

type PhotoshopModule = {
  app: {
    activeDocument?: PhotoshopDocument;
    documents?: PhotoshopDocument[];
  };
  action: {
    batchPlay: (commands: unknown[], options: Record<string, unknown>) => Promise<unknown[]>;
  };
  core: {
    executeAsModal: <T>(command: () => Promise<T>, options: { commandName: string }) => Promise<T>;
  };
  imaging?: {
    getPixels: (options: Record<string, unknown>) => Promise<PhotoshopPixelResult>;
    encodeImageData: (options: Record<string, unknown>) => Promise<ArrayBuffer | Uint8Array | number[] | string>;
  };
};

type PhotoshopDocument = {
  id?: number;
  title?: string;
  name?: string;
  width?: number;
  height?: number;
  activeLayers?: PhotoshopLayer[];
};

type PhotoshopLayer = {
  id?: number;
  name?: string;
};

type PhotoshopImageData = {
  width?: number;
  height?: number;
  dispose?: () => void;
};

type PhotoshopPixelResult = {
  imageData?: PhotoshopImageData;
};

type CapturedSourceImage = {
  data: ArrayBuffer;
  filename: string;
  width: number;
  height: number;
  sourceName: string;
};

type ImportProgress = (message: string) => void;

type BatchPlayCommand = Record<string, unknown>;

export type ActiveDocumentInfo = {
  name: string;
  width: number;
  height: number;
};

export type ExportedSourceImage = {
  blob: Blob;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  sourceName: string;
};

export async function hasOpenDocument(): Promise<boolean> {
  const photoshop = getPhotoshop();
  return Boolean(photoshop.app.activeDocument);
}

export async function getActiveDocumentInfo(): Promise<ActiveDocumentInfo> {
  const document = getActiveDocument();

  return {
    name: document.title ?? document.name ?? "Untitled",
    width: Number(document.width ?? 0),
    height: Number(document.height ?? 0)
  };
}

export async function importGeneratedImageAsLayer(
  blob: Blob,
  layerName = createLayerName("OpenLayer_Generated"),
  onProgress?: ImportProgress
) {
  const photoshop = getPhotoshop();
  getActiveDocument();

  try {
    if (!blob || blob.size === 0) {
      throw new Error("The generated image blob is empty.");
    }

    onProgress?.("Saving generated image to a temporary PNG...");
    const file = await saveBlobToTemporaryFile(blob, `${layerName}.png`);
    const uxp = getUxp();
    onProgress?.("Creating Photoshop file token...");
    const token = await uxp.storage.localFileSystem.createSessionToken(file);

    onProgress?.("Placing image into the active document...");
    await photoshop.core.executeAsModal(
      async () => {
        await placeFileAsLayer(photoshop, token);
        onProgress?.("Renaming imported layer...");
        await renameActiveLayer(photoshop, layerName);
      },
      { commandName: "Import OpenLayer Result" }
    );

    onProgress?.(`Imported ${layerName}.`);
    return layerName;
  } catch (caughtError) {
    throw createOpenLayerError(
      "PHOTOSHOP_IMPORT_FAILED",
      `Could not import the generated image as a Photoshop layer. ${getErrorMessage(caughtError)}`
    );
  }
}

export async function exportActiveLayerForImageToImage(): Promise<ExportedSourceImage> {
  const photoshop = getPhotoshop();
  const imaging = getImagingApi(photoshop);

  try {
    const capturedSource = await photoshop.core.executeAsModal(
      async () => {
        const document = getActiveDocument();
        const activeLayer = document.activeLayers?.[0];

        if (!activeLayer) {
          throw createOpenLayerError(
            "PHOTOSHOP_EXPORT_FAILED",
            "No active Photoshop layer was found. Select a pixel or smart object layer before using Image to Image."
          );
        }

        if (typeof document.id !== "number" || typeof activeLayer.id !== "number") {
          throw createOpenLayerError(
            "PHOTOSHOP_EXPORT_FAILED",
            "Photoshop did not expose a stable document or layer ID for the active layer.",
            "Image-to-image source capture needs document.id and activeLayer.id."
          );
        }

        return captureSourceImage(imaging, {
          pixelOptions: {
            documentID: document.id,
            layerID: activeLayer.id,
            componentSize: 8,
            colorSpace: "RGB",
            applyAlpha: true
          },
          filenamePrefix: "OpenLayer_Source",
          sourceName: activeLayer.name || "Active layer"
        });
      },
      { commandName: "Capture OpenLayer Source" }
    );

    return createExportedSourceImage(capturedSource);
  } catch (caughtError) {
    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      `Could not capture the active Photoshop layer for image-to-image. ${getErrorMessage(caughtError)}`
    );
  }
}

export async function exportCanvasForImageToImage(): Promise<ExportedSourceImage> {
  const photoshop = getPhotoshop();
  const imaging = getImagingApi(photoshop);

  try {
    const capturedSource = await photoshop.core.executeAsModal(
      async () => {
        const document = getActiveDocument();

        if (typeof document.id !== "number") {
          throw createOpenLayerError(
            "PHOTOSHOP_EXPORT_FAILED",
            "Photoshop did not expose a stable document ID for the active document.",
            "Canvas image-to-image source capture needs document.id."
          );
        }

        return captureSourceImage(imaging, {
          pixelOptions: {
            documentID: document.id,
            ...createDocumentSourceBounds(document),
            componentSize: 8,
            colorSpace: "RGB",
            applyAlpha: true
          },
          filenamePrefix: "OpenLayer_Canvas",
          sourceName: document.title ?? document.name ?? "Canvas composite"
        });
      },
      { commandName: "Capture OpenLayer Canvas" }
    );

    return createExportedSourceImage(capturedSource);
  } catch (caughtError) {
    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      `Could not capture the Photoshop canvas for image-to-image. ${getErrorMessage(caughtError)}`
    );
  }
}

export async function exportActiveLayerAsPNG(): Promise<Blob> {
  // TODO(v0.2+): Add a true PNG export path if Photoshop UXP exposes one safely for selected layers.
  throw createOpenLayerError(
    "PHOTOSHOP_EXPORT_FAILED",
    "PNG active-layer export is planned for a future OpenLayer version. v0.2.0-alpha captures a JPEG source through Photoshop's Imaging API for Image to Image."
  );
}

export async function exportSelectionAsPNG(): Promise<Blob> {
  // TODO(v0.2): Export the active selection pixels for inpainting and regional generation.
  throw new Error("exportSelectionAsPNG is planned for a future OpenLayer version.");
}

export async function exportSelectionMask(): Promise<Blob> {
  // TODO(v0.2): Export the active selection or mask as a grayscale PNG for mask workflows.
  throw new Error("exportSelectionMask is planned for a future OpenLayer version.");
}

export async function importImageAlignedToSelection(_blob: Blob): Promise<void> {
  // TODO(v0.2): Place generated content aligned to the active selection bounds.
  throw new Error("importImageAlignedToSelection is planned for a future OpenLayer version.");
}

export async function preserveSelection<T>(_operation: () => Promise<T>): Promise<T> {
  // TODO(v0.2): Save and restore the active Photoshop selection around generation workflows.
  throw new Error("preserveSelection is planned for a future OpenLayer version.");
}

function getActiveDocument() {
  const photoshop = getPhotoshop();
  const document = photoshop.app.activeDocument;

  if (!document) {
    throw createOpenLayerError(
      "PHOTOSHOP_NO_DOCUMENT",
      "No Photoshop document is open. Open a document before importing a result."
    );
  }

  return document;
}

async function placeFileAsLayer(photoshop: PhotoshopModule, token: string) {
  const placeCommands = createPlaceCommands(token);
  const failures: string[] = [];

  for (const command of placeCommands) {
    try {
      await photoshop.action.batchPlay([command], {});
      return;
    } catch (caughtError) {
      failures.push(getErrorMessage(caughtError));
    }
  }

  throw new Error(`Photoshop rejected the place command. ${failures.filter(Boolean).join(" | ")}`);
}

function createPlaceCommands(token: string): BatchPlayCommand[] {
  const localFile = {
    _path: token,
    _kind: "local"
  };

  return [
    {
      _obj: "placeEvent",
      null: localFile,
      linked: false,
      freeTransformCenterState: {
        _enum: "quadCenterState",
        _value: "QCSAverage"
      },
      offset: {
        _obj: "offset",
        horizontal: {
          _unit: "pixelsUnit",
          _value: 0
        },
        vertical: {
          _unit: "pixelsUnit",
          _value: 0
        }
      },
      _options: {
        dialogOptions: "dontDisplay"
      }
    },
    {
      _obj: "placeEvent",
      null: localFile,
      linked: false,
      _options: {
        dialogOptions: "dontDisplay"
      }
    }
  ];
}

async function renameActiveLayer(photoshop: PhotoshopModule, layerName: string) {
  const activeLayer = photoshop.app.activeDocument?.activeLayers?.[0];

  if (activeLayer) {
    try {
      activeLayer.name = layerName;
      return;
    } catch {
      // Fall through to the action descriptor below.
    }
  }

  await photoshop.action.batchPlay(
    [
      {
        _obj: "set",
        _target: [
          {
            _ref: "layer",
            _enum: "ordinal",
            _value: "targetEnum"
          }
        ],
        to: {
          _obj: "layer",
          name: layerName
        },
        _options: {
          dialogOptions: "dontDisplay"
        }
      }
    ],
    {}
  );
}

function getImagingApi(photoshop: PhotoshopModule) {
  const imaging = photoshop.imaging;

  if (!imaging?.getPixels || !imaging.encodeImageData) {
    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      "This Photoshop UXP environment does not expose the Imaging API needed to capture a source image.",
      "OpenLayer v0.2.0-alpha uses photoshop.imaging.getPixels() and encodeImageData() for image-to-image source capture."
    );
  }

  return imaging;
}

async function captureSourceImage(
  imaging: NonNullable<PhotoshopModule["imaging"]>,
  options: {
    pixelOptions: Record<string, unknown>;
    filenamePrefix: string;
    sourceName: string;
  }
): Promise<CapturedSourceImage> {
  let imageData: PhotoshopImageData | undefined;

  try {
    const pixelResult = await imaging.getPixels(options.pixelOptions);
    imageData = pixelResult.imageData;

    if (!imageData) {
      throw new Error("Photoshop returned no image data.");
    }

    const encoded = await imaging.encodeImageData({
      imageData,
      base64: false
    });
    const bytes = toUint8Array(encoded);

    if (bytes.byteLength === 0) {
      throw new Error("Photoshop encoded an empty source image.");
    }

    return {
      data: toArrayBuffer(bytes),
      filename: `${createLayerName(options.filenamePrefix)}.jpg`,
      width: Number(imageData.width ?? 0),
      height: Number(imageData.height ?? 0),
      sourceName: options.sourceName
    };
  } finally {
    imageData?.dispose?.();
  }
}

function createExportedSourceImage(capturedSource: CapturedSourceImage): ExportedSourceImage {
  return {
    blob: new Blob([capturedSource.data], { type: "image/jpeg" }),
    filename: capturedSource.filename,
    mimeType: "image/jpeg",
    width: capturedSource.width,
    height: capturedSource.height,
    sourceName: capturedSource.sourceName
  };
}

function createDocumentSourceBounds(document: PhotoshopDocument) {
  const width = Number(document.width ?? 0);
  const height = Number(document.height ?? 0);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {};
  }

  return {
    sourceBounds: {
      left: 0,
      top: 0,
      right: width,
      bottom: height
    }
  };
}

function toUint8Array(data: ArrayBuffer | Uint8Array | number[] | string) {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }

  return decodeBase64(data);
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function decodeBase64(base64Value: string) {
  const normalized = base64Value.includes(",") ? base64Value.split(",").pop() ?? "" : base64Value;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function getPhotoshop(): PhotoshopModule {
  return require("photoshop") as PhotoshopModule;
}

function getUxp(): UxpModule {
  return require("uxp") as UxpModule;
}
