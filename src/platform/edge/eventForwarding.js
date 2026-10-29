import { OFFSCREEN_NOTICE } from "./protocol.js";

const ALL_URLS = { urls: ["<all_urls>"] };
const MEDIA_TYPE = /video|audio|mpegurl|dash\+xml|octet-stream/i;
const MEDIA_PATH = /\.(m3u8|mpd|mp4|m4v|webm|mkv|mov|flv|ogv|mp3|m4a|ogg|opus|wav)(?:$|[?#])/i;

/**
 * Forwards to the offscreen document the browser events the engine listens to.
 * Call it at the top level of the service worker: listeners registered there wake it up.
 * @param {typeof chrome} chromeApi
 * @param {(notice: object) => void} sendToOffscreen
 */
export function forwardEvents(chromeApi, sendToOffscreen) {
  const forward =
    (name) =>
    (...args) =>
      sendToOffscreen({ type: OFFSCREEN_NOTICE.EVENT, name, args });
  const forwardResponse = forward("webRequest.onHeadersReceived");

  chromeApi.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (mightBeMedia(details)) forwardResponse(details);
    },
    ALL_URLS,
    ["responseHeaders"],
  );
  chromeApi.webRequest.onBeforeRequest.addListener(forward("webRequest.onBeforeRequest"), {
    ...ALL_URLS,
    types: ["main_frame"],
  });
  chromeApi.tabs.onRemoved.addListener(forward("tabs.onRemoved"));
  chromeApi.downloads.onChanged.addListener(forward("downloads.onChanged"));
  chromeApi.storage.onChanged.addListener(forward("storage.onChanged"));
}

/**
 * Cheap pre-filter: only tab responses that can be media cross to the offscreen
 * document, not every image and script of every page.
 * @param {{ tabId: number, url: string, responseHeaders?: { name: string, value?: string }[] }} details
 */
export function mightBeMedia(details) {
  if (details.tabId < 0) return false;
  const type = (details.responseHeaders ?? []).find((h) => h.name.toLowerCase() === "content-type");
  return MEDIA_TYPE.test(type?.value ?? "") || MEDIA_PATH.test(details.url);
}
