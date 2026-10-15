// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { loadOpenLayerPreferences, saveOpenLayerPreferences } from "../../src/utils/preferences";

const BASE = {
  serverUrl: "http://127.0.0.1:8188",
  workflow: "txt2img-basic",
  checkpointName: "",
  width: "1024",
  height: "1024",
  steps: "20",
  cfg: "7",
  seed: "",
  theme: "compact" as const
};

describe("the workflowChosen preference", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a deliberate choice", () => {
    saveOpenLayerPreferences({ ...BASE, workflowChosen: true });

    expect(loadOpenLayerPreferences().workflowChosen).toBe(true);
  });

  it("reads preferences saved before the flag existed as not chosen", () => {
    localStorage.setItem("openlayer.preferences.v1", JSON.stringify(BASE));

    expect(loadOpenLayerPreferences().workflowChosen).toBe(false);
  });

  it("accepts only a real true, not a truthy string", () => {
    localStorage.setItem("openlayer.preferences.v1", JSON.stringify({ ...BASE, workflowChosen: "true" }));

    expect(loadOpenLayerPreferences().workflowChosen).toBe(false);
  });
});
