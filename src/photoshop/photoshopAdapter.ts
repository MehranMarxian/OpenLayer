import { createLayerName, saveBlobToTemporaryFile } from "../utils/fileUtils";
import { createOpenLayerError, getErrorMessage } from "../utils/errors";
import { encodeRgbaPng } from "../utils/png";
import {
  createPaddedSelectionBounds,
  normalizeSelectionBounds,
  NormalizedSelectionBounds,
  SelectionBounds,
  snapBoundsToMultiple
} from "./selectionUtils";
import {
  createInpaintSourceModeWarning,
  InpaintSourceMode
} from "./inpaintSourceMode";

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
const MIN_INPAINT_CONTEXT_PADDING = 96;
const INPAINT_CONTEXT_PADDING_RATIO = 0.75;
// ComfyUI VAE encoding rounds image dimensions down to multiples of 8, so a
// non-multiple context comes back smaller than captured and breaks the
// translate-only aligned import.
const INPAINT_CONTEXT_MULTIPLE = 8;

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
  filename: string;
  mimeType: string;
  bounds: SelectionBounds;
  width: number;
  height: number;
  captureFormat: SourceCaptureFormat;
};

export type ActiveSelectionInfo = {
  bounds: NormalizedSelectionBounds;
  contextBounds: NormalizedSelectionBounds;
  documentName: string;
  maskAvailable: boolean;
  maskMessage: string;
};

export type SelectedRegionSourceImage = ExportedSourceImage & {
  selection: ActiveSelectionInfo;
  mask?: SelectionMaskExport;
  maskAvailable: boolean;
  maskMessage: string;
  sourceMode: InpaintSourceMode;
  sourceWarning: string;
  activeLayerName?: string;
};

export type AlignedRegionalImportOptions = {
  blob: Blob;
  bounds: SelectionBounds;
  selectionBounds?: SelectionBounds;
  layerName?: string;
  onProgress?: ImportProgress;
};

export type PreserveSelectionOperation<T> = () => Promise<T>;

export type AlignedInpaintResultImport = AlignedRegionalImportOptions & {
  selection: ActiveSelectionInfo;
};

