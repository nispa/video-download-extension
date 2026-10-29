import { describe, expect, it, vi } from "vitest";
import { createEngine } from "./engine.js";

function setup() {
  const deps = {
    fetch: vi.fn(async () => ({
      ok: true,
      url: "",
      text: async () => "",
      arrayBuffer: async () => new ArrayBuffer(0),
    })),
    setReferer: vi.fn(),
    sleep: async () => {},
    schedule: (callback) => callback(),
    parseXml: vi.fn(),
    subtle: {},
    remux: vi.fn(),
    blobUrls: { create: vi.fn(), revoke: vi.fn() },
    downloads: { download: vi.fn(async () => 1) },
    setBadge: vi.fn(),
    tabTitle: async () => "Page",
    native: { send: vi.fn(async () => ({ ok: true, version: "1" })), connect: vi.fn() },
    notifyPopup: vi.fn(),
    settings: () => ({ hlsFormat: "mp4", allowEncrypted: false }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
  return { deps, engine: createEngine(deps) };
}

const mediaResponse = {
  tabId: 2,
  statusCode: 200,
  url: "https://cdn.example/v.mp4",
  responseHeaders: [{ name: "content-type", value: "video/mp4" }],
};

describe("createEngine", () => {
  it("lists detected media in the state of its tab and updates the badge", () => {
    const { deps, engine } = setup();

    engine.onResponse(mediaResponse);
    const state = engine.handleMessage({ type: "get-state", tabId: 2 });

    expect(state.items).toHaveLength(1);
    expect(state.jobs).toEqual([]);
    expect(deps.setBadge).toHaveBeenLastCalledWith(2, "1");
    expect(deps.notifyPopup).toHaveBeenCalled();
  });

  it("clears the badge when the tab navigates", () => {
    const { deps, engine } = setup();
    engine.onResponse(mediaResponse);

    engine.onNavigation(2);

    expect(deps.setBadge).toHaveBeenLastCalledWith(2, "");
  });

  it("downloads items by id and reports unknown ones", async () => {
    const { deps, engine } = setup();
    engine.onResponse(mediaResponse);
    const [item] = engine.handleMessage({ type: "get-state", tabId: 2 }).items;

    expect(engine.handleMessage({ type: "download", itemId: item.id })).toEqual({ ok: true });
    expect(engine.handleMessage({ type: "download", itemId: "item-99" })).toEqual({
      error: { code: "itemNotFound", detail: "item-99" },
    });
    await vi.waitFor(() => expect(deps.downloads.download).toHaveBeenCalledOnce());
  });

  it("cancels and dismisses jobs", async () => {
    const { engine } = setup();
    engine.onResponse(mediaResponse);
    const [item] = engine.handleMessage({ type: "get-state", tabId: 2 }).items;
    engine.handleMessage({ type: "download", itemId: item.id });
    await vi.waitFor(() =>
      expect(engine.handleMessage({ type: "get-state", tabId: 2 }).jobs).toHaveLength(1),
    );

    engine.handleMessage({ type: "cancel", jobId: "job-1" });
    engine.handleMessage({ type: "dismiss", jobId: "job-1" });

    expect(engine.handleMessage({ type: "get-state", tabId: 2 }).jobs).toEqual([]);
  });

  it("checks and starts yt-dlp", async () => {
    const port = {
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() },
      postMessage: vi.fn(),
    };
    const { deps, engine } = setup();
    deps.native.connect.mockReturnValue(port);

    expect((await engine.handleMessage({ type: "ytdlp-status" })).ok).toBe(true);
    engine.handleMessage({ type: "ytdlp-download", url: "https://v.example/w", format: "best" });

    expect(port.postMessage).toHaveBeenCalledOnce();
  });

  it("takes media found in tags from content scripts only", () => {
    const { engine } = setup();
    const message = { type: "found-elements", urls: ["https://cdn.example/clip.mp4"] };

    expect(engine.handleMessage(message, {})).toBeUndefined();
    engine.handleMessage(message, { tab: { id: 7 }, url: "https://page/" });

    expect(engine.handleMessage({ type: "get-state", tabId: 7 }).items).toHaveLength(1);
  });

  it("ignores unknown messages and forgets closed tabs", () => {
    const { engine } = setup();
    engine.onResponse(mediaResponse);

    engine.onTabRemoved(2);
    engine.onDownloadChanged({ id: 1 });

    expect(engine.handleMessage({ type: "nope" })).toBeUndefined();
    expect(engine.handleMessage({ type: "get-state", tabId: 2 }).items).toEqual([]);
  });
});
