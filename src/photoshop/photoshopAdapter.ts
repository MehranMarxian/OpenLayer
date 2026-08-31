import { createLayerName, deleteTemporaryFileBestEffort, saveBlobToTemporaryFile } from "../utils/fileUtils";
import { createOpenLayerError, getErrorMessage } from "../utils/errors";
import { encodeRgbaPng } from "../utils/png";
import { calculatePlacementOffset, createOpaqueGrayscaleMaskPng, PixelDimensions } from "./exactInpaintMask";
import { OutpaintExpansionPlan } from "./outpaintExpansion";
import { UpscaleResizePlan } from "./upscaleResize";
import {
  classifyPlateSample,
  planLayerScale,
  planUnflattenLayerStack,
  stackLayerNames,
  LayerScalePlan
} from "./unflattenLayerStack";
import {
  calculateCenteredOrigin,
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
import {
  createPhotoshopDocumentIdentity,
  PhotoshopDocumentIdentity,
  validateDocumentImportContext
} from "./documentContext";
import {
  CleanupTask,
  formatCleanupFailures,
  ImportFinalizationAction,
  ImportRecoveryAction,
  isMaskSandwichTopmost,
  planImportFinalization,
  planImportRecovery,
  runCleanupTasks
} from "./photoshopTransaction";

type PhotoshopModule = {
  app: {
    activeDocument?: PhotoshopDocument;
    documents?: PhotoshopDocument[];
  };
  action: {
    batchPlay: (commands: unknown[], options: Record<string, unknown>) => Promise<unknown[]>;
  };
  core: {
    executeAsModal: <T>(
      command: (executionContext: PhotoshopExecutionContext) => Promise<T>,
      options: { commandName: string }
    ) => Promise<T>;
  };
  imaging?: {
    getPixels: (options: Record<string, unknown>) => Promise<PhotoshopPixelResult>;
  };
};

// Passed by executeAsModal to its callback. suspendHistory groups every edit in
// the block into one undoable history state; resumeHistory(id, false) reverts
// the document to the pre-suspension state, which is the only rollback that
// cannot clip artist pixels the way a programmatic canvas re-crop would.
type PhotoshopExecutionContext = {
  hostControl?: {
    suspendHistory?: (options: { documentID: number; name: string }) => Promise<number>;
    resumeHistory?: (suspensionID: number, commit: boolean) => Promise<void>;
  };
};

type PhotoshopDocument = {
  id?: number;
  title?: string;
  name?: string;
  width?: number;
  height?: number;
  // Top-level layers, topmost first. Used to build the mask sandwich above the
  // whole stack so the composite selection cannot read the artist's artwork.
  layers?: PhotoshopLayer[];
  activeLayers?: PhotoshopLayer[];
  activeChannels?: PhotoshopChannel[];
  channels?: { getByName: (name: string) => PhotoshopChannel };
  selection?: {
    save: (name?: string) => Promise<void>;
    load: (channel: PhotoshopChannel) => Promise<void>;
  };
};

type PhotoshopChannel = {
  id?: number;
  name?: string;
  visible?: boolean;
  remove?: () => Promise<void> | void;
};

type SelectionSnapshot = Readonly<{
  hadSelection: boolean;
  channel: PhotoshopChannel | null;
  channelName: string | null;
  activeChannels: readonly PhotoshopChannel[];
}>;

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
  originatingDocument: PhotoshopDocumentIdentity;
};

type ImportProgress = (message: string) => void;

type BatchPlayCommand = Record<string, unknown>;
const MIN_INPAINT_CONTEXT_PADDING = 96;
const INPAINT_CONTEXT_PADDING_RATIO = 0.75;
// ComfyUI VAE encoding rounds image dimensions down to multiples of 8, so a
// non-multiple context comes back smaller than captured and breaks the
// translate-only aligned import.
const INPAINT_CONTEXT_MULTIPLE = 8;
// Uncompressed PNG capture costs about 4 bytes per pixel, so very large
// captures can exhaust UXP panel memory before the upload even starts.
export const MAX_CAPTURE_PIXELS = 4096 * 4096;

// Big enough that a small subject survives the downsample -- a person occupying
// 5% of the frame still covers dozens of these pixels -- and small enough that
// the read costs nothing next to the placement it guards.
const PLATE_SAMPLE_SIZE = 128;
// Below this a pixel is not contributing anything anyone can see, so its RGB
// is noise rather than picture and must not count toward the flatness measure.
const PLATE_VISIBLE_ALPHA_FLOOR = 24;

// Inpaint was the only caller that could hit this, so its phrasing is the
// default and must stay byte-identical -- a test pins the exact sentence.
export const DEFAULT_SELECTION_REQUESTER = "using Inpaint";

export function createNoSelectionMessage(requestedBy: string = DEFAULT_SELECTION_REQUESTER) {
  return `No active Photoshop selection was found. Make a selection before ${requestedBy}.`;
}

export function assertCaptureSizeWithinLimit(width: number, height: number) {
  if (width * height > MAX_CAPTURE_PIXELS) {
    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      `This capture is ${Math.round(width)} x ${Math.round(height)}, which is larger than OpenLayer's current 16-megapixel capture limit. Crop the document, use a smaller layer, or make a smaller selection, then capture again.`,
      "Uncompressed PNG capture above 4096 x 4096 risks UXP memory failures. A downscale option is planned."
    );
  }
}

export type ActiveDocumentInfo = PhotoshopDocumentIdentity & {
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
  originatingDocument: PhotoshopDocumentIdentity;
  /**
   * Where in the document this capture came from, so a result made from it can
   * be put back in the same place. Absent only when Photoshop would not report
   * bounds, in which case the import falls back to centring on the canvas.
   */
  captureBounds?: NormalizedSelectionBounds;
};

export type SelectionMaskExport = {
  blob: Blob;
  filename: string;
  mimeType: string;
  bounds: SelectionBounds;
  width: number;
  height: number;
  captureFormat: SourceCaptureFormat;
  originatingDocument: PhotoshopDocumentIdentity;
};

export type ActiveSelectionInfo = {
  bounds: NormalizedSelectionBounds;
  contextBounds: NormalizedSelectionBounds;
  documentName: string;
  originatingDocument: PhotoshopDocumentIdentity;
  maskAvailable: boolean;
  maskMessage: string;
};

export type GeneratedImageImportOptions = {
  blob: Blob;
  originatingDocument: PhotoshopDocumentIdentity | null;
  layerName?: string;
  onProgress?: ImportProgress;
  /**
   * Where the result belongs, normally the bounds of the layer it was generated
   * from. Without it the layer lands wherever `placeEvent` decides, which is
   * the centre of the active *selection* when one exists and the centre of the
   * canvas otherwise -- neither of which is the captured layer's position.
   */
  targetBounds?: SelectionBounds;
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
  originatingDocument: PhotoshopDocumentIdentity | null;
  bounds: SelectionBounds;
  selectionBounds?: SelectionBounds;
  layerName?: string;
  onProgress?: ImportProgress;
};

export type ExactInpaintImportOptions = Omit<AlignedRegionalImportOptions, "selectionBounds"> & {
  mask: { blob: Blob; width: number; height: number };
  sourceDimensions: PixelDimensions;
  resultDimensions: PixelDimensions;
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
  const identity = readDocumentIdentity(document);

  return {
    ...identity,
    width: Number(document.width ?? 0),
    height: Number(document.height ?? 0)
  };
}

export function getActiveDocumentIdentity(): PhotoshopDocumentIdentity | null {
  const document = getPhotoshop().app.activeDocument;
  return document ? readDocumentIdentity(document) : null;
}

