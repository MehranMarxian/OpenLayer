import { describe, expect, it } from "vitest";
import {
  OpenLayerError,
  createOpenLayerError,
  getErrorMessage,
  getNestedErrorMessage,
  getTechnicalErrorDetails
} from "../../src/utils/errors";

describe("OpenLayer errors", () => {
  it("preserves friendly and technical details", () => {
    const error = createOpenLayerError("WORKFLOW_INVALID", "Friendly message.", "Technical details.");

    expect(error).toBeInstanceOf(OpenLayerError);
    expect(getErrorMessage(error)).toBe("Friendly message.");
    expect(getTechnicalErrorDetails(error)).toBe("Technical details.");
  });

  it("handles unknown thrown values", () => {
    expect(getErrorMessage("plain error")).toBe("plain error");
    expect(getNestedErrorMessage(12)).toBe("12");
  });

  it("always returns a string from getTechnicalErrorDetails", () => {
    // JSON.stringify returns undefined rather than a string for these three,
    // which used to leak out of here as a non-string. Callers treat the result
    // as text — every tool's failure hint calls .toLowerCase() on it inside a
    // catch block — so a non-string became a throw escaping an error handler.
    for (const value of [undefined, () => undefined, Symbol("nope")]) {
      expect(typeof getTechnicalErrorDetails(value)).toBe("string");
    }

    expect(getTechnicalErrorDetails(undefined)).toBe("No technical details available.");

    // Values JSON can represent still come back as their serialised form.
    expect(getTechnicalErrorDetails(42)).toBe("42");
    expect(getTechnicalErrorDetails({ code: 7 })).toBe('{"code":7}');
  });

  it("returns a string for a value that cannot be serialised at all", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(getTechnicalErrorDetails(circular)).toBe("No technical details available.");
  });
});
