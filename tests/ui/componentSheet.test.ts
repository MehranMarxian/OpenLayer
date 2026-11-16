// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createAppMarkup } from "../../src/ui/appMarkup";
import {
  COMPONENT_SHEET_VIEW_ID,
  createComponentSheetMarkup,
  createComponentSheetPlaceholderMarkup,
  readComponentSheetInfo,
  refreshComponentSheet
} from "../../src/ui/componentSheet";

/**
 * The UI sheet (docs/ui-audit-ps28.md, U0) is only useful if a capture of it
 * answers the open questions without anyone remembering what to look for, and
 * it must never be able to run anything. These tests hold both.
 */
describe("component sheet markup", () => {
  const markup = createComponentSheetMarkup();

  it("has a way back to Settings", () => {
    expect(markup).toContain('data-openlayer-view="settings"');
  });

  it("cannot run anything: no control carries an action", () => {
    expect(markup).not.toContain("data-openlayer-action");
    expect(markup).not.toContain("action-control");
  });

  it("puts every secondary-button candidate side by side", () => {
    expect(markup).toContain('<button type="button">Copy Prompt</button>');
    expect(markup).toContain('<sp-button variant="secondary">Copy Prompt</sp-button>');
    expect(markup).toContain("ui-sheet-host-button");
  });

  it("draws primary actions both as today's native button and as the div primitive", () => {
    expect(markup).toContain('<button class="button button-primary button-generate button-wide" type="button">Generate</button>');
    expect(markup).toMatch(/<div class="button button-primary button-generate button-wide" role="button"[^>]*>Generate<\/div>/);
  });

  it("probes the checks the audit left open", () => {
    expect(markup).toContain("ui-sheet-probe-opacity");
    expect(markup).toContain('style="opacity: 0.3"');
    expect(markup).toContain("ui-sheet-probe-rgba");
    expect(markup).toContain("ui-sheet-probe-hover");
    expect(markup).toContain("ui-sheet-probe-focus");
    expect(markup).toContain("ui-sheet-host-background-color");
    expect(markup).toContain("ui-sheet-host-fs");
  });

  it("follows the panel copy rule: no double hyphen and no backticks", () => {
    const text = markup.replace(/<[^>]*>/g, " ");

    expect(text).not.toContain("--");
    expect(text).not.toContain("`");
  });

  it("never uses Photoshop as an adjective in its copy", () => {
    const text = markup.replace(/<[^>]*>/g, " ");

    expect(text).not.toMatch(/Photoshop (panel|layer|plugin|canvas|selection|document)/i);
  });
});

describe("component sheet in the app", () => {
  const app = createAppMarkup();

  it("starts as one empty hidden screen, so the panel does not parse it at startup", () => {
    expect(app.split(`id="${COMPONENT_SHEET_VIEW_ID}"`).length).toBe(2);
    expect(createComponentSheetPlaceholderMarkup()).toMatch(
      new RegExp(`<section class="ui-sheet-view" id="${COMPONENT_SHEET_VIEW_ID}"[^>]*hidden></section>`)
    );
    expect(app).not.toContain("ui-sheet-probe-opacity");
  });

  it("is reached from the Settings status report, not from Home", () => {
    const settingsStart = app.indexOf('id="settings-view"');
    const entry = app.indexOf('data-openlayer-view="ui-sheet"');
    const homeStart = app.indexOf('id="home-view"');
    const homeEnd = app.indexOf('id="prompt-from-layer-view"');

    expect(entry).toBeGreaterThan(settingsStart);
    expect(entry < homeStart || entry > homeEnd).toBe(true);
    expect(app.split('data-openlayer-view="ui-sheet"').length).toBe(2);
  });
});

describe("refreshComponentSheet", () => {
  it("draws the sheet on first entry and keeps it on the next", () => {
    const host = document.createElement("div");
    host.innerHTML = createComponentSheetPlaceholderMarkup();
    const root = host.firstElementChild as HTMLElement;

    refreshComponentSheet(root, "Compact Adobe Dark");
    const first = root.querySelector(".ui-sheet-probe-opacity");

    expect(first).not.toBeNull();
    expect(root.querySelector("#ui-sheet-panel-theme")?.textContent).toBe("Compact Adobe Dark");

    refreshComponentSheet(root, "Artist-Friendly Dark");

    expect(root.querySelector(".ui-sheet-probe-opacity")).toBe(first);
    expect(root.querySelector("#ui-sheet-panel-theme")?.textContent).toBe("Artist-Friendly Dark");
  });
});

describe("readComponentSheetInfo", () => {
  it("reads the host and UXP versions from the uxp module", () => {
    const load = () => ({ host: { name: "Photoshop", version: "28.0.0" }, versions: { uxp: "9.4.1" } });
    const info = readComponentSheetInfo("Compact Adobe Dark", null, load);

    expect(info.hostVersion).toBe("Photoshop 28.0.0");
    expect(info.uxpVersion).toBe("9.4.1");
    expect(info.panelTheme).toBe("Compact Adobe Dark");
  });

  it("says Not available instead of throwing when the host lacks something", () => {
    const load = () => {
      throw new Error("no such module");
    };
    const info = readComponentSheetInfo("Artist-Friendly Dark", null, load);

    expect(info.hostVersion).toBe("Not available");
    expect(info.uxpVersion).toBe("Not available");
    expect(info.width).toBe("Not available");
  });
});
