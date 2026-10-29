import { describe, expect, it, vi } from "vitest";
import { createJobRegistry } from "./jobs.js";
import { applyHostMessage, createYtdlpService, YTDLP_HOST } from "./ytdlp.js";

function fakePort() {
  const listeners = { message: [], disconnect: [] };
  return {
    onMessage: { addListener: (fn) => listeners.message.push(fn) },
    onDisconnect: { addListener: (fn) => listeners.disconnect.push(fn) },
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    receive: (message) => listeners.message.forEach((fn) => fn(message)),
    close: (error) => listeners.disconnect.forEach((fn) => fn({ error })),
  };
}

function setup(reply) {
  const port = fakePort();
  const native = {
    send: vi.fn(async () => {
      if (reply instanceof Error) throw reply;
      return reply;
    }),
    connect: vi.fn(() => port),
  };
  const jobs = createJobRegistry({ onChange: () => {} });
  return { port, native, jobs, service: createYtdlpService({ native, jobs }) };
}

describe("createYtdlpService.check", () => {
  it("reports the version and caches a working host", async () => {
    const { native, service } = setup({ type: "check", ok: true, version: "2026.08.19" });

    await service.check();
    const status = await service.check();

    expect(status).toMatchObject({ ok: true, version: "2026.08.19" });
    expect(native.send).toHaveBeenCalledOnce();
    expect(native.send).toHaveBeenCalledWith(YTDLP_HOST, { type: "check" });
  });

  it("reports a missing host, and asks again next time", async () => {
    const { native, service } = setup(new Error("No such native application"));

    const status = await service.check();
    await service.check();

    expect(status).toEqual({ ok: false, error: { code: "ytdlpMissing", detail: "" } });
    expect(native.send).toHaveBeenCalledTimes(2);
  });

  it("treats a malformed reply as missing", async () => {
    expect((await setup({ ok: true }).service.check()).ok).toBe(false);
  });
});

describe("createYtdlpService.download", () => {
  it("asks the host to download the page and follows its messages", () => {
    const { port, jobs, service } = setup();

    service.download("https://video.example/watch", "720p", "A: talk");
    port.receive({ type: "title", title: "A talk" });
    port.receive({ type: "done", file: "C:/Downloads/A talk.mp4" });

    expect(port.postMessage).toHaveBeenCalledWith({
      type: "download",
      url: "https://video.example/watch",
      format: "720p",
    });
    expect(jobs.snapshot()[0]).toMatchObject({
      filename: "A talk",
      status: "done",
      via: "yt-dlp",
      detail: "C:/Downloads/A talk.mp4",
    });
  });

  it("names the job after the URL when the page has no title", () => {
    const { jobs, service } = setup();

    service.download("https://video.example/watch", "best", "");

    expect(jobs.snapshot()[0].filename).toBe("https://video.example/watch");
  });

  it("fails the job when the host closes unexpectedly, but not after it finished", () => {
    const first = setup();
    const second = setup();
    first.service.download("https://v.example/1", "best");
    second.service.download("https://v.example/2", "best");

    first.port.close({ message: "host crashed" });
    second.port.receive({ type: "done", file: "" });
    second.port.close();

    expect(first.jobs.snapshot()[0].error).toEqual({ code: "ytdlpClosed", detail: "host crashed" });
    expect(second.jobs.snapshot()[0].status).toBe("done");
  });

  it("disconnects the host when the user cancels", () => {
    const { port, jobs, service } = setup();
    const job = service.download("https://v.example/1", "best");

    jobs.cancel(job.id);

    expect(port.disconnect).toHaveBeenCalledOnce();
    expect(jobs.snapshot()[0].status).toBe("cancelled");
  });
});

describe("applyHostMessage", () => {
  it("shows progress with speed and remaining time", () => {
    const jobs = createJobRegistry({ onChange: () => {} });
    const job = jobs.create("x");

    applyHostMessage(jobs, job, {
      type: "progress",
      percent: 42.5,
      speed: "1.2MiB/s",
      eta: "00:10",
    });

    expect(job).toMatchObject({ progress: 0.425, detail: "1.2MiB/s · ETA 00:10" });
  });

  it("records yt-dlp errors and ignores malformed messages", () => {
    const jobs = createJobRegistry({ onChange: () => {} });
    const job = jobs.create("x");

    applyHostMessage(jobs, job, null);
    applyHostMessage(jobs, job, { type: "progress", percent: "half" });
    applyHostMessage(jobs, job, { type: "error", message: "Unsupported URL" });

    expect(job).toMatchObject({
      status: "error",
      error: { code: "ytdlpFailed", detail: "Unsupported URL" },
    });
  });
});
