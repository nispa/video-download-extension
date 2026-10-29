import { EngineError, ERROR, toErrorInfo } from "./errors.js";
import { JOB_STATUS } from "./jobs.js";
import { blobType, outputFilename } from "./output.js";
import { assembleChunks, createSegmentFetcher, runInParallel } from "./segments.js";

/**
 * Runs one stream download: loads its plan, fetches every segment, converts or
 * joins them and saves the file. Failures end up on the job, never thrown.
 * @param {object} context
 * @param {ReturnType<import("./jobs.js").createJobRegistry>} context.jobs
 * @param {{ bytes: Function }} context.network
 * @param {SubtleCrypto} context.subtle
 * @param {(parts: ArrayBuffer[], onProgress: Function) => Promise<Uint8Array[]>} context.remux TS to MP4
 * @param {() => { hlsFormat: string }} context.settings
 * @param {(job: object, blob: Blob) => Promise<void>} context.saveBlob
 * @param {number} context.concurrency
 * @param {{ name: string, referer: string, load: Function }} task from streamTasks
 */
export async function runStreamJob(context, task) {
  const { jobs } = context;
  const job = jobs.create(task.name);
  const signal = jobs.signal(job);
  try {
    const plan = await task.load(signal);
    if (plan.segments.length === 0) throw new EngineError(ERROR.NO_SEGMENTS);
    jobs.update(job, {
      filename: outputFilename(task.name, plan.extension, plan.encrypted),
      live: plan.live,
    });
    const fetcher = createSegmentFetcher({ ...context, referer: task.referer, signal });
    const total = plan.segments.length;
    let completed = 0;
    const parts = await runInParallel(total, (i) => fetcher.segment(plan.segments[i]), {
      concurrency: context.concurrency,
      signal,
      onResult: (data) => {
        completed++;
        jobs.update(job, { progress: completed / total, bytes: job.bytes + data.byteLength });
      },
    });
    if (signal.aborted) return jobs.finish(job, JOB_STATUS.CANCELLED);
    const blob = await buildFile(context, job, task, plan, { parts, fetcher });
    await context.saveBlob(job, blob);
  } catch (error) {
    jobs.stop(job); // segments still in flight are not needed any more
    if (job.cancelled) jobs.finish(job, JOB_STATUS.CANCELLED);
    else jobs.finish(job, JOB_STATUS.ERROR, toErrorInfo(error));
  }
}

/** Converts .ts streams to MP4 when asked to; otherwise joins the segments as they are. */
async function buildFile(context, job, task, plan, { parts, fetcher }) {
  const convert =
    plan.extension === "ts" && !plan.encrypted && context.settings().hlsFormat === "mp4";
  if (convert) {
    context.jobs.update(job, { status: JOB_STATUS.CONVERTING, progress: 0 });
    try {
      const mp4 = await context.remux(parts, (progress) => context.jobs.update(job, { progress }));
      context.jobs.update(job, { filename: outputFilename(task.name, "mp4", false) });
      return new Blob(mp4, { type: blobType("mp4", false) });
    } catch (error) {
      // Not convertible (unusual codecs): the original .ts is still a good file.
      context.jobs.update(job, {
        warning: { code: ERROR.CONVERSION_FAILED, detail: toErrorInfo(error).detail },
      });
    }
  }
  const chunks = await assembleChunks(plan.segments, parts, (map) => fetcher.init(map));
  return new Blob(chunks, { type: blobType(plan.extension, plan.encrypted) });
}
