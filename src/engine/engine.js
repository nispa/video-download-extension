import { createThrottle } from "../core/throttle.js";
import { createDetector } from "./detection.js";
import { createDownloadService } from "./downloadService.js";
import { ERROR } from "./errors.js";
import { createJobRegistry } from "./jobs.js";
import { parseRequest, REQUEST } from "./messages.js";
import { createNetwork } from "./network.js";
import { createStreamTasks } from "./streamTasks.js";
import { createTabStore } from "./tabStore.js";
import { createYtdlpService } from "./ytdlp.js";

/** Below this size a "video" is almost always a preview or a stray segment. */
const MIN_FILE_SIZE = 512 * 1024;
/** Segments downloaded in parallel per stream. */
const CONCURRENCY = 6;
/** Popup updates are grouped: progress arrives many times a second. */
const NOTIFY_DELAY_MS = 150;

/**
 * Composition of the engine. Every browser capability arrives in `deps`, so the
 * engine runs unchanged in Firefox, in Edge's offscreen document and in tests.
 * @param {object} deps
 * @param {typeof fetch} deps.fetch
 * @param {(url: string, referer: string) => Promise<void> | void} deps.setReferer
 * @param {(ms: number) => Promise<void>} deps.sleep
 * @param {(callback: () => void, ms: number) => unknown} deps.schedule
 * @param {(text: string) => Element} deps.parseXml
 * @param {SubtleCrypto} deps.subtle
 * @param {Function} deps.remux from createTsToMp4
 * @param {{ create: Function, revoke: Function }} deps.blobUrls
 * @param {{ download: Function }} deps.downloads
 * @param {(tabId: number, text: string) => void} deps.setBadge
 * @param {(tabId: number) => Promise<string>} deps.tabTitle
 * @param {{ send: Function, connect: Function }} deps.native
 * @param {() => void} deps.notifyPopup
 * @param {() => { hlsFormat: string, allowEncrypted: boolean }} deps.settings
 * @param {import("../core/logger.js").Logger} deps.logger
 */
export function createEngine(deps) {
  const notify = createThrottle(deps.notifyPopup, NOTIFY_DELAY_MS, deps.schedule);
  const store = createTabStore({ minFileSize: MIN_FILE_SIZE });
  const jobs = createJobRegistry({ onChange: notify });
  const network = createNetwork(deps);
  const streamTasks = createStreamTasks({
    network,
    parseXml: deps.parseXml,
    settings: deps.settings,
  });
  const updateBadge = (tabId) => {
    const count = store.count(tabId);
    deps.setBadge(tabId, count ? String(count) : "");
  };
  const detector = createDetector({ store, streamTasks, updateBadge, notify, logger: deps.logger });
  const streamContext = {
    network,
    subtle: deps.subtle,
    remux: deps.remux,
    settings: deps.settings,
    concurrency: CONCURRENCY,
  };
  const downloads = createDownloadService({ ...deps, jobs, streamTasks, streamContext });
  const ytdlp = createYtdlpService({ native: deps.native, jobs });

  const handlers = {
    [REQUEST.GET_STATE]: ({ tabId }) => ({ items: store.items(tabId), jobs: jobs.snapshot() }),
    [REQUEST.DOWNLOAD]: ({ itemId, variantIndex = 0 }) => {
      const item = store.find(itemId);
      if (!item) return { error: { code: ERROR.ITEM_NOT_FOUND, detail: itemId } };
      void downloads.download(item, variantIndex);
      return { ok: true };
    },
    [REQUEST.CANCEL]: ({ jobId }) => {
      jobs.cancel(jobId);
      return { ok: true };
    },
    [REQUEST.DISMISS]: ({ jobId }) => {
      jobs.dismiss(jobId);
      return { ok: true };
    },
    [REQUEST.YTDLP_STATUS]: () => ytdlp.check(),
    [REQUEST.YTDLP_DOWNLOAD]: ({ url, format, title }) => {
      ytdlp.download(url, format, title);
      return { ok: true };
    },
    [REQUEST.FOUND_ELEMENTS]: ({ urls }, sender) => {
      if (sender?.tab) detector.onElementsFound(sender.tab.id, urls, sender.url ?? "");
      return undefined;
    },
  };

  return {
    onResponse: detector.onResponse,
    onNavigation: detector.onNavigation,
    onTabRemoved: detector.onTabRemoved,
    onDownloadChanged: downloads.onDownloadChanged,

    /** Answers a runtime message; undefined when there is nothing to answer. */
    handleMessage(message, sender) {
      const request = parseRequest(message);
      return request ? handlers[request.type](request, sender) : undefined;
    },
  };
}
