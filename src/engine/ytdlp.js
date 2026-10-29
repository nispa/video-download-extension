import { sanitizeFilename } from "../core/filename.js";
import { ERROR } from "./errors.js";
import { JOB_STATUS } from "./jobs.js";

/** Name of the native messaging host registered by native-host/install.ps1. */
export const YTDLP_HOST = "video_grabber_ytdlp";
/** Formats the native host knows (native-host/ytdlpArgs.js). */
export const YTDLP_FORMATS = Object.freeze(["best", "1080p", "720p", "audio"]);
const PERCENT = 100;

/**
 * Downloads whole pages with yt-dlp, through the native messaging host.
 * @param {object} deps
 * @param {{ send: (host: string, message: object) => Promise<unknown>, connect: (host: string) => object }} deps.native
 * @param {ReturnType<import("./jobs.js").createJobRegistry>} deps.jobs
 */
export function createYtdlpService({ native, jobs }) {
  let status = null;

  return {
    /** `{ ok: true, version }` when the host and yt-dlp work; cached once it does. */
    async check() {
      if (status?.ok) return status;
      try {
        const reply = await native.send(YTDLP_HOST, { type: "check" });
        status = isCheckReply(reply) ? reply : missing();
      } catch {
        status = missing();
      }
      return status;
    },

    download(url, format, title) {
      const job = jobs.create(title ? sanitizeFilename(title) : url, { via: "yt-dlp" });
      const port = native.connect(YTDLP_HOST);
      port.onMessage.addListener((message) => applyHostMessage(jobs, job, message));
      port.onDisconnect.addListener((closed) => {
        if (job.status !== JOB_STATUS.DOWNLOADING) return;
        const detail = closed?.error?.message ?? "";
        jobs.finish(job, JOB_STATUS.ERROR, { code: ERROR.YTDLP_CLOSED, detail });
      });
      jobs.signal(job).addEventListener("abort", () => {
        port.disconnect(); // the host then stops yt-dlp
        if (job.status === JOB_STATUS.DOWNLOADING) jobs.finish(job, JOB_STATUS.CANCELLED);
      });
      port.postMessage({ type: "download", url, format });
      return job;
    },
  };
}

/**
 * Applies one message of the native host to its job; malformed messages are ignored.
 * @param {ReturnType<import("./jobs.js").createJobRegistry>} jobs
 * @param {object} job
 * @param {unknown} message
 */
export function applyHostMessage(jobs, job, message) {
  if (typeof message !== "object" || message === null) return;
  if (message.type === "title" && typeof message.title === "string") {
    jobs.update(job, { filename: message.title });
  } else if (message.type === "progress" && typeof message.percent === "number") {
    const detail = [message.speed, message.eta && `ETA ${message.eta}`].filter(Boolean).join(" · ");
    jobs.update(job, { progress: message.percent / PERCENT, detail });
  } else if (message.type === "done") {
    jobs.update(job, { detail: String(message.file ?? "") });
    jobs.finish(job, JOB_STATUS.DONE);
  } else if (message.type === "error") {
    jobs.update(job, { detail: "" });
    jobs.finish(job, JOB_STATUS.ERROR, {
      code: ERROR.YTDLP_FAILED,
      detail: String(message.message ?? ""),
    });
  }
}

function isCheckReply(reply) {
  return (
    typeof reply === "object" &&
    reply !== null &&
    reply.ok === true &&
    typeof reply.version === "string"
  );
}

function missing() {
  return { ok: false, error: { code: ERROR.YTDLP_MISSING, detail: "" } };
}
