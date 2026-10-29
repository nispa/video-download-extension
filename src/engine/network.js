import { EngineError, ERROR } from "./errors.js";

const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;

/**
 * HTTP access for the engine. Requests carry the page's cookies and, through
 * the platform, its Referer and Origin: many CDNs refuse requests without them.
 * @param {object} deps
 * @param {typeof fetch} deps.fetch
 * @param {(url: string, referer: string) => Promise<void> | void} deps.setReferer
 * @param {(ms: number) => Promise<void>} deps.sleep
 * @param {number} [deps.retries] attempts per segment
 * @param {number} [deps.retryDelayMs] grows linearly with each attempt
 */
export function createNetwork({
  fetch,
  setReferer,
  sleep,
  retries = DEFAULT_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
}) {
  async function request(url, referer, init = {}) {
    await setReferer(url, referer);
    const response = await fetch(url, { credentials: "include", ...init });
    if (!response.ok) throw new EngineError(ERROR.HTTP, `${response.status} ${url}`);
    return response;
  }

  return {
    setReferer,

    /** A text document and its final URL (after redirects), for resolving relative links. */
    async text(url, referer, signal) {
      const response = await request(url, referer, { signal });
      return { text: await response.text(), url: response.url || url };
    },

    /** Bytes of a file or of a byte range of it, retried on failure. */
    async bytes(url, referer, range, signal) {
      const headers = range
        ? { Range: `bytes=${range.offset}-${range.offset + range.length - 1}` }
        : {};
      for (let attempt = 1; ; attempt++) {
        try {
          const response = await request(url, referer, { headers, signal });
          return await response.arrayBuffer();
        } catch (error) {
          if (signal?.aborted || attempt >= retries) throw error;
          await sleep(retryDelayMs * attempt);
        }
      }
    },
  };
}
