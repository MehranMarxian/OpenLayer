import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listRunnableWorkflowPresets } from "../../src/comfy/presetRegistry";
import { ComfyWorkflow } from "../../src/comfy/types";
import { createAppMarkup } from "../../src/ui/appMarkup";

/**
 * The warning at the top of the Upscale screen is static markup, so nothing
 * updated it when SeedVR2 arrived in #151: it went on telling artists that
 * Upscale "does not reinterpret prompts or run diffusion sampling" while the
 * SeedVR2 preset ran a KSampler. These tests tie it to the registry, so the
 * next Upscale preset fails here instead of shipping the same false sentence.
 */
describe("Upscale screen warning", () => {
  const markup = createAppMarkup();
  const upscaleScreen = markup.slice(markup.indexOf('aria-label="Upscale source"') - 2000, markup.indexOf('aria-label="Upscale source"'));
  const warning = upscaleScreen.match(/<div class="tool-warning" role="note">([\s\S]*?)<\/div>/)?.[1].trim() ?? "";
  const upscalePresets = listRunnableWorkflowPresets("upscale");

  it("is found", () => {
    expect(warning.length).toBeGreaterThan(0);
  });

  it("names every runnable Upscale preset", () => {
    for (const preset of upscalePresets) {
      expect(warning).toContain(preset.label);
    }
  });

  it("does not deny diffusion sampling while a preset samples", () => {
    const anySamples = upscalePresets.some((preset) => {
      const workflow = JSON.parse(readFileSync(resolve(__dirname, "../../src", preset.workflowFile), "utf8")) as ComfyWorkflow;
      return Object.values(workflow).some((node) => /KSampler|SamplerCustom/.test(node.class_type));
    });

    expect(anySamples).toBe(true);
    expect(warning).not.toMatch(/does not .*diffusion|pixel\/model enlargement only/i);
    expect(warning).toMatch(/invent/);
  });

  it("is plain text", () => {
    expect(warning).not.toMatch(/`|--|\*\*|<|Photoshop plugin/);
  });
});
