import { describe, expect, it, vi } from "vitest";
import { consoleSink, createLogger } from "./logger.js";

describe("createLogger", () => {
  it("forwards entries with level, scope and message to the sink", () => {
    const entries = [];
    const logger = createLogger("engine", (entry) => entries.push(entry));

    logger.warn("playlist failed", { url: "https://cdn.example/a.m3u8" });

    expect(entries).toEqual([
      {
        level: "warn",
        scope: "engine",
        message: "playlist failed",
        details: { url: "https://cdn.example/a.m3u8" },
      },
    ]);
  });

  it("leaves details out when none are given", () => {
    const entries = [];
    const logger = createLogger("app", (entry) => entries.push(entry));

    logger.info("started");
    logger.error("failed");

    expect(entries).toEqual([
      { level: "info", scope: "app", message: "started" },
      { level: "error", scope: "app", message: "failed" },
    ]);
  });
});

describe("consoleSink", () => {
  it("writes to the console method of the entry's level", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    consoleSink({ level: "warn", scope: "edge", message: "offscreen missing" });

    expect(warn).toHaveBeenCalledWith("[edge] offscreen missing", "");
    warn.mockRestore();
  });
});
