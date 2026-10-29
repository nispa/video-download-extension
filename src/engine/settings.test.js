import { describe, expect, it } from "vitest";
import { applySettingsChanges, DEFAULT_SETTINGS, normalizeSettings } from "./settings.js";

describe("normalizeSettings", () => {
  it("keeps valid values", () => {
    expect(normalizeSettings({ hlsFormat: "ts", allowEncrypted: true })).toEqual({
      hlsFormat: "ts",
      allowEncrypted: true,
    });
  });

  it("replaces invalid or missing values with defaults", () => {
    expect(normalizeSettings({ hlsFormat: "avi", allowEncrypted: "yes" })).toEqual(
      DEFAULT_SETTINGS,
    );
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("applySettingsChanges", () => {
  it("applies known keys and ignores unknown ones", () => {
    const next = applySettingsChanges(DEFAULT_SETTINGS, {
      allowEncrypted: { newValue: true },
      theme: { newValue: "dark" },
    });

    expect(next).toEqual({ hlsFormat: "mp4", allowEncrypted: true });
  });

  it("falls back to the default when a value is removed", () => {
    const next = applySettingsChanges(
      { hlsFormat: "ts", allowEncrypted: false },
      { hlsFormat: {} },
    );

    expect(next.hlsFormat).toBe("mp4");
  });
});