export type InpaintLayerMaskImportResult = {
  layerName: string;
  maskApplied: boolean;
  message: string;
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

export async function captureSelectionForInpainting(
  sourceMode: InpaintSourceMode = "visible-canvas"
): Promise<SelectedRegionSourceImage> {
  const photoshop = getPhotoshop();
  const imaging = getImagingApi(photoshop);

  try {
    const capturedSource = await photoshop.core.executeAsModal(
      async () => {
        const document = getActiveDocument();
        const selection = await readActiveSelectionInfo(photoshop, document);
        const activeLayer = document.activeLayers?.[0];
        let mask: CapturedSourceImage | null = null;
        let maskError = "";

        if (typeof document.id !== "number") {
          throw createOpenLayerError(
            "PHOTOSHOP_EXPORT_FAILED",
            "Photoshop did not expose a stable document ID for the active document.",
            "Selection source capture needs document.id."
          );
        }

        if (sourceMode === "active-layer" && typeof activeLayer?.id !== "number") {
          throw createOpenLayerError(
            "PHOTOSHOP_EXPORT_FAILED",
            "No active Photoshop layer was found for Inpaint Active Layer capture.",
            "Select the layer you want OpenLayer to use as the Inpaint source."
          );
        }

        const captured = await captureSourceImage(imaging, {
          pixelOptions: {
            documentID: document.id,
            ...(sourceMode === "active-layer" ? { layerID: activeLayer?.id } : {}),
            sourceBounds: {
              left: selection.contextBounds.left,
              top: selection.contextBounds.top,
              right: selection.contextBounds.right,
              bottom: selection.contextBounds.bottom
            },
            componentSize: 8,
            colorSpace: "RGB",
            applyAlpha: false
          },
          filenamePrefix: "OpenLayer_Inpaint_Source",
          sourceName: sourceMode === "active-layer"
            ? `Active layer: ${activeLayer?.name || "Layer"}`
            : `Visible canvas from ${selection.documentName}`
        });

        try {
          mask = await captureSelectionMaskSourceImage(photoshop, imaging, document, selection);
        } catch (caughtError) {
          maskError = getErrorMessage(caughtError);
        }

        return {
          captured,
          selection,
          mask,
          maskError,
          activeLayerName: activeLayer?.name
        };
      },
      { commandName: "Capture OpenLayer Selection" }
    );
    const mask = capturedSource.mask ? createSelectionMaskExport(capturedSource.mask, capturedSource.selection.contextBounds) : undefined;
    const maskMessage = mask
      ? "Selection mask captured as PNG/lossless source."
      : `Mask export unavailable. ${capturedSource.maskError || "OpenLayer captured the selected rectangular source only."}`;

    return {
      ...createExportedSourceImage(capturedSource.captured),
      selection: {
        ...capturedSource.selection,
        maskAvailable: Boolean(mask),
        maskMessage
      },
      mask,
      maskAvailable: Boolean(mask),
      maskMessage,
      sourceMode,
      sourceWarning: createInpaintSourceModeWarning(sourceMode, capturedSource.activeLayerName),
      activeLayerName: capturedSource.activeLayerName
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

export async function importImageAlignedToSelectionWithLayerMask(
  options: AlignedRegionalImportOptions
): Promise<InpaintLayerMaskImportResult> {
  const photoshop = getPhotoshop();
  getActiveDocument();

  try {
    if (!options.blob || options.blob.size === 0) {
      throw new Error("The generated inpaint image blob is empty.");
    }

    const bounds = normalizeSelectionBounds(options.bounds);
    const layerName = options.layerName ?? createLayerName("OpenLayer_Inpaint");

    options.onProgress?.("Saving inpaint result to a temporary PNG...");
    const file = await saveBlobToTemporaryFile(options.blob, `${layerName}.png`);
    const uxp = getUxp();
    options.onProgress?.("Creating Photoshop file token...");
    const token = await uxp.storage.localFileSystem.createSessionToken(file);
    let maskApplied = false;
    let maskMessage = "Layer mask was not applied. Aligned context fallback used.";

    options.onProgress?.("Placing inpaint patch into the active document...");
    await photoshop.core.executeAsModal(
      async () => {
        await placeFileAsLayer(photoshop, token);
        await renameActiveLayer(photoshop, layerName);
        options.onProgress?.("Aligning inpaint patch to the captured selection context...");
        await alignActiveLayerToBounds(photoshop, bounds);

        try {
          options.onProgress?.("Applying Photoshop selection as a layer mask...");
          const maskSelectionAvailable = await ensureSelectionForLayerMask(photoshop, options.selectionBounds);

          if (maskSelectionAvailable) {
            await createLayerMaskFromActiveSelection(photoshop);
            maskApplied = true;
            maskMessage = "Imported with a Photoshop layer mask from the active selection.";
          } else {
            maskMessage =
              "Layer mask skipped because Photoshop no longer had an active selection after placing the result. Aligned context import used.";
          }
        } catch (caughtError) {
          maskMessage = `Layer mask import fallback used. ${getErrorMessage(caughtError)}`;
        }
      },
      { commandName: "Import OpenLayer Inpaint Result With Mask" }
    );

    options.onProgress?.(`Imported ${layerName}. ${maskMessage}`);
    return {
      layerName,
      maskApplied,
      message: maskMessage
    };
  } catch (caughtError) {
    throw createOpenLayerError(
      "PHOTOSHOP_IMPORT_FAILED",
      `Could not import the generated inpaint result aligned to the selection. ${getErrorMessage(caughtError)}`
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
  const photoshop = getPhotoshop();
  const imaging = getImagingApi(photoshop);

  try {
    const capturedMask = await photoshop.core.executeAsModal(
      async () => {
        const document = getActiveDocument();
        const selection = await readActiveSelectionInfo(photoshop, document);

        return {
          selection,
          mask: await captureSelectionMaskSourceImage(photoshop, imaging, document, selection)
        };
      },
      { commandName: "Export OpenLayer Selection Mask" }
    );

    return createSelectionMaskExport(capturedMask.mask, capturedMask.selection.contextBounds);
  } catch (caughtError) {
    if (isOpenLayerNoSelectionError(caughtError)) {
      throw caughtError;
    }

    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      `Could not export the active Photoshop selection mask. ${getErrorMessage(caughtError)}`
    );
  }
}

export async function importImageAlignedToSelection(options: AlignedRegionalImportOptions): Promise<string> {
  const photoshop = getPhotoshop();
  getActiveDocument();

  try {
    if (!options.blob || options.blob.size === 0) {
      throw new Error("The generated inpaint image blob is empty.");
    }

    const bounds = normalizeSelectionBounds(options.bounds);
    const layerName = options.layerName ?? createLayerName("OpenLayer_Inpaint");

    options.onProgress?.("Saving inpaint result to a temporary PNG...");
    const file = await saveBlobToTemporaryFile(options.blob, `${layerName}.png`);
    const uxp = getUxp();
    options.onProgress?.("Creating Photoshop file token...");
    const token = await uxp.storage.localFileSystem.createSessionToken(file);

    options.onProgress?.("Placing inpaint patch into the active document...");
    await photoshop.core.executeAsModal(
      async () => {
        await placeFileAsLayer(photoshop, token);
        await renameActiveLayer(photoshop, layerName);
        options.onProgress?.("Aligning inpaint patch to the captured selection context...");
        await alignActiveLayerToBounds(photoshop, bounds);
      },
      { commandName: "Import OpenLayer Inpaint Result" }
    );

    options.onProgress?.(`Imported ${layerName}.`);
    return layerName;
  } catch (caughtError) {
    throw createOpenLayerError(
      "PHOTOSHOP_IMPORT_FAILED",
      `Could not import the generated inpaint result aligned to the selection. ${getErrorMessage(caughtError)}`
    );
  }
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
  const contextBounds = createInpaintContextBounds(normalizedBounds, document);

  return {
    bounds: normalizedBounds,
    contextBounds,
    documentName: document.title ?? document.name ?? "active document",
    maskAvailable: false,
    maskMessage: "Capture Selection will try to export a PNG/lossless mask from the active Photoshop selection."
  };
}

function createInpaintContextBounds(
  selectionBounds: NormalizedSelectionBounds,
  document: PhotoshopDocument
) {
  const documentWidth = Number(document.width ?? 0);
  const documentHeight = Number(document.height ?? 0);
  const adaptivePadding = Math.max(
    MIN_INPAINT_CONTEXT_PADDING,
    Math.round(Math.max(selectionBounds.width, selectionBounds.height) * INPAINT_CONTEXT_PADDING_RATIO)
  );
  const paddedBounds = createPaddedSelectionBounds(selectionBounds, {
    width: documentWidth,
    height: documentHeight
  }, adaptivePadding);

  return snapBoundsToMultiple(paddedBounds, {
    width: documentWidth,
    height: documentHeight
  }, INPAINT_CONTEXT_MULTIPLE);
}

async function captureSelectionMaskSourceImage(
  photoshop: PhotoshopModule,
  imaging: NonNullable<PhotoshopModule["imaging"]>,
  document: PhotoshopDocument,
  selection: ActiveSelectionInfo
): Promise<CapturedSourceImage> {
  if (typeof document.id !== "number") {
    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      "Photoshop did not expose a stable document ID for the active document.",
      "Selection mask capture needs document.id."
    );
  }

  const previousLayer = document.activeLayers?.[0];
  let temporaryLayerId: number | undefined;
  let selectionNeedsRestore = false;

  try {
    temporaryLayerId = await createTemporaryMaskLayer(photoshop);
    await fillActiveSelection(photoshop, "white");
    await invertActiveSelection(photoshop);
    selectionNeedsRestore = true;
    await fillActiveSelection(photoshop, "black");
    await invertActiveSelection(photoshop);
    selectionNeedsRestore = false;

    return captureMaskImage(imaging, {
      pixelOptions: {
        documentID: document.id,
        layerID: temporaryLayerId,
        sourceBounds: {
          left: selection.contextBounds.left,
          top: selection.contextBounds.top,
          right: selection.contextBounds.right,
          bottom: selection.contextBounds.bottom
        },
        componentSize: 8,
        colorSpace: "RGB",
        applyAlpha: false
      },
      filenamePrefix: "OpenLayer_Inpaint_Mask",
      sourceName: `Mask from ${selection.documentName}`
    });
  } finally {
    if (selectionNeedsRestore) {
      await invertActiveSelection(photoshop);
    }

    if (typeof temporaryLayerId === "number") {
      await deleteLayerById(photoshop, temporaryLayerId);
    }

    if (typeof previousLayer?.id === "number") {
      await selectLayerById(photoshop, previousLayer.id);
    }
  }
}

async function createTemporaryMaskLayer(photoshop: PhotoshopModule) {
  const layerName = `OpenLayer_Temporary_Mask_${Date.now()}`;

  await photoshop.action.batchPlay(
    [
      {
        _obj: "make",
        _target: [
          {
            _ref: "layer"
          }
        ],
        using: {
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

  const temporaryLayer = photoshop.app.activeDocument?.activeLayers?.[0];

  if (typeof temporaryLayer?.id !== "number") {
    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      "Photoshop created a temporary mask layer but did not expose its layer ID."
    );
  }

  return temporaryLayer.id;
}

async function fillActiveSelection(photoshop: PhotoshopModule, color: "black" | "white") {
  await photoshop.action.batchPlay(
    [
      {
        _obj: "fill",
        using: {
          _enum: "fillContents",
          _value: color
        },
        opacity: {
          _unit: "percentUnit",
          _value: 100
        },
        mode: {
          _enum: "blendMode",
          _value: "normal"
        },
        _options: {
          dialogOptions: "dontDisplay"
        }
      }
    ],
    {}
  );
}

async function invertActiveSelection(photoshop: PhotoshopModule) {
  await photoshop.action.batchPlay(
    [
      {
        _obj: "inverse",
        _target: [
          {
            _ref: "channel",
            _property: "selection"
          }
        ],
        _options: {
          dialogOptions: "dontDisplay"
        }
      }
    ],
    {}
  );
}

async function deleteLayerById(photoshop: PhotoshopModule, layerId: number) {
  try {
    await photoshop.action.batchPlay(
      [
        {
          _obj: "delete",
          _target: [
            {
              _ref: "layer",
              _id: layerId
            }
          ],
          _options: {
            dialogOptions: "dontDisplay"
          }
        }
      ],
      {}
    );
  } catch {
    // Best-effort cleanup. The caller will still restore the previous layer when possible.
  }
}

async function selectLayerById(photoshop: PhotoshopModule, layerId: number) {
  try {
    await photoshop.action.batchPlay(
      [
        {
          _obj: "select",
          _target: [
            {
              _ref: "layer",
              _id: layerId
            }
          ],
          makeVisible: false,
          _options: {
            dialogOptions: "dontDisplay"
          }
        }
      ],
      {}
    );
  } catch {
    // Restoring active layer is helpful but should not fail a successful mask capture.
  }
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

async function ensureSelectionForLayerMask(
  photoshop: PhotoshopModule,
  fallbackBounds?: SelectionBounds
) {
  // Photoshop's place command clears the active selection, so the original
  // Inpaint selection is usually gone by the time the layer mask is created.
  if (await hasActiveSelectionBounds(photoshop)) {
    return true;
  }

  if (!fallbackBounds) {
    return false;
  }

  await setRectangularSelection(photoshop, normalizeSelectionBounds(fallbackBounds));
  return hasActiveSelectionBounds(photoshop);
}

async function hasActiveSelectionBounds(photoshop: PhotoshopModule) {
  try {
    return Boolean(readSelectionBounds(await getSelectionDescriptor(photoshop)));
  } catch {
    return false;
  }
}

async function setRectangularSelection(
  photoshop: PhotoshopModule,
  bounds: NormalizedSelectionBounds
) {
  await photoshop.action.batchPlay(
    [
      {
        _obj: "set",
        _target: [
          {
            _ref: "channel",
            _property: "selection"
          }
        ],
        to: {
          _obj: "rectangle",
          top: {
            _unit: "pixelsUnit",
            _value: bounds.top
          },
          left: {
            _unit: "pixelsUnit",
            _value: bounds.left
          },
          bottom: {
            _unit: "pixelsUnit",
            _value: bounds.bottom
          },
          right: {
            _unit: "pixelsUnit",
            _value: bounds.right
          }
        },
        _options: {
          dialogOptions: "dontDisplay"
        }
      }
    ],
    {}
  );
}

async function createLayerMaskFromActiveSelection(photoshop: PhotoshopModule) {
  await photoshop.action.batchPlay(
    [
      {
        _obj: "make",
        new: {
          _class: "channel"
        },
        at: {
          _ref: "channel",
          _enum: "channel",
          _value: "mask"
        },
        using: {
          _enum: "userMaskEnabled",
          _value: "revealSelection"
        },
        _options: {
          dialogOptions: "dontDisplay"
        }
      }
    ],
    {}
  );
}

async function alignActiveLayerToBounds(
  photoshop: PhotoshopModule,
  targetBounds: NormalizedSelectionBounds
) {
  const layerBounds = await readActiveLayerBounds(photoshop);
  const deltaX = Math.round(targetBounds.left - layerBounds.left);
  const deltaY = Math.round(targetBounds.top - layerBounds.top);

  if (deltaX === 0 && deltaY === 0) {
    return;
  }

  await moveActiveLayerBy(photoshop, deltaX, deltaY);
}

async function readActiveLayerBounds(photoshop: PhotoshopModule): Promise<NormalizedSelectionBounds> {
  const response = await photoshop.action.batchPlay(
    [
      {
        _obj: "get",
        _target: [
          {
            _property: "bounds"
          },
          {
            _ref: "layer",
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
  const descriptor = response[0] as Record<string, unknown>;
  const boundsObject = readDescriptorObject(descriptor.bounds) ?? descriptor;
  const left = readUnitValue(boundsObject.left);
  const top = readUnitValue(boundsObject.top);
  const right = readUnitValue(boundsObject.right);
  const bottom = readUnitValue(boundsObject.bottom);

  if (left === null || top === null || right === null || bottom === null) {
    throw new Error("Photoshop did not expose bounds for the imported inpaint layer.");
  }

  return normalizeSelectionBounds({
    left,
    top,
    right,
    bottom
  });
}

async function moveActiveLayerBy(photoshop: PhotoshopModule, deltaX: number, deltaY: number) {
  await photoshop.action.batchPlay(
    [
      {
        _obj: "move",
        _target: [
          {
            _ref: "layer",
            _enum: "ordinal",
            _value: "targetEnum"
          }
        ],
        to: {
          _obj: "offset",
          horizontal: {
            _unit: "pixelsUnit",
            _value: deltaX
          },
          vertical: {
            _unit: "pixelsUnit",
            _value: deltaY
          }
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

function createSelectionMaskExport(
  capturedMask: CapturedSourceImage,
  bounds: SelectionBounds
): SelectionMaskExport {
  return {
    blob: new Blob([capturedMask.data], { type: capturedMask.mimeType }),
    filename: capturedMask.filename,
    mimeType: capturedMask.mimeType,
    bounds,
    width: capturedMask.width,
    height: capturedMask.height,
    captureFormat: capturedMask.captureFormat
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

async function captureMaskImage(
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
      throw new Error("Photoshop returned no mask image data.");
    }

    const encoded = await encodeSelectionMaskImageDataAsPng(imageData);

    if (encoded.bytes.byteLength === 0) {
      throw new Error("Photoshop encoded an empty selection mask.");
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

async function encodeSelectionMaskImageDataAsPng(imageData: PhotoshopImageData) {
  const width = Number(imageData.width ?? 0);
  const height = Number(imageData.height ?? 0);
  const components = Number(imageData.components ?? 4);
  const componentSize = Number(imageData.componentSize ?? 8);

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error("Photoshop returned selection mask data without valid dimensions.");
  }

  if (componentSize !== 8) {
    throw new Error(`OpenLayer expected 8-bit mask pixels, but Photoshop returned ${componentSize}-bit data.`);
  }

  const rawPixels = await readImageDataBytes(imageData);
  const rgba = convertMaskPixelsToRgba(rawPixels, width, height, components);
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

function convertMaskPixelsToRgba(rawPixels: Uint8Array, width: number, height: number, components: number) {
  const pixelCount = width * height;
  const expectedBytes = pixelCount * components;

  if (rawPixels.byteLength < expectedBytes) {
    throw new Error("Photoshop returned fewer selection mask pixel bytes than expected.");
  }

  if (components < 1 || components > 4) {
    throw new Error(`OpenLayer cannot convert ${components}-component Photoshop mask pixels to PNG yet.`);
  }

  const rgba = new Uint8Array(pixelCount * 4);

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const sourceOffset = pixel * components;
    const targetOffset = pixel * 4;
    const red = rawPixels[sourceOffset] ?? 0;
    const green = components === 2 ? red : components >= 3 ? rawPixels[sourceOffset + 1] ?? red : red;
    const blue = components === 2 ? red : components >= 3 ? rawPixels[sourceOffset + 2] ?? red : red;
    const alpha = components === 2
      ? rawPixels[sourceOffset + 1] ?? 255
      : components >= 4
        ? rawPixels[sourceOffset + 3] ?? 255
        : 255;
    const luminance = Math.round((red + green + blue) / 3);
    const maskValue = alpha > 8 ? luminance : 0;

    rgba[targetOffset] = maskValue;
    rgba[targetOffset + 1] = maskValue;
    rgba[targetOffset + 2] = maskValue;
    rgba[targetOffset + 3] = 255;
  }

  return rgba;
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
