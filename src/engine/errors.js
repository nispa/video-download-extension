/**
 * Error codes shown to the user. The engine never builds sentences: the UI
 * translates each code (`error_<code>` in _locales).
 */
export const ERROR = Object.freeze({
  DRM: "drmProtected",
  NO_SEGMENTS: "noSegments",
  UNEXPECTED_PLAYLIST: "unexpectedPlaylist",
  QUALITY_GONE: "qualityGone",
  HTTP: "http",
  SAVE_INTERRUPTED: "saveInterrupted",
  CONVERSION_FAILED: "conversionFailed",
  YTDLP_MISSING: "ytdlpMissing",
  YTDLP_CLOSED: "ytdlpClosed",
  YTDLP_FAILED: "ytdlpFailed",
  ITEM_NOT_FOUND: "itemNotFound",
  UNEXPECTED: "unexpected",
});

/** An expected failure with a code for the UI and an optional technical detail. */
export class EngineError extends Error {
  /**
   * @param {string} code one of ERROR
   * @param {string} [detail]
   */
  constructor(code, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Plain `{ code, detail }` for any thrown value, ready to cross runtime messaging.
 * @param {unknown} error
 * @returns {{ code: string, detail: string }}
 */
export function toErrorInfo(error) {
  if (error instanceof EngineError) return { code: error.code, detail: error.detail };
  const detail = error instanceof Error ? error.message : String(error);
  return { code: ERROR.UNEXPECTED, detail };
}
