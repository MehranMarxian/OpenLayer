import { describe, expect, it } from "vitest";

import {
  createNoSelectionMessage,
  DEFAULT_SELECTION_REQUESTER
} from "../../src/photoshop/photoshopAdapter";

// readActiveSelectionInfo needs Photoshop and cannot be tested here. Its
// no-selection message can, and it is worth pinning: the sentence was
// hard-coded for Inpaint, and parameterising it for the new export paths is
// exactly the kind of change that silently rewords an error a user already
// knows.
describe("no-selection message", () => {
  it("keeps Inpaint's original sentence when no caller is named", () => {
    expect(createNoSelectionMessage()).toBe(
      "No active Photoshop selection was found. Make a selection before using Inpaint."
    );
    expect(DEFAULT_SELECTION_REQUESTER).toBe("using Inpaint");
  });

  it("names the caller so the message matches what the artist did", () => {
    expect(createNoSelectionMessage("exporting a selection")).toBe(
      "No active Photoshop selection was found. Make a selection before exporting a selection."
    );
    expect(createNoSelectionMessage("exporting a selection mask")).toBe(
      "No active Photoshop selection was found. Make a selection before exporting a selection mask."
    );
  });

  it("never leaves the sentence without its trailing period", () => {
    expect(createNoSelectionMessage("doing something")).toMatch(/\.$/);
  });
});
