import { describe, expect, it } from "vitest";
import {
  errorText,
  itemFacts,
  itemName,
  itemWarning,
  jobLine,
  tagLabel,
  variantLabel,
} from "./labels.js";

/** Fake translator: shows the key and its values, so tests read like the message table. */
const t = (key, ...values) => (values.length ? `${key}(${values.join(",")})` : key);

describe("tagLabel", () => {
  it("names streams by protocol and files by type", () => {
    expect(tagLabel({ kind: "hls", mime: "" })).toBe("HLS");
    expect(tagLabel({ kind: "file", mime: "audio/mp4" })).toBe("AUDIO");
    expect(tagLabel({ kind: "file", mime: "video/webm" })).toBe("WEBM");
    expect(tagLabel({ kind: "file", mime: "" })).toBe("MEDIA");
  });
});

describe("itemName", () => {
  it("shows the decoded file name, or the host for bare URLs", () => {
    expect(itemName({ url: "https://a.example/v/my%20clip.mp4?x=1" })).toBe("my clip.mp4");
    expect(itemName({ url: "https://a.example/" })).toBe("a.example");
    expect(itemName({ url: "https://a.example/bad%E0%A4%A.mp4" })).toBe("bad%E0%A4%A.mp4");
  });
});

describe("itemFacts", () => {
  it("lists size, qualities, duration, separate audio and live state", () => {
    const item = { kind: "dash", variants: [{}, {}], duration: 90, audio: { id: "a" }, live: true };

    expect(itemFacts(item, t)).toEqual(["qualities(2)", "1:30", "separateAudio", "live"]);
    expect(itemFacts({ kind: "file", size: 0 }, t)).toEqual(["unknownSize"]);
    expect(itemFacts({ kind: "file", size: 2048 }, t)).toEqual(["2.0 KB"]);
  });
});

describe("itemWarning", () => {
  it("prefers the item's error, then explains its DRM", () => {
    expect(itemWarning({ error: { code: "http", detail: "403" }, drm: true }, t, false)).toBe(
      "error_http (403)",
    );
    expect(itemWarning({ drm: true }, t, false)).toBe("drmBlocked");
    expect(itemWarning({ drm: true }, t, true)).toBe("drmAllowed");
    expect(itemWarning({}, t, false)).toBe("");
  });
});

describe("variantLabel", () => {
  it("shows height and bitrate", () => {
    expect(variantLabel({ resolution: "1024x576", bandwidth: 1486000 }, t)).toBe("576p · 1.5 Mbps");
    expect(variantLabel({ resolution: "", bandwidth: 0 }, t)).toBe("unknownQuality");
  });
});

describe("jobLine", () => {
  it("shows progress of running jobs", () => {
    const job = {
      status: "downloading",
      progress: 0.42,
      bytes: 2048,
      via: "yt-dlp",
      detail: "1MiB/s",
    };

    expect(jobLine(job, t)).toBe("yt-dlp · status_downloading · 42% · 2.0 KB · 1MiB/s");
  });

  it("shows the error of failed jobs", () => {
    const job = {
      status: "error",
      progress: 0,
      bytes: 0,
      error: { code: "drmProtected", detail: "" },
    };

    expect(jobLine(job, t)).toBe("status_error · error_drmProtected");
  });
});

describe("errorText", () => {
  it("adds the detail in brackets when there is one", () => {
    expect(errorText({ code: "ytdlpFailed", detail: "Unsupported URL" }, t)).toBe(
      "error_ytdlpFailed (Unsupported URL)",
    );
  });
});
