import { describe, expect, it } from "vitest";
import {
  bindDocumentContext,
  createPhotoshopDocumentIdentity,
  validateDocumentImportContext
} from "../../src/photoshop/documentContext";

describe("Photoshop document context", () => {
  const origin = createPhotoshopDocumentIdentity(101, "Concept.psd");
  const other = createPhotoshopDocumentIdentity(202, "References.psd");

  it("allows import when the originating document is still active", () => {
    expect(validateDocumentImportContext(origin, origin, [origin, other])).toEqual({
      ok: true,
      activeDocument: origin
    });
  });

  it("blocks import when a different open document is active", () => {
    const validation = validateDocumentImportContext(origin, other, [origin, other]);

    expect(validation).toMatchObject({
      ok: false,
      reason: "different-active-document"
    });
    expect(validation.message).toContain("Concept.psd");
    expect(validation.message).toContain("References.psd");
  });

  it("detects an originating-document change during an import transaction", () => {
    expect(validateDocumentImportContext(origin, origin, [origin, other]).ok).toBe(true);
    expect(validateDocumentImportContext(origin, other, [origin, other])).toMatchObject({
      ok: false,
      reason: "different-active-document"
    });
  });

  it("blocks import when the originating document has been closed", () => {
    const validation = validateDocumentImportContext(origin, other, [other]);

    expect(validation).toMatchObject({
      ok: false,
      reason: "origin-closed"
    });
    expect(validation.message).toContain("no longer open");
  });

  it("names the originating document when no Photoshop document is active", () => {
    const validation = validateDocumentImportContext(origin, null, [origin]);

    expect(validation).toMatchObject({
      ok: false,
      reason: "no-active-document"
    });
    expect(validation.message).toContain("Concept.psd");
  });

  it("blocks results that have no originating document identity", () => {
    const validation = validateDocumentImportContext(null, other, [other]);

    expect(validation).toMatchObject({
      ok: false,
      reason: "missing-origin"
    });
  });

  it("binds the originating identity immutably to a result", () => {
    const result = bindDocumentContext({ filename: "result.png" }, origin);

    expect(result.originatingDocument).toBe(origin);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(origin)).toBe(true);
  });
});
