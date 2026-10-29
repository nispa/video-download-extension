import { consoleSink, createLogger } from "../core/logger.js";
import { forwardEvents } from "../platform/edge/eventForwarding.js";
import { createOffscreenStarter } from "../platform/edge/offscreenDocument.js";
import { SW_REQUEST, TARGET } from "../platform/edge/protocol.js";
import { createCallHandler } from "../platform/edge/serviceWorkerCalls.js";

// Edge/Chromium (Manifest V3): the background is a service worker the browser
// suspends, without DOMParser or URL.createObjectURL. The engine runs in an
// offscreen document; this worker forwards events to it and makes API calls for it.

const logger = createLogger("edge", consoleSink);
const ensureOffscreen = createOffscreenStarter(chrome);
const sendToOffscreen = (notice) =>
  ensureOffscreen()
    .then(() => chrome.runtime.sendMessage({ target: TARGET.OFFSCREEN, ...notice }))
    .catch(() => {}); // the offscreen document may be restarting; events can be dropped
const handleCall = createCallHandler(chrome, sendToOffscreen);

forwardEvents(chrome, sendToOffscreen);

const start = () =>
  ensureOffscreen().catch((error) => logger.error("Offscreen failed", { error: error.message }));
chrome.runtime.onStartup.addListener(start);
chrome.runtime.onInstalled.addListener(start);
start();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only extension pages (offscreen, popup) talk to the worker, never content scripts.
  const fromExtensionPage = sender.id === chrome.runtime.id && !sender.tab;
  if (message?.target !== TARGET.SERVICE_WORKER || !fromExtensionPage) return false;
  const work =
    message.type === SW_REQUEST.ENSURE_OFFSCREEN
      ? ensureOffscreen().then(() => true)
      : handleCall(message);
  work.then(
    (value) => sendResponse({ ok: true, value }),
    (error) => sendResponse({ ok: false, error: error.message }),
  );
  return true;
});
