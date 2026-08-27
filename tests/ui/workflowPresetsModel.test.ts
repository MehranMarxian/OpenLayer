import { describe, expect, it } from "vitest";
import { createWorkflowPresetsView } from "../../src/ui/workflowPresetsModel";
import { getWorkflowPreset, listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";

const view = createWorkflowPresetsView(listRunnableWorkflowPresets());
const allRows = view.groups.flatMap((group) => group.rows);

describe("workflow presets catalogue", () => {
  it("lists every runnable preset exactly once", () => {
    const runnableIds = listRunnableWorkflowPresets().map((preset) => preset.id).sort();

    expect(allRows.map((row) => row.id).sort()).toEqual(runnableIds);
    expect(new Set(allRows.map((row) => row.id)).size).toBe(allRows.length);
  });

  it("groups presets under their tool's artist-facing name", () => {
    const toolLabels = view.groups.map((group) => group.toolLabel);

    expect(new Set(toolLabels).size).toBe(toolLabels.length);
    expect(toolLabels).toContain("Inpaint");
    expect(toolLabels).toContain("Text to Image");
    // Every group has to carry something, or it is a heading over nothing.
    expect(view.groups.every((group) => group.rows.length > 0)).toBe(true);
  });

  it("keeps registry order inside a group rather than re-sorting", () => {
    // The registry is curated: the generally useful route for a tool comes
    // first. Sorting alphabetically here would put inpaint-basic above the
    // crop & stitch route that is actually recommended.
    const inpaint = view.groups.find((group) => group.toolLabel === "Inpaint");
    const registryOrder = listRunnableWorkflowPresets()
      .filter((preset) => preset.mode === "inpaint")
      .map((preset) => preset.id);

    expect(inpaint?.rows.map((row) => row.id)).toEqual(registryOrder);
  });

  it("reads zero required models as good news, not as a missing count", () => {
    // txt2img-basic brings its own checkpoint choice and needs no extra file.
    // "0 models" would read like something failed to load.
    const row = allRows.find((candidate) => candidate.id === "txt2img-basic");

    expect(row?.modelSummary).toBe("No extra downloads");
    expect(row?.modelSummary).not.toContain("0");
  });

  it("counts a preset's required models and names its custom node packs", () => {
    const row = allRows.find((candidate) => candidate.id === "sketch2img-linecn-basic");

    expect(row?.modelSummary).toBe("1 model");
    // Named, not counted: the pack name is the thing an artist can act on.
    expect(row?.customNodePackages).toEqual(["comfyui_controlnet_aux"]);
  });

  it("carries each preset's own status and note through unchanged", () => {
    const row = allRows.find((candidate) => candidate.id === "style-reference-sd15");
    const preset = getWorkflowPreset("style-reference-sd15");

    expect(row?.statusLabel).toBe("Experimental");
    expect(row?.statusTone).toBe("experimental");
    expect(row?.note).toBe(preset.compatibilityNote);
    expect(row?.displayName).toBe(preset.displayName);
  });

  it("summarises the catalogue by stability", () => {
    expect(view.summaryLine).toMatch(/^\d+ presets: \d+ stable, \d+ experimental\.$/);
  });

  it("says something sensible when handed nothing", () => {
    const empty = createWorkflowPresetsView([]);

    expect(empty.groups).toEqual([]);
    expect(empty.summaryLine).toBe("No workflow presets are available.");
  });

  it("keeps every string plain text, because the panel renders with textContent", () => {
    const strings = [
      view.summaryLine,
      ...view.groups.map((group) => group.toolLabel),
      ...allRows.flatMap((row) => [
        row.displayName,
        row.technicalId,
        row.description,
        row.statusLabel,
        row.modelSummary,
        ...row.customNodePackages,
        row.note ?? ""
      ])
    ];

    for (const value of strings) {
      expect(value).not.toContain("<");
      expect(value).not.toContain("`");
    }
  });
});
