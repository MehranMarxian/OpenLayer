// Which ComfyUI a remembered models-folder grant belongs to.
//
// The first version remembered ONE granted folder for every server. Pointing the
// panel at a second ComfyUI (a second install, a moved one, a test copy on 8189)
// then had Setup check the new server while every download, the Start here card
// included, went into the old ComfyUI's models folder. The new server still
// reported the files missing, and nothing said why.
//
// So a grant is remembered per server address, and a server with no grant of
// its own gets the picker. The one token the old build stored is carried over
// once, as the grant for the server saved in preferences, so existing artists
// are not asked to choose the folder again.
//
// Storage is passed in rather than read from localStorage here, so the rules
// are testable and App.ts only supplies the host calls.

/** The single key the first version stored its token under. Read once, then removed. */
export const LEGACY_MODELS_FOLDER_TOKEN_KEY = "openlayer.modelsFolderToken";

/** A JSON object mapping a server key (see `toGrantServerKey`) to its token. */
export const MODELS_FOLDER_GRANTS_KEY = "openlayer.modelsFolderGrants.v1";

export type GrantStorage = Readonly<{
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}>;

export type ModelsFolderTokenStore = Readonly<{
  read: () => string | null;
  write: (token: string | null) => void;
}>;

// Names for this machine. `localhost` and `127.0.0.1` on the same port are the
// same ComfyUI writing to the same folder, so they share a grant. 0.0.0.0 is
// in the list because ComfyUI started with --listen prints it as the address,
// and artists copy that line into Settings.
const LOOPBACK_HOSTS = new Set(["localhost", "[::1]", "0.0.0.0"]);
const LOOPBACK_KEY_HOST = "127.0.0.1";
const DEFAULT_PORTS: Readonly<Record<string, string>> = { "http:": "80", "https:": "443" };

/**
 * Reduces a server URL to the part that decides which ComfyUI it is: scheme,
 * host and port, plus any path a reverse proxy mounts it under. Every name for
 * this machine becomes 127.0.0.1, the port is always written out, and trailing
 * slashes, query and fragment are dropped. An address that will not parse is
 * kept as typed, trimmed and lower-cased, so it still gets a grant of its own.
 */
export function toGrantServerKey(serverUrl: string): string {
  const trimmed = serverUrl.trim();

  if (!trimmed) {
    return "";
  }

  // "127.0.0.1:8188" with no scheme is what people type, and URL would read
  // the "localhost:" in "localhost:8188" as the scheme.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  let parsed: URL;

  try {
    parsed = new URL(withScheme);
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }

  const host = isLoopbackHost(parsed.hostname) ? LOOPBACK_KEY_HOST : parsed.hostname.toLowerCase();
  const port = parsed.port || DEFAULT_PORTS[parsed.protocol] || "";
  const path = parsed.pathname.replace(/\/+$/, "");

  return `${parsed.protocol}//${host}${port ? `:${port}` : ""}${path}`;
}

function isLoopbackHost(hostname: string) {
  const host = hostname.toLowerCase();
  return LOOPBACK_HOSTS.has(host) || /^127(\.\d{1,3}){3}$/.test(host);
}

/**
 * Files the old single token under the server saved in preferences, then
 * removes it. Returns whether there was one to move.
 *
 * Run once when the panel starts, before the artist can change the address.
 * Filing it lazily, at the first download, would put it under whatever server
 * Settings points at by then, and an artist who had just switched to a second
 * ComfyUI would get the old folder for it: the very bug this module fixes.
 */
export function migrateLegacyModelsFolderToken(storage: GrantStorage, savedServerUrl: string): boolean {
  const legacyToken = storage.getItem(LEGACY_MODELS_FOLDER_TOKEN_KEY);

  if (legacyToken === null) {
    return false;
  }

  const grants = loadGrants(storage);
  const savedKey = toGrantServerKey(savedServerUrl);

  // A grant already filed under the new key is never replaced by the old one.
  // Both only exist together after going back to an older build and forward
  // again, and the new key is the one this build has been keeping current.
  if (legacyToken && savedKey && !hasGrant(grants, savedKey)) {
    grants[savedKey] = legacyToken;
    saveGrants(storage, grants);
  }

  storage.removeItem(LEGACY_MODELS_FOLDER_TOKEN_KEY);
  return true;
}

/**
 * The token store `acquireModelsFolder` reads and writes, scoped to the server
 * Setup is checking. Forgetting a grant forgets it for that server only.
 */
export function createModelsFolderTokenStore(storage: GrantStorage, serverUrl: string): ModelsFolderTokenStore {
  const serverKey = toGrantServerKey(serverUrl);

  return {
    read: () => {
      const grants = loadGrants(storage);
      return serverKey && hasGrant(grants, serverKey) ? grants[serverKey] : null;
    },
    write: (token) => {
      if (!serverKey) {
        return;
      }

      const grants = loadGrants(storage);

      if (token === null) delete grants[serverKey];
      else grants[serverKey] = token;

      saveGrants(storage, grants);
    }
  };
}

function hasGrant(grants: Record<string, string>, serverKey: string) {
  return Object.prototype.hasOwnProperty.call(grants, serverKey);
}

function loadGrants(storage: GrantStorage): Record<string, string> {
  const raw = storage.getItem(MODELS_FOLDER_GRANTS_KEY);

  if (!raw) {
    return {};
  }

  try {
    const value: unknown = JSON.parse(raw);

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const grants: Record<string, string> = {};

    for (const [key, token] of Object.entries(value as Record<string, unknown>)) {
      if (key && typeof token === "string" && token) {
        grants[key] = token;
      }
    }

    return grants;
  } catch {
    // Unreadable means no grants: the cost is one picker, and the next grant
    // rewrites the key cleanly.
    return {};
  }
}

function saveGrants(storage: GrantStorage, grants: Record<string, string>) {
  if (Object.keys(grants).length === 0) storage.removeItem(MODELS_FOLDER_GRANTS_KEY);
  else storage.setItem(MODELS_FOLDER_GRANTS_KEY, JSON.stringify(grants));
}
