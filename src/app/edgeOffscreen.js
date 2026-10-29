import { consoleSink, createLogger } from "../core/logger.js";
import { createEdgeApi } from "../platform/edge/bridge.js";
import { createDnrReferer } from "../platform/edge/dnrReferer.js";
import { startBackground } from "./background.js";

// Edge/Chromium: the offscreen document is a hidden, persistent page that runs
// the engine. mux.js is loaded before this module by edge-offscreen.html.
const { api, callServiceWorker } = createEdgeApi(chrome.runtime);

startBackground({
  api,
  setReferer: createDnrReferer(callServiceWorker).setReferer,
  muxjs: globalThis.muxjs,
  logger: createLogger("offscreen", consoleSink),
});
