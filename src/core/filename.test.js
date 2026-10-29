import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "./filename.js";

describe("sanitizeFilename", () => {
  it("replaces characters that file systems refuse", () => {
    expect(sanitizeFilename('Episode 1: "Pilot" <HD>?')).toBe("Episode 1_ _Pilot_ _HD__");
  });

  it("collapses whitespace and drops trailing dots and spaces", () => {
    expect(sanitizeFilename("  My   video...  ")).toBe("My video");
  });

  it("cuts very long titles", () => {
    expect(sanitizeFilename("a".repeat(300))).toHaveLength(120);
  });

  it("falls back to a generic name when nothing is left", () => {
    expect(sanitizeFilename("  ...  ")).toBe("video");
  });
});
