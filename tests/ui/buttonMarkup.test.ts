import { describe, expect, it } from "vitest";
import { buttonClassName, createButtonMarkup, escapeMarkup } from "../../src/ui/buttonMarkup";

/**
 * The button primitive replaces native <button>s, which Photoshop 28 paints
 * grey over our CSS (docs/ui-audit-ps28.md). These tests pin the contract the
 * rest of the panel relies on: a div that is focusable, announced as a button,
 * disabled the same way setActionDisabled disables at runtime, and styled by
 * the same classes the native button had.
 */
describe("createButtonMarkup", () => {
  it("emits a focusable div announced as a button, never a native button", () => {
    const markup = createButtonMarkup({ label: "Copy Prompt" });

    expect(markup.startsWith("<div ")).toBe(true);
    expect(markup).not.toMatch(/<button/);
    expect(markup).toContain('role="button"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('aria-disabled="false"');
    expect(markup).toContain(">Copy Prompt</div>");
  });

  it("keeps the classes each native button had, so the stylesheet sees no change", () => {
    expect(buttonClassName({ tone: "secondary" })).toBe("button");
    expect(buttonClassName({ tone: "generate", wide: true })).toBe(
      "button button-primary button-generate button-wide"
    );
    expect(buttonClassName({ tone: "capture" })).toBe("button source-action-button");
    expect(buttonClassName({ tone: "import" })).toBe("button button-import button-import-blue");
    expect(buttonClassName({ tone: "disclosure" })).toBe("button disclosure-button");
  });

  it("disables the way setActionDisabled does: class, aria-disabled and tabindex -1", () => {
    const markup = createButtonMarkup({ label: "Generate", tone: "generate", disabled: true });

    expect(markup).toContain("is-disabled");
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('tabindex="-1"');
    // The native attribute means nothing on a div and must not creep in.
    expect(markup).not.toMatch(/\sdisabled(\s|>|=)/);
  });

  it("adds action-control only when there is an action to run", () => {
    expect(buttonClassName({ tone: "secondary" })).not.toContain("action-control");

    const markup = createButtonMarkup({ label: "Copy Prompt", action: "copyPromptFromLayer", id: "copy-prompt" });

    expect(markup).toContain("action-control");
    expect(markup).toContain('data-openlayer-action="copyPromptFromLayer"');
    expect(markup).toContain('id="copy-prompt"');
  });

  it("carries a view for the screen-navigation binding", () => {
    expect(createButtonMarkup({ label: "Open UI sheet", view: "ui-sheet" })).toContain(
      'data-openlayer-view="ui-sheet"'
    );
  });

  it("gives toggles and chips data-state for styling and aria-pressed for screen readers", () => {
    const off = createButtonMarkup({ label: "Import Automatically", tone: "toggle" });
    const on = createButtonMarkup({ label: "Import Automatically", tone: "toggle", state: "on" });

    expect(off).toContain('data-state="off"');
    expect(off).toContain('aria-pressed="false"');
    expect(off).not.toContain("is-active");
    expect(on).toContain('data-state="on"');
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain("is-active");
  });

  it("leaves data-state off plain buttons", () => {
    const markup = createButtonMarkup({ label: "Copy Prompt", state: "on" });

    expect(markup).not.toContain("data-state");
    expect(markup).not.toContain("aria-pressed");
  });

  it("does not give a chip the button class, which the Setup chips never had", () => {
    expect(buttonClassName({ tone: "chip" })).toBe("setup-filter-chip");
    expect(buttonClassName({ tone: "chip", state: "on" })).toBe("setup-filter-chip is-active");
  });

  it("escapes label, id and title so data cannot close an attribute", () => {
    const markup = createButtonMarkup({ label: 'A <b> & "c"', id: 'x" onclick="y', title: "it's" });

    expect(markup).toContain(">A &lt;b&gt; &amp; &quot;c&quot;</div>");
    expect(markup).toContain('id="x&quot; onclick=&quot;y"');
    expect(markup).toContain('title="it&#39;s"');
  });

  it("writes hidden as a bare attribute when asked", () => {
    expect(createButtonMarkup({ label: "Cancel", hidden: true })).toMatch(/\shidden>/);
    expect(createButtonMarkup({ label: "Cancel" })).not.toContain("hidden");
  });
});

describe("escapeMarkup", () => {
  it("escapes the five characters that matter in markup", () => {
    expect(escapeMarkup(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
