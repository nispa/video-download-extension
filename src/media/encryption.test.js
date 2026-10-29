import { describe, expect, it } from "vitest";
import { hasDrm, isClearKey, segmentIv } from "./encryption.js";

const AES_KEY = { method: "AES-128", keyFormat: "identity", url: "https://a.example/k", iv: null };

describe("isClearKey", () => {
  it("accepts standard AES-128 keys served by URL", () => {
    expect(isClearKey(AES_KEY)).toBe(true);
  });

  it("rejects DRM methods and key systems", () => {
    expect(isClearKey({ ...AES_KEY, method: "SAMPLE-AES" })).toBe(false);
    expect(isClearKey({ ...AES_KEY, keyFormat: "com.apple.streamingkeydelivery" })).toBe(false);
    expect(isClearKey({ ...AES_KEY, url: null })).toBe(false);
  });
});

describe("hasDrm", () => {
  it("is false for clear and AES-128 segments", () => {
    expect(hasDrm([{ key: null }, { key: AES_KEY }])).toBe(false);
  });

  it("is true when any segment uses another key system", () => {
    expect(hasDrm([{ key: null }, { key: { ...AES_KEY, method: "SAMPLE-AES" } }])).toBe(true);
  });
});

describe("segmentIv", () => {
  it("uses the playlist's IV when present", () => {
    const iv = new Uint8Array(16).fill(7);

    expect(segmentIv({ sequence: 3, key: { iv } })).toBe(iv);
  });

  it("derives the IV from the sequence number otherwise", () => {
    const iv = segmentIv({ sequence: 258, key: { iv: null } });

    expect([...iv.slice(12)]).toEqual([0, 0, 1, 2]);
    expect([...iv.slice(0, 12)].every((byte) => byte === 0)).toBe(true);
  });
});
