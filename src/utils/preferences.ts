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
