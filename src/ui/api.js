/** Extension API of the page: browser.* in Firefox, chrome.* in Edge and Chrome. */
export const api = globalThis.browser ?? globalThis.chrome;

/**
 * Sends a request to the engine and returns its answer.
 * @param {object} message
 */
export function send(message) {
  return api.runtime.sendMessage(message);
}
