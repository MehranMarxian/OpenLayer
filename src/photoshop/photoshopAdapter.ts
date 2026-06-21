import { createLayerName, saveBlobToTemporaryFile } from "../utils/fileUtils";
import { getErrorMessage } from "../utils/errors";

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

export async function importGeneratedImageAsLayer(blob: Blob, layerName = createLayerName("OpenLayer_Generated")) {
  const photoshop = getPhotoshop();
  getActiveDocument();

  try {
    const file = await saveBlobToTemporaryFile(blob, `${layerName}.png`);
    const uxp = getUxp();
    const token = await uxp.storage.localFileSystem.createSessionToken(file);

    await photoshop.core.executeAsModal(
      async () => {
        await photoshop.action.batchPlay(
          [
            {
              _obj: "placeEvent",
              null: {
                _path: token,
                _kind: "local"
              },
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
            }
          ],
          {}
        );

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
      },
      { commandName: "Import OpenLayer Result" }
    );
  } catch (caughtError) {
    throw new Error(`Could not import the generated image as a Photoshop layer. ${getErrorMessage(caughtError)}`);
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
    throw new Error("No Photoshop document is open. Open a document before importing a result.");
  }

  return document;
}

function getPhotoshop(): PhotoshopModule {
  return require("photoshop") as PhotoshopModule;
}

function getUxp(): UxpModule {
  return require("uxp") as UxpModule;
}
