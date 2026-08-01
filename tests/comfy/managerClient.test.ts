import { afterEach, describe, expect, it, vi } from "vitest";
import type { ManagerInstallModelRequest } from "../../src/comfy/assistedInstall";
import {
  isManagerSecurityLevelError,
  ManagerClient,
  MANAGER_SECURITY_LEVEL_ERROR_NAME
} from "../../src/comfy/managerClient";

describe("ManagerClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats a missing Manager version route as a normal unavailable state", async () => {
    const fetchMock = vi.fn(async () => new Response("Not Found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ManagerClient("  http://127.0.0.1:8190///  ");

    await expect(client.getManagerVersion()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8190/manager/version",
      undefined
    );
  });

  it("reads the bare Manager version string", async () => {
    vi.stubGlobal("fetch", async () => new Response("V3.41\n", { status: 200 }));

    await expect(
      new ManagerClient("http://127.0.0.1:8190").getManagerVersion()
    ).resolves.toBe("V3.41");
  });

  it("validates and returns Manager queue status", async () => {
    const status = {
      total_count: 4,
      done_count: 2,
      in_progress_count: 1,
      is_processing: true
    };
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify(status), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    );

    await expect(
      new ManagerClient("http://127.0.0.1:8190").getQueueStatus()
    ).resolves.toEqual(status);
  });

  it("rejects a malformed Manager queue status", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ total_count: "4", is_processing: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    );

    await expect(
      new ManagerClient("http://127.0.0.1:8190").getQueueStatus()
    ).rejects.toMatchObject({
      code: "COMFY_HTTP",
      message: "ComfyUI-Manager returned an invalid queue status."
    });
  });

  it("posts the exact model request body", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const request: ManagerInstallModelRequest = {
      save_path: "diffusion_models",
      base: "Krea-2 Turbo diffusion model",
      filename: "krea2_turbo_fp8_scaled.safetensors",
      url: "https://example.test/krea2_turbo_fp8_scaled.safetensors",
      ui_id: "openlayer:diffusion_models/krea2_turbo_fp8_scaled.safetensors"
    };

    await new ManagerClient("http://127.0.0.1:8190").enqueueModelInstall(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8190/manager/queue/install_model",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      }
    );
  });

  it("maps a 403 to the identifiable security-level error without retrying", async () => {
    const fetchMock = vi.fn(
      async () => new Response("A security error has occurred", { status: 403 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const request: ManagerInstallModelRequest = {
      save_path: "checkpoints",
      base: "Flux checkpoint",
      filename: "flux.safetensors",
      url: "https://example.test/flux.safetensors",
      ui_id: "openlayer:checkpoints/flux.safetensors"
    };

    let caughtError: unknown;

    try {
      await new ManagerClient("http://127.0.0.1:8190").enqueueModelInstall(request);
    } catch (error) {
      caughtError = error;
    }

    expect(isManagerSecurityLevelError(caughtError)).toBe(true);
    expect(caughtError).toMatchObject({
      name: MANAGER_SECURITY_LEVEL_ERROR_NAME,
      code: "COMFY_HTTP",
      technicalDetails: "A security error has occurred"
    });
    expect((caughtError as Error).message).toContain("security_level");
    expect((caughtError as Error).message).toContain("config.ini");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("starts the Manager queue with a bodyless POST", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await new ManagerClient("http://127.0.0.1:8190").startQueue();

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8190/manager/queue/start", {
      method: "POST"
    });
  });
});
