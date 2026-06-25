export type OpenLayerErrorCode =
  | "COMFY_OFFLINE"
  | "COMFY_HTTP"
  | "COMFY_REJECTED_WORKFLOW"
  | "COMFY_GENERATION_FAILED"
  | "COMFY_TIMEOUT"
  | "COMFY_NO_IMAGE"
  | "COMFY_UPLOAD_FAILED"
  | "COMFY_SETUP_MISSING"
  | "COMFY_CHECKPOINTS_EMPTY"
  | "WORKFLOW_PRESET_UNSUPPORTED"
  | "WORKFLOW_INVALID"
  | "WORKFLOW_FILE_MISSING"
  | "SETTINGS_INVALID"
  | "PROMPT_REQUIRED"
  | "CHECKPOINT_REQUIRED"
  | "CHECKPOINT_UNSUPPORTED"
  | "PHOTOSHOP_NO_DOCUMENT"
  | "PHOTOSHOP_NO_SELECTION"
  | "PHOTOSHOP_EXPORT_FAILED"
  | "PHOTOSHOP_IMPORT_FAILED"
  | "UNKNOWN";

export class OpenLayerError extends Error {
  readonly code: OpenLayerErrorCode;
  readonly technicalDetails?: string;

  constructor(code: OpenLayerErrorCode, message: string, technicalDetails?: string) {
    super(message);
    this.name = "OpenLayerError";
    this.code = code;
    this.technicalDetails = technicalDetails;
  }
}

export function createOpenLayerError(
  code: OpenLayerErrorCode,
  message: string,
  technicalDetails?: string
) {
  return new OpenLayerError(code, message, technicalDetails);
}

export function getErrorMessage(error: unknown) {
  if (error instanceof OpenLayerError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unknown error occurred.";
}

export function getTechnicalErrorDetails(error: unknown) {
  if (error instanceof OpenLayerError) {
    return error.technicalDetails ?? error.message;
  }

  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "No technical details available.";
  }
}

export function getNestedErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
