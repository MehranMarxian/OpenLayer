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
});
