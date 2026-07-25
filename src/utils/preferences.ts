export type OpenLayerTheme = "compact" | "classic";

export type OpenLayerPreferences = {
  serverUrl: string;
  workflow: string;
  checkpointName: string;
  width: string;
  height: string;
  steps: string;
  cfg: string;
  seed: string;
  theme: OpenLayerTheme;
};

const STORAGE_KEY = "openlayer.preferences.v1";

export function loadOpenLayerPreferences(): Partial<OpenLayerPreferences> {
  const storage = getStorage();

  if (!storage) {
    return {};
  }

  try {
    const rawValue = storage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    return sanitizePreferences(JSON.parse(rawValue));
  } catch {
    return {};
  }
}

export function saveOpenLayerPreferences(preferences: OpenLayerPreferences) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function clearOpenLayerPreferences() {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * The preview panel's pinned tool, stored under its own key rather than inside
 * OpenLayerPreferences.
 *
 * Two reasons to keep it separate. OpenLayerPreferences is written wholesale
 * from the settings form and sanitised against it, so a field no form control
 * owns would be a standing invitation to clobber; and the preview panel is a
 * different entrypoint that may render with no settings screen ever having been
 * opened. Both panels share one JavaScript context, so plain localStorage
 * reaches it either way.
 *
 * The value is an opaque string here — this module has no business knowing
 * which tools exist. The panel validates it against the tool list on read.
 */
const PREVIEW_PANEL_PIN_KEY = "openlayer.previewPanel.pin.v1";

export function loadPreviewPanelPin(): string {
  const storage = getStorage();

  if (!storage) {
    return "";
  }

  try {
    return storage.getItem(PREVIEW_PANEL_PIN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePreviewPanelPin(toolId: string) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    if (toolId) {
      storage.setItem(PREVIEW_PANEL_PIN_KEY, toolId);
    } else {
      storage.removeItem(PREVIEW_PANEL_PIN_KEY);
    }

    return true;
  } catch {
    return false;
  }
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function sanitizePreferences(value: unknown): Partial<OpenLayerPreferences> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const input = value as Record<string, unknown>;

  return {
    serverUrl: readString(input.serverUrl),
    workflow: readString(input.workflow),
    checkpointName: readString(input.checkpointName),
    width: readString(input.width),
    height: readString(input.height),
    steps: readString(input.steps),
    cfg: readString(input.cfg),
    seed: readString(input.seed),
    theme: readTheme(input.theme)
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readTheme(value: unknown): OpenLayerTheme {
  return value === "classic" ? "classic" : "compact";
}
