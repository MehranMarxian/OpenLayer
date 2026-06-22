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
};

type PhotoshopDocument = {
  title?: string;
  name?: string;
  width?: number;
  height?: number;
  activeLayers?: PhotoshopLayer[];
};

type PhotoshopLayer = {
  name?: string;
};

type ImportProgress = (message: string) => void;

type BatchPlayCommand = Record<string, unknown>;

export type ActiveDocumentInfo = {
  name: string;
  width: number;
  height: number;
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

export async function exportActiveLayerAsPNG(): Promise<Blob> {
  // TODO(v0.2): Export the selected Photoshop layer to a PNG for image-to-image workflows.
  throw new Error("exportActiveLayerAsPNG is planned for a future OpenLayer version.");
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

function getPhotoshop(): PhotoshopModule {
  return require("photoshop") as PhotoshopModule;
}

function getUxp(): UxpModule {
  return require("uxp") as UxpModule;
}
