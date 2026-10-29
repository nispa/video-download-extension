import { describe, expect, it, vi } from "vitest";
import { createJobRegistry } from "./jobs.js";
import { runStreamJob } from "./streamJob.js";

const bytes = (text) => new TextEncoder().encode(text).buffer;
const segment = (name, map = null) => ({
  url: `https://a.example/${name}`,
  range: null,
  map,
  key: null,
});

function setup({ settings = { hlsFormat: "mp4" }, remux, failOn } = {}) {
  const jobs = createJobRegistry({ onChange: () => {} });
  const saved = [];
  const network = {
    bytes: vi.fn(async (url) => {
      if (url.endsWith(failOn)) throw new Error(`cannot fetch ${url}`);
      return bytes(url.split("/").pop());
    }),
  };
  const context = {
    jobs,
    network,
    subtle: {},
    remux: remux ?? (async (parts) => [new Uint8Array([parts.length])]),
    settings: () => settings,
    saveBlob: async (job, blob) => saved.push({ filename: job.filename, blob }),
    concurrency: 2,
  };
  const run = (plan) =>
    runStreamJob(context, { name: "Clip", referer: "", load: async () => plan });
  return { jobs, saved, network, run };
}

const plan = (segments, extra = {}) => ({
  segments,
  extension: "ts",
  live: false,
  encrypted: false,
  ...extra,
});

describe("runStreamJob", () => {
  it("converts TS streams to MP4 when the setting asks for it", async () => {
    const { jobs, saved, run } = setup();

    await run(plan([segment("1.ts"), segment("2.ts")]));

    expect(saved[0].filename).toBe("Clip.mp4");
    expect(saved[0].blob.type).toBe("video/mp4");
    expect(jobs.snapshot()[0]).toMatchObject({ status: "converting", bytes: 8 });
  });

  it("keeps TS segments as they are when asked to", async () => {
    const { saved, run } = setup({ settings: { hlsFormat: "ts" } });

    await run(plan([segment("1.ts"), segment("2.ts")]));

    expect(saved[0].filename).toBe("Clip.ts");
    expect(await saved[0].blob.text()).toBe("1.ts2.ts");
  });

  it("saves the original TS with a warning when conversion fails", async () => {
    const remux = async () => {
      throw new Error("unsupported codec");
    };
    const { jobs, saved, run } = setup({ remux });

    await run(plan([segment("1.ts")]));

    expect(saved[0].filename).toBe("Clip.ts");
    expect(jobs.snapshot()[0].warning).toEqual({
      code: "conversionFailed",
      detail: "unsupported codec",
    });
  });

  it("joins fMP4 segments after their init segment", async () => {
    const { saved, run } = setup();
    const map = { url: "https://a.example/init.mp4", range: null };

    await run(plan([segment("1.m4s", map), segment("2.m4s", map)], { extension: "mp4" }));

    expect(await saved[0].blob.text()).toBe("init.mp41.m4s2.m4s");
  });

  it("saves encrypted streams unconverted, with the .drm extension", async () => {
    const { saved, run } = setup();

    await run(plan([segment("1.ts")], { encrypted: true }));

    expect(saved[0].filename).toBe("Clip.ts.drm");
    expect(saved[0].blob.type).toBe("application/octet-stream");
  });

  it("fails on an empty plan and on a segment that cannot be fetched", async () => {
    const empty = setup();
    const broken = setup({ failOn: "2.ts" });

    await empty.run(plan([]));
    await broken.run(plan([segment("1.ts"), segment("2.ts")]));

    expect(empty.jobs.snapshot()[0].error).toEqual({ code: "noSegments", detail: "" });
    expect(broken.jobs.snapshot()[0]).toMatchObject({
      status: "error",
      error: { code: "unexpected" },
    });
    expect(broken.saved).toEqual([]);
  });

  it("ends as cancelled when the user cancels", async () => {
    const { jobs, saved, run } = setup();
    const running = run(plan([segment("1.ts"), segment("2.ts"), segment("3.ts")]));

    jobs.cancel("job-1");
    await running;

    expect(jobs.snapshot()[0].status).toBe("cancelled");
    expect(saved).toEqual([]);
  });
});
