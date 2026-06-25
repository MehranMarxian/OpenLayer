import { createLayerName, saveBlobToTemporaryFile } from "../utils/fileUtils";
import { createOpenLayerError, getErrorMessage } from "../utils/errors";
import { encodeRgbaPng } from "../utils/png";
import {
  normalizeSelectionBounds,
  NormalizedSelectionBounds,
  SelectionBounds
} from "./selectionUtils";

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
  components?: number;
  componentSize?: number;
  getData?: (options?: Record<string, unknown>) => Promise<ArrayBuffer | Uint8Array | number[]> | ArrayBuffer | Uint8Array | number[];
  dispose?: () => void;
};

type PhotoshopPixelResult = {
  imageData?: PhotoshopImageData;
};

export type SourceCaptureFormat = "png";

type CapturedSourceImage = {
  data: ArrayBuffer;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  sourceName: string;
  captureFormat: SourceCaptureFormat;
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
  captureFormat: SourceCaptureFormat;
};

export type SelectionMaskExport = {
  blob: Blob;
  bounds: SelectionBounds;
  width: number;
  height: number;
};

export type ActiveSelectionInfo = {
  bounds: NormalizedSelectionBounds;
  documentName: string;
  maskAvailable: boolean;
  maskMessage: string;
};

export type SelectedRegionSourceImage = ExportedSourceImage & {
  selection: ActiveSelectionInfo;
  mask?: SelectionMaskExport;
  maskAvailable: boolean;
  maskMessage: string;
};

export type AlignedRegionalImportOptions = {
  blob: Blob;
  bounds: SelectionBounds;
  layerName?: string;
};

export type PreserveSelectionOperation<T> = () => Promise<T>;

export type AlignedInpaintResultImport = AlignedRegionalImportOptions & {
  selection: ActiveSelectionInfo;
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
            applyAlpha: false
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
            applyAlpha: false
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

export async function getActiveSelectionInfo(): Promise<ActiveSelectionInfo> {
  const photoshop = getPhotoshop();

  try {
    return await photoshop.core.executeAsModal(
      async () => readActiveSelectionInfo(photoshop, getActiveDocument()),
      { commandName: "Inspect OpenLayer Selection" }
    );
  } catch (caughtError) {
    if (isOpenLayerNoSelectionError(caughtError)) {
      throw caughtError;
    }

    throw createOpenLayerError(
      "PHOTOSHOP_NO_SELECTION",
      "No active Photoshop selection was found. Make a selection before using Inpaint.",
      getErrorMessage(caughtError)
    );
  }
}

export async function captureSelectionForInpainting(): Promise<SelectedRegionSourceImage> {
  const photoshop = getPhotoshop();
  const imaging = getImagingApi(photoshop);

  try {
    const capturedSource = await photoshop.core.executeAsModal(
      async () => {
        const document = getActiveDocument();
        const selection = await readActiveSelectionInfo(photoshop, document);

        if (typeof document.id !== "number") {
          throw createOpenLayerError(
            "PHOTOSHOP_EXPORT_FAILED",
            "Photoshop did not expose a stable document ID for the active document.",
            "Selection source capture needs document.id."
          );
        }

        const captured = await captureSourceImage(imaging, {
          pixelOptions: {
            documentID: document.id,
            sourceBounds: {
              left: selection.bounds.left,
              top: selection.bounds.top,
              right: selection.bounds.right,
              bottom: selection.bounds.bottom
            },
            componentSize: 8,
            colorSpace: "RGB",
            applyAlpha: false
          },
          filenamePrefix: "OpenLayer_Inpaint_Source",
          sourceName: `Selection from ${selection.documentName}`
        });

        return {
          captured,
          selection
        };
      },
      { commandName: "Capture OpenLayer Selection" }
    );

    return {
      ...createExportedSourceImage(capturedSource.captured),
      selection: capturedSource.selection,
      maskAvailable: false,
      maskMessage: capturedSource.selection.maskMessage
    };
  } catch (caughtError) {
    if (isOpenLayerNoSelectionError(caughtError)) {
      throw caughtError;
    }

    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      `Could not capture the active Photoshop selection for inpainting. ${getErrorMessage(caughtError)}`
    );
  }
}

export async function exportActiveLayerAsPNG(): Promise<Blob> {
  // TODO(v0.4): Use this for mask-aware inpainting when selected-layer PNG export is fully verified.
  throw createOpenLayerError(
    "PHOTOSHOP_EXPORT_FAILED",
    "Dedicated selected-layer PNG file export is planned for a future OpenLayer inpainting release. Current Image to Image and Sketch capture already encode source pixels as PNG through the Imaging API path."
  );
}

export async function exportSelectionAsPNG(): Promise<Blob> {
  // TODO(v0.5): Export selected pixels as a standalone PNG when this path is verified separately.
  throw createOpenLayerError(
    "PHOTOSHOP_EXPORT_FAILED",
    "Dedicated selected-pixels PNG export is planned for a future OpenLayer inpainting release. The current Inpaint foundation captures selection bounds as a PNG source image."
  );
}

