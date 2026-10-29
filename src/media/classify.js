const HLS_MIME = /^(application|audio)\/(x-|vnd\.apple\.)?mpegurl$/;
const DASH_MIME = /^application\/dash\+xml$/;
const SEGMENT_MIME = /^(video|audio)\/(mp2t|iso\.segment)$/;
const GENERIC_MIME = /^(application|binary)\/octet-stream$/;
const MEDIA_EXTENSION = /\.(mp4|m4v|webm|mkv|mov|flv|ogv|mp3|m4a|ogg|opus|wav)$/i;
const SEGMENT_EXTENSION = /\.(ts|m4s|cmfv|cmfa)$/i;
// YouTube serves files in signed pieces that cannot be fetched whole: yt-dlp handles it.
const IGNORED_HOSTS = /(^|\.)googlevideo\.com$/i;
const HTTP_PARTIAL_CONTENT = 206;
const DEFAULT_EXTENSION = "mp4";
const MIME_EXTENSIONS = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "video/quicktime": "mov",
  "video/x-flv": "flv",
  "video/ogg": "ogv",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "audio/wav": "wav",
};

/** MIME type given to media found in <video>/<audio> tags, whose real type is unknown. */
export const UNKNOWN_MEDIA_MIME = "video/unknown";

/**
 * What a response is: "hls", "dash", "file", or null when it is not media worth listing
 * (pages, images, stream segments, YouTube pieces).
 * @param {string} url
 * @param {string} mime lowercased, without parameters
 * @returns {"hls" | "dash" | "file" | null}
 */
export function classifyMedia(url, mime) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol) || IGNORED_HOSTS.test(parsed.hostname)) return null;
  const path = parsed.pathname;
  if (HLS_MIME.test(mime) || /\.m3u8$/i.test(path)) return "hls";
  if (DASH_MIME.test(mime) || /\.mpd$/i.test(path)) return "dash";
  if (SEGMENT_MIME.test(mime) || SEGMENT_EXTENSION.test(path)) return null;
  if (/^(video|audio)\//.test(mime)) return "file";
  if (MEDIA_EXTENSION.test(path) && (mime === "" || GENERIC_MIME.test(mime))) return "file";
  return null;
}

/**
 * Value of a response header, case-insensitive; "" when missing.
 * @param {{ name: string, value?: string }[] | undefined} headers
 * @param {string} name lowercase
 */
export function headerValue(headers, name) {
  const header = (headers ?? []).find((entry) => entry.name.toLowerCase() === name);
  return header?.value ?? "";
}

/**
 * MIME type of a response, lowercased, without parameters such as charset.
 * @param {{ name: string, value?: string }[] | undefined} headers
 */
export function contentType(headers) {
  return headerValue(headers, "content-type").split(";")[0].trim().toLowerCase();
}

/**
 * Size of the whole file: the total of Content-Range on partial responses, else Content-Length.
 * @param {{ name: string, value?: string }[] | undefined} headers
 * @param {number} statusCode
 */
export function responseSize(headers, statusCode) {
  if (statusCode === HTTP_PARTIAL_CONTENT) {
    const total = /\/(\d+)$/.exec(headerValue(headers, "content-range"));
    if (total) return Number(total[1]);
  }
  return Number(headerValue(headers, "content-length")) || 0;
}

/**
 * Extension for a saved file: the URL's own when it is a known media type, else from the MIME type.
 * @param {string} url
 * @param {string} mime
 */
export function fileExtension(url, mime) {
  const match = /\.([a-z0-9]{2,4})$/i.exec(new URL(url).pathname);
  if (match && MEDIA_EXTENSION.test(`.${match[1]}`)) return match[1].toLowerCase();
  return MIME_EXTENSIONS[mime] ?? DEFAULT_EXTENSION;
}
