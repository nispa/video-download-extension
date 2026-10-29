import { createEngine } from "../engine/engine.js";
import { toErrorInfo } from "../engine/errors.js";
import { STATE_CHANGED } from "../engine/messages.js";
import { applySettingsChanges, DEFAULT_SETTINGS, normalizeSettings } from "../engine/settings.js";
import { createTsToMp4 } from "../media/remux.js";

const BADGE_COLOR = "#16a34a";
const ALL_URLS = { urls: ["<all_urls>"] };

/**
 * Starts the engine on a browser: its events in, its APIs out. Shared by the
 * Firefox background page and the Edge offscreen document.
 * @param {object} options
 * @param {object} options.api browser.* in Firefox; a proxy of the service worker in Edge
 * @param {(url: string, referer: string) => Promise<void> | void} options.setReferer
 * @param {object} options.muxjs the mux.js library, loaded as a classic script
 * @param {import("../core/logger.js").Logger} options.logger
 */
export function startBackground({ api, setReferer, muxjs, logger }) {
  let settings = DEFAULT_SETTINGS;
  api.storage.local.get(DEFAULT_SETTINGS).then((raw) => {
    settings = normalizeSettings(raw);
  });
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "local") settings = applySettingsChanges(settings, changes);
  });

  const badge = api.action ?? api.browserAction;
  badge.setBadgeBackgroundColor({ color: BADGE_COLOR }).catch(() => {});

  const engine = createEngine({
    fetch: (url, init) => fetch(url, init),
    setReferer,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    schedule: (callback, ms) => setTimeout(callback, ms),
    parseXml: (text) => new DOMParser().parseFromString(text, "application/xml").documentElement,
    subtle: crypto.subtle,
    remux: createTsToMp4(muxjs, () => new Promise((resolve) => setTimeout(resolve, 0))),
    blobUrls: {
      create: (blob) => URL.createObjectURL(blob),
      revoke: (url) => URL.revokeObjectURL(url),
    },
    downloads: { download: (options) => api.downloads.download(options) },
    setBadge: (tabId, text) => badge.setBadgeText({ tabId, text }).catch(() => {}),
    tabTitle: (tabId) =>
      api.tabs.get(tabId).then(
        (tab) => tab.title ?? "",
        () => "",
      ),
    native: {
      send: (host, message) => api.runtime.sendNativeMessage(host, message),
      connect: (host) => api.runtime.connectNative(host),
    },
    notifyPopup: () => api.runtime.sendMessage({ type: STATE_CHANGED }).catch(() => {}),
    settings: () => settings,
    logger,
  });

  api.webRequest.onHeadersReceived.addListener(engine.onResponse, ALL_URLS, ["responseHeaders"]);
  api.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId >= 0) engine.onNavigation(details.tabId);
    },
    { ...ALL_URLS, types: ["main_frame"] },
  );
  api.tabs.onRemoved.addListener((tabId) => engine.onTabRemoved(tabId));
  api.downloads.onChanged.addListener((delta) => engine.onDownloadChanged(delta));
  api.runtime.onMessage.addListener((message, sender, sendResponse) =>
    answer(engine.handleMessage(message, sender), sendResponse),
  );
}

/**
 * Sends the engine's answer back. Chromium does not accept a Promise returned by
 * the listener, so both browsers use sendResponse and `return true`.
 */
function answer(result, sendResponse) {
  if (result === undefined) return false;
  Promise.resolve(result).then(sendResponse, (error) =>
    sendResponse({ error: toErrorInfo(error) }),
  );
  return true;
}
