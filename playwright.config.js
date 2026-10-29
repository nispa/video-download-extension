import { defineConfig } from "@playwright/test";

// Loads dist/edge (built by `pnpm test:e2e`) into Playwright's Chromium.
// Branded Chrome and Edge no longer accept --load-extension, Chromium does.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
});
