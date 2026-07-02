import {
  OpenLayerLayerMetadata,
  serializeOpenLayerLayerMetadata,
  summarizeOpenLayerLayerMetadata
} from "../metadata/layerMetadata";

export type OpenLayerLayerMetadataWriteResult = {
  supported: boolean;
  status: "written" | "unsupported";
  message: string;
  summary: string;
};

export async function writeOpenLayerLayerMetadata(
  metadata: OpenLayerLayerMetadata,
  onProgress?: (message: string) => void
): Promise<OpenLayerLayerMetadataWriteResult> {
  const summary = summarizeOpenLayerLayerMetadata(metadata);
  const serialized = serializeOpenLayerLayerMetadata(metadata);

  onProgress?.("Checking Photoshop layer metadata support...");

  // Photoshop UXP does not expose a clearly supported, stable public layer
  // metadata writer in every host version. Keep the payload prepared and
  // testable, but do not pretend persistence happened when the host cannot
  // safely attach it to the active layer.
  void serialized;

  return {
    supported: false,
    status: "unsupported",
    summary,
    message: "Photoshop layer metadata persistence is not safely exposed in this UXP environment. OpenLayer kept the metadata in session history."
  };
}
