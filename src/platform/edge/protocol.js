import { WAKE_ENGINE } from "../../engine/messages.js";

/**
 * Messages between the Edge service worker and the offscreen document that runs
 * the engine. Every message names its `target`, so each side ignores the other's
 * (runtime messages reach all extension pages at once).
 */
export const TARGET = Object.freeze({ SERVICE_WORKER: WAKE_ENGINE.target, OFFSCREEN: "offscreen" });

/** Requests to the service worker. */
export const SW_REQUEST = Object.freeze({
  ENSURE_OFFSCREEN: WAKE_ENGINE.type,
  CALL: "call",
  NATIVE_CONNECT: "native-connect",
  NATIVE_POST: "native-post",
  NATIVE_DISCONNECT: "native-disconnect",
});

/** Notifications to the offscreen document. */
export const OFFSCREEN_NOTICE = Object.freeze({
  EVENT: "event",
  NATIVE_MESSAGE: "native-message",
  NATIVE_DISCONNECT: "native-disconnect",
});

/** The offscreen document, relative to the extension root. */
export const OFFSCREEN_PATH = "src/app/edge-offscreen.html";
