import { describe, expect, it, vi } from "vitest";
import {
  acquireModelsFolder,
  describeFolderMismatch,
  FolderAccessDeps
} from "../../src/photoshop/modelFolderAccess";

function deps(overrides: Partial<FolderAccessDeps> = {}): FolderAccessDeps {
  let stored: string | null = null;

  return {
    readStoredToken: () => stored,
    writeStoredToken: (token) => {
      stored = token;
    },
    canWrite: async () => true,
    ...overrides
  };
}

describe("acquiring the models folder", () => {
  it("uses the quiet direct route when it both resolves and is writable", async () => {
    const result = await acquireModelsFolder("C:/comfy/models/loras", deps({
      getEntryWithUrl: async () => ({ name: "loras" })
    }));

    expect(result.kind).toBe("ready");
    expect(result.kind === "ready" && result.route).toBe("direct");
  });

  it("normalises Windows separators into the file: URL UXP wants", async () => {
    const seen: string[] = [];

    await acquireModelsFolder("C:\\comfy\\models\\loras", deps({
      getEntryWithUrl: async (url) => {
        seen.push(url);
        return { name: "loras" };
      }
    }));

    expect(seen).toEqual(["file:C:/comfy/models/loras"]);
  });

  // This is the exact split the spike found: the path resolved, the write did
  // not. Resolving must never be mistaken for access.
  it("does not accept a folder that resolves but cannot be written to", async () => {
    const result = await acquireModelsFolder("C:/comfy/models/loras", deps({
      getEntryWithUrl: async () => ({ name: "loras" }),
      canWrite: async () => false
    }));

    expect(result.kind).toBe("needs-grant");
  });

  it("asks for a grant rather than opening a picker unprompted", async () => {
    const pickFolder = vi.fn();

    const result = await acquireModelsFolder("C:/comfy/models/loras", deps({
      getEntryWithUrl: async () => null,
      pickFolder
    }));

    expect(result.kind).toBe("needs-grant");
    expect(pickFolder).not.toHaveBeenCalled();
  });

  it("opens the picker and remembers the choice when asked to", async () => {
    let stored: string | null = null;
    const result = await acquireModelsFolder("C:/comfy/models/loras", {
      readStoredToken: () => stored,
      writeStoredToken: (token) => {
        stored = token;
      },
      canWrite: async () => true,
      getEntryWithUrl: async () => null,
      pickFolder: async () => ({ name: "picked" }),
      createPersistentToken: async () => "token-123"
    }, { allowPicker: true });

    expect(result.kind === "ready" && result.route).toBe("granted");
    expect(stored).toBe("token-123");
  });

  it("prefers a remembered folder over the direct route, with no dialog", async () => {
    const getEntryWithUrl = vi.fn();

    const result = await acquireModelsFolder("C:/comfy/models/loras", {
      readStoredToken: () => "token-123",
      writeStoredToken: () => undefined,
      canWrite: async () => true,
      getEntryWithUrl,
      getEntryForPersistentToken: async () => ({ name: "remembered" })
    });

    expect(result.kind === "ready" && result.route).toBe("granted");
    expect(getEntryWithUrl).not.toHaveBeenCalled();
  });

  // Adobe documents that persistent tokens can stop working. A stale token must
  // read as "ask again", never as a hard failure.
  it("forgets a token that no longer resolves and falls back", async () => {
    let stored: string | null = "stale";

    const result = await acquireModelsFolder("C:/comfy/models/loras", {
      readStoredToken: () => stored,
      writeStoredToken: (token) => {
        stored = token;
      },
      canWrite: async () => true,
      getEntryForPersistentToken: async () => {
        throw new Error("token no longer valid");
      },
      getEntryWithUrl: async () => ({ name: "loras" })
    });

    expect(stored).toBeNull();
    expect(result.kind === "ready" && result.route).toBe("direct");
  });

  it("forgets a token that resolves to something no longer writable", async () => {
    let stored: string | null = "stale";

    await acquireModelsFolder("C:/comfy/models/loras", {
      readStoredToken: () => stored,
      writeStoredToken: (token) => {
        stored = token;
      },
      canWrite: async (folder) => (folder as { name: string }).name !== "moved",
      getEntryForPersistentToken: async () => ({ name: "moved" }),
      getEntryWithUrl: async () => ({ name: "loras" })
    });

    expect(stored).toBeNull();
  });

  it("treats a cancelled picker as a non-event, not a failure", async () => {
    const result = await acquireModelsFolder("C:/comfy/models/loras", deps({
      getEntryWithUrl: async () => null,
      pickFolder: async () => null
    }), { allowPicker: true });

    expect(result.kind).toBe("needs-grant");
    expect(result.note).toContain("nothing was downloaded");
  });

  it("rejects a granted folder that cannot be written to", async () => {
    const result = await acquireModelsFolder("C:/comfy/models/loras", deps({
      getEntryWithUrl: async () => null,
      pickFolder: async () => ({ name: "read-only" }),
      canWrite: async () => false
    }), { allowPicker: true });

    expect(result.kind).toBe("failed");
    expect(result.note).toContain("cannot be written to");
  });

  // Remembering is an optimisation; failing to remember must not block a
  // download that otherwise works.
  it("still proceeds when the folder cannot be remembered", async () => {
    const result = await acquireModelsFolder("C:/comfy/models/loras", deps({
      getEntryWithUrl: async () => null,
      pickFolder: async () => ({ name: "picked" }),
      createPersistentToken: async () => {
        throw new Error("tokens unavailable");
      }
    }), { allowPicker: true });

    expect(result.kind).toBe("ready");
  });

  it("reports a build with no picker at all rather than hanging", async () => {
    const result = await acquireModelsFolder("C:/comfy/models/loras", deps({
      getEntryWithUrl: async () => null
    }), { allowPicker: true });

    expect(result.kind).toBe("failed");
    expect(result.note).toContain("cannot show a folder picker");
  });
});

describe("folder mismatch warning", () => {
  it("stays quiet when the folder matches what ComfyUI expects", () => {
    expect(describeFolderMismatch("C:/comfy/models/loras", "loras")).toBeNull();
    expect(describeFolderMismatch("C:\\comfy\\models\\Loras\\", "loras")).toBeNull();
  });

  // Warn rather than refuse: extra_model_paths.yaml can make an unexpected
  // folder correct, and we cannot see it from here.
  it("warns without refusing when the folder looks wrong", () => {
    const warning = describeFolderMismatch("C:/comfy/models/checkpoints", "loras");

    expect(warning).toContain("loras");
    expect(warning).toContain("extra_model_paths.yaml");
  });
});
