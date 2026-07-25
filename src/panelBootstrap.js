/*
 * Claims the UXP panel entrypoints. Loaded by index.html as a plain, NON-deferred
 * script so it runs during head parsing, before the application bundle exists.
 *
 * Why this file exists at all, and why it is not part of the bundle or an inline
 * <script> block:
 *
 *  - `entrypoints.setup()` throws if called much more than ~20ms after plugin
 *    start (Adobe's known issue PS-57605). The application bundle is a deferred
 *    ~340 KB script, so calling setup() from there always missed the window and
 *    threw "Cannot read properties of undefined (reading '_isSet')".
 *  - Every working Adobe multi-panel sample calls setup() from a real script
 *    file that index.html loads, never from an inline block. `require` is not
 *    reliably injected into inline scripts, so an inline attempt can fail with
 *    a ReferenceError before it gets as far as setup().
 *
 * It stays deliberately tiny, dependency-free and un-transpiled: it must not
 * grow into something that needs the bundle it exists to run ahead of. All it
 * does is claim the panels, remember the root nodes UXP hands back, and hand
 * them to renderers the bundle registers later. Either arrival order works.
 */
(function () {
  var MAIN_PANEL_ID = "openlayer.panel";
  var PREVIEW_PANEL_ID = "openlayerPreview";
  var startedAt = Date.now();

  var bootstrap = {
    mode: "pending",
    registered: false,
    events: [],
    roots: {},
    renderers: {},

    note: function (message) {
      var entry = "+" + (Date.now() - startedAt) + "ms " + message;
      bootstrap.events.push(entry);
      console.log("[OpenLayer bootstrap] " + entry);
    },

    register: function (id, render) {
      bootstrap.renderers[id] = render;
      bootstrap.mount(id);
    },

    mount: function (id) {
      var root = bootstrap.roots[id];
      var render = bootstrap.renderers[id];

      if (!root || !render || root.__openlayerMounted) {
        return;
      }

      root.__openlayerMounted = true;
      bootstrap.note("rendering " + id);

      try {
        render(root);
      } catch (error) {
        bootstrap.note("render failed for " + id + ": " + String(error));
      }
    },

    /**
     * One setup() attempt. Returns true on success. Safe to call repeatedly:
     * a throw here is catchable (verified against the real _isSet TypeError),
     * and the guard stops a second call once one has landed.
     */
    trySetup: function (label, panelIds) {
      if (bootstrap.registered) {
        return true;
      }

      var uxp;

      try {
        uxp = require("uxp");
      } catch (error) {
        bootstrap.note("attempt " + label + ": require(\"uxp\") failed: " + String(error));
        return false;
      }

      if (!uxp || !uxp.entrypoints || typeof uxp.entrypoints.setup !== "function") {
        bootstrap.note("attempt " + label + ": uxp.entrypoints.setup is unavailable");
        return false;
      }

      var panels = {};

      for (var index = 0; index < panelIds.length; index += 1) {
        panels[panelIds[index]] = (function (id) {
          return {
            create: function (rootNode) {
              bootstrap.note("create() fired for " + id);
              bootstrap.roots[id] = rootNode;
              bootstrap.mount(id);
            },
            show: function (rootNode) {
              // Some hosts only deliver a usable node on show().
              if (rootNode && !bootstrap.roots[id]) {
                bootstrap.note("show() supplied the root node for " + id);
                bootstrap.roots[id] = rootNode;
                bootstrap.mount(id);
              }
            }
          };
        })(panelIds[index]);
      }

      try {
        uxp.entrypoints.setup({ panels: panels });
        bootstrap.registered = true;
        bootstrap.mode = "entrypoints.setup:" + label;
        bootstrap.note("attempt " + label + " registered " + panelIds.join(" + "));
        return true;
      } catch (error) {
        bootstrap.note("attempt " + label + " threw: " + String(error));
        return false;
      }
    }
  };

  window.__openlayerBootstrap = bootstrap;

  bootstrap.note("early script running, typeof require = " + typeof require);

  /*
   * Ladder rather than a single attempt, because two independent things could
   * be wrong and a host round trip is expensive to spend on one hypothesis.
   *
   * The main panel's id has a dot in it and cannot be changed — saved user
   * workspaces reference it. No Adobe sample uses a dotted id, so if their
   * internal lookup is what fails, registering both panels fails as a unit.
   * The second attempt therefore drops the main panel: it does not need
   * setup() at all, because it already renders through index.html.
   */
  if (!bootstrap.trySetup("both", [MAIN_PANEL_ID, PREVIEW_PANEL_ID])) {
    bootstrap.trySetup("preview-only", [PREVIEW_PANEL_ID]);
  }

  // Late retries, in case the entrypoints API is not ready during head parsing.
  if (!bootstrap.registered) {
    window.setTimeout(function () {
      bootstrap.trySetup("preview-only@timeout", [PREVIEW_PANEL_ID]);
    }, 0);

    document.addEventListener(
      "DOMContentLoaded",
      function () {
        bootstrap.trySetup("preview-only@domready", [PREVIEW_PANEL_ID]);
      },
      { once: true }
    );
  }
})();
