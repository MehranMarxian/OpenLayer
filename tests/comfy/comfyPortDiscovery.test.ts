import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findActiveComfyUrl } from "../../src/comfy/comfyPortDiscovery";
import { COMFY_PORT_CANDIDATES } from "../../src/ui/appConstants";

/**
 * Comfy Desktop, the install ComfyUI recommends to newcomers, listens on 8000.
 * The scan did not check it, so the people least able to type a port into
 * Settings were the ones it could not find (beta gate G2).
 */
describe("findActiveComfyUrl", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    (globalThis as { window?: unknown }).window = globalThis;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  function serveComfyOn(port: number) {
    const fetchMock = vi.fn(async (url: string) => {
      const answers = url === `http://127.0.0.1:${port}/system_stats`;
      return { ok: answers } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("finds a Comfy Desktop server on port 8000", async () => {
    serveComfyOn(8000);

    await expect(findActiveComfyUrl("http://127.0.0.1:8188", () => undefined)).resolves.toBe("http://127.0.0.1:8000");
  });

  it("checks 8000 right after the configured URL and 8188", async () => {
    const fetchMock = serveComfyOn(8000);

    await findActiveComfyUrl("http://127.0.0.1:8188", () => undefined);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:8188/system_stats",
      "http://127.0.0.1:8000/system_stats"
    ]);
  });

  it("still prefers 8188 when both answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true }) as Response));

    await expect(findActiveComfyUrl("", () => undefined)).resolves.toBe("http://127.0.0.1:8188");
  });

  it("does not take a non-ComfyUI server on 8000 for ComfyUI", async () => {
    // Another local dev server answers its own routes but not /system_stats.
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));

    await expect(findActiveComfyUrl("", () => undefined)).resolves.toBe("");
  });

  it("keeps every port it scanned before", () => {
    expect(COMFY_PORT_CANDIDATES).toEqual(expect.arrayContaining([8188, 8190, 8189, 8191, 8192, 8193, 7860, 8000]));
    expect(new Set(COMFY_PORT_CANDIDATES).size).toBe(COMFY_PORT_CANDIDATES.length);
  });
});
