import { consoleSink, createLogger } from "../core/logger.js";
import { createFirefoxReferer } from "../platform/firefox/referer.js";
import { startBackground } from "./background.js";

// Firefox (Manifest V2): a persistent background page with every API, including
// blocking webRequest. mux.js is loaded before this module by firefox-background.html.
startBackground({
  api: browser,
  setReferer: createFirefoxReferer(browser.webRequest).setReferer,
  muxjs: globalThis.muxjs,
  logger: createLogger("background", consoleSink),
});
