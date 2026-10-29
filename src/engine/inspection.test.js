import { describe, expect, it } from "vitest";
import { summarizeDash, summarizeHls } from "./inspection.js";

const segment = (url, extra = {}) => ({ url, range: null, map: null, key: null, ...extra });

describe("summarizeHls", () => {
  it("offers the qualities of a master playlist and hides its child playlists", () => {
    const playlist = {
      type: "master",
      variants: [{ url: "https://a.example/v/hi/index.m3u8", bandwidth: 2 }],
      audios: [{ url: "https://a.example/v/audio/en.m3u8", groupId: "aud" }],
    };

    const summary = summarizeHls(playlist, "https://a.example/v/master.m3u8");

    expect(summary.patch.variants).toBe(playlist.variants);
    expect(summary.hiddenUrls).toEqual([
      "https://a.example/v/hi/index.m3u8",
      "https://a.example/v/audio/en.m3u8",
    ]);
    expect(summary.hiddenDirs).toEqual(["/v/hi/", "/v/audio/"]);
  });

  it("describes a media playlist and hides its segments", () => {
    const playlist = {
      type: "media",
      segments: [segment("https://a.example/v/1.ts"), segment("https://a.example/v/2.ts")],
      endList: false,
      totalDuration: 8,
    };

    const summary = summarizeHls(playlist, "https://a.example/v/index.m3u8");

    expect(summary.patch).toEqual({ duration: 8, live: true, drm: false });
    expect(summary.hiddenUrls).toHaveLength(2);
    expect(summary.hiddenDirs).toEqual(["/v/"]);
  });
});

describe("summarizeDash", () => {
  const init = { url: "https://a.example/d/init.mp4", range: null };
  const representation = (id, type, bandwidth, extra = {}) => ({
    id,
    type,
    bandwidth,
    width: type === "video" ? 640 : 0,
    height: type === "video" ? 360 : 0,
    codecs: "",
    lang: "",
    drm: false,
    segments: [segment(`https://a.example/d/${id}-1.m4s`, { map: init })],
    ...extra,
  });

  it("offers video qualities best first, with the first language's best audio", () => {
    const mpd = {
      live: false,
      duration: 60,
      representations: [
        representation("v1", "video", 1),
        representation("v2", "video", 2),
        representation("en-low", "audio", 1, { lang: "en" }),
        representation("en-high", "audio", 3, { lang: "en" }),
        representation("it", "audio", 9, { lang: "it" }),
      ],
    };

    const { patch, hiddenUrls, hiddenDirs } = summarizeDash(mpd);

    expect(patch.variants.map((v) => [v.id, v.resolution])).toEqual([
      ["v2", "640x360"],
      ["v1", "640x360"],
    ]);
    expect(patch.audio).toEqual({ id: "en-high", type: "audio", lang: "en" });
    expect(patch).toMatchObject({ duration: 60, live: false, drm: false });
    expect(hiddenUrls).toContain("https://a.example/d/init.mp4");
    expect(hiddenDirs).toEqual(["/d/"]);
  });

  it("offers audio qualities for audio-only streams, with no separate audio", () => {
    const mpd = {
      live: true,
      duration: 0,
      representations: [representation("a1", "audio", 1), representation("a2", "audio", 2)],
    };

    const { patch } = summarizeDash(mpd);

    expect(patch.variants.map((v) => [v.id, v.resolution])).toEqual([
      ["a2", ""],
      ["a1", ""],
    ]);
    expect(patch.audio).toBeNull();
  });

  it("reports DRM only when every quality is protected", () => {
    const protectedMpd = {
      live: false,
      duration: 1,
      representations: [representation("v1", "video", 1, { drm: true })],
    };

    expect(summarizeDash(protectedMpd).patch.drm).toBe(true);
    expect(summarizeDash({ ...protectedMpd, representations: [] }).patch.drm).toBe(false);
  });
});
