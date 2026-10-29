import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";

const PURE_LAYERS = ["src/core/**", "src/media/**", "src/engine/**"];
const BROWSER_LAYERS = ["src/app/**", "src/platform/**", "src/ui/**"];

export default defineConfig(
  { ignores: ["dist", "coverage", "playwright-report", "test-results", "node_modules"] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: "module" },
    rules: {
      "no-console": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "ExportDefaultDeclaration", message: "Use named exports only." },
      ],
      eqeqeq: "error",
      "prefer-const": "error",
      "no-var": "error",
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: PURE_LAYERS,
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/app/**", "**/platform/**", "**/ui/**", "**/content/**"],
              message: "core, media and engine must not depend on app, platform, ui or content.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "browser", message: "Pure layers must not touch extension APIs." },
        { name: "chrome", message: "Pure layers must not touch extension APIs." },
        { name: "window", message: "Pure layers must not touch the DOM." },
        { name: "document", message: "Pure layers must not touch the DOM." },
        { name: "fetch", message: "Receive fetch as a dependency, so tests can replace it." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Pure layers must be deterministic." },
        { object: "Date", property: "now", message: "Receive time as a dependency." },
      ],
    },
  },
  {
    files: BROWSER_LAYERS,
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
  },
  {
    // Content scripts cannot be ES modules: one self-contained classic script.
    files: ["src/content/**"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser, ...globals.webextensions },
    },
  },
  {
    files: ["native-host/**", "scripts/**", "e2e/**", "*.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Functions given to worker.evaluate() run inside the extension, where chrome.* exists.
    files: ["e2e/**"],
    languageOptions: { globals: { ...globals.webextensions } },
  },
  {
    // Tests run some files in happy-dom, which provides DOMParser.
    files: ["**/*.test.js"],
    languageOptions: { globals: { DOMParser: "readonly" } },
  },
  {
    // Tool configuration files must export a default object.
    files: ["*.config.js"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Command-line tools report to the terminal. (Not native-host: its stdout is the protocol.)
    files: ["scripts/**", "e2e/**"],
    rules: { "no-console": "off" },
  },
);
