import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.js", "native-host/**/*.test.js", "scripts/**/*.test.js"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/core/**", "src/media/**", "src/engine/**"],
      exclude: ["**/*.test.js"],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
});