export async function importGeneratedImageAsLayer(
  options: GeneratedImageImportOptions
) {
  const photoshop = getPhotoshop();
  const layerName = options.layerName ?? createLayerName("OpenLayer_Generated");
  let file: UxpFile | undefined;

  try {
    assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);

    if (!options.blob || options.blob.size === 0) {
      throw new Error("The generated image blob is empty.");
    }

    options.onProgress?.("Saving generated image to a temporary PNG...");
    file = await saveBlobToTemporaryFile(options.blob, `${layerName}.png`);
    const uxp = getUxp();
    options.onProgress?.("Creating Photoshop file token...");
    const token = await uxp.storage.localFileSystem.createSessionToken(file);

    options.onProgress?.("Placing image into the originating document...");
    await photoshop.core.executeAsModal(
      async () => {
        assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
        await placeFileAsLayer(photoshop, token);
        options.onProgress?.("Renaming imported layer...");
        await renameActiveLayer(photoshop, layerName);
        // Always position explicitly. placeEvent's own centring is not a
        // reliable placement: with a selection active it centres on the
        // selection, so a leftover Inpaint selection silently drops an Image to
        // Image result somewhere the artist then has to drag back by hand.
        options.onProgress?.("Positioning imported layer...");

        if (options.targetBounds) {
          await alignActiveLayerToBounds(photoshop, normalizeSelectionBounds(options.targetBounds));
        } else {
          await centerActiveLayerOnCanvas(photoshop);
        }
      },
      { commandName: "Import OpenLayer Result" }
    );

    options.onProgress?.(`Imported ${layerName}.`);
    return layerName;
  } catch (caughtError) {
    throw createOpenLayerError(
      "PHOTOSHOP_IMPORT_FAILED",
      `Could not import the generated image as a Photoshop layer. ${getErrorMessage(caughtError)}`
    );
  } finally {
    // placeEvent has already read the file by the time executeAsModal returns
    // or throws, so nothing further needs it whichever way the import went.
    await deleteTemporaryFileBestEffort(file);
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

        // Read where the layer sits before capturing it. getPixels with a
        // layerID and no sourceBounds returns the layer's own bounding box, so
        // the result is only in the right place if it goes back to these
        // coordinates rather than to the middle of the canvas.
        const captureBounds = await readActiveLayerBoundsBestEffort(photoshop);
        const captured = await captureSourceImage(imaging, {
          pixelOptions: {
            documentID: document.id,
            layerID: activeLayer.id,
            componentSize: 8,
            colorSpace: "RGB",
            applyAlpha: false
          },
          filenamePrefix: "OpenLayer_Source",
          sourceName: activeLayer.name || "Active layer",
          originatingDocument: readDocumentIdentity(document)
        });

        return { captured, captureBounds };
      },
      { commandName: "Capture OpenLayer Source" }
    );

    return {
      ...createExportedSourceImage(capturedSource.captured),
      captureBounds: capturedSource.captureBounds ?? undefined
    };
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

        const captured = await captureSourceImage(imaging, {
          pixelOptions: {
            documentID: document.id,
            ...createDocumentSourceBounds(document),
            componentSize: 8,
            colorSpace: "RGB",
            applyAlpha: false
          },
          filenamePrefix: "OpenLayer_Canvas",
          sourceName: document.title ?? document.name ?? "Canvas composite",
          originatingDocument: readDocumentIdentity(document)
        });

        // A canvas capture covers the whole document, so a result made from it
        // belongs at the document origin.
        return {
          captured,
          captureBounds: normalizeSelectionBounds({
            left: 0,
            top: 0,
            right: Number(document.width ?? 0),
            bottom: Number(document.height ?? 0)
          })
        };
      },
      { commandName: "Capture OpenLayer Canvas" }
    );

    return {
      ...createExportedSourceImage(capturedSource.captured),
      captureBounds: capturedSource.captureBounds
    };
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
            : `Visible canvas from ${selection.documentName}`,
          originatingDocument: selection.originatingDocument
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
  options: ExactInpaintImportOptions
): Promise<InpaintLayerMaskImportResult> {
  const photoshop = getPhotoshop();
  let file: UxpFile | undefined;
  let maskFile: UxpFile | undefined;

  try {
    assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);

    if (!options.blob || options.blob.size === 0) {
      throw new Error("The generated inpaint image blob is empty.");
    }

    const bounds = normalizeSelectionBounds(options.bounds);
    const layerName = options.layerName ?? createLayerName("OpenLayer_Inpaint");
    const opaqueMaskBlob = await createOpaqueGrayscaleMaskPng({
      blob: options.mask.blob,
      dimensions: { width: options.mask.width, height: options.mask.height },
      sourceDimensions: options.sourceDimensions,
      resultDimensions: options.resultDimensions
    });

    options.onProgress?.("Saving inpaint result to a temporary PNG...");
    file = await saveBlobToTemporaryFile(options.blob, `${layerName}.png`);
    const maskLayerName = `__OpenLayer_InpaintMask_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    maskFile = await saveBlobToTemporaryFile(opaqueMaskBlob, `${maskLayerName}.png`);
    const uxp = getUxp();
    options.onProgress?.("Creating Photoshop file token...");
    const token = await uxp.storage.localFileSystem.createSessionToken(file);
    const maskToken = await uxp.storage.localFileSystem.createSessionToken(maskFile);
    let maskApplied = false;
    const maskMessage = "Imported with the exact saved Photoshop selection as a layer mask.";

    options.onProgress?.("Placing inpaint patch into the active document...");
    await photoshop.core.executeAsModal(
      async () => {
        assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
        const transactionDocument = getActiveDocument();
        const previousLayerId = transactionDocument.activeLayers?.[0]?.id;
        const selectionSnapshot = await saveSelectionSnapshot(photoshop, transactionDocument, "Import");
        let resultLayerId: number | undefined;
        let temporaryMaskLayerId: number | undefined;
        let temporaryBlackLayerId: number | undefined;
        let operationError: unknown;
        let selectionRestored = false;
        let selectionSnapshotRemoved = false;

        try {
          await placeFileAsLayer(photoshop, token);
          resultLayerId = getActiveDocument().activeLayers?.[0]?.id;
          if (resultLayerId === undefined) throw new Error("Photoshop did not expose the imported result layer ID.");
          await renameActiveLayer(photoshop, layerName);
          options.onProgress?.("Aligning inpaint patch to the captured selection context...");
          await alignActiveLayerToBounds(photoshop, bounds);

          options.onProgress?.("Applying the exact saved selection mask...");
          // The mask sandwich must sit above every other layer. The selection below
          // is read from the RGB composite, so any visible layer left above the
          // sandwich would contaminate it: confirmed in Photoshop on 2026-07-16,
          // where a visible layer above a non-topmost active layer replaced the
          // saved mask with that layer's luminance. Building the sandwich on top of
          // the stack makes the composite depend only on OpenLayer's own layers.
          await selectTopmostLayer(photoshop);
          temporaryBlackLayerId = await createTemporaryMaskLayer(photoshop);
          await selectEntireCanvas(photoshop);
          await fillActiveSelection(photoshop, "black");
          await deselectActiveSelection(photoshop);
          await placeFileAsLayer(photoshop, maskToken);
          temporaryMaskLayerId = getActiveDocument().activeLayers?.[0]?.id;
          if (temporaryMaskLayerId === undefined) throw new Error("Photoshop did not expose the temporary mask layer ID.");
          await renameActiveLayer(photoshop, maskLayerName);
          // This PNG is fully opaque, so Photoshop reports its complete captured
          // context bounds rather than trimming to the white mask pixels.
          await alignActiveLayerToBounds(photoshop, bounds);
          await assertMaskSandwichIsTopmost(temporaryMaskLayerId, temporaryBlackLayerId);
          // The opaque grayscale mask sits above a temporary full-canvas black layer
          // at the top of the stack, making the document composite an exact selection
          // source with black outside the saved mask.
          await loadSelectionFromCompositeChannel(photoshop);
          await selectLayerById(photoshop, resultLayerId, false);
          await createLayerMaskFromActiveSelection(photoshop);
        } catch (caughtError) {
          operationError = caughtError;
        }

        if (!operationError) {
          try {
            assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
          } catch (caughtError) {
            operationError = caughtError;
          }
        }

        // planImportFinalization owns which steps run and in what order; the
        // handlers below own how each one talks to Photoshop. Keeping the order
        // in one pure, tested place is what stops a future edit here from
        // silently changing the transaction's guarantees.
        const finalizationHandlers: Record<ImportFinalizationAction, CleanupTask> = {
          "delete-temporary-mask-layer": {
            label: "remove temporary mask layer",
            run: async () => {
              await deleteLayerById(photoshop, temporaryMaskLayerId!, false);
              temporaryMaskLayerId = undefined;
            }
          },
          "delete-temporary-black-layer": {
            label: "remove temporary black backing layer",
            run: async () => {
              await deleteLayerById(photoshop, temporaryBlackLayerId!, false);
              temporaryBlackLayerId = undefined;
            }
          },
          "delete-result-layer": {
            label: "remove partially imported result layer",
            run: async () => {
              await deleteLayerById(photoshop, resultLayerId!, false);
              resultLayerId = undefined;
            }
          },
          "restore-selection": {
            label: "restore the artist's selection",
            run: async () => {
              await restoreSelectionSnapshot(photoshop, transactionDocument, selectionSnapshot);
              selectionRestored = true;
            }
          },
          "delete-selection-snapshot-channel": {
            label: "remove selection snapshot channel",
            run: async () => {
              if (!selectionRestored) throw new Error("Selection was not restored; snapshot channel retained for recovery.");
              await removeSelectionSnapshotChannel(selectionSnapshot);
              selectionSnapshotRemoved = true;
            }
          },
          "restore-channel-targeting": {
            label: "restore channel targeting",
            run: () => restoreActiveChannels(transactionDocument, selectionSnapshot)
          },
          "select-result-layer": {
            label: "activate imported result layer",
            run: () => selectLayerById(photoshop, resultLayerId!, false)
          },
          "restore-previous-layer": {
            label: "restore previously active layer",
            run: () => selectLayerById(photoshop, previousLayerId!, false)
          }
        };

        const cleanupFailures = await runCleanupTasks(
          planImportFinalization(
            {
              resultLayerCreated: resultLayerId !== undefined,
              temporaryMaskLayerCreated: temporaryMaskLayerId !== undefined,
              temporaryBlackLayerCreated: temporaryBlackLayerId !== undefined,
              selectionSnapshotChannelCreated: Boolean(selectionSnapshot.channel),
              previousLayerAvailable: previousLayerId !== undefined
            },
            operationError ? "failure" : "success"
          ).map((action) => finalizationHandlers[action])
        );

        let recoveryFailures: Awaited<ReturnType<typeof runCleanupTasks>> = [];
        if (cleanupFailures.length > 0) {
          const recoveryHandlers: Record<ImportRecoveryAction, CleanupTask> = {
            "retry-delete-temporary-mask-layer": {
              label: "retry temporary mask layer removal",
              run: () => deleteLayerById(photoshop, temporaryMaskLayerId!, false)
            },
            "retry-delete-temporary-black-layer": {
              label: "retry temporary black layer removal",
              run: () => deleteLayerById(photoshop, temporaryBlackLayerId!, false)
            },
            "roll-back-result-layer": {
              label: "roll back imported result layer",
              run: () => deleteLayerById(photoshop, resultLayerId!, false)
            },
            "retry-restore-selection": {
              label: "retry artist selection restoration",
              run: async () => {
                await restoreSelectionSnapshot(photoshop, transactionDocument, selectionSnapshot);
                selectionRestored = true;
              }
            },
            "delete-selection-snapshot-channel": {
              label: "remove selection snapshot channel after rollback",
              run: async () => {
                if (!selectionRestored) throw new Error("Selection restoration still failed; snapshot channel retained.");
                await removeSelectionSnapshotChannel(selectionSnapshot);
              }
            },
            "restore-channel-targeting": {
              label: "restore channel targeting after rollback",
              run: () => restoreActiveChannels(transactionDocument, selectionSnapshot)
            },
            "restore-previous-layer": {
              label: "restore previously active layer after rollback",
              run: () => selectLayerById(photoshop, previousLayerId!, false)
            }
          };

          recoveryFailures = await runCleanupTasks(
            planImportRecovery({
              temporaryMaskLayerPresent: temporaryMaskLayerId !== undefined,
              temporaryBlackLayerPresent: temporaryBlackLayerId !== undefined,
              resultLayerPresent: resultLayerId !== undefined,
              selectionRestored,
              selectionSnapshotChannelPresent: Boolean(selectionSnapshot.channel) && !selectionSnapshotRemoved,
              previousLayerAvailable: previousLayerId !== undefined
            }).map((action) => recoveryHandlers[action])
          );
          if (!operationError) {
            throw new Error(`Photoshop could not safely finalize the import. ${formatCleanupFailures([...cleanupFailures, ...recoveryFailures])}`);
          }
        }

        if (operationError) {
          const allCleanupFailures = [...cleanupFailures, ...recoveryFailures];
          const cleanupDetails = allCleanupFailures.length > 0
            ? ` Cleanup also reported: ${formatCleanupFailures(allCleanupFailures)}`
            : "";
          throw new Error(`${getErrorMessage(operationError)}${cleanupDetails}`);
        }

        maskApplied = true;
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
  } finally {
    await deleteTemporaryFileBestEffort(file);
    await deleteTemporaryFileBestEffort(maskFile);
  }
}

// Captures the active layer's pixels and returns the full source image so its
// originating Photoshop document remains bound to the PNG instead of being lost with a bare Blob.
export async function exportActiveLayerAsPNG(): Promise<ExportedSourceImage> {
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
            "No active Photoshop layer was found. Select a pixel or smart object layer before exporting."
          );
        }

        if (typeof document.id !== "number" || typeof activeLayer.id !== "number") {
          throw createOpenLayerError(
            "PHOTOSHOP_EXPORT_FAILED",
            "Photoshop did not expose a stable document or layer ID for the active layer.",
            "Active layer export needs document.id and activeLayer.id."
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
          filenamePrefix: "OpenLayer_Layer",
          sourceName: activeLayer.name || "Active layer",
          originatingDocument: readDocumentIdentity(document)
        });
      },
      { commandName: "Export OpenLayer Active Layer" }
    );

    return createExportedSourceImage(capturedSource);
  } catch (caughtError) {
    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      `Could not export the active Photoshop layer. ${getErrorMessage(caughtError)}`
    );
  }
}

// Captures the current selection's pixels and returns the full source image so its
// originating Photoshop document remains bound to the PNG instead of being lost with a bare Blob.
export async function exportSelectionAsPNG(): Promise<ExportedSourceImage> {
  const photoshop = getPhotoshop();
  const imaging = getImagingApi(photoshop);

  try {
    const capturedSource = await photoshop.core.executeAsModal(
      async () => {
        const document = getActiveDocument();
        const selection = await readActiveSelectionInfo(photoshop, document, "exporting a selection");

        if (typeof document.id !== "number") {
          throw createOpenLayerError(
            "PHOTOSHOP_EXPORT_FAILED",
            "Photoshop did not expose a stable document ID for the active document.",
            "Selection export needs document.id."
          );
        }

        return captureSourceImage(imaging, {
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
          filenamePrefix: "OpenLayer_Selection",
          sourceName: `Selection from ${selection.documentName}`,
          originatingDocument: selection.originatingDocument
        });
      },
      { commandName: "Export OpenLayer Selection" }
    );

    return createExportedSourceImage(capturedSource);
  } catch (caughtError) {
    if (isOpenLayerNoSelectionError(caughtError)) {
      throw caughtError;
    }

    throw createOpenLayerError(
      "PHOTOSHOP_EXPORT_FAILED",
      `Could not export the active Photoshop selection. ${getErrorMessage(caughtError)}`
    );
  }
}

export async function exportSelectionMask(): Promise<SelectionMaskExport> {
  const photoshop = getPhotoshop();
  const imaging = getImagingApi(photoshop);

  try {
    const capturedMask = await photoshop.core.executeAsModal(
      async () => {
        const document = getActiveDocument();
        const selection = await readActiveSelectionInfo(photoshop, document, "exporting a selection mask");

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
  let file: UxpFile | undefined;

  try {
    assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);

    if (!options.blob || options.blob.size === 0) {
      throw new Error("The generated inpaint image blob is empty.");
    }

    const bounds = normalizeSelectionBounds(options.bounds);
    const layerName = options.layerName ?? createLayerName("OpenLayer_Inpaint");

    options.onProgress?.("Saving inpaint result to a temporary PNG...");
    file = await saveBlobToTemporaryFile(options.blob, `${layerName}.png`);
    const uxp = getUxp();
    options.onProgress?.("Creating Photoshop file token...");
    const token = await uxp.storage.localFileSystem.createSessionToken(file);

    options.onProgress?.("Placing inpaint patch into the active document...");
    await photoshop.core.executeAsModal(
      async () => {
        assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
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
  } finally {
    await deleteTemporaryFileBestEffort(file);
  }
}

export type OutpaintCanvasImportOptions = {
  blob: Blob;
  originatingDocument: PhotoshopDocumentIdentity | null;
  plan: OutpaintExpansionPlan;
  layerName?: string;
  onProgress?: ImportProgress;
};

// Expands the artist's canvas by the plan's padding and places the generated
// result covering the whole expanded canvas, so the original content lines up
// exactly under its region of the outpaint. The whole operation is wrapped in a
// suspended history state: on any failure the placed layer is removed and the
// document reverts to its pre-import state in one step. The canvas is never
// re-cropped programmatically, because reducing canvas size clips pixel data
// outside the new bounds and artist layers may extend past the original canvas.
export async function importOutpaintResultExpandingCanvas(
  options: OutpaintCanvasImportOptions
): Promise<string> {
  const photoshop = getPhotoshop();
  const layerName = options.layerName ?? createLayerName("OpenLayer_Outpaint");
  let file: UxpFile | undefined;

  try {
    assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
    assertCanvasMatchesOutpaintPlan(getActiveDocument(), options.plan);

    if (!options.blob || options.blob.size === 0) {
      throw new Error("The generated outpaint image blob is empty.");
    }

    options.onProgress?.("Saving outpaint result to a temporary PNG...");
    file = await saveBlobToTemporaryFile(options.blob, `${layerName}.png`);
    const uxp = getUxp();
    options.onProgress?.("Creating Photoshop file token...");
    const token = await uxp.storage.localFileSystem.createSessionToken(file);

    options.onProgress?.("Expanding the canvas and placing the outpaint result...");
    await photoshop.core.executeAsModal(
      async (executionContext) => {
        assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
        const transactionDocument = getActiveDocument();
        assertCanvasMatchesOutpaintPlan(transactionDocument, options.plan);

        const hostControl = executionContext?.hostControl;
        const canSuspendHistory = typeof transactionDocument.id === "number" &&
          typeof hostControl?.suspendHistory === "function" &&
          typeof hostControl?.resumeHistory === "function";
        const suspensionId = canSuspendHistory
          ? await hostControl!.suspendHistory!({
            documentID: transactionDocument.id!,
            name: "OpenLayer Outpaint Canvas Expansion"
          })
          : null;
        let resultLayerId: number | undefined;
        let operationError: unknown;

        try {
          const { pads, sourceDimensions, expandedWidth, expandedHeight } = options.plan;

          // Two anchored steps because canvasSize distributes new space
          // around a single anchor: first pin the content bottom-right to
          // add the left/top padding, then pin it top-left for right/bottom.
          if (pads.left > 0 || pads.top > 0) {
            await resizeCanvas(photoshop, sourceDimensions.width + pads.left, sourceDimensions.height + pads.top, "right", "bottom");
          }

          if (pads.right > 0 || pads.bottom > 0) {
            await resizeCanvas(photoshop, expandedWidth, expandedHeight, "left", "top");
          }

          await placeFileAsLayer(photoshop, token);
          resultLayerId = getActiveDocument().activeLayers?.[0]?.id;
          if (resultLayerId === undefined) throw new Error("Photoshop did not expose the imported outpaint layer ID.");
          await renameActiveLayer(photoshop, layerName);
          await alignActiveLayerToBounds(photoshop, normalizeSelectionBounds(options.plan.resultBounds));

          // The placed layer must cover the expanded canvas exactly; anything
          // else means the result image did not match the plan after all.
          const placedBounds = await readActiveLayerBounds(photoshop);
          if (
            placedBounds.left !== 0 ||
            placedBounds.top !== 0 ||
            placedBounds.width !== expandedWidth ||
            placedBounds.height !== expandedHeight
          ) {
            throw new Error(
              `The placed outpaint layer covers ${placedBounds.width} x ${placedBounds.height} at ${placedBounds.left}, ${placedBounds.top}, not the expanded ${expandedWidth} x ${expandedHeight} canvas.`
            );
          }

          assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
        } catch (caughtError) {
          operationError = caughtError;
        }

        if (operationError) {
          // Belt and suspenders: remove the placed layer even though the
          // history revert below should also erase it, in case this host
          // cannot suspend history at all.
          if (resultLayerId !== undefined) {
            await deleteLayerById(photoshop, resultLayerId, true);
          }
        }

        if (suspensionId !== null) {
          await hostControl!.resumeHistory!(suspensionId, !operationError);
        }

        if (operationError) {
          const revertNote = suspensionId !== null
            ? " The document was reverted to its state before the import."
            : " Undo (Ctrl+Z) restores the canvas if it was already expanded.";
          throw new Error(`${getErrorMessage(operationError)}${revertNote}`);
        }
      },
      { commandName: "Import OpenLayer Outpaint With Canvas Expansion" }
    );

    options.onProgress?.(`Imported ${layerName} on an expanded canvas.`);
    return layerName;
  } catch (caughtError) {
    throw createOpenLayerError(
      "PHOTOSHOP_IMPORT_FAILED",
      `Could not import the outpaint result with canvas expansion. ${getErrorMessage(caughtError)}`
    );
  } finally {
    await deleteTemporaryFileBestEffort(file);
  }
}

export type UpscaleDocumentImportOptions = {
  blob: Blob;
  originatingDocument: PhotoshopDocumentIdentity | null;
  plan: UpscaleResizePlan;
  layerName?: string;
  onProgress?: ImportProgress;
};

// Resamples the artist's whole document up to the upscaled size and places the
// result covering it exactly, so every existing layer stays in register with
// the upscale instead of sitting in one corner of an oversized canvas. This
// resamples the artist's other layers, which is lossy for them -- that is the
// deliberate trade for keeping the document coherent, and it is why the caller
// only reaches this path for a canvas capture whose result is a clean uniform
// scale. Wrapped in a suspended history state: any failure removes the placed
// layer and reverts the document, including the resize, in one step.
export async function importUpscaleResultResizingDocument(
  options: UpscaleDocumentImportOptions
): Promise<string> {
  const photoshop = getPhotoshop();
  const layerName = options.layerName ?? createLayerName("OpenLayer_Upscale");
  let file: UxpFile | undefined;

  try {
    assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
    assertCanvasMatchesUpscalePlan(getActiveDocument(), options.plan);

    if (!options.blob || options.blob.size === 0) {
      throw new Error("The generated upscale image blob is empty.");
    }

    options.onProgress?.("Saving upscale result to a temporary PNG...");
    file = await saveBlobToTemporaryFile(options.blob, `${layerName}.png`);
    const uxp = getUxp();
    options.onProgress?.("Creating Photoshop file token...");
    const token = await uxp.storage.localFileSystem.createSessionToken(file);

    options.onProgress?.("Resizing the document and placing the upscale result...");
    await photoshop.core.executeAsModal(
      async (executionContext) => {
        assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
        const transactionDocument = getActiveDocument();
        assertCanvasMatchesUpscalePlan(transactionDocument, options.plan);

        const hostControl = executionContext?.hostControl;
        const canSuspendHistory = typeof transactionDocument.id === "number" &&
          typeof hostControl?.suspendHistory === "function" &&
          typeof hostControl?.resumeHistory === "function";
        const suspensionId = canSuspendHistory
          ? await hostControl!.suspendHistory!({
            documentID: transactionDocument.id!,
            name: "OpenLayer Upscale Document Resize"
          })
          : null;
        let resultLayerId: number | undefined;
        let operationError: unknown;

        try {
          const { resizedWidth, resizedHeight } = options.plan;

          await resampleImageSize(photoshop, resizedWidth, resizedHeight);

          await placeFileAsLayer(photoshop, token);
          resultLayerId = getActiveDocument().activeLayers?.[0]?.id;
          if (resultLayerId === undefined) throw new Error("Photoshop did not expose the imported upscale layer ID.");
          await renameActiveLayer(photoshop, layerName);
          await alignActiveLayerToBounds(photoshop, normalizeSelectionBounds(options.plan.resultBounds));

          // The placed layer must cover the resized document exactly. This is
          // also what catches Photoshop scaling an oversized placed image down
          // to fit: the bounds would come back at the old canvas size.
          const placedBounds = await readActiveLayerBounds(photoshop);
          if (
            placedBounds.left !== 0 ||
            placedBounds.top !== 0 ||
            placedBounds.width !== resizedWidth ||
            placedBounds.height !== resizedHeight
          ) {
            throw new Error(
              `The placed upscale layer covers ${placedBounds.width} x ${placedBounds.height} at ${placedBounds.left}, ${placedBounds.top}, not the resized ${resizedWidth} x ${resizedHeight} document.`
            );
          }

          assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
        } catch (caughtError) {
          operationError = caughtError;
        }

        if (operationError) {
          if (resultLayerId !== undefined) {
            await deleteLayerById(photoshop, resultLayerId, true);
          }
        }

        if (suspensionId !== null) {
          await hostControl!.resumeHistory!(suspensionId, !operationError);
        }

        if (operationError) {
          const revertNote = suspensionId !== null
            ? " The document was reverted to its state before the import."
            : " Undo (Ctrl+Z) restores the document if it was already resized.";
          throw new Error(`${getErrorMessage(operationError)}${revertNote}`);
        }
      },
      { commandName: "Import OpenLayer Upscale With Document Resize" }
    );

    options.onProgress?.(`Imported ${layerName} on a resized document.`);
    return layerName;
  } catch (caughtError) {
    throw createOpenLayerError(
      "PHOTOSHOP_IMPORT_FAILED",
      `Could not import the upscale result with document resizing. ${getErrorMessage(caughtError)}`
    );
  } finally {
    await deleteTemporaryFileBestEffort(file);
  }
}

// Same guard as the outpaint path: the document must still be the size that was
// captured, or resampling it would scale the artist's work by the wrong factor.
function assertCanvasMatchesUpscalePlan(document: PhotoshopDocument, plan: UpscaleResizePlan) {
  const width = Math.round(Number(document.width ?? 0));
  const height = Math.round(Number(document.height ?? 0));

  if (width !== plan.sourceDimensions.width || height !== plan.sourceDimensions.height) {
    throw new Error(
      `The document is now ${width} x ${height}, but this upscale was generated from a ${plan.sourceDimensions.width} x ${plan.sourceDimensions.height} canvas. Capture and generate again before importing with document resizing.`
    );
  }
}

// Photoshop's imageSize descriptor carries its interpolation method under the
// legacy key "interfaceIconFrameDimmed". Hosts that reject it still accept the
// plain resample, so the explicit-interpolation form is tried first and the
// bare form is the fallback -- same tolerance pattern as placeFileAsLayer.
async function resampleImageSize(photoshop: PhotoshopModule, width: number, height: number) {
  const base = {
    _obj: "imageSize",
    width: { _unit: "pixelsUnit", _value: width },
    height: { _unit: "pixelsUnit", _value: height },
    constrainProportions: false,
    _options: { dialogOptions: "dontDisplay" }
  };
  const commands: BatchPlayCommand[] = [
    { ...base, interfaceIconFrameDimmed: { _enum: "interpolationType", _value: "bicubicSmoother" } },
    base
  ];
  const failures: string[] = [];

  for (const command of commands) {
    try {
      await photoshop.action.batchPlay([command], {});
      return;
    } catch (caughtError) {
      failures.push(getErrorMessage(caughtError));
    }
  }

  throw new Error(`Photoshop rejected the image size command. ${failures.filter(Boolean).join(" | ")}`);
}

// The canvas must still be exactly the size that was captured and padded; if
// the artist resized the document after capturing, expanding it would misalign
// everything silently.
function assertCanvasMatchesOutpaintPlan(document: PhotoshopDocument, plan: OutpaintExpansionPlan) {
  const width = Math.round(Number(document.width ?? 0));
  const height = Math.round(Number(document.height ?? 0));

  if (width !== plan.sourceDimensions.width || height !== plan.sourceDimensions.height) {
    throw new Error(
      `The document is now ${width} x ${height}, but this outpaint was generated from a ${plan.sourceDimensions.width} x ${plan.sourceDimensions.height} canvas. Capture and generate again before importing with canvas expansion.`
    );
  }
}

async function resizeCanvas(
  photoshop: PhotoshopModule,
  width: number,
  height: number,
  horizontalAnchor: "left" | "center" | "right",
  verticalAnchor: "top" | "center" | "bottom"
) {
  await photoshop.action.batchPlay(
    [{
      _obj: "canvasSize",
      width: { _unit: "pixelsUnit", _value: width },
      height: { _unit: "pixelsUnit", _value: height },
      horizontal: { _enum: "horizontalLocation", _value: horizontalAnchor },
      vertical: { _enum: "verticalLocation", _value: verticalAnchor },
      _options: { dialogOptions: "dontDisplay" }
    }],
    {}
  );
}

export type UnflattenLayerStackImportOptions = {
  /**
   * Every image the run returned, in ComfyUI's order. Index 0 is the flattened
   * composite and is not imported; see planUnflattenLayerStack.
   */
  images: readonly { blob: Blob }[];
  originatingDocument: PhotoshopDocumentIdentity | null;
  /**
   * Where the source layer sat. Every plate is scaled and aligned to this, so
   * the stack lands back over the region it was decomposed from. Absent means
   * the capture could not report bounds, and the stack centres instead.
   */
  targetBounds?: NormalizedSelectionBounds;
  /** The captured layer's name; the group is named after it. */
  sourceName?: string;
  /**
   * The capture that was decomposed, at the resolution it was captured at.
   *
   * Every layer in front of the background is built from these pixels, masked
   * by the model's alpha, rather than from the model's own 640px re-render.
   * Omitting it falls back to the model's pixels for everything, which is what
   * the import did before and is still what happens if the host cannot load a
   * layer's transparency as a selection.
   */
  sourceBlob?: Blob;
  onProgress?: ImportProgress;
};

export type UnflattenLayerStackImportResult = {
  groupName: string;
  layerNames: string[];
  /** How many layers were built from the source rather than the model. */
  sourcePixelLayerCount: number;
  /** Plates that carried no matte at all and were left out. */
  skippedBlankLayerCount: number;
};

/**
 * Imports a decomposed layer stack into the artist's document: N plates, back
 * to front, each scaled and aligned to the region the source was captured
 * from, all inside one layer group named after that source.
 *
 * Three things here are not shared with any other import in this file.
 *
 * **It is the only import that places more than once.** Every placement mutates
 * the document, so the failure this has to survive is a partial one -- three
 * plates down of five when something goes wrong. The whole sequence runs inside
 * a single suspended history state, so `resumeHistory(id, false)` undoes every
 * placement, rename, transform and the group in one step (A3). The deletions
 * before it are belt and braces for a host that cannot suspend history at all.
 *
 * **It is the only import that scales.** `placeEvent` shrinks an oversized
 * image to fit the canvas and never enlarges a small one, and
 * `alignActiveLayerToBounds` beside it only translates -- so a 640px plate
 * would otherwise sit at a fraction of its size in the corner of the region it
 * came from. Measured rather than assumed: docs/unflatten-gate-findings.md, Q5.
 *
 * **It is the only import that carries alpha.** Nothing here had moved an alpha
 * channel before; captures run `applyAlpha: false` and every import to date was
 * opaque RGB. The bytes are never decoded on the way through -- ComfyUI's PNG
 * reaches `placeEvent` untouched -- and Place preserves transparency, both
 * verified before this was written.
 */
export async function importUnflattenLayerStack(
  options: UnflattenLayerStackImportOptions
): Promise<UnflattenLayerStackImportResult> {
  const photoshop = getPhotoshop();
  const files: UxpFile[] = [];

  try {
    assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);

    const plan = planUnflattenLayerStack({
      imageCount: options.images.length,
      sourceName: options.sourceName
    });

    for (const placement of plan.placements) {
      const image = options.images[placement.imageIndex];

      if (!image?.blob || image.blob.size === 0) {
        throw new Error(`The decomposed image for ${placement.layerName} is empty.`);
      }
    }

    // Every temporary file and token is created before the modal scope opens,
    // matching the single-image imports: a failure while writing files must not
    // happen with the artist's document already half-mutated.
    const uxp = getUxp();
    const tokens: string[] = [];
    const stamp = Date.now();

    for (const placement of plan.placements) {
      options.onProgress?.(`Saving ${placement.layerName} to a temporary PNG...`);
      const file = await saveBlobToTemporaryFile(
        options.images[placement.imageIndex].blob,
        `OpenLayer_Unflatten_${stamp}_${placement.depth}.png`
      );
      files.push(file);
      tokens.push(await uxp.storage.localFileSystem.createSessionToken(file));
    }

    let sourceToken: string | undefined;

    if (options.sourceBlob && options.sourceBlob.size > 0) {
      options.onProgress?.("Saving the captured source for masking...");
      const sourceFile = await saveBlobToTemporaryFile(
        options.sourceBlob,
        `OpenLayer_Unflatten_${stamp}_source.png`
      );
      files.push(sourceFile);
      sourceToken = await uxp.storage.localFileSystem.createSessionToken(sourceFile);
    }

    const layerNames: string[] = [];
    let sourcePixelLayerCount = 0;
    let skippedBlankLayerCount = 0;

    await photoshop.core.executeAsModal(
      async (executionContext) => {
        assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
        const transactionDocument = getActiveDocument();
        const previousLayerId = transactionDocument.activeLayers?.[0]?.id;

        const hostControl = executionContext?.hostControl;
        const canSuspendHistory = typeof transactionDocument.id === "number" &&
          typeof hostControl?.suspendHistory === "function" &&
          typeof hostControl?.resumeHistory === "function";
        const suspensionId = canSuspendHistory
          ? await hostControl!.suspendHistory!({
            documentID: transactionDocument.id!,
            name: "OpenLayer Unflatten Import"
          })
          : null;

        const placedLayerIds: number[] = [];
        let operationError: unknown;

        try {
          for (const placement of plan.placements) {
            // Re-checked every iteration rather than once at the end. This loop
            // mutates the document repeatedly, and a document switched
            // underneath it halfway would otherwise scatter plates across two
            // documents before anything noticed (A1).
            assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);

            options.onProgress?.(`Placing ${placement.layerName}...`);

            const outcome = await placeDecomposedPlate(photoshop, {
              modelToken: tokens[placement.depth - 1],
              sourceToken,
              targetBounds: options.targetBounds
            });

            if (outcome === "skipped") {
              // A plate holding nothing, or holding a flat fill and no picture.
              // Either way there is no layer in it.
              skippedBlankLayerCount += 1;
              continue;
            }

            if (outcome === "unavailable") {
              await placeFileAsLayer(photoshop, tokens[placement.depth - 1]);
              await fitActiveLayerToBounds(photoshop, options.targetBounds);
            } else if (outcome === "masked") {
              sourcePixelLayerCount += 1;
            }

            const placedLayerId = getActiveDocument().activeLayers?.[0]?.id;
            if (placedLayerId === undefined) {
              throw new Error(`Photoshop did not expose a layer ID for ${placement.layerName}.`);
            }
            placedLayerIds.push(placedLayerId);

            await renameActiveLayer(photoshop, placement.layerName);
            layerNames.push(placement.layerName);
          }

          if (placedLayerIds.length === 0) {
            throw new Error("Every decomposed layer came back empty, so there was nothing to import.");
          }

          // Only when plates were dropped. Renumbering an untouched stack would
          // be a batchPlay round trip per layer to write the names it already
          // has, and every extra command in here is another way to fail.
          if (skippedBlankLayerCount > 0) {
            const survivingNames = stackLayerNames(placedLayerIds.length);
            layerNames.length = 0;

            for (const [index, layerId] of placedLayerIds.entries()) {
              await selectLayerById(photoshop, layerId, false);
              await renameActiveLayer(photoshop, survivingNames[index]);
              layerNames.push(survivingNames[index]);
            }
          }

          assertActiveDocumentMatchesOrigin(photoshop, options.originatingDocument);
          options.onProgress?.(`Grouping ${placedLayerIds.length} layers into ${plan.groupName}...`);
          await selectLayersByIds(photoshop, placedLayerIds);
          await groupSelectedLayers(photoshop, plan.groupName);
        } catch (caughtError) {
          operationError = caughtError;
        }

        if (operationError) {
          // Reverse order so each delete targets a layer nothing else sits on.
          for (const layerId of [...placedLayerIds].reverse()) {
            await deleteLayerById(photoshop, layerId, true);
          }

          if (previousLayerId !== undefined) {
            await selectLayerById(photoshop, previousLayerId, true);
          }
        }

        if (suspensionId !== null) {
          await hostControl!.resumeHistory!(suspensionId, !operationError);
        }

        if (operationError) {
          const revertNote = suspensionId !== null
            ? " The document was returned to its state before the import."
            : " Undo (Ctrl+Z) removes any layers that were already placed.";
          throw new Error(`${getErrorMessage(operationError)}${revertNote}`);
        }
      },
      { commandName: "Import OpenLayer Unflatten Layers" }
    );

    options.onProgress?.(`Imported ${layerNames.length} layers into ${plan.groupName}.`);
    return { groupName: plan.groupName, layerNames, sourcePixelLayerCount, skippedBlankLayerCount };
  } catch (caughtError) {
    throw createOpenLayerError(
      "PHOTOSHOP_IMPORT_FAILED",
      `Could not import the decomposed layers. ${getErrorMessage(caughtError)}`
    );
  } finally {
    for (const file of files) {
      await deleteTemporaryFileBestEffort(file);
    }
  }
}

/**
 * Scales the active layer to the captured region and then moves it there.
 *
 * Scale before align, always: the transform is anchored on the layer's own
 * centre, so it moves the layer as a side effect, and aligning first would be
 * undone by it.
 */
async function fitActiveLayerToBounds(
  photoshop: PhotoshopModule,
  targetBounds?: NormalizedSelectionBounds
) {
  if (!targetBounds) {
    await centerActiveLayerOnCanvas(photoshop);
    return;
  }

  const placedBounds = await readActiveLayerBounds(photoshop);
  const scale = planLayerScale(placedBounds, targetBounds);

  if (scale) {
    await scaleActiveLayer(photoshop, scale);
  }

  await alignActiveLayerToBounds(photoshop, targetBounds);
}

/**
 * Places one decomposed plate, deciding from its own pixels what it is.
 *
 * The plate goes down first and is then read, because what it holds cannot be
 * known before it is in the document and nothing else here can decode a PNG.
 * Four outcomes:
 *
 * - **blank or flat fill** -- deleted. Nothing in it is worth a layer.
 * - **full frame** -- kept exactly as placed. This is a background: it holds
 *   content the model invented behind the subject, which is not in the source,
 *   so it must keep the model's own pixels even though they are softer.
 * - **cut-out** -- rebuilt from the artist's pixels wearing this plate's matte.
 * - **anything the host refuses** -- reported so the caller places it plainly.
 *
 * The ordering rule that governs the cut-out path is worth stating because it
 * is invisible and was learned the hard way: `placeEvent` clears the active
 * selection, so every placement happens before the transparency is loaded, and
 * nothing between the selection and the mask may place anything.
 */
async function placeDecomposedPlate(
  photoshop: PhotoshopModule,
  options: {
    modelToken: string;
    sourceToken?: string;
    targetBounds?: NormalizedSelectionBounds;
  }
): Promise<"masked" | "model" | "skipped" | "unavailable"> {
  let plateLayerId: number | undefined;
  let sourceLayerId: number | undefined;

  try {
    await placeFileAsLayer(photoshop, options.modelToken);
    plateLayerId = getActiveDocument().activeLayers?.[0]?.id;

    if (plateLayerId === undefined) {
      throw new Error("Photoshop did not expose the placed plate.");
    }

    await fitActiveLayerToBounds(photoshop, options.targetBounds);

    const kind = await classifyPlacedPlate(photoshop, plateLayerId);

    if (kind === "blank" || kind === "flat-fill") {
      await deleteLayerById(photoshop, plateLayerId, true);

      return "skipped";
    }

    // A background, or a run with no source to mask against. Either way the
    // plate as placed already is the layer.
    if (kind === "full-frame" || options.sourceToken === undefined) {
      return "model";
    }

    // Placed above the plate, and placed now, because after the selection
    // exists nothing may call placeEvent.
    await placeFileAsLayer(photoshop, options.sourceToken);
    sourceLayerId = getActiveDocument().activeLayers?.[0]?.id;

    if (sourceLayerId === undefined) {
      throw new Error("Photoshop did not expose the placed source layer.");
    }

    await fitActiveLayerToBounds(photoshop, options.targetBounds);

    await selectLayerById(photoshop, plateLayerId, false);
    await loadActiveLayerTransparencyAsSelection(photoshop);
    await deleteLayerById(photoshop, plateLayerId, false);
    plateLayerId = undefined;

    await selectLayerById(photoshop, sourceLayerId, false);
    await addLayerMaskFromSelection(photoshop);
    await deselectActiveSelection(photoshop);

    return "masked";
  } catch {
    // Leave nothing behind: the caller is about to place this plate plainly.
    if (sourceLayerId !== undefined) {
      await deleteLayerById(photoshop, sourceLayerId, true);
    }

    if (plateLayerId !== undefined) {
      await deleteLayerById(photoshop, plateLayerId, true);
    }

    try {
      await deselectActiveSelection(photoshop);
    } catch {
      // A selection that will not clear is not worth failing the import over.
    }

    return "unavailable";
  }
}

/**
 * Reads a placed plate small and reports what it holds.
 *
 * Sampled at 128 square: the questions are whether anything is there, whether
 * it varies, and whether it covers the frame, and all three survive a
 * downsample. A read that fails answers "cut-out", the outcome that imports the
 * layer -- because importing something empty is a visible nuisance while
 * dropping something real is silent data loss.
 */
async function classifyPlacedPlate(photoshop: PhotoshopModule, plateLayerId: number) {
  const imaging = photoshop.imaging;
  const documentId = getActiveDocument().id;

  if (!imaging?.getPixels || typeof documentId !== "number") {
    return "cutout" as const;
  }

  let imageData: PhotoshopImageData | undefined;

  try {
    const pixels = await imaging.getPixels({
      documentID: documentId,
      layerID: plateLayerId,
      componentSize: 8,
      colorSpace: "RGB",
      // The alpha must arrive as its own component rather than composited
      // against anything, which is the whole point of the read.
      applyAlpha: false,
      targetSize: { width: PLATE_SAMPLE_SIZE, height: PLATE_SAMPLE_SIZE }
    });
    imageData = pixels.imageData;

    if (!imageData) return "cutout" as const;

    const components = Number(imageData.components ?? 4);
    const raw = toUint8Array(await readImageDataBytes(imageData));

    return classifyPlateSample(measurePlateSample(raw, components));
  } catch {
    return "cutout" as const;
  } finally {
    imageData?.dispose?.();
  }
}

/**
 * Turns raw interleaved pixels into the three numbers the classifier needs.
 *
 * Exported for its own tests: this is arithmetic over a byte array, it decides
 * whether a layer reaches the artist's document, and it is the one part of the
 * read that can be checked without Photoshop.
 */
export function measurePlateSample(raw: Uint8Array, components: number) {
  const hasAlpha = components >= 4;
  const pixelCount = components > 0 ? Math.floor(raw.length / components) : 0;

  if (pixelCount === 0) {
    return { peakAlpha: 255, clearFraction: 0, rgbStandardDeviation: 255 };
  }

  let peakAlpha = 0;
  let clearCount = 0;
  let sum = 0;
  let sumOfSquares = 0;
  let channelCount = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * components;
    const alpha = hasAlpha ? raw[offset + components - 1] : 255;

    if (alpha > peakAlpha) peakAlpha = alpha;
    if (alpha === 0) clearCount += 1;

    // Only where something is actually visible. Averaging in the arbitrary RGB
    // that sits under fully transparent pixels would make every cut-out look
    // like a flat fill or a busy one at random.
    if (alpha > PLATE_VISIBLE_ALPHA_FLOOR) {
      for (let channel = 0; channel < Math.min(3, components); channel += 1) {
        const value = raw[offset + channel];
        sum += value;
        sumOfSquares += value * value;
        channelCount += 1;
      }
    }
  }

  const mean = channelCount > 0 ? sum / channelCount : 0;
  const variance = channelCount > 0 ? Math.max(sumOfSquares / channelCount - mean * mean, 0) : 0;

  return {
    peakAlpha,
    clearFraction: clearCount / pixelCount,
    rgbStandardDeviation: Math.sqrt(variance)
  };
}

async function loadActiveLayerTransparencyAsSelection(photoshop: PhotoshopModule) {
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
          _ref: "channel",
          _enum: "channel",
          _value: "transparencyEnum"
        },
        _options: {
          dialogOptions: "dontDisplay"
        }
      }
    ],
    {}
  );
}

async function addLayerMaskFromSelection(photoshop: PhotoshopModule) {
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

async function scaleActiveLayer(photoshop: PhotoshopModule, scale: LayerScalePlan) {
  await photoshop.action.batchPlay(
    [
      {
        _obj: "transform",
        _target: [
          {
            _ref: "layer",
            _enum: "ordinal",
            _value: "targetEnum"
          }
        ],
        freeTransformCenterState: {
          _enum: "quadCenterState",
          _value: "QCSAverage"
        },
        offset: {
          _obj: "offset",
          horizontal: { _unit: "pixelsUnit", _value: 0 },
          vertical: { _unit: "pixelsUnit", _value: 0 }
        },
        width: { _unit: "percentUnit", _value: scale.horizontalPercent },
        height: { _unit: "percentUnit", _value: scale.verticalPercent },
        interfaceIconFrameDimmed: {
          _enum: "interpolationType",
          _value: "bicubic"
        },
        _options: {
          dialogOptions: "dontDisplay"
        }
      }
    ],
    {}
  );
}

async function selectLayersByIds(photoshop: PhotoshopModule, layerIds: readonly number[]) {
  if (layerIds.length === 0) throw new Error("No placed layers to group.");

  await selectLayerById(photoshop, layerIds[0], false);

  for (const layerId of layerIds.slice(1)) {
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
          selectionModifier: {
            _enum: "selectionModifierType",
            _value: "addToSelection"
          },
          makeVisible: false,
          _options: {
            dialogOptions: "dontDisplay"
          }
        }
      ],
      {}
    );
  }
}

async function groupSelectedLayers(photoshop: PhotoshopModule, groupName: string) {
  await photoshop.action.batchPlay(
    [
      {
        _obj: "make",
        _target: [
          {
            _ref: "layerSection"
          }
        ],
        from: {
          _ref: "layer",
          _enum: "ordinal",
          _value: "targetEnum"
        },
        using: {
          _obj: "layerSection",
          name: groupName
        },
        _options: {
          dialogOptions: "dontDisplay"
        }
      }
    ],
    {}
  );
}

export async function preserveSelection<T>(_operation: PreserveSelectionOperation<T>): Promise<T> {
  // TODO(v0.5): Save and restore the active Photoshop selection around generation workflows.
  throw createOpenLayerError(
    "PHOTOSHOP_EXPORT_FAILED",
    "Selection preservation is planned for the next inpainting step."
  );
}

// The caller names itself so the no-selection message can say what the artist
// was actually doing. This helper predates any use outside Inpaint, so its
// message hard-coded "before using Inpaint" -- which reads as a non sequitur
// when the artist pressed Export Selection. Inpaint's wording is the default
// so its behavior is unchanged.
async function readActiveSelectionInfo(
  photoshop: PhotoshopModule,
  document: PhotoshopDocument,
  requestedBy = DEFAULT_SELECTION_REQUESTER
): Promise<ActiveSelectionInfo> {
  const selectionDescriptor = await getSelectionDescriptor(photoshop);
  const bounds = readSelectionBounds(selectionDescriptor);

  if (!bounds) {
    throw createOpenLayerError(
      "PHOTOSHOP_NO_SELECTION",
      createNoSelectionMessage(requestedBy)
    );
  }

  const normalizedBounds = normalizeSelectionBounds(bounds);
  const contextBounds = createInpaintContextBounds(normalizedBounds, document);

  return {
    bounds: normalizedBounds,
    contextBounds,
    documentName: document.title ?? document.name ?? "active document",
    originatingDocument: readDocumentIdentity(document),
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
  const previousLayerId = previousLayer?.id;
  const selectionSnapshot = await saveSelectionSnapshot(photoshop, document, "Capture");
  let temporaryLayerId: number | undefined;
  let selectionNeedsRestore = false;
  let capturedMask: CapturedSourceImage | undefined;
  let operationError: unknown;
  let captureSelectionRestored = false;
  let captureSnapshotRemoved = false;

  try {
    temporaryLayerId = await createTemporaryMaskLayer(photoshop);
    await fillActiveSelection(photoshop, "white");
    await invertActiveSelection(photoshop);
    selectionNeedsRestore = true;
    await fillActiveSelection(photoshop, "black");
    await invertActiveSelection(photoshop);
    selectionNeedsRestore = false;

    capturedMask = await captureMaskImage(imaging, {
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
      sourceName: `Mask from ${selection.documentName}`,
      originatingDocument: selection.originatingDocument
    });
  } catch (caughtError) {
    operationError = caughtError;
  }

  const cleanupFailures = await runCleanupTasks([
    ...(selectionNeedsRestore ? [{
      label: "restore inverted capture selection",
      run: () => invertActiveSelection(photoshop)
    }] : []),
    ...(temporaryLayerId === undefined ? [] : [{
      label: "remove capture mask layer",
      run: async () => {
        await deleteLayerById(photoshop, temporaryLayerId!, false);
        temporaryLayerId = undefined;
      }
    }]),
    {
      label: "restore captured selection",
      run: async () => {
        await restoreSelectionSnapshot(photoshop, document, selectionSnapshot);
        captureSelectionRestored = true;
      }
    },
    ...(selectionSnapshot.channel ? [{
      label: "remove capture selection snapshot channel",
      run: async () => {
        if (!captureSelectionRestored) throw new Error("Captured selection was not restored; snapshot channel retained for recovery.");
        await removeSelectionSnapshotChannel(selectionSnapshot);
        captureSnapshotRemoved = true;
      }
    }] : []),
    {
      label: "restore capture channel targeting",
      run: () => restoreActiveChannels(document, selectionSnapshot)
    },
    ...(previousLayerId === undefined ? [] : [{
      label: "restore active layer after capture",
      run: () => selectLayerById(photoshop, previousLayerId, false)
    }])
  ]);

  const recoveryFailures = cleanupFailures.length === 0 ? [] : await runCleanupTasks([
    ...(temporaryLayerId === undefined ? [] : [{
      label: "retry capture mask layer removal",
      run: () => deleteLayerById(photoshop, temporaryLayerId!, false)
    }]),
    ...(!captureSelectionRestored ? [{
      label: "retry captured selection restoration",
      run: async () => {
        await restoreSelectionSnapshot(photoshop, document, selectionSnapshot);
        captureSelectionRestored = true;
      }
    }] : []),
    ...(selectionSnapshot.channel && !captureSnapshotRemoved ? [{
      label: "remove capture snapshot channel after recovery",
      run: async () => {
        if (!captureSelectionRestored) throw new Error("Selection restoration still failed; snapshot channel retained.");
        await removeSelectionSnapshotChannel(selectionSnapshot);
      }
    }] : []),
    {
      label: "restore capture channel targeting after recovery",
      run: () => restoreActiveChannels(document, selectionSnapshot)
    }
  ]);

  if (operationError || cleanupFailures.length > 0) {
    const allCleanupFailures = [...cleanupFailures, ...recoveryFailures];
    const cleanupDetails = allCleanupFailures.length > 0
      ? ` Cleanup also reported: ${formatCleanupFailures(allCleanupFailures)}`
      : "";
    throw new Error(`${operationError ? getErrorMessage(operationError) : "Photoshop could not safely finalize selection capture."}${cleanupDetails}`);
  }

  if (!capturedMask) throw new Error("Photoshop did not return the captured selection mask.");
  return capturedMask;
}

// Photoshop creates a new layer directly above the active one, so activating the
// topmost layer first is what places the mask sandwich above the whole stack.
// This reuses the same select-by-ID primitive the rest of the import already
// relies on rather than introducing an arrange/reorder descriptor.
async function selectTopmostLayer(photoshop: PhotoshopModule) {
  const topmostLayerId = getActiveDocument().layers?.[0]?.id;

  if (typeof topmostLayerId !== "number") {
    throw new Error(
      "Photoshop did not expose the topmost layer, so OpenLayer cannot build the saved mask above the layer stack."
    );
  }

  await selectLayerById(photoshop, topmostLayerId, false);
  return topmostLayerId;
}

// Fails the import rather than letting a contaminated composite become a layer
// mask. The sandwich is only a valid selection source while the opaque mask sits
// directly above the full-canvas black backing at the very top of the document.
async function assertMaskSandwichIsTopmost(maskLayerId: number, blackLayerId: number) {
  const topLevelLayerIds = (getActiveDocument().layers ?? []).map((layer) => layer.id);

  if (!isMaskSandwichTopmost(topLevelLayerIds, { maskLayerId, blackLayerId })) {
    throw new Error(
      "Photoshop did not keep OpenLayer's temporary mask layers at the top of the document, so the saved selection mask could not be applied exactly."
    );
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

async function deleteLayerById(photoshop: PhotoshopModule, layerId: number, suppressErrors = true) {
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
  } catch (caughtError) {
    if (!suppressErrors) throw caughtError;
    // Best-effort cleanup. The caller will still restore the previous layer when possible.
  }
}

async function selectLayerById(photoshop: PhotoshopModule, layerId: number, suppressErrors = true) {
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
  } catch (caughtError) {
    if (!suppressErrors) throw caughtError;
    // Restoring active layer is helpful but should not fail a successful mask capture.
  }
}

async function saveSelectionSnapshot(
  photoshop: PhotoshopModule,
  document: PhotoshopDocument,
  operationName: string
): Promise<SelectionSnapshot> {
  const activeChannels = [...(document.activeChannels ?? [])];
  const hadSelection = await hasActiveSelection(photoshop);

  if (!hadSelection) {
    return { hadSelection: false, channel: null, channelName: null, activeChannels };
  }

  if (!document.selection?.save || !document.channels?.getByName) {
    throw new Error("Photoshop 25+ selection snapshot APIs are unavailable in this host.");
  }

  const channelName = `__OpenLayer_${operationName}_Selection_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await document.selection.save(channelName);

  try {
    const channel = document.channels.getByName(channelName);
    if (!channel) throw new Error("Photoshop did not expose the saved alpha channel.");
    document.activeChannels = [...activeChannels];
    return { hadSelection: true, channel, channelName, activeChannels };
  } catch (caughtError) {
    try { await deleteChannelByName(photoshop, channelName); } catch { /* Report the original snapshot failure. */ }
    throw caughtError;
  }
}