export async function exportSelectionMask(): Promise<SelectionMaskExport> {
  // TODO(v0.5): Export the active selection or mask as a grayscale PNG for mask workflows.
  throw createOpenLayerError(
    "PHOTOSHOP_EXPORT_FAILED",
    "Mask export is not available yet. OpenLayer can detect selection bounds, but true grayscale mask export still needs a verified Photoshop UXP path."
  );
}

export async function importImageAlignedToSelection(_options: AlignedRegionalImportOptions): Promise<void> {
  // TODO(v0.5): Place generated content aligned to the active selection bounds.
  throw createOpenLayerError(
    "PHOTOSHOP_IMPORT_FAILED",
    "Aligned regional import is planned for the next inpainting step. Current imports still place full generated layers."
  );
}

export async function preserveSelection<T>(_operation: PreserveSelectionOperation<T>): Promise<T> {
  // TODO(v0.5): Save and restore the active Photoshop selection around generation workflows.
  throw createOpenLayerError(
    "PHOTOSHOP_EXPORT_FAILED",
    "Selection preservation is planned for the next inpainting step."
  );
}

async function readActiveSelectionInfo(
  photoshop: PhotoshopModule,
  document: PhotoshopDocument
): Promise<ActiveSelectionInfo> {
  const selectionDescriptor = await getSelectionDescriptor(photoshop);
  const bounds = readSelectionBounds(selectionDescriptor);

  if (!bounds) {
    throw createOpenLayerError(
      "PHOTOSHOP_NO_SELECTION",
      "No active Photoshop selection was found. Make a selection before using Inpaint."
    );
  }

  const normalizedBounds = normalizeSelectionBounds(bounds);

  return {
    bounds: normalizedBounds,
    documentName: document.title ?? document.name ?? "active document",
    maskAvailable: false,
    maskMessage: "Mask export not available yet. OpenLayer captured the selected rectangular bounds as a PNG source."
  };
}

async function getSelectionDescriptor(photoshop: PhotoshopModule) {
  try {
    const response = await photoshop.action.batchPlay(
      [
        {
          _obj: "get",
          _target: [
            {
              _property: "selection"
            },
            {
              _ref: "document",
              _enum: "ordinal",
              _value: "targetEnum"
            }
          ],
          _options: {
            dialogOptions: "dontDisplay"
          }
        }
      ],
      {}
    );

    return response[0] as Record<string, unknown>;
  } catch (caughtError) {
    throw createOpenLayerError(
      "PHOTOSHOP_NO_SELECTION",
      "No active Photoshop selection was found. Make a selection before using Inpaint.",
      getErrorMessage(caughtError)
    );
  }
}

function readSelectionBounds(descriptor: Record<string, unknown>): SelectionBounds | null {
  const selection = readDescriptorObject(descriptor.selection) ?? descriptor;
  const left = readUnitValue(selection.left);
  const top = readUnitValue(selection.top);
  const right = readUnitValue(selection.right);
  const bottom = readUnitValue(selection.bottom);

  if (left === null || top === null || right === null || bottom === null) {
    return null;
  }

  try {
    return normalizeSelectionBounds({
      left,
      top,
      right,
      bottom
    });
  } catch {
    return null;
  }
}

function readDescriptorObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readUnitValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const objectValue = readDescriptorObject(value);

  if (!objectValue) {
    return null;
  }

  const numericValue = objectValue._value;

  return typeof numericValue === "number" && Number.isFinite(numericValue) ? numericValue : null;
}

function isOpenLayerNoSelectionError(error: unknown) {
  return (error as { code?: string } | null)?.code === "PHOTOSHOP_NO_SELECTION";
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

  if (!imaging?.getPixels) {
    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      "This Photoshop UXP environment does not expose the Imaging API needed to capture a source image.",
      "OpenLayer uses photoshop.imaging.getPixels() and raw imageData.getData() for PNG source capture."
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
    const pixelResult = await getPixelsWithFallbacks(imaging, options.pixelOptions);
    imageData = pixelResult.imageData;

    if (!imageData) {
      throw new Error("Photoshop returned no image data.");
    }

    const encoded = await encodeSourceImageDataAsPng(imageData);

    if (encoded.bytes.byteLength === 0) {
      throw new Error("Photoshop encoded an empty source image.");
    }

    return {
      data: toArrayBuffer(encoded.bytes),
      filename: `${createLayerName(options.filenamePrefix)}.${encoded.extension}`,
      mimeType: encoded.mimeType,
      width: Number(imageData.width ?? 0),
      height: Number(imageData.height ?? 0),
      sourceName: options.sourceName,
      captureFormat: encoded.captureFormat
    };
  } finally {
    imageData?.dispose?.();
  }
}

