import { OFFSCREEN_PATH } from "./protocol.js";

const JUSTIFICATION = "Downloads and joins video segments, and reads DASH manifests.";

/**
 * Returns a function that makes sure the offscreen document exists. Chromium
 * allows only one; concurrent callers share the same creation.
 * @param {typeof chrome} chromeApi
 * @returns {() => Promise<void>}
 */
export function createOffscreenStarter(chromeApi) {
  let creating = null;
  return async function ensureOffscreen() {
    const existing = await chromeApi.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
    if (existing.length > 0) return;
    creating ??= chromeApi.offscreen
      .createDocument({
        url: OFFSCREEN_PATH,
        reasons: ["BLOBS", "DOM_PARSER"],
        justification: JUSTIFICATION,
      })
      .catch((error) => {
        if (!/single offscreen/i.test(error.message)) throw error;
      })
      .finally(() => {
        creating = null;
      });
    await creating;
  };
}
