import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Lint configuration for OpenLayer.
 *
 * The point of this file is a gate CI can enforce, not a style opinion. Two
 * rules about how it is maintained:
 *
 * The baseline is zero problems on committed code. A rule that would need
 * dozens of fixes gets dropped rather than silenced — a codebase dotted with
 * `eslint-disable` comments teaches everyone to ignore the linter, which is
 * worse than not having one.
 *
 * Nothing here is type-aware. The type-checked rule sets need a full program
 * per lint run, and `npm run typecheck` already covers what they would catch.
 * Paying for that twice would make the gate slow enough to route around.
 */

/**
 * Web APIs that exist in a browser and in Node, but NOT in Photoshop's UXP
 * runtime. Code under `src/` ships into UXP, so reaching for one of these is a
 * runtime failure that neither `tsc` nor Vitest can see — their DOM and Node
 * lib types declare all of them.
 *
 * `TextEncoder` is here because it already cost a release. UXP does not expose
 * it, so multipart upload bodies had to be encoded by hand
 * (`src/utils/multipart.ts`), and the failure only showed up in Photoshop.
 * Anything added here should have the same shape: available to the type
 * checker, absent from the host.
 */
const UXP_MISSING_GLOBALS = [
  {
    name: "TextEncoder",
    message:
      "Photoshop UXP does not expose TextEncoder. Use encodeUtf8 from src/utils/multipart.ts instead."
  },
  {
    name: "TextDecoder",
    message:
      "Photoshop UXP does not expose TextDecoder. Decode bytes manually rather than relying on it."
  }
];

export default tseslint.config(
  {
    ignores: ["dist/**", "packages/**", "node_modules/**", "src/workflows/**"]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Three rules from the recommended sets do not fit this codebase. Each is
    // switched off here, with the reason, rather than disabled at call sites —
    // a file dotted with `eslint-disable` comments trains everyone to stop
    // reading them.
    rules: {
      /**
       * UXP exposes the host API through `require("photoshop")` and
       * `require("uxp")`, and there is no ESM equivalent. Nine call sites do
       * this because it is the only way to reach Photoshop; forbidding it would
       * forbid the plugin.
       */
      "@typescript-eslint/no-require-imports": "off",

      /**
       * `src/metadata/layerMetadata.ts` strips control characters out of
       * strings before they are written into Photoshop layer metadata, which
       * means a regex containing control-character ranges — exactly what this
       * rule flags. The usage is the intent.
       */
      "no-control-regex": "off",

      /**
       * A leading underscore is this codebase's existing convention for a
       * parameter that must stay in the signature but is deliberately unused
       * (`_source`, `_operation`). Honour it rather than rewriting call sites.
       */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    }
  },

  {
    // Plugin code: runs inside Photoshop UXP, which is browser-shaped but not a
    // browser. The restricted-globals list above is the part that earns its keep.
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: globals.browser
    },
    rules: {
      "no-restricted-globals": ["error", ...UXP_MISSING_GLOBALS],
      eqeqeq: ["error", "always", { null: "ignore" }]
    }
  },

  {
    // The undeferred entrypoint bootstrap. Plain JS, loaded ahead of the bundle,
    // and it calls UXP's `require` directly — see docs/PREVIEW_PANEL.md.
    files: ["src/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        require: "readonly"
      }
    }
  },

  {
    // Build scripts, tests, and tool configs run in Node, never in the host, so
    // the UXP restrictions do not apply. The multipart tests use TextEncoder
    // deliberately, as the reference implementation to check ours against.
    files: ["scripts/**/*.mjs", "tests/**/*.ts", "*.config.ts", "*.config.js"],
    languageOptions: {
      globals: globals.node
    }
  }
);
