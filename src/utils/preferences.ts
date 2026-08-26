/**
 * Panel themes, in the order they are offered in Settings.
 *
 * "artist" is not a standalone stylesheet: it renders as the compact theme
 * with a set of token overrides on top, so it inherits every compact layout
 * rule. See applyTheme in App.ts for the class stacking that makes that work.
 */
export const OPEN_LAYER_THEMES = ["compact", "artist", "classic"] as const;

export type OpenLayerTheme = (typeof OPEN_LAYER_THEMES)[number];

/** Coerces untrusted input (stored prefs, a select value) to a known theme. */
export function normalizeTheme(value: unknown): OpenLayerTheme {
  return OPEN_LAYER_THEMES.includes(value as OpenLayerTheme)
    ? (value as OpenLayerTheme)
    : "compact";
}

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

/**
 * Persists only `serverUrl`, merged into whatever is already stored, rather
 * than the full-object overwrite `saveOpenLayerPreferences` does.
 *
 * The welcome screen calls this before the rest of the panel has necessarily
 * loaded saved generation defaults into their form fields. A full-object save
 * built from `AppElements` at that point would write the DOM's static markup
 * defaults for width/height/steps/etc. over whatever the user actually had
 * saved — this exists so detecting ComfyUI on first run can't silently erase
 * unrelated settings.
 */
export function saveServerUrlPreference(serverUrl: string): boolean {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    const rawValue = storage.getItem(STORAGE_KEY);
    const existing = rawValue ? sanitizePreferences(JSON.parse(rawValue)) : {};

    storage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, serverUrl }));
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

/**
 * Agent Bridge settings, stored apart from `OpenLayerPreferences`.
 *
 * That object is the Text to Image form's saved state — it is written by Save
 * Settings and cleared by Reset Settings, both of which are about generation
 * defaults. Whether an external process may drive the panel is not a generation
 * default, and someone resetting their prompt settings should not silently be
 * opening or closing a socket.
 *
 * `enabled` defaults to false and every read path must preserve that: an absent
 * or corrupt value means off. This is the only preference in the plugin where
 * the failure direction matters, so it is spelled out rather than implied.
 */
export type AgentBridgeSettings = {
  enabled: boolean;
  port: number;
};

export const DEFAULT_AGENT_BRIDGE_PORT = 8199;

const AGENT_BRIDGE_KEY = "openlayer.agentBridge.v1";

export function loadAgentBridgeSettings(): AgentBridgeSettings {
  const fallback: AgentBridgeSettings = { enabled: false, port: DEFAULT_AGENT_BRIDGE_PORT };
  const storage = getStorage();

  if (!storage) {
    return fallback;
  }

  try {
    const rawValue = storage.getItem(AGENT_BRIDGE_KEY);

    if (!rawValue) {
      return fallback;
    }

    const parsed = JSON.parse(rawValue) as Record<string, unknown>;

    return {
      // Strict equality, not truthiness: anything that is not exactly `true`
      // leaves the bridge off.
      enabled: parsed.enabled === true,
      port: readPort(parsed.port)
    };
  } catch {
    return fallback;
  }
}

export function saveAgentBridgeSettings(settings: AgentBridgeSettings) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(
      AGENT_BRIDGE_KEY,
      JSON.stringify({ enabled: settings.enabled === true, port: readPort(settings.port) })
    );

    return true;
  } catch {
    return false;
  }
}

function readPort(value: unknown): number {
  const port = Number(value);

  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : DEFAULT_AGENT_BRIDGE_PORT;
}

/**
 * Which "Advanced settings" disclosures the user last left open, stored apart
 * from `OpenLayerPreferences` for the same reason as the preview panel pin:
 * this is not a form field, and Reset Settings should not silently re-collapse
 * a screen the user chose to leave expanded.
 *
 * Keyed by each settings grid's own `aria-label` (e.g. "Generation settings"),
 * which is already unique per screen and needs no new DOM attribute. The
 * value is a plain array rather than a Set because JSON has no Set type;
 * bindAdvancedToggles is the only reader and turns it into a Set on load.
 */
const ADVANCED_SECTIONS_KEY = "openlayer.advancedSections.v1";

export function loadOpenAdvancedSections(): string[] {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(ADVANCED_SECTIONS_KEY);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function saveOpenAdvancedSections(keys: readonly string[]) {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(ADVANCED_SECTIONS_KEY, JSON.stringify(Array.from(new Set(keys))));
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the first-run welcome screen has already been shown, stored apart
 * from `OpenLayerPreferences` for the same reason as the preview panel pin
 * and the advanced-sections set: it is not a form field, and Reset Settings
 * should not bring the welcome screen back for someone who has already
 * connected once.
 *
 * A missing or corrupt value means "not seen" — the failure direction
 * matters here (same as `AgentBridgeSettings.enabled`): a storage read that
 * fails should show the welcome screen again, not skip it silently for
 * someone who never actually saw it.
 */
const WELCOME_SEEN_KEY = "openlayer.welcomeSeen.v1";

export function loadHasSeenWelcome(): boolean {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    return storage.getItem(WELCOME_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveHasSeenWelcome() {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(WELCOME_SEEN_KEY, "true");
    return true;
  } catch {
    return false;
  }
}

/**
 * A prompt the artist chose to keep, in the Prompt Wallet.
 *
 * Positive and negative are stored together because they are one thought --
 * a negative prompt is tuned against the positive it accompanies, and
 * recalling one without the other loses half the work. This is the main thing
 * the panel can do that a clipboard-based prompt manager cannot.
 *
 * `pinned` floats an entry to the top of the list regardless of age.
 */
export type PromptWalletEntry = {
  id: string;
  name: string;
  positivePrompt: string;
  negativePrompt: string;
  pinned: boolean;
  createdAt: string;
};

const PROMPT_WALLET_KEY = "openlayer.promptWallet.v1";

/**
 * Not crypto.randomUUID(): this project has hit enough missing web APIs in
 * UXP (no TextEncoder, FormData dropping filenames) to not assume a newer
 * crypto method exists in the host. An id only has to be unique inside one
 * artist's local storage.
 */
export function createPromptWalletId(): string {
  return `wallet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadPromptWallet(): PromptWalletEntry[] {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(PROMPT_WALLET_KEY);

    if (!rawValue) {
      return [];
    }

    const parsed: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(sanitizePromptWalletEntry)
      .filter((entry): entry is PromptWalletEntry => entry !== null);
  } catch {
    return [];
  }
}

export function savePromptWallet(entries: readonly PromptWalletEntry[]): boolean {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(PROMPT_WALLET_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

/**
 * Drops anything that is not a usable entry rather than trusting stored JSON.
 * An entry with no positive prompt is not worth recalling, so it counts as
 * corrupt too -- that is the one field the whole feature exists to carry.
 */
function sanitizePromptWalletEntry(value: unknown): PromptWalletEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const id = typeof entry.id === "string" ? entry.id : "";
  const positivePrompt = typeof entry.positivePrompt === "string" ? entry.positivePrompt : "";

  if (!id || !positivePrompt) {
    return null;
  }

  return {
    id,
    name: typeof entry.name === "string" && entry.name ? entry.name : positivePrompt.slice(0, 40),
    positivePrompt,
    negativePrompt: typeof entry.negativePrompt === "string" ? entry.negativePrompt : "",
    pinned: entry.pinned === true,
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString()
  };
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
  return normalizeTheme(value);
}
