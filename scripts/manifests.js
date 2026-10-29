import { CHROMIUM_PUBLIC_KEY } from "./chromiumKey.js";

/** Firefox add-on ID; native-host/install.ps1 allows it. */
export const FIREFOX_ID = "video-grabber@local";
/** Firefox 142 is the first to know data_collection_permissions on every platform. */
const FIREFOX_MIN_VERSION = "142.0";
/** chrome.runtime.getContexts, used to find the offscreen document, needs Chrome 116. */
const CHROMIUM_MIN_VERSION = "116";

const CONTENT_SCRIPTS = [
  {
    matches: ["<all_urls>"],
    js: ["src/content/content.js"],
    all_frames: true,
    run_at: "document_idle",
  },
];
const POPUP = "src/ui/popup/popup.html";
const OPTIONS = "src/ui/options/options.html";

/**
 * Fields shared by both builds; texts come from _locales.
 * @param {{ version: string, author: string }} pkg package.json
 */
function common(pkg) {
  return {
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    version: pkg.version,
    author: pkg.author,
    default_locale: "en",
    content_scripts: CONTENT_SCRIPTS,
  };
}

/**
 * Manifest V2 for Firefox: persistent background page and blocking webRequest.
 * @param {{ version: string, author: string }} pkg
 */
export function firefoxManifest(pkg) {
  return {
    manifest_version: 2,
    ...common(pkg),
    browser_specific_settings: {
      gecko: {
        id: FIREFOX_ID,
        strict_min_version: FIREFOX_MIN_VERSION,
        data_collection_permissions: { required: ["none"] },
      },
    },
    permissions: [
      "webRequest",
      "webRequestBlocking",
      "downloads",
      "tabs",
      "storage",
      "nativeMessaging",
      "<all_urls>",
    ],
    background: { page: "src/app/firefox-background.html", persistent: true },
    options_ui: { page: OPTIONS },
    browser_action: {
      default_title: "__MSG_extName__",
      default_popup: POPUP,
      default_icon: "icons/icon.svg",
    },
    icons: { 48: "icons/icon.svg", 96: "icons/icon.svg" },
  };
}

/**
 * Manifest V3 for Edge, Chrome and other Chromium browsers.
 * @param {{ version: string, author: string }} pkg
 */
export function edgeManifest(pkg) {
  const pngIcons = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png" };
  return {
    manifest_version: 3,
    ...common(pkg),
    key: CHROMIUM_PUBLIC_KEY,
    minimum_chrome_version: CHROMIUM_MIN_VERSION,
    permissions: [
      "webRequest",
      "declarativeNetRequestWithHostAccess",
      "downloads",
      "tabs",
      "storage",
      "nativeMessaging",
      "offscreen",
    ],
    host_permissions: ["<all_urls>"],
    background: { service_worker: "src/app/edgeServiceWorker.js", type: "module" },
    options_ui: { page: OPTIONS, open_in_tab: false },
    action: { default_title: "__MSG_extName__", default_popup: POPUP, default_icon: pngIcons },
    icons: { 16: "icons/icon-16.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" },
  };
}
