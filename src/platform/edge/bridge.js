import { createNativeProxy } from "./nativeProxy.js";
import { OFFSCREEN_NOTICE, SW_REQUEST, TARGET } from "./protocol.js";

/**
 * The `api` object the engine expects (the subset of browser.* it uses), for the
 * offscreen document. Only chrome.runtime exists there: events arrive from the
 * service worker, and calls go to it.
 * @param {typeof chrome.runtime} runtime
 * @returns {{ api: object, callServiceWorker: (path: string, ...args: unknown[]) => Promise<unknown> }}
 */
export function createEdgeApi(runtime) {
  const listeners = new Map(); // event name -> listeners
  const native = createNativeProxy(runtime);

  const callServiceWorker = async (path, ...args) => {
    const reply = await runtime.sendMessage({
      target: TARGET.SERVICE_WORKER,
      type: SW_REQUEST.CALL,
      path,
      args,
    });
    if (!reply) throw new Error("Service worker not reachable.");
    if (!reply.ok) throw new Error(reply.error);
    return reply.value;
  };
  const call =
    (path) =>
    (...args) =>
      callServiceWorker(path, ...args);
  const event = (name) => ({
    addListener: (listener) => listeners.set(name, [...(listeners.get(name) ?? []), listener]),
  });

  runtime.onMessage.addListener((notice) => {
    if (notice?.target !== TARGET.OFFSCREEN) return false;
    if (notice.type === OFFSCREEN_NOTICE.EVENT) {
      (listeners.get(notice.name) ?? []).forEach((listener) => listener(...notice.args));
    } else {
      native.onNotice(notice);
    }
    return false;
  });

  const api = {
    runtime: {
      onMessage: runtime.onMessage,
      sendMessage: (message) => runtime.sendMessage(message),
      sendNativeMessage: call("runtime.sendNativeMessage"),
      connectNative: native.connect,
    },
    tabs: { get: call("tabs.get"), onRemoved: event("tabs.onRemoved") },
    downloads: { download: call("downloads.download"), onChanged: event("downloads.onChanged") },
    action: {
      setBadgeText: call("action.setBadgeText"),
      setBadgeBackgroundColor: call("action.setBadgeBackgroundColor"),
    },
    storage: { local: { get: call("storage.local.get") }, onChanged: event("storage.onChanged") },
    webRequest: {
      onHeadersReceived: event("webRequest.onHeadersReceived"),
      onBeforeRequest: event("webRequest.onBeforeRequest"),
    },
  };
  return { api, callServiceWorker };
}
