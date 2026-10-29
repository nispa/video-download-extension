import { describe, expect, it } from "vitest";
import { fileStem, isHttpUrl, stripRangeParams, urlDir, urlKey } from "./url.js";

describe("isHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isHttpUrl("https://example.com/a")).toBe(true);
    expect(isHttpUrl("HTTP://example.com/a")).toBe(true);
  });

  it("rejects other schemes", () => {
    expect(isHttpUrl("blob:https://example.com/1")).toBe(false);
    expect(isHttpUrl("about:blank")).toBe(false);
  });
});

describe("urlKey", () => {
  it("treats the same segment from different hosts and queries as one", () => {
    const first = urlKey("https://cf.cdn.example/x/video=1486000-0.dash?token=a");
    const second = urlKey("https://ak.cdn.example/x/video%3D1486000-0.dash?token=b");

    expect(first).toBe(second);
  });

  it("keeps the raw path when it is not valid percent-encoding", () => {
    expect(urlKey("https://example.com/a%E0%A4%A.ts")).toBe("/a%E0%A4%A.ts");
  });
});

describe("urlDir", () => {
  it("returns the folder of the path, ending with a slash", () => {
    expect(urlDir("https://example.com/stream/dash/seg-1.m4s?x=1")).toBe("/stream/dash/");
  });
});

describe("stripRangeParams", () => {
  it("removes bytestart and byteend, keeping the other parameters", () => {
    const url = "https://video.example/v.mp4?oh=sig&bytestart=0&byteend=999";

    expect(stripRangeParams(url)).toBe("https://video.example/v.mp4?oh=sig");
  });

  it("returns URLs without range parameters unchanged", () => {
    const url = "https://video.example/v.mp4?oh=sig";

    expect(stripRangeParams(url)).toBe(url);
  });
});

describe("fileStem", () => {
  it("returns the decoded last path segment without extension", () => {
    expect(fileStem("https://example.com/videos/my%20clip.mp4?x=1")).toBe("my clip");
  });

  it("returns an empty string for a bare host", () => {
    expect(fileStem("https://example.com/")).toBe("");
  });

  it("keeps the raw segment when it is not valid percent-encoding", () => {
    expect(fileStem("https://example.com/bad%E0%A4%A.mp4")).toBe("bad%E0%A4%A");
  });
});
