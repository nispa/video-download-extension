const IV_BYTES = 16;
const SEQUENCE_OFFSET = 12;

/**
 * True for keys the extension decrypts itself: standard HLS AES-128 whose key is
 * served by URL. Anything else (SAMPLE-AES, Widevine, FairPlay, PlayReady) is DRM.
 * @param {{ method: string, keyFormat: string, url: string | null }} key
 */
export function isClearKey(key) {
  return key.method === "AES-128" && key.keyFormat === "identity" && Boolean(key.url);
}

/**
 * True when any segment is protected by DRM.
 * @param {{ key: object | null }[]} segments
 */
export function hasDrm(segments) {
  return segments.some((segment) => segment.key !== null && !isClearKey(segment.key));
}

/**
 * Initialization vector of a segment: the playlist's, or else the media
 * sequence number as a 128-bit big-endian integer (RFC 8216, 5.2).
 * @param {{ sequence: number, key: { iv: Uint8Array | null } }} segment
 */
export function segmentIv(segment) {
  if (segment.key.iv) return segment.key.iv;
  const iv = new Uint8Array(IV_BYTES);
  new DataView(iv.buffer).setUint32(SEQUENCE_OFFSET, segment.sequence);
  return iv;
}
