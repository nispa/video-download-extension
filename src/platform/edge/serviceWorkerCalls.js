import { OFFSCREEN_NOTICE, SW_REQUEST } from "./protocol.js";

/**
 * Handles the offscreen document's requests for APIs it cannot use itself.
 * Only the calls listed here are allowed. Native messaging ports live here and
 * their messages are relayed to the offscreen document.
 * @param {typeof chrome} chromeApi
 * @param {(notice: object) => void} sendToOffscreen
 * @returns {(request: object) => Promise<unknown>}
 */
export function createCallHandler(chromeApi, sendToOffscreen) {
  const calls = {
    "tabs.get": (id) => chromeApi.tabs.get(id),
    "downloads.download": (options) => chromeApi.downloads.download(options),
    "action.setBadgeText": (details) => chromeApi.action.setBadgeText(details),
    "action.setBadgeBackgroundColor": (details) =>
      chromeApi.action.setBadgeBackgroundColor(details),
    "storage.local.get": (keys) => chromeApi.storage.local.get(keys),
    "runtime.sendNativeMessage": (host, message) =>
      chromeApi.runtime.sendNativeMessage(host, message),
    "declarativeNetRequest.updateSessionRules": (options) =>
      chromeApi.declarativeNetRequest.updateSessionRules(options),
  };
  const ports = new Map(); // id -> runtime.Port

  const connect = ({ id, name }) => {
    const port = chromeApi.runtime.connectNative(name);
    ports.set(id, port);
    port.onMessage.addListener((message) =>
      sendToOffscreen({ type: OFFSCREEN_NOTICE.NATIVE_MESSAGE, id, message }),
    );
    port.onDisconnect.addListener(() => {
      ports.delete(id);
      const error = chromeApi.runtime.lastError?.message ?? "";
      sendToOffscreen({ type: OFFSCREEN_NOTICE.NATIVE_DISCONNECT, id, error });
    });
    return true;
  };

  const handlers = {
    [SW_REQUEST.CALL]: ({ path, args }) => {
      if (!Object.hasOwn(calls, path)) throw new Error(`Call not allowed: ${path}`);
      return calls[path](...args);
    },
    [SW_REQUEST.NATIVE_CONNECT]: connect,
    [SW_REQUEST.NATIVE_POST]: ({ id, message }) => {
      ports.get(id)?.postMessage(message);
      return true;
    },
    [SW_REQUEST.NATIVE_DISCONNECT]: ({ id }) => {
      ports.get(id)?.disconnect();
      ports.delete(id);
      return true;
    },
  };

  return async (request) => {
    if (!Object.hasOwn(handlers, request.type)) throw new Error(`Unknown request: ${request.type}`);
    return handlers[request.type](request);
  };
}
