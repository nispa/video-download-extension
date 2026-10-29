import { OFFSCREEN_NOTICE, SW_REQUEST, TARGET } from "./protocol.js";

/**
 * Native messaging ports for the offscreen document, which cannot open them:
 * the real port lives in the service worker and messages are relayed both ways.
 * @param {typeof chrome.runtime} runtime
 * @returns {{ connect: (name: string) => object, onNotice: (notice: object) => void }}
 */
export function createNativeProxy(runtime) {
  const ports = new Map(); // id -> { onMessage: Function[], onDisconnect: Function[] }
  let nextId = 1;
  const toWorker = (request) => runtime.sendMessage({ target: TARGET.SERVICE_WORKER, ...request });

  /** Same interface as runtime.Port, as used by the engine. */
  function connect(name) {
    const id = nextId++;
    const listeners = { onMessage: [], onDisconnect: [] };
    ports.set(id, listeners);
    const ready = toWorker({ type: SW_REQUEST.NATIVE_CONNECT, id, name });
    return {
      onMessage: { addListener: (listener) => listeners.onMessage.push(listener) },
      onDisconnect: { addListener: (listener) => listeners.onDisconnect.push(listener) },
      postMessage: (message) =>
        ready.then(() => toWorker({ type: SW_REQUEST.NATIVE_POST, id, message })),
      disconnect: () => {
        ports.delete(id);
        ready.then(() => toWorker({ type: SW_REQUEST.NATIVE_DISCONNECT, id }));
      },
    };
  }

  /** Delivers a relayed port message or disconnection from the service worker. */
  function onNotice(notice) {
    const listeners = ports.get(notice.id);
    if (!listeners) return;
    if (notice.type === OFFSCREEN_NOTICE.NATIVE_MESSAGE) {
      listeners.onMessage.forEach((listener) => listener(notice.message));
    } else if (notice.type === OFFSCREEN_NOTICE.NATIVE_DISCONNECT) {
      ports.delete(notice.id);
      const error = notice.error ? { message: notice.error } : null;
      listeners.onDisconnect.forEach((listener) => listener({ error }));
    }
  }

  return { connect, onNotice };
}
