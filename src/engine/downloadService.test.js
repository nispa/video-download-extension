import { describe, expect, it, vi } from "vitest";
import { createDownloadService } from "./downloadService.js";
import { createJobRegistry } from "./jobs.js";

function setup({ title = "My Page", downloadFails = false } = {}) {
  const jobs = createJobRegistry({ onChange: () => {} });
  const downloads = {
    download: vi.fn(async () => {
      if (downloadFails) throw new Error("download refused");
      return 42;
    }),
  };
  const blobUrls = { create: vi.fn(() => "blob:1"), revoke: vi.fn() };
  const streamTasks = {
    forHls: vi.fn((item, index, name) => [
      { name, referer: "", load: async () => ({ segments: [], extension: "ts" }) },
    ]),
    forDash: vi.fn(() => []),
  };
  const service = createDownloadService({
    jobs,
    streamTasks,
    streamContext: { network: { bytes: async () => new ArrayBuffer(1) }, settings: () => ({}) },
    downloads,
    blobUrls,
    tabTitle: async () => title,
    setReferer: vi.fn(),
  });
  return { jobs, downloads, blobUrls, streamTasks, service };
}

const fileItem = {
  kind: "file",
  url: "https://a.example/v.webm",
  mime: "video/webm",
  tabId: 1,
  referer: "r",
};

describe("createDownloadService", () => {
  it("hands direct files to the browser, named after the page", async () => {
    const { jobs, downloads, service } = setup({ title: "Clip: part 1" });

    await service.download(fileItem, 0);

    expect(downloads.download).toHaveBeenCalledWith({
      url: "https://a.example/v.webm",
      filename: "Clip_ part 1.webm",
      saveAs: false,
    });
    expect(jobs.snapshot()[0].status).toBe("handed");
  });

  it("names files after the URL when the tab has no title", async () => {
    const { downloads, service } = setup({ title: "" });

    await service.download(fileItem, 0);

    expect(downloads.download.mock.calls[0][0].filename).toBe("v.webm");
  });

  it("reports a direct download the browser refuses", async () => {
    const { jobs, service } = setup({ downloadFails: true });

    await service.download(fileItem, 0);

    expect(jobs.snapshot()[0]).toMatchObject({
      status: "error",
      error: { detail: "download refused" },
    });
  });

  it("runs the stream tasks of HLS and DASH items", async () => {
    const { streamTasks, service } = setup();

    await service.download({ kind: "hls", url: "https://a.example/v.m3u8", tabId: 1 }, 2);
    await service.download({ kind: "dash", url: "https://a.example/v.mpd", tabId: 1 }, 0);

    expect(streamTasks.forHls).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "hls" }),
      2,
      "My Page",
    );
    expect(streamTasks.forDash).toHaveBeenCalledOnce();
  });

  it("completes saved blobs when the browser finishes writing them", async () => {
    const { jobs, blobUrls, service, streamTasks } = setup();
    streamTasks.forHls.mockReturnValue([
      {
        name: "Clip",
        referer: "",
        load: async () => ({
          segments: [{ url: "https://a.example/1.ts", map: null, key: null }],
          extension: "ts",
        }),
      },
    ]);
    await service.download({ kind: "hls", url: "https://a.example/v.m3u8", tabId: 1 }, 0);

    service.onDownloadChanged({ id: 7, state: { current: "complete" } });
    service.onDownloadChanged({ id: 42, state: { current: "in_progress" } });
    service.onDownloadChanged({ id: 42, state: { current: "complete" } });

    expect(jobs.snapshot()[0].status).toBe("done");
    expect(blobUrls.revoke).toHaveBeenCalledWith("blob:1");
  });

  it("reports interrupted saves", async () => {
    const { jobs, service, streamTasks } = setup();
    streamTasks.forHls.mockReturnValue([
      {
        name: "Clip",
        referer: "",
        load: async () => ({
          segments: [{ url: "https://a.example/1.ts", map: null, key: null }],
          extension: "mp4",
        }),
      },
    ]);
    await service.download({ kind: "hls", url: "https://a.example/v.m3u8", tabId: 1 }, 0);

    service.onDownloadChanged({ id: 42, state: { current: "interrupted" } });

    expect(jobs.snapshot()[0].error).toEqual({ code: "saveInterrupted", detail: "" });
  });

  it("frees the blob and fails the job when the browser refuses to save it", async () => {
    const { jobs, blobUrls, service, streamTasks } = setup({ downloadFails: true });
    streamTasks.forHls.mockReturnValue([
      {
        name: "Clip",
        referer: "",
        load: async () => ({
          segments: [{ url: "https://a.example/1.ts", map: null, key: null }],
          extension: "mp4",
        }),
      },
    ]);

    await service.download({ kind: "hls", url: "https://a.example/v.m3u8", tabId: 1 }, 0);

    expect(blobUrls.revoke).toHaveBeenCalledWith("blob:1");
    expect(jobs.snapshot()[0]).toMatchObject({
      status: "error",
      error: { detail: "download refused" },
    });
  });
});
