import { describe, expect, it } from "vitest";
import { findTextOutput } from "../../src/comfy/comfyClient";
import { ComfyHistoryItem } from "../../src/comfy/types";

describe("Comfy text output parsing", () => {
  it("reads preferred ShowText output from ComfyUI history", () => {
    const history: ComfyHistoryItem = {
      outputs: {
        "45": {
          text: ["A detailed caption from Florence."]
        }
      }
    };

    expect(findTextOutput(history, "45")).toBe("A detailed caption from Florence.");
  });

  it("falls back to common string-like output fields", () => {
    const history: ComfyHistoryItem = {
      outputs: {
        "38": {
          caption: "A caption from the Florence node."
        }
      }
    };

    expect(findTextOutput(history)).toBe("A caption from the Florence node.");
  });
});
