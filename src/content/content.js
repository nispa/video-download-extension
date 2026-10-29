"use strict";

// Reports the http(s) sources of <video>, <audio> and <source> tags to the engine.
// blob: URLs (Media Source Extensions) cannot be downloaded: those streams are
// found on the network as HLS/DASH manifests instead.
// Content scripts cannot be ES modules, so this file imports nothing; the message
// type must match REQUEST.FOUND_ELEMENTS in src/engine/messages.js.
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const FOUND_ELEMENTS = "found-elements";
  const SCAN_DELAY_MS = 1000;
  const reported = new Set();
  let timer = null;

  function newSources() {
    const sources = [];
    for (const element of document.querySelectorAll("video, audio, source")) {
      for (const source of [element.currentSrc, element.src]) {
        if (source && /^https?:/i.test(source) && !reported.has(source)) {
          reported.add(source);
          sources.push(source);
        }
      }
    }
    return sources;
  }

  function scan() {
    const urls = newSources();
    if (urls.length > 0) api.runtime.sendMessage({ type: FOUND_ELEMENTS, urls }).catch(() => {});
  }

  function scheduleScan() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      scan();
    }, SCAN_DELAY_MS);
  }

  scan();
  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  document.addEventListener("loadstart", scheduleScan, true);
})();
