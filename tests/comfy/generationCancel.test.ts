import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createComfyInterruptRequest,
  decideCancelAction,
  createComfyQueueDeleteRequest,
  createGenerationCancelledError,
  formatCancelDiagnostic,
  formatCancelResultDiagnostic,
  isGenerationCancelledError
} from "../../src/comfy/generationCancel";

describe("generationCancel", () => {
  it("creates a targeted interrupt that always names the prompt", () => {
    const request = createComfyInterruptRequest("http://127.0.0.1:8190/", "abc-123");

    expect(request.url).toBe("http://127.0.0.1:8190/interrupt");
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(request.init.body))).toEqual({ prompt_id: "abc-123" });
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

  it("formats a plain sentence for every cancel result", () => {
    for (const result of ["dequeued", "interrupted", "not-active", "unconfirmed", "not-submitted"] as const) {
      const text = formatCancelResultDiagnostic(result, "abc-123");

      // Panel status strings render through textContent.
      expect(text).not.toMatch(/`|--/);
      expect(text.length).toBeGreaterThan(formatCancelDiagnostic("abc-123").length);
    }
  });
});

describe("decideCancelAction", () => {
  const entry = (id: string) => [7, id, {}, {}, []];

  it("dequeues our prompt while it is waiting", () => {
    expect(decideCancelAction({ queue_running: [entry("other")], queue_pending: [entry("ours")] }, "ours")).toBe(
      "dequeue"
    );
  });

  it("interrupts only when our prompt is the one running", () => {
    expect(decideCancelAction({ queue_running: [entry("ours")], queue_pending: [] }, "ours")).toBe("interrupt");
  });

  it("sends nothing when someone else is running and ours has finished", () => {
    expect(decideCancelAction({ queue_running: [entry("other")], queue_pending: [entry("third")] }, "ours")).toBe(
      "none"
    );
  });

  it("sends nothing when the queue could not be read", () => {
    expect(decideCancelAction(null, "ours")).toBe("none");
  });

  it("does not match a prompt id that only appears inside another prompt's data", () => {
    const lookalike = [7, "other", { note: "ours" }, {}, []];

    expect(decideCancelAction({ queue_running: [lookalike], queue_pending: [] }, "ours")).toBe("none");
  });
});

describe("no global interrupt anywhere in the plugin", () => {
  function listSourceFiles(directory: string): string[] {
    return readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? listSourceFiles(path) : /\.(ts|js)$/.test(name) ? [path] : [];
    });
  }

  it("builds every /interrupt request through the targeted helper", () => {
    const offenders = listSourceFiles("src")
      .filter((path) => !path.replace(/\\/g, "/").endsWith("src/comfy/generationCancel.ts"))
      // A string literal holding the path, which is what a request needs. Prose
      // in comments may mention the endpoint.
      .filter((path) => /["'`][^"'`\n]*\/interrupt/.test(readFileSync(path, "utf8")));

    expect(offenders).toEqual([]);
  });
});
