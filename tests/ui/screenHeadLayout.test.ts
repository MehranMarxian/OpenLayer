// @vitest-environment jsdom
//
// The pinned screen header is a DOM restructure, not a stylesheet tweak, so
// the shape it builds is what has to be asserted.
import { describe, expect, it } from "vitest";
import { createAppMarkup } from "../../src/ui/appMarkup";
import { bindStickyProgress } from "../../src/ui/appBindings";

function mount() {
  const root = document.createElement("div");
  root.innerHTML = createAppMarkup();
  bindStickyProgress(root);
  return root;
}

describe("screen head layout", () => {
  it("gives every screen with a nav a pinned head and a scrolling body", () => {
    const root = mount();
    const views = Array.from(root.querySelectorAll<HTMLElement>(".has-screen-head"));

    expect(views.length).toBeGreaterThan(0);

    for (const view of views) {
      const head = view.querySelector(":scope > .screen-head");
      const body = view.querySelector(":scope > .screen-body");

      expect(head, `no .screen-head in #${view.id}`).not.toBeNull();
      expect(body, `no .screen-body in #${view.id}`).not.toBeNull();

      // The head must come first, or it is not a header.
      expect(view.children[0]).toBe(head);
      expect(head!.querySelector(".screen-nav")).not.toBeNull();
    }
  });

  it("moves the screen's panels into the scrolling body, not the head", () => {
    const root = mount();
    const generator = root.querySelector<HTMLElement>("#generator-view")!;

    expect(generator.classList.contains("has-screen-head")).toBe(true);
    // The prompt lives in a panel below the header, so it must have travelled
    // into the body -- that is the part that scrolls.
    expect(generator.querySelector(".screen-body #prompt")).not.toBeNull();
    expect(generator.querySelector(".screen-head #prompt")).toBeNull();
  });

  /**
   * Home has no back/title nav, so it never gets a head or a body. The CSS is
   * scoped to .has-screen-head precisely so home keeps scrolling itself --
   * unscoped, it would hand home's scrolling to an element that does not exist
   * and stranded the whole dashboard below the fold.
   */
  it("leaves the home dashboard alone", () => {
    const root = mount();
    const home = root.querySelector<HTMLElement>("#home-view")!;

    expect(home.classList.contains("has-screen-head")).toBe(false);
    expect(home.querySelector(":scope > .screen-body")).toBeNull();
  });
});
