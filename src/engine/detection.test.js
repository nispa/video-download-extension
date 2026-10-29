import { describe, expect, it, vi } from "vitest";
import { createDetector } from "./detection.js";
import { createTabStore } from "./tabStore.js";

const MASTER = { type: "master", variants: [{ url: "https://cdn.example/v/hi.m3u8" }], audios: [] };

function setup({ playlist = MASTER, failManifest = false } = {}) {
  const store = createTabStore({ minFileSize: 100 });
  const streamTasks = {
    loadPlaylist: vi.fn(async () => {
      if (failManifest) throw new Error("HTTP 403");
      return playlist;
    }),
    loadMpd: vi.fn(async () => ({ live: false, duration: 5, representations: [] })),
  };
  const updateBadge = vi.fn();
  const notify = vi.fn();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const detector = createDetector({ store, streamTasks, updateBadge, notify, logger });
  return { store, streamTasks, updateBadge, notify, logger, detector };
}

const response = (url, type, extra = {}) => ({
  tabId: 4,
  statusCode: 200,
  url,
  responseHeaders: [
    { name: "Content-Type", value: type },
    { name: "Content-Length", value: "5000" },
  ],
  documentUrl: "https://page.example/watch",
  ...extra,
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createDetector.onResponse", () => {
  it("lists media files with their size and the page as referer", () => {
    const { store, updateBadge, detector } = setup();

    detector.onResponse(response("https://cdn.example/v.mp4", "video/mp4"));

    expect(store.items(4)).toEqual([
      expect.objectContaining({ kind: "file", size: 5000, referer: "https://page.example/watch" }),
    ]);
    expect(updateBadge).toHaveBeenCalledWith(4);
  });

  it("lists the whole file once for ranged requests, with an unknown size", () => {
    const { store, detector } = setup();

    detector.onResponse(response("https://fb.example/v.mp4?bytestart=0&byteend=9", "video/mp4"));
    detector.onResponse(response("https://fb.example/v.mp4?bytestart=10&byteend=19", "video/mp4"));

    expect(store.items(4)).toEqual([
      expect.objectContaining({ url: "https://fb.example/v.mp4", size: 0 }),
    ]);
  });

  it("ignores failed responses, background requests and non-media", () => {
    const { store, detector } = setup();

    detector.onResponse(response("https://cdn.example/v.mp4", "video/mp4", { statusCode: 404 }));
    detector.onResponse(response("https://cdn.example/v.mp4", "video/mp4", { tabId: -1 }));
    detector.onResponse(response("https://cdn.example/page", "text/html"));

    expect(store.count(4)).toBe(0);
  });

  it("uses the initiator as referer in Chromium", () => {
    const { store, detector } = setup();

    detector.onResponse(
      response("https://cdn.example/v.mp4", "video/mp4", {
        documentUrl: undefined,
        initiator: "https://page.example",
      }),
    );

    expect(store.items(4)[0].referer).toBe("https://page.example");
  });

  it("reads manifests to offer qualities and hide child playlists", async () => {
    const { store, detector } = setup();

    detector.onResponse(response("https://cdn.example/v/master.m3u8", "application/x-mpegurl"));
    detector.onResponse(response("https://cdn.example/v/hi.m3u8", "application/x-mpegurl"));
    await settle();

    expect(store.items(4).map((item) => item.url)).toEqual(["https://cdn.example/v/master.m3u8"]);
    expect(store.items(4)[0].variants).toHaveLength(1);
  });

  it("reads DASH manifests too", async () => {
    const { store, streamTasks, detector } = setup();

    detector.onResponse(response("https://cdn.example/d/stream.mpd", "application/dash+xml"));
    await settle();

    expect(streamTasks.loadMpd).toHaveBeenCalledOnce();
    expect(store.items(4)[0]).toMatchObject({ duration: 5, drm: false });
  });

  it("keeps a manifest that cannot be read, with its error", async () => {
    const { store, logger, detector } = setup({ failManifest: true });

    detector.onResponse(response("https://cdn.example/v/master.m3u8", "application/x-mpegurl"));
    await settle();

    expect(store.items(4)[0].error).toEqual({ code: "unexpected", detail: "HTTP 403" });
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});

describe("createDetector for tags and navigation", () => {
  it("lists http sources of video tags as files", () => {
    const { store, detector } = setup();

    detector.onElementsFound(4, ["https://cdn.example/clip", "blob:https://x/1"], "https://page/");

    expect(store.items(4)).toEqual([
      expect.objectContaining({
        url: "https://cdn.example/clip",
        kind: "file",
        referer: "https://page/",
      }),
    ]);
  });

  it("starts over on navigation and forgets closed tabs", () => {
    const { store, notify, detector } = setup();
    detector.onResponse(response("https://cdn.example/v.mp4", "video/mp4"));
    detector.onResponse(response("https://cdn.example/w.mp4", "video/mp4", { tabId: 5 }));

    detector.onNavigation(4);
    detector.onTabRemoved(5);

    expect(store.count(4)).toBe(0);
    expect(store.count(5)).toBe(0);
    expect(notify).toHaveBeenCalled();
  });
});
