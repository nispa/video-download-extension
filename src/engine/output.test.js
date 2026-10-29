import { describe, expect, it } from "vitest";
import {
  audioSuffix,
  blobType,
  dashExtension,
  hlsExtension,
  outputFilename,
  qualitySuffix,
} from "./output.js";

describe("qualitySuffix", () => {
  it("names the height of a known resolution", () => {
    expect(qualitySuffix({ resolution: "1280x720" })).toBe(" [720p]");
  });

  it("is empty without a resolution", () => {
    expect(qualitySuffix({ resolution: "" })).toBe("");
    expect(qualitySuffix(undefined)).toBe("");
  });
});

describe("audioSuffix", () => {
  it("includes the language when known", () => {
    expect(audioSuffix("en")).toBe(" (audio en)");
    expect(audioSuffix("")).toBe(" (audio)");
  });
});

describe("outputFilename and blobType", () => {
  it("uses the plain extension and media type for clear files", () => {
    expect(outputFilename("Clip [720p]", "mp4", false)).toBe("Clip [720p].mp4");
    expect(blobType("m4a", false)).toBe("audio/mp4");
  });

  it("adds .drm and a generic type for encrypted files", () => {
    expect(outputFilename("Clip", "mp4", true)).toBe("Clip.mp4.drm");
    expect(blobType("mp4", true)).toBe("application/octet-stream");
  });

  it("uses a generic type for unknown extensions", () => {
    expect(blobType("mkv", false)).toBe("application/octet-stream");
  });
});

describe("hlsExtension and dashExtension", () => {
  it("saves HLS with init segments as MP4, others as TS", () => {
    expect(hlsExtension([{ map: { url: "i.mp4" } }])).toBe("mp4");
    expect(hlsExtension([{ map: null }])).toBe("ts");
  });

  it("saves DASH by track type and container", () => {
    expect(dashExtension({ mime: "video/mp4", type: "video" })).toBe("mp4");
    expect(dashExtension({ mime: "audio/mp4", type: "audio" })).toBe("m4a");
    expect(dashExtension({ mime: "video/webm", type: "video" })).toBe("webm");
  });
});
