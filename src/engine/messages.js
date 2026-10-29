import { isHttpUrl } from "../core/url.js";
import { YTDLP_FORMATS } from "./ytdlp.js";

/** Requests the popup and the content script send to the engine. */
export const REQUEST = Object.freeze({
  GET_STATE: "get-state",
  DOWNLOAD: "download",
  CANCEL: "cancel",
  DISMISS: "dismiss",
  YTDLP_STATUS: "ytdlp-status",
  YTDLP_DOWNLOAD: "ytdlp-download",
  /** From the content script; must match the literal in src/content/content.js. */
  FOUND_ELEMENTS: "found-elements",
});

/** Broadcast by the engine whenever items or jobs change. */
export const STATE_CHANGED = "state-changed";

/**
 * Asks the Edge service worker to start the engine (its offscreen document).
 * Nothing answers it in Firefox, where the engine always runs.
 */
export const WAKE_ENGINE = Object.freeze({ target: "sw", type: "ensure-offscreen" });

const isString = (value) => typeof value === "string";
const isOptionalIndex = (value) => value === undefined || (Number.isInteger(value) && value >= 0);
const isOptionalString = (value) => value === undefined || isString(value);

const VALIDATORS = {
  [REQUEST.GET_STATE]: (message) => Number.isInteger(message.tabId),
  [REQUEST.DOWNLOAD]: (message) =>
    isString(message.itemId) && isOptionalIndex(message.variantIndex),
  [REQUEST.CANCEL]: (message) => isString(message.jobId),
  [REQUEST.DISMISS]: (message) => isString(message.jobId),
  [REQUEST.YTDLP_STATUS]: () => true,
  [REQUEST.YTDLP_DOWNLOAD]: (message) =>
    isString(message.url) &&
    isHttpUrl(message.url) &&
    YTDLP_FORMATS.includes(message.format) &&
    isOptionalString(message.title),
  [REQUEST.FOUND_ELEMENTS]: (message) =>
    Array.isArray(message.urls) && message.urls.every(isString),
};

/**
 * Checks a runtime message: returns it when it is a well-formed request, else null.
 * Messages come from other extension pages and content scripts in any web page.
 * @param {unknown} message
 */
export function parseRequest(message) {
  if (typeof message !== "object" || message === null) return null;
  const isValid = Object.hasOwn(VALIDATORS, message.type) && VALIDATORS[message.type](message);
  return isValid ? message : null;
}
