/** File names and types of saved downloads. */

const BLOB_TYPES = { ts: "video/mp2t", mp4: "video/mp4", m4a: "audio/mp4", webm: "video/webm" };
// A generic type keeps browsers from "fixing" the .drm extension of encrypted files.
const GENERIC_BLOB_TYPE = "application/octet-stream";
const ENCRYPTED_EXTENSION = "drm";

/**
 * " [720p]" for a quality with a known resolution, otherwise "".
 * @param {{ resolution?: string } | undefined} variant
 */
export function qualitySuffix(variant) {
  const height = variant?.resolution?.split("x")[1];
  return height ? ` [${height}p]` : "";
}

/**
 * " (audio en)" for a separate audio track; the language is left out when unknown.
 * @param {string} language
 */
export function audioSuffix(language) {
  return language ? ` (audio ${language})` : " (audio)";
}

/**
 * Full file name. Encrypted files get a second extension (video.mp4.drm) so no player tries them.
 * @param {string} name
 * @param {string} extension
 * @param {boolean} encrypted
 */
export function outputFilename(name, extension, encrypted) {
  return encrypted ? `${name}.${extension}.${ENCRYPTED_EXTENSION}` : `${name}.${extension}`;
}

/**
 * MIME type of the saved blob.
 * @param {string} extension
 * @param {boolean} encrypted
 */
export function blobType(extension, encrypted) {
  return (!encrypted && BLOB_TYPES[extension]) || GENERIC_BLOB_TYPE;
}

/**
 * HLS output: fMP4 when segments have an init segment (EXT-X-MAP), else MPEG-TS.
 * @param {{ map: object | null }[]} segments
 */
export function hlsExtension(segments) {
  return segments.some((segment) => segment.map) ? "mp4" : "ts";
}

/**
 * DASH output: WebM for WebM tracks, else MP4 for video and M4A for audio.
 * @param {{ mime: string, type: string }} representation
 */
export function dashExtension(representation) {
  if (/webm/.test(representation.mime)) return "webm";
  return representation.type === "audio" ? "m4a" : "mp4";
}
