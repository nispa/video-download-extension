/** Lifecycle of a download, as shown in the popup. */
export const JOB_STATUS = Object.freeze({
  DOWNLOADING: "downloading",
  CONVERTING: "converting",
  SAVING: "saving",
  /** Passed to the browser's own download manager (direct files). */
  HANDED: "handed",
  DONE: "done",
  ERROR: "error",
  CANCELLED: "cancelled",
});

const ACTIVE_STATUSES = new Set([JOB_STATUS.DOWNLOADING, JOB_STATUS.CONVERTING, JOB_STATUS.SAVING]);

/**
 * True while a job is still running.
 * @param {string} status
 */
export function isActive(status) {
  return ACTIVE_STATUSES.has(status);
}

/**
 * The downloads of this session. Jobs are plain objects (safe to send to the
 * popup); each has an AbortController kept here, used to cancel it.
 * @param {{ onChange: () => void }} options called after every change
 */
export function createJobRegistry({ onChange }) {
  const jobs = new Map();
  const controllers = new Map();
  let nextId = 1;

  return {
    create(filename, fields = {}) {
      const job = {
        id: `job-${nextId++}`,
        filename,
        status: JOB_STATUS.DOWNLOADING,
        progress: 0,
        bytes: 0,
        error: null,
        ...fields,
      };
      jobs.set(job.id, job);
      controllers.set(job.id, new AbortController());
      onChange();
      return job;
    },

    /** Signal that aborts when the user cancels the job. */
    signal(job) {
      return controllers.get(job.id).signal;
    },

    update(job, fields) {
      Object.assign(job, fields);
      onChange();
    },

    finish(job, status, error = null) {
      Object.assign(job, { status, error }, status === JOB_STATUS.DONE ? { progress: 1 } : {});
      onChange();
    },

    /** Cancelled by the user: aborts the work and marks the job. */
    cancel(id) {
      if (!jobs.has(id)) return;
      jobs.get(id).cancelled = true;
      controllers.get(id).abort();
    },

    /** Aborts the job's remaining work (e.g. after a failure) without marking it cancelled. */
    stop(job) {
      controllers.get(job.id)?.abort();
    },

    dismiss(id) {
      jobs.delete(id);
      controllers.delete(id);
      onChange();
    },

    /** Copies of all jobs, newest first. */
    snapshot() {
      return [...jobs.values()].reverse().map((job) => ({ ...job }));
    },
  };
}
