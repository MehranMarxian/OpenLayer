import { describe, expect, it } from "vitest";
import {
  createComfyInterruptRequest,
  createGenerationCancelledError,
  formatCancelDiagnostic,
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
});
