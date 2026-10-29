import { describe, expect, it } from "vitest";
import {
  classifyMedia,
  contentType,
  fileExtension,
  headerValue,
  responseSize,
} from "./classify.js";

describe("classifyMedia", () => {
  it("recognizes HLS playlists by MIME type or extension", () => {
    expect(classifyMedia("https://cdn.example/a", "application/vnd.apple.mpegurl")).toBe("hls");
    expect(classifyMedia("https://cdn.example/a.m3u8?t=1", "text/plain")).toBe("hls");
  });

  it("recognizes DASH manifests by MIME type or extension", () => {
    expect(classifyMedia("https://cdn.example/a", "application/dash+xml")).toBe("dash");
    expect(classifyMedia("https://cdn.example/stream.mpd", "")).toBe("dash");
  });

  it("recognizes media files by MIME type", () => {
    expect(classifyMedia("https://cdn.example/watch", "video/mp4")).toBe("file");
    expect(classifyMedia("https://cdn.example/song", "audio/mpeg")).toBe("file");
  });

  it("recognizes media files by extension when the type is generic or missing", () => {
    expect(classifyMedia("https://cdn.example/v.webm", "application/octet-stream")).toBe("file");
    expect(classifyMedia("https://cdn.example/v.mp4", "")).toBe("file");
  });

  it("ignores stream segments, which belong to a playlist", () => {
    expect(classifyMedia("https://cdn.example/seg1.ts", "video/mp2t")).toBeNull();
    expect(classifyMedia("https://cdn.example/chunk.m4s", "video/mp4")).toBeNull();
  });

  it("ignores pages, YouTube pieces and non-http URLs", () => {
    expect(classifyMedia("https://example.com/", "text/html")).toBeNull();
    expect(classifyMedia("https://r1.googlevideo.com/videoplayback", "video/mp4")).toBeNull();
    expect(classifyMedia("blob:https://example.com/1", "video/mp4")).toBeNull();
    expect(classifyMedia("not a url", "video/mp4")).toBeNull();
  });
});

describe("headerValue and contentType", () => {
  const headers = [{ name: "Content-Type", value: "Video/MP4; charset=binary" }];

  it("finds headers regardless of case", () => {
    expect(headerValue(headers, "content-type")).toBe("Video/MP4; charset=binary");
  });

  it("returns an empty string for missing headers", () => {
    expect(headerValue(undefined, "content-length")).toBe("");
  });

  it("returns the lowercased MIME type without parameters", () => {
    expect(contentType(headers)).toBe("video/mp4");
  });
});

describe("responseSize", () => {
  it("reads the full size from Content-Range on partial responses", () => {
    const headers = [
      { name: "Content-Range", value: "bytes 0-1/123456" },
      { name: "Content-Length", value: "2" },
    ];

    expect(responseSize(headers, 206)).toBe(123456);
  });

  it("falls back to Content-Length", () => {
    expect(responseSize([{ name: "content-length", value: "789" }], 200)).toBe(789);
    expect(responseSize([{ name: "content-length", value: "5" }], 206)).toBe(5);
  });

  it("is zero when unknown", () => {
    expect(responseSize([], 200)).toBe(0);
  });
});

describe("fileExtension", () => {
  it("keeps a known media extension from the URL", () => {
    expect(fileExtension("https://cdn.example/clip.WEBM?x=1", "video/mp4")).toBe("webm");
  });

  it("derives the extension from the MIME type otherwise", () => {
    expect(fileExtension("https://cdn.example/play", "audio/mpeg")).toBe("mp3");
    expect(fileExtension("https://cdn.example/page.php", "video/quicktime")).toBe("mov");
  });

  it("defaults to mp4", () => {
    expect(fileExtension("https://cdn.example/play", "video/unknown")).toBe("mp4");
  });
});
