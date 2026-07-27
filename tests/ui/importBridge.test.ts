import { describe, expect, it, vi } from "vitest";
import {
  createImportBridge,
  IMPORT_TARGETS,
  resolveImportAffordance
} from "../../src/ui/importBridge";
import { PREVIEW_TOOLS, PreviewPublication, PreviewToolId } from "../../src/ui/previewHub";

const publication = (toolId: PreviewToolId, kind: PreviewPublication["kind"] = "result"): PreviewPublication => ({
  toolId,
  kind,
  blob: new Blob(["x"])
});

describe("IMPORT_TARGETS", () => {
  it("covers every tool that can publish a preview", () => {
    // The panel indexes this by the displayed publication's toolId, so a tool
    // added to PREVIEW_TOOLS without an entry here would render an undefined
    // label. Freezing the pairing is cheaper than a runtime fallback.
    expect(Object.keys(IMPORT_TARGETS).sort()).toEqual(PREVIEW_TOOLS.map((tool) => tool.id).sort());
  });

  it("claims auto-import only for the tools that have the flag", () => {
    // Text to Image, Image to Image, Upscale and Live Painting have an
    // auto-import flag in renderApp; Sketch, Inpaint and Outpaint have none, in
    // the dashboard either. If someone adds a flag, this test is the reminder to
    // record it here rather than letting the two surfaces disagree.
    const withAuto = Object.entries(IMPORT_TARGETS)
      .filter(([, target]) => target.hasAutoImport)
      .map(([toolId]) => toolId)
      .sort();

    expect(withAuto).toEqual(["image-to-image", "live-painting", "text-to-image"]);
  });
});

describe("resolveImportAffordance", () => {
  it("hides the row when nothing is displayed", () => {
    expect(resolveImportAffordance({ canImport: true, auto: null }, null).visible).toBe(false);
  });

  it("hides the row when the tool never registered a capability", () => {
    expect(resolveImportAffordance(null, publication("inpaint")).visible).toBe(false);
  });

  it("refuses to import a live frame even when the tool says it can import", () => {
    // A live publication is a mid-generation sampler frame: there is no
    // committed result to place, and a run is by definition still active. This
    // is the A4 lockout expressed at the only surface that can see the frame.
    const affordance = resolveImportAffordance({ canImport: true, auto: null }, publication("inpaint", "live"));

    expect(affordance).toEqual({
      visible: true,
      enabled: false,
      reason: "Import when the generation finishes."
    });
  });

  it("disables the button while the tool reports it cannot import", () => {
    const affordance = resolveImportAffordance({ canImport: false, auto: null }, publication("upscale"));

    expect(affordance.visible).toBe(true);
    expect(affordance.enabled).toBe(false);
    expect(affordance.reason).toContain("running");
  });

  it("enables the button for a finished result the tool can import", () => {
    expect(resolveImportAffordance({ canImport: true, auto: null }, publication("upscale"))).toEqual({
      visible: true,
      enabled: true,
      reason: ""
    });
  });
});

describe("createImportBridge", () => {
  it("routes a request to the registered tool's handler and nobody else's", () => {
    const bridge = createImportBridge();
    const inpaint = vi.fn();
    const upscale = vi.fn();

    bridge.register("inpaint", { requestImport: inpaint });
    bridge.register("upscale", { requestImport: upscale });
    bridge.publishCapability("inpaint", { canImport: true, auto: null });
    bridge.publishCapability("upscale", { canImport: true, auto: null });

    bridge.requestImport("inpaint");

    expect(inpaint).toHaveBeenCalledTimes(1);
    expect(upscale).not.toHaveBeenCalled();
  });

  it("refuses a request the capability says is impossible", () => {
    // The button should already be disabled. This is the second line of defence:
    // a stale render must not be able to fire an import during a run.
    const bridge = createImportBridge();
    const handler = vi.fn();

    bridge.register("inpaint", { requestImport: handler });
    bridge.publishCapability("inpaint", { canImport: false, auto: null });

    bridge.requestImport("inpaint");

    expect(handler).not.toHaveBeenCalled();
  });

  it("refuses a request for a tool that never published a capability", () => {
    const bridge = createImportBridge();
    const handler = vi.fn();

    bridge.register("inpaint", { requestImport: handler });
    bridge.requestImport("inpaint");

    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores a request for a tool that never registered", () => {
    const bridge = createImportBridge();

    bridge.publishCapability("sketch-to-image", { canImport: true, auto: null });

    expect(() => bridge.requestImport("sketch-to-image")).not.toThrow();
  });

  it("does nothing when asked to toggle auto-import on a tool without the control", () => {
    const bridge = createImportBridge();

    bridge.register("inpaint", { requestImport: vi.fn() });

    expect(() => bridge.toggleAutoImport("inpaint")).not.toThrow();
  });

  it("notifies subscribers when a capability actually changes", () => {
    const bridge = createImportBridge();
    const listener = vi.fn();

    bridge.subscribe(listener);
    bridge.publishCapability("upscale", { canImport: false, auto: null });

    expect(listener).toHaveBeenCalledTimes(1);

    bridge.publishCapability("upscale", { canImport: true, auto: null });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("drops an unchanged capability rather than re-rendering the panel", () => {
    // syncBusy runs on every state change, including every live frame. Without
    // this the panel would rebuild its import row throughout a generation.
    const bridge = createImportBridge();
    const listener = vi.fn();

    bridge.publishCapability("upscale", { canImport: true, auto: { isEnabled: false } });
    bridge.subscribe(listener);
    bridge.publishCapability("upscale", { canImport: true, auto: { isEnabled: false } });

    expect(listener).not.toHaveBeenCalled();
  });

  it("treats a missing auto control as different from a disabled one", () => {
    // null means "this tool has no toggle" and { isEnabled: false } means "the
    // toggle is off". The panel renders them differently, so a change between
    // them has to reach it.
    const bridge = createImportBridge();
    const listener = vi.fn();

    bridge.publishCapability("upscale", { canImport: true, auto: null });
    bridge.subscribe(listener);
    bridge.publishCapability("upscale", { canImport: true, auto: { isEnabled: false } });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps the newest registration when a panel remounts", () => {
    const bridge = createImportBridge();
    const first = vi.fn();
    const second = vi.fn();

    const unregisterFirst = bridge.register("inpaint", { requestImport: first });
    bridge.register("inpaint", { requestImport: second });
    // The first mount's cleanup runs after the second has registered, which is
    // the ordering UXP produces on a remount. It must not unregister the live one.
    unregisterFirst();
    bridge.publishCapability("inpaint", { canImport: true, auto: null });

    bridge.requestImport("inpaint");

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("retains the last outcome per tool", () => {
    const bridge = createImportBridge();

    bridge.reportOutcome({ toolId: "inpaint", status: "imported", message: "Imported layer: A" });
    bridge.reportOutcome({ toolId: "upscale", status: "failed", message: "Import failed." });

    expect(bridge.outcomeFor("inpaint")?.status).toBe("imported");
    expect(bridge.outcomeFor("upscale")?.message).toBe("Import failed.");
    expect(bridge.outcomeFor("sketch-to-image")).toBeNull();
  });

  it("keeps delivering to other listeners when one throws", () => {
    // A surface that throws while re-rendering must not propagate back into the
    // handler that reported success, or a cosmetic bug becomes a failed import.
    const bridge = createImportBridge();
    const healthy = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    bridge.subscribe(() => {
      throw new Error("render failed");
    });
    bridge.subscribe(healthy);

    expect(() => bridge.reportOutcome({ toolId: "inpaint", status: "imported", message: "ok" })).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });
});
