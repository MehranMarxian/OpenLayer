import { describe, expect, it } from "vitest";
import { acquireModelsFolder, FolderAccessDeps } from "../../src/photoshop/modelFolderAccess";
import {
  createModelsFolderTokenStore,
  GrantStorage,
  LEGACY_MODELS_FOLDER_TOKEN_KEY,
  migrateLegacyModelsFolderToken,
  MODELS_FOLDER_GRANTS_KEY,
  toGrantServerKey
} from "../../src/photoshop/modelsFolderGrants";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  const storage: GrantStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    }
  };

  return { storage, items };
}

function storedGrants(items: Map<string, string>) {
  const raw = items.get(MODELS_FOLDER_GRANTS_KEY);
  return raw ? JSON.parse(raw) : undefined;
}

describe("the server key a grant is filed under", () => {
  it("treats every name for this machine on the same port as one server", () => {
    const spellings = [
      "http://127.0.0.1:8188",
      "http://127.0.0.1:8188/",
      "http://localhost:8188",
      "  HTTP://LocalHost:8188//  ",
      "localhost:8188",
      "127.0.0.1:8188",
      "http://[::1]:8188",
      "http://0.0.0.0:8188",
      "http://127.0.1.1:8188"
    ];

    expect(new Set(spellings.map(toGrantServerKey))).toEqual(new Set(["http://127.0.0.1:8188"]));
  });

  // The case that started this: a second ComfyUI on the same machine.
  it("keeps a different port a different server", () => {
    expect(toGrantServerKey("http://127.0.0.1:8189")).not.toBe(toGrantServerKey("http://127.0.0.1:8188"));
  });

  it("writes the default port out, so leaving it off is the same server", () => {
    expect(toGrantServerKey("http://studio-pc.lan")).toBe("http://studio-pc.lan:80");
    expect(toGrantServerKey("http://studio-pc.lan:80/")).toBe("http://studio-pc.lan:80");
    expect(toGrantServerKey("https://studio-pc.lan")).toBe("https://studio-pc.lan:443");
  });

  it("keeps the scheme and another machine's name apart", () => {
    expect(toGrantServerKey("https://127.0.0.1:8188")).not.toBe(toGrantServerKey("http://127.0.0.1:8188"));
    expect(toGrantServerKey("http://Studio-PC:8188")).toBe("http://studio-pc:8188");
    expect(toGrantServerKey("http://studio-pc:8188")).not.toBe(toGrantServerKey("http://127.0.0.1:8188"));
  });

  it("keeps a reverse-proxy path but drops query, fragment and trailing slashes", () => {
    expect(toGrantServerKey("http://127.0.0.1:8188/comfy/?tab=1#x")).toBe("http://127.0.0.1:8188/comfy");
    expect(toGrantServerKey("http://127.0.0.1:8188/comfy")).not.toBe(toGrantServerKey("http://127.0.0.1:8188"));
  });

  it("keeps an address that will not parse as typed, so it still gets its own grant", () => {
    expect(toGrantServerKey("  http://[not-an-address/ ")).toBe("http://[not-an-address");
    expect(toGrantServerKey("")).toBe("");
    expect(toGrantServerKey("   ")).toBe("");
  });
});

describe("remembering a grant per server", () => {
  it("does not hand one server's folder to another", () => {
    const { storage } = memoryStorage();

    createModelsFolderTokenStore(storage, "http://127.0.0.1:8188").write("token-8188");

    expect(createModelsFolderTokenStore(storage, "http://127.0.0.1:8189").read()).toBeNull();
    expect(createModelsFolderTokenStore(storage, "http://localhost:8188/").read()).toBe("token-8188");
  });

  it("forgets a grant for its own server only", () => {
    const { storage } = memoryStorage();
    createModelsFolderTokenStore(storage, "http://127.0.0.1:8188").write("token-8188");
    createModelsFolderTokenStore(storage, "http://127.0.0.1:8189").write("token-8189");

    createModelsFolderTokenStore(storage, "http://127.0.0.1:8189").write(null);

    expect(createModelsFolderTokenStore(storage, "http://127.0.0.1:8188").read()).toBe("token-8188");
    expect(createModelsFolderTokenStore(storage, "http://127.0.0.1:8189").read()).toBeNull();
  });

  it("removes the storage key once the last grant is forgotten", () => {
    const { storage, items } = memoryStorage();
    const store = createModelsFolderTokenStore(storage, "http://127.0.0.1:8188");

    store.write("token-8188");
    store.write(null);

    expect(items.has(MODELS_FOLDER_GRANTS_KEY)).toBe(false);
  });

  it("treats unreadable stored grants as none, and the next grant rewrites them cleanly", () => {
    const { storage, items } = memoryStorage({ [MODELS_FOLDER_GRANTS_KEY]: "{not json" });
    const store = createModelsFolderTokenStore(storage, "http://127.0.0.1:8188");

    expect(store.read()).toBeNull();

    store.write("token-8188");

    expect(storedGrants(items)).toEqual({ "http://127.0.0.1:8188": "token-8188" });
  });

  it("ignores stored entries that are not tokens", () => {
    const { storage } = memoryStorage({
      [MODELS_FOLDER_GRANTS_KEY]: JSON.stringify({ "http://127.0.0.1:8188": 42, "http://127.0.0.1:8189": "" })
    });

    expect(createModelsFolderTokenStore(storage, "http://127.0.0.1:8188").read()).toBeNull();
    expect(createModelsFolderTokenStore(storage, "http://127.0.0.1:8189").read()).toBeNull();
  });

  it("neither reads nor writes a grant for an empty address", () => {
    const { storage, items } = memoryStorage();
    const store = createModelsFolderTokenStore(storage, "  ");

    store.write("token");

    expect(store.read()).toBeNull();
    expect(items.size).toBe(0);
  });
});

