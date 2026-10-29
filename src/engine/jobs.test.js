import { describe, expect, it, vi } from "vitest";
import { createJobRegistry, isActive, JOB_STATUS } from "./jobs.js";

describe("createJobRegistry", () => {
  it("creates downloading jobs with extra fields and reports the change", () => {
    const onChange = vi.fn();
    const jobs = createJobRegistry({ onChange });

    const job = jobs.create("Clip.mp4", { via: "yt-dlp" });

    expect(job).toEqual({
      id: "job-1",
      filename: "Clip.mp4",
      status: "downloading",
      progress: 0,
      bytes: 0,
      error: null,
      via: "yt-dlp",
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("updates and finishes jobs, completing progress when done", () => {
    const jobs = createJobRegistry({ onChange: () => {} });
    const job = jobs.create("Clip.mp4");

    jobs.update(job, { progress: 0.5 });
    jobs.finish(job, JOB_STATUS.DONE);

    expect(job).toMatchObject({ status: "done", progress: 1, error: null });
  });

  it("keeps the error of failed jobs", () => {
    const jobs = createJobRegistry({ onChange: () => {} });
    const job = jobs.create("Clip.mp4");

    jobs.finish(job, JOB_STATUS.ERROR, { code: "http", detail: "404" });

    expect(job).toMatchObject({ status: "error", error: { code: "http", detail: "404" } });
  });

  it("cancels through the job's signal, ignoring unknown ids", () => {
    const jobs = createJobRegistry({ onChange: () => {} });
    const job = jobs.create("Clip.mp4");

    jobs.cancel("job-404");
    jobs.cancel(job.id);

    expect(jobs.signal(job).aborted).toBe(true);
    expect(job.cancelled).toBe(true);
  });

  it("stops a job's work without marking it cancelled", () => {
    const jobs = createJobRegistry({ onChange: () => {} });
    const job = jobs.create("Clip.mp4");

    jobs.stop(job);

    expect(jobs.signal(job).aborted).toBe(true);
    expect(job.cancelled).toBeUndefined();
  });

  it("lists copies newest first and forgets dismissed jobs", () => {
    const jobs = createJobRegistry({ onChange: () => {} });
    const first = jobs.create("a.mp4");
    jobs.create("b.mp4");

    jobs.dismiss(first.id);
    const snapshot = jobs.snapshot();
    snapshot[0].filename = "changed";

    expect(jobs.snapshot().map((job) => job.filename)).toEqual(["b.mp4"]);
  });
});

describe("isActive", () => {
  it("is true while downloading, converting or saving", () => {
    expect(isActive(JOB_STATUS.CONVERTING)).toBe(true);
    expect(isActive(JOB_STATUS.HANDED)).toBe(false);
    expect(isActive(JOB_STATUS.CANCELLED)).toBe(false);
  });
});