async function getPixelsWithFallbacks(
  imaging: NonNullable<PhotoshopModule["imaging"]>,
  pixelOptions: Record<string, unknown>
) {
  const attempts = createPixelCaptureAttempts(pixelOptions);
  const failures: string[] = [];

  for (const attempt of attempts) {
    try {
      return await imaging.getPixels(attempt);
    } catch (caughtError) {
      failures.push(getErrorMessage(caughtError));
    }
  }

  throw new Error(`Photoshop rejected the source capture options. ${failures.filter(Boolean).join(" | ")}`);
}

function createPixelCaptureAttempts(pixelOptions: Record<string, unknown>) {
  const attempts: Record<string, unknown>[] = [pixelOptions];
  const alphaAppliedAttempt = {
    ...pixelOptions,
    applyAlpha: true
  };
  const defaultAlphaAttempt = { ...pixelOptions };

  delete defaultAlphaAttempt.applyAlpha;

  if (JSON.stringify(alphaAppliedAttempt) !== JSON.stringify(pixelOptions)) {
    attempts.push(alphaAppliedAttempt);
  }

  if (JSON.stringify(defaultAlphaAttempt) !== JSON.stringify(pixelOptions)) {
    attempts.push(defaultAlphaAttempt);
  }

  return attempts;
}

function createExportedSourceImage(capturedSource: CapturedSourceImage): ExportedSourceImage {
  return {
    blob: new Blob([capturedSource.data], { type: capturedSource.mimeType }),
    filename: capturedSource.filename,
    mimeType: capturedSource.mimeType,
    width: capturedSource.width,
    height: capturedSource.height,
    sourceName: capturedSource.sourceName,
    captureFormat: capturedSource.captureFormat
  };
}

async function encodeSourceImageDataAsPng(imageData: PhotoshopImageData) {
  const width = Number(imageData.width ?? 0);
  const height = Number(imageData.height ?? 0);
  const components = Number(imageData.components ?? 4);
  const componentSize = Number(imageData.componentSize ?? 8);

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error("Photoshop returned source image data without valid dimensions.");
  }

  if (componentSize !== 8) {
    throw new Error(`OpenLayer expected 8-bit source pixels, but Photoshop returned ${componentSize}-bit data.`);
  }

  if (typeof imageData.getData !== "function") {
    throw new Error(
      "Photoshop did not expose raw source pixels for PNG capture. Update Photoshop/UXP or report this environment."
    );
  }

  const rawPixels = await readImageDataBytes(imageData);
  const rgba = convertPixelsToRgba(rawPixels, width, height, components);
  const bytes = encodeRgbaPng({ width, height, rgba });

  return {
    bytes,
    captureFormat: "png" as const,
    extension: "png",
    mimeType: "image/png"
  };
}

async function readImageDataBytes(imageData: PhotoshopImageData) {
  if (typeof imageData.getData !== "function") {
    throw new Error(
      "Photoshop did not expose raw source pixels for PNG capture. Update Photoshop/UXP or report this environment."
    );
  }

  try {
    return toUint8Array(await imageData.getData());
  } catch (caughtError) {
    try {
      return toUint8Array(await imageData.getData({ chunky: true }));
    } catch {
      throw caughtError;
    }
  }
}

function convertPixelsToRgba(rawPixels: Uint8Array, width: number, height: number, components: number) {
  const pixelCount = width * height;
  const expectedBytes = pixelCount * components;

  if (rawPixels.byteLength < expectedBytes) {
    throw new Error("Photoshop returned fewer source pixel bytes than expected.");
  }

  if (components === 4) {
    return rawPixels.slice(0, pixelCount * 4);
  }

  const rgba = new Uint8Array(pixelCount * 4);

  if (components === 3) {
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const sourceOffset = pixel * 3;
      const targetOffset = pixel * 4;
      rgba[targetOffset] = rawPixels[sourceOffset];
      rgba[targetOffset + 1] = rawPixels[sourceOffset + 1];
      rgba[targetOffset + 2] = rawPixels[sourceOffset + 2];
      rgba[targetOffset + 3] = 255;
    }

    return rgba;
  }

  if (components === 2) {
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const sourceOffset = pixel * 2;
      const targetOffset = pixel * 4;
      const value = rawPixels[sourceOffset];
      rgba[targetOffset] = value;
      rgba[targetOffset + 1] = value;
      rgba[targetOffset + 2] = value;
      rgba[targetOffset + 3] = rawPixels[sourceOffset + 1];
    }

    return rgba;
  }

  if (components === 1) {
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const targetOffset = pixel * 4;
      const value = rawPixels[pixel];
      rgba[targetOffset] = value;
      rgba[targetOffset + 1] = value;
      rgba[targetOffset + 2] = value;
      rgba[targetOffset + 3] = 255;
    }

    return rgba;
  }

  throw new Error(`OpenLayer cannot convert ${components}-component Photoshop pixels to PNG yet.`);
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
