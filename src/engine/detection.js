import { stripRangeParams } from "../core/url.js";
import { classifyMedia, contentType, responseSize, UNKNOWN_MEDIA_MIME } from "../media/classify.js";
import { toErrorInfo } from "./errors.js";
import { summarizeDash, summarizeHls } from "./inspection.js";

const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 299;

/**
 * Finds media in tabs: from network responses and from <video>/<audio> tags.
 * Manifests are read right away to offer their qualities and hide their segments.
 * @param {object} deps
 * @param {ReturnType<import("./tabStore.js").createTabStore>} deps.store
 * @param {ReturnType<import("./streamTasks.js").createStreamTasks>} deps.streamTasks
 * @param {(tabId: number) => void} deps.updateBadge
 * @param {() => void} deps.notify
 * @param {import("../core/logger.js").Logger} deps.logger
 */
export function createDetector({ store, streamTasks, updateBadge, notify, logger }) {
  async function inspect(item) {
    try {
      const summary =
        item.kind === "hls"
          ? summarizeHls(await streamTasks.loadPlaylist(item.url, item.referer), item.url)
          : summarizeDash(await streamTasks.loadMpd(item.url, item.referer));
      Object.assign(item, summary.patch);
      store.hide(item.tabId, summary.hiddenUrls, summary.hiddenDirs);
      updateBadge(item.tabId);
    } catch (error) {
      item.error = toErrorInfo(error);
      logger.warn("Could not read manifest", { url: item.url, error: item.error });
    }
    notify();
  }

  function add(tabId, data) {
    const { item, change } = store.add(tabId, data);
    if (change === "none") return;
    updateBadge(tabId);
    notify();
    if (item && item.kind !== "file") void inspect(item);
  }

  return {
    /** A response seen by webRequest.onHeadersReceived. */
    onResponse(details) {
      const ok = details.statusCode >= HTTP_SUCCESS_MIN && details.statusCode <= HTTP_SUCCESS_MAX;
      if (details.tabId < 0 || !ok) return;
      const mime = contentType(details.responseHeaders);
      const kind = classifyMedia(details.url, mime);
      if (!kind) return;
      const url = kind === "file" ? stripRangeParams(details.url) : details.url;
      // A ranged request only shows the size of its piece, not of the whole file.
      const isWholeFile = kind === "file" && url === details.url;
      add(details.tabId, {
        url,
        kind,
        mime,
        size: isWholeFile ? responseSize(details.responseHeaders, details.statusCode) : 0,
        referer: details.documentUrl || details.originUrl || details.initiator || "",
      });
    },

    /** Sources of <video>/<audio> tags reported by the content script. */
    onElementsFound(tabId, urls, pageUrl) {
      for (const url of urls) {
        const kind = classifyMedia(url, UNKNOWN_MEDIA_MIME);
        if (kind) add(tabId, { url, kind, mime: "", size: 0, referer: pageUrl });
      }
    },

    /** A new page was loaded in the tab: its media list starts over. */
    onNavigation(tabId) {
      store.clear(tabId);
      updateBadge(tabId);
      notify();
    },

    onTabRemoved(tabId) {
      store.clear(tabId);
    },
  };
}