describe("carrying over the old single grant", () => {
  it("files it under the saved server and removes the old key", () => {
    const { storage, items } = memoryStorage({ [LEGACY_MODELS_FOLDER_TOKEN_KEY]: "old-token" });

    expect(migrateLegacyModelsFolderToken(storage, "http://127.0.0.1:8188")).toBe(true);

    expect(items.has(LEGACY_MODELS_FOLDER_TOKEN_KEY)).toBe(false);
    expect(createModelsFolderTokenStore(storage, "http://localhost:8188").read()).toBe("old-token");
    expect(createModelsFolderTokenStore(storage, "http://127.0.0.1:8189").read()).toBeNull();
  });

  it("happens once", () => {
    const { storage, items } = memoryStorage({ [LEGACY_MODELS_FOLDER_TOKEN_KEY]: "old-token" });
    migrateLegacyModelsFolderToken(storage, "http://127.0.0.1:8188");
    const afterFirst = new Map(items);

    expect(migrateLegacyModelsFolderToken(storage, "http://127.0.0.1:8189")).toBe(false);
    expect(items).toEqual(afterFirst);
  });

  it("never replaces a grant already filed for the saved server", () => {
    const { storage, items } = memoryStorage({
      [LEGACY_MODELS_FOLDER_TOKEN_KEY]: "old-token",
      [MODELS_FOLDER_GRANTS_KEY]: JSON.stringify({ "http://127.0.0.1:8188": "new-token" })
    });

    migrateLegacyModelsFolderToken(storage, "http://127.0.0.1:8188");

    expect(createModelsFolderTokenStore(storage, "http://127.0.0.1:8188").read()).toBe("new-token");
    expect(items.has(LEGACY_MODELS_FOLDER_TOKEN_KEY)).toBe(false);
  });

  it("keeps grants for other servers when it files the old one", () => {
    const { storage } = memoryStorage({
      [LEGACY_MODELS_FOLDER_TOKEN_KEY]: "old-token",
      [MODELS_FOLDER_GRANTS_KEY]: JSON.stringify({ "http://127.0.0.1:8189": "token-8189" })
    });

    migrateLegacyModelsFolderToken(storage, "http://127.0.0.1:8188");

    expect(createModelsFolderTokenStore(storage, "http://127.0.0.1:8188").read()).toBe("old-token");
    expect(createModelsFolderTokenStore(storage, "http://127.0.0.1:8189").read()).toBe("token-8189");
  });

  it("touches nothing when there is no old grant", () => {
    const { storage, items } = memoryStorage();

    expect(migrateLegacyModelsFolderToken(storage, "http://127.0.0.1:8188")).toBe(false);
    expect(items.size).toBe(0);
  });
});

// The scenario as the panel runs it: an existing artist with one grant from the
// old build points Settings at a second ComfyUI and presses Download.
describe("acquiring the models folder with per-server grants", () => {
  const folders: Record<string, { name: string }> = {
    "old-token": { name: "models (8188)" },
    "token-for-picked": { name: "models (8189)" }
  };

  function depsFor(storage: GrantStorage, serverUrl: string, picks: unknown[]): FolderAccessDeps {
    const store = createModelsFolderTokenStore(storage, serverUrl);

    return {
      pickFolder: async () => {
        const picked = { name: "models (8189)" };
        picks.push(picked);
        return picked;
      },
      createPersistentToken: async () => "token-for-picked",
      getEntryForPersistentToken: async (token) => folders[token] ?? null,
      readStoredToken: store.read,
      writeStoredToken: store.write,
      canWrite: async () => true
    };
  }

  it("asks for the second server's folder instead of reusing the first one's", async () => {
    const { storage } = memoryStorage({ [LEGACY_MODELS_FOLDER_TOKEN_KEY]: "old-token" });
    migrateLegacyModelsFolderToken(storage, "http://127.0.0.1:8188");
    const picks: unknown[] = [];

    const second = await acquireModelsFolder("models/diffusion_models", depsFor(storage, "http://127.0.0.1:8189", picks), {
      allowPicker: true
    });

    expect(picks).toHaveLength(1);
    expect(second.kind === "ready" && second.folder).toEqual({ name: "models (8189)" });

    // The first server still has its own folder, with no picker.
    const first = await acquireModelsFolder("models/diffusion_models", depsFor(storage, "http://localhost:8188", picks), {
      allowPicker: true
    });

    expect(picks).toHaveLength(1);
    expect(first.kind === "ready" && first.route).toBe("granted");
    expect(first.kind === "ready" && first.folder).toEqual({ name: "models (8188)" });

    // And the second server's grant is remembered for next time.
    const secondAgain = await acquireModelsFolder("models/diffusion_models", depsFor(storage, "http://127.0.0.1:8189/", picks), {
      allowPicker: true
    });

    expect(picks).toHaveLength(1);
    expect(secondAgain.kind === "ready" && secondAgain.route).toBe("granted");
  });
});
