import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMFY_ONLINE_NO_CHECKPOINTS_STATUS,
  COMFY_ONLINE_STATUS,
  getComfyFoundStatus,
  getComfyOnlineStatus,
  getNoCheckpointsDiagnostics,
  NO_CHECKPOINTS_NOTE
} from "../../src/ui/comfyCheckStatus";

// The panel's status bar is one line and clipped "...No checkpoints in" in
// Photoshop 2025, so every status this module returns must fit it.
const STATUS_BAR_CHARS = 48;

describe("getComfyOnlineStatus", () => {
  it("keeps the usual line when ComfyUI lists checkpoints", () => {
    expect(getComfyOnlineStatus(3)).toBe("ComfyUI is online. Models loaded.");
  });

  it("still reports ComfyUI online when models/checkpoints is empty, in a line that fits the bar", () => {
    const status = getComfyOnlineStatus(0);

    expect(status).toBe(COMFY_ONLINE_NO_CHECKPOINTS_STATUS);
    expect(status.startsWith("ComfyUI is online.")).toBe(true);
    expect(status).not.toMatch(/failed/i);
    expect(status.length).toBeLessThanOrEqual(STATUS_BAR_CHARS);
    expect(COMFY_ONLINE_STATUS.length).toBeLessThanOrEqual(STATUS_BAR_CHARS);
  });

  it("puts the explanation on the diagnostics line, and only when there are no checkpoints", () => {
    expect(getNoCheckpointsDiagnostics(0)).toBe(NO_CHECKPOINTS_NOTE);
    expect(getNoCheckpointsDiagnostics(2)).toBeNull();
  });
});

describe("getComfyFoundStatus", () => {
  it("names the server and nothing else, so it fits the bar", () => {
    expect(getComfyFoundStatus("http://127.0.0.1:8189", 1)).toBe("Found ComfyUI at http://127.0.0.1:8189.");
    expect(getComfyFoundStatus("http://127.0.0.1:8189", 0)).toBe("Found ComfyUI at http://127.0.0.1:8189.");
  });
});

describe("no-checkpoints note", () => {
  it("is plain text for textContent", () => {
    expect(NO_CHECKPOINTS_NOTE).not.toMatch(/[`*_#]|--/);
  });
});

describe("App.ts checkpoint loading", () => {
  // loadCheckpoints lives in the renderApp module, which needs the UXP host to
  // import, so its contract is checked against the source: an empty list must
  // never throw again, or a Klein-only install fails Check ComfyUI.
  const app = readFileSync(new URL("../../src/ui/App.ts", import.meta.url), "utf8");
  const body = app.slice(app.indexOf("async function loadCheckpoints("), app.indexOf("async function refreshTextModelOptionsForSelectedPreset("));

  it("does not throw when ComfyUI lists no checkpoints", () => {
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toMatch(/throw\b/);
    expect(app).not.toContain("No ComfyUI checkpoints were found.");
  });
});
