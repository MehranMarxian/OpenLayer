import { describe, expect, it } from "vitest";
import {
  createComfyInterruptRequest,
  createComfyQueueDeleteRequest,
  createGenerationCancelledError,
  formatCancelDiagnostic,
  formatCancelResultDiagnostic,
  isGenerationCancelledError
} from "../../src/comfy/generationCancel";

describe("generationCancel", () => {
  it("creates a ComfyUI interrupt request from the active server URL", () => {
    const request = createComfyInterruptRequest("http://127.0.0.1:8190/");

    expect(request.url).toBe("http://127.0.0.1:8190/interrupt");
    expect(request.init.method).toBe("POST");
  });

  it("identifies OpenLayer generation cancellation errors", () => {
    const error = createGenerationCancelledError();

    expect(isGenerationCancelledError(error)).toBe(true);
    expect(isGenerationCancelledError(new Error("cancelled"))).toBe(false);
  });

  it("formats prompt-aware cancellation diagnostics", () => {
    expect(formatCancelDiagnostic("abc-123")).toContain("abc-123");
    expect(formatCancelDiagnostic()).toContain("before ComfyUI returned");
  });

  it("creates a ComfyUI queue delete request for a pending prompt", () => {
    const request = createComfyQueueDeleteRequest("http://127.0.0.1:8190/", "abc-123");

    expect(request.url).toBe("http://127.0.0.1:8190/queue");
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(request.init.body))).toEqual({ delete: ["abc-123"] });
  });

  it("formats cancel result diagnostics for dequeued and interrupted prompts", () => {
    const dequeued = formatCancelResultDiagnostic("dequeued", "abc-123");
    const interrupted = formatCancelResultDiagnostic("interrupted", "abc-123");

    expect(dequeued).toContain("abc-123");
    expect(dequeued).toContain("removed from the ComfyUI queue");
    expect(interrupted).toContain("abc-123");
    expect(interrupted).toContain("interrupted the running prompt");
  });
});
