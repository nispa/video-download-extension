import { sanitizeFilename } from "../core/filename.js";
import { fileStem } from "../core/url.js";
import { fileExtension } from "../media/classify.js";
import { ERROR, toErrorInfo } from "./errors.js";
import { JOB_STATUS } from "./jobs.js";
import { runStreamJob } from "./streamJob.js";

/**
 * Starts downloads of detected items and saves finished files through the browser.
 * @param {object} deps
 * @param {ReturnType<import("./jobs.js").createJobRegistry>} deps.jobs
 * @param {ReturnType<import("./streamTasks.js").createStreamTasks>} deps.streamTasks
 * @param {object} deps.streamContext everything runStreamJob needs except jobs and saveBlob
 * @param {{ download: (options: object) => Promise<number> }} deps.downloads browser downloads
 * @param {{ create: (blob: Blob) => string, revoke: (url: string) => void }} deps.blobUrls
 * @param {(tabId: number) => Promise<string>} deps.tabTitle
 * @param {(url: string, referer: string) => Promise<void> | void} deps.setReferer
 */
export function createDownloadService(deps) {
  const { jobs, downloads, blobUrls } = deps;
  const savingBlobs = new Map(); // browser download id -> { objectUrl, job }

  async function saveBlob(job, blob) {
    jobs.update(job, { status: JOB_STATUS.SAVING });
    const objectUrl = blobUrls.create(blob);
    try {
      const id = await downloads.download({
        url: objectUrl,
        filename: job.filename,
        saveAs: false,
      });
      savingBlobs.set(id, { objectUrl, job });
    } catch (error) {
      blobUrls.revoke(objectUrl);
      throw error;
    }
  }

  /** The page title, or the file name when the tab is gone. */
  async function baseName(item) {
    const title = await deps.tabTitle(item.tabId);
    return sanitizeFilename(title || fileStem(item.url));
  }

  /** Direct files go to the browser's download manager, which shows their progress. */
  async function downloadFile(item, name) {
    const job = jobs.create(`${name}.${fileExtension(item.url, item.mime)}`);
    try {
      await deps.setReferer(item.url, item.referer);
      await downloads.download({ url: item.url, filename: job.filename, saveAs: false });
      jobs.finish(job, JOB_STATUS.HANDED);
    } catch (error) {
      jobs.finish(job, JOB_STATUS.ERROR, toErrorInfo(error));
    }
  }

  return {
    /** Downloads an item at the chosen quality (index into item.variants). */
    async download(item, variantIndex) {
      const name = await baseName(item);
      if (item.kind === "file") return downloadFile(item, name);
      const tasks =
        item.kind === "hls"
          ? deps.streamTasks.forHls(item, variantIndex, name)
          : deps.streamTasks.forDash(item, variantIndex, name);
      const context = { ...deps.streamContext, jobs, saveBlob };
      await Promise.all(tasks.map((task) => runStreamJob(context, task)));
    },

    /** Browser download events: frees saved blobs and completes their jobs. */
    onDownloadChanged(delta) {
      const saving = savingBlobs.get(delta.id);
      const state = delta.state?.current;
      if (!saving || (state !== "complete" && state !== "interrupted")) return;
      blobUrls.revoke(saving.objectUrl);
      savingBlobs.delete(delta.id);
      if (state === "complete") jobs.finish(saving.job, JOB_STATUS.DONE);
      else jobs.finish(saving.job, JOB_STATUS.ERROR, { code: ERROR.SAVE_INTERRUPTED, detail: "" });
    },
  };
}