async function hasActiveSelection(photoshop: PhotoshopModule) {
  try {
    return Boolean(readSelectionBounds(await getSelectionDescriptor(photoshop)));
  } catch {
    return false;
  }
}

async function restoreSelectionSnapshot(
  photoshop: PhotoshopModule,
  document: PhotoshopDocument,
  snapshot: SelectionSnapshot
) {
  if (!snapshot.hadSelection) {
    await deselectActiveSelection(photoshop, false);
    return;
  }

  if (!snapshot.channel || !document.selection?.load) {
    throw new Error("The saved Photoshop selection channel is unavailable.");
  }

  await document.selection.load(snapshot.channel);
}

async function removeSelectionSnapshotChannel(snapshot: SelectionSnapshot) {
  if (!snapshot.channel) return;
  if (!snapshot.channel.remove) throw new Error("Photoshop did not expose alpha-channel removal.");
  await snapshot.channel.remove();
}

async function restoreActiveChannels(document: PhotoshopDocument, snapshot: SelectionSnapshot) {
  document.activeChannels = [...snapshot.activeChannels];
}

async function deleteChannelByName(photoshop: PhotoshopModule, channelName: string) {
  await photoshop.action.batchPlay(
    [{
      _obj: "delete",
      _target: [{ _ref: "channel", _name: channelName }],
      _options: { dialogOptions: "dontDisplay" }
    }],
    {}
  );
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

function readDocumentIdentity(document: PhotoshopDocument): PhotoshopDocumentIdentity {
  if (typeof document.id !== "number" || !Number.isFinite(document.id)) {
    throw createOpenLayerError(
      "PHOTOSHOP_NO_DOCUMENT",
      "Photoshop did not expose a stable identity for the active document. OpenLayer cannot safely bind generated results to it."
    );
  }

  return createPhotoshopDocumentIdentity(
    document.id,
    document.title ?? document.name ?? "Untitled document"
  );
}

function assertActiveDocumentMatchesOrigin(
  photoshop: PhotoshopModule,
  originatingDocument: PhotoshopDocumentIdentity | null
) {
  const activeDocument = photoshop.app.activeDocument
    ? readDocumentIdentity(photoshop.app.activeDocument)
    : null;
  const openDocuments = Array.from(photoshop.app.documents ?? [])
    .map((document) => {
      try {
        return readDocumentIdentity(document);
      } catch {
        return null;
      }
    })
    .filter((document): document is PhotoshopDocumentIdentity => Boolean(document));
  const validation = validateDocumentImportContext(
    originatingDocument,
    activeDocument,
    photoshop.app.documents ? openDocuments : undefined
  );

  if (!validation.ok) {
    throw createOpenLayerError("PHOTOSHOP_IMPORT_FAILED", validation.message);
  }
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

async function loadSelectionFromCompositeChannel(photoshop: PhotoshopModule) {
  await photoshop.action.batchPlay(
    [{
      _obj: "set",
      _target: [{ _ref: "channel", _property: "selection" }],
      to: { _ref: "channel", _enum: "channel", _value: "RGB" },
      _options: { dialogOptions: "dontDisplay" }
    }],
    {}
  );
}

async function selectEntireCanvas(photoshop: PhotoshopModule) {
  await photoshop.action.batchPlay(
    [{
      _obj: "set",
      _target: [{ _ref: "channel", _property: "selection" }],
      to: { _enum: "ordinal", _value: "allEnum" },
      _options: { dialogOptions: "dontDisplay" }
    }],
    {}
  );
}

async function deselectActiveSelection(photoshop: PhotoshopModule, suppressErrors = true) {
  try {
    await photoshop.action.batchPlay(
      [{
        _obj: "set",
        _target: [{ _ref: "channel", _property: "selection" }],
        to: { _enum: "ordinal", _value: "none" },
        _options: { dialogOptions: "dontDisplay" }
      }],
      {}
    );
  } catch (caughtError) {
    if (!suppressErrors) throw caughtError;
    // Cleanup is best-effort; the imported result is already removed on failure.
  }
}

async function alignActiveLayerToBounds(
  photoshop: PhotoshopModule,
  targetBounds: NormalizedSelectionBounds
) {
  const layerBounds = await readActiveLayerBounds(photoshop);
  const { deltaX, deltaY } = calculatePlacementOffset(layerBounds, targetBounds);

  if (deltaX === 0 && deltaY === 0) {
    return { deltaX, deltaY };
  }

  await moveActiveLayerBy(photoshop, deltaX, deltaY);
  return { deltaX, deltaY };
}

/**
 * Centres the active layer on the canvas the way an artist expects a fresh
 * generated layer to arrive. This is what `placeEvent` does on its own when no
 * selection is active; doing it explicitly makes the outcome independent of
 * whatever selection happens to be lying around.
 */
async function centerActiveLayerOnCanvas(photoshop: PhotoshopModule) {
  const document = photoshop.app.activeDocument;
  const documentWidth = Number(document?.width ?? 0);
  const documentHeight = Number(document?.height ?? 0);

  if (!Number.isFinite(documentWidth) || !Number.isFinite(documentHeight) || documentWidth <= 0 || documentHeight <= 0) {
    return { deltaX: 0, deltaY: 0 };
  }

  const layerBounds = await readActiveLayerBounds(photoshop);
  const target = calculateCenteredOrigin(
    { width: documentWidth, height: documentHeight },
    {
      width: layerBounds.right - layerBounds.left,
      height: layerBounds.bottom - layerBounds.top
    }
  );
  const { deltaX, deltaY } = calculatePlacementOffset(layerBounds, target);

  if (deltaX === 0 && deltaY === 0) {
    return { deltaX, deltaY };
  }

  await moveActiveLayerBy(photoshop, deltaX, deltaY);
  return { deltaX, deltaY };
}

/**
 * Bounds are a placement hint, never a reason to fail a capture. If Photoshop
 * will not report them the import centres on the canvas, which is exactly the
 * behaviour that existed before placement was made explicit.
 */
async function readActiveLayerBoundsBestEffort(photoshop: PhotoshopModule) {
  try {
    return await readActiveLayerBounds(photoshop);
  } catch {
    return null;
  }
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
    originatingDocument: PhotoshopDocumentIdentity;
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
      captureFormat: encoded.captureFormat,
      originatingDocument: options.originatingDocument
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
    captureFormat: capturedSource.captureFormat,
    originatingDocument: capturedSource.originatingDocument
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
    captureFormat: capturedMask.captureFormat,
    originatingDocument: capturedMask.originatingDocument
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

  assertCaptureSizeWithinLimit(width, height);

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
    originatingDocument: PhotoshopDocumentIdentity;
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
      captureFormat: encoded.captureFormat,
      originatingDocument: options.originatingDocument
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

  assertCaptureSizeWithinLimit(width, height);

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

export function convertPixelsToRgba(rawPixels: Uint8Array, width: number, height: number, components: number) {
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

// Feather strength is carried in the mask layer's own alpha, not its RGB: the
// captured layer starts fully transparent, then gets filled white through the
// original selection and black through its inverse (captureSelectionMaskSourceImage).
// Painting through a feathered selection onto transparent pixels composites
// paint_alpha = selection strength, so the two complementary fills between them
// cover the full document and leave alpha close to 255 at every pixel Photoshop
// actually painted, including every real feather gradient. Alpha only drops near
// zero for a pixel neither fill touched, which should not happen inside the
// captured context bounds but can if getPixels returns stale or uninitialized
// data at the capture edge. ALPHA_TRUST_THRESHOLD forces those pixels to a
// "do not repaint" 0 instead of trusting whatever luminance happens to be there;
// it is a defensive floor against capture artifacts, not part of the feather math.
const MASK_ALPHA_TRUST_THRESHOLD = 8;

export function convertMaskPixelsToRgba(rawPixels: Uint8Array, width: number, height: number, components: number) {
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
    const maskValue = alpha > MASK_ALPHA_TRUST_THRESHOLD ? luminance : 0;

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
