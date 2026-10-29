import { describe, expect, it } from "vitest";
import { formatBitrate, formatDuration, formatSize } from "./format.js";

describe("formatSize", () => {
  it("uses the largest unit below 1024", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("stops at gigabytes", () => {
    expect(formatSize(3 * 1024 ** 4)).toBe("3072.0 GB");
  });

  it("is empty for an unknown size", () => {
    expect(formatSize(0)).toBe("");
  });
});

describe("formatDuration", () => {
  it("shows minutes and seconds under an hour", () => {
    expect(formatDuration(1417)).toBe("23:37");
  });

  it("adds hours when needed", () => {
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("is empty for an unknown duration", () => {
    expect(formatDuration(0)).toBe("");
  });
});

describe("formatBitrate", () => {
  it("shows megabits per second with one decimal", () => {
    expect(formatBitrate(1486000)).toBe("1.5 Mbps");
  });
});
