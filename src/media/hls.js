/**
 * Minimal HLS playlist parser (RFC 8216): master playlists (qualities, audio
 * renditions) and media playlists (segments, keys, init segments, byte ranges).
 */

const IV_BYTES = 16;
/** Some servers start playlists with a UTF-8 byte order mark. */
const BYTE_ORDER_MARK = new RegExp(`^${String.fromCharCode(0xfeff)}`);

/**
 * Parses an M3U8 playlist. Relative URIs are resolved against `baseUrl`.
 * @param {string} text
 * @param {string} baseUrl
 */
export function parseM3u8(text, baseUrl) {
  const lines = text
    .replace(BYTE_ORDER_MARK, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines[0] !== "#EXTM3U") throw new Error("Not an M3U8 playlist.");
  const resolve = (uri) => new URL(uri, baseUrl).href;
  return lines.some((line) => line.startsWith("#EXT-X-STREAM-INF:"))
    ? parseMaster(lines, resolve)
    : parseMedia(lines, resolve);
}

/**
 * Attribute list of a tag (`KEY=value,KEY="quoted, value"`) as an object.
 * @param {string} text
 */
export function parseAttributes(text) {
  const attributes = {};
  for (const [, name, raw] of text.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) {
    attributes[name] = raw.startsWith('"') ? raw.slice(1, -1) : raw;
  }
  return attributes;
}

function tagValue(line, tag) {
  return line.slice(tag.length);
}

function parseMaster(lines, resolve) {
  const variants = [];
  const audios = [];
  lines.forEach((line, index) => {
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const uri = lines.slice(index + 1).find((next) => !next.startsWith("#"));
      if (uri === undefined) return;
      const variant = toVariant(
        parseAttributes(tagValue(line, "#EXT-X-STREAM-INF:")),
        resolve(uri),
      );
      if (!variants.some((known) => known.url === variant.url)) variants.push(variant);
    } else if (line.startsWith("#EXT-X-MEDIA:")) {
      const attributes = parseAttributes(tagValue(line, "#EXT-X-MEDIA:"));
      if (attributes.TYPE === "AUDIO" && attributes.URI) audios.push(toAudio(attributes, resolve));
    }
  });
  variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return { type: "master", variants, audios };
}

function toVariant(attributes, url) {
  return {
    url,
    bandwidth: Number(attributes.BANDWIDTH) || 0,
    resolution: attributes.RESOLUTION ?? "",
    codecs: attributes.CODECS ?? "",
    audio: attributes.AUDIO ?? null,
  };
}

function toAudio(attributes, resolve) {
  return {
    groupId: attributes["GROUP-ID"],
    name: attributes.NAME ?? "",
    language: attributes.LANGUAGE ?? "",
    isDefault: attributes.DEFAULT === "YES",
    url: resolve(attributes.URI),
  };
}

function parseMedia(lines, resolve) {
  const state = { sequence: 0, duration: 0, key: null, map: null, range: null, offset: 0 };
  const segments = [];
  let endList = false;
  for (const line of lines) {
    if (line === "#EXT-X-ENDLIST") endList = true;
    else if (line.startsWith("#")) applyMediaTag(state, line, resolve);
    else segments.push(nextSegment(state, resolve(line), segments.length));
  }
  const totalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0);
  return { type: "media", segments, endList, totalDuration };
}

function applyMediaTag(state, line, resolve) {
  if (line.startsWith("#EXT-X-MEDIA-SEQUENCE:")) {
    state.sequence = parseInt(tagValue(line, "#EXT-X-MEDIA-SEQUENCE:"), 10) || 0;
  } else if (line.startsWith("#EXTINF:")) {
    state.duration = parseFloat(tagValue(line, "#EXTINF:")) || 0;
  } else if (line.startsWith("#EXT-X-BYTERANGE:")) {
    state.range = parseByteRange(tagValue(line, "#EXT-X-BYTERANGE:"), state.offset);
  } else if (line.startsWith("#EXT-X-KEY:")) {
    state.key = toKey(parseAttributes(tagValue(line, "#EXT-X-KEY:")), resolve);
  } else if (line.startsWith("#EXT-X-MAP:")) {
    const attributes = parseAttributes(tagValue(line, "#EXT-X-MAP:"));
    const range = attributes.BYTERANGE ? parseByteRange(attributes.BYTERANGE, 0) : null;
    state.map = { url: resolve(attributes.URI), range };
  }
}

function nextSegment(state, url, index) {
  const segment = {
    url,
    duration: state.duration,
    sequence: state.sequence + index,
    key: state.key,
    map: state.map,
    range: state.range,
  };
  if (state.range) state.offset = state.range.offset + state.range.length;
  state.range = null;
  state.duration = 0;
  return segment;
}

function toKey(attributes, resolve) {
  if (attributes.METHOD === "NONE") return null;
  return {
    method: attributes.METHOD,
    url: attributes.URI ? resolve(attributes.URI) : null,
    iv: attributes.IV ? hexToBytes(attributes.IV) : null,
    keyFormat: attributes.KEYFORMAT ?? "identity",
  };
}

/** `length@offset`; without offset, the range continues where the previous one ended. */
function parseByteRange(value, defaultOffset) {
  const [length, offset] = value.split("@");
  return { length: Number(length), offset: offset === undefined ? defaultOffset : Number(offset) };
}

function hexToBytes(hex) {
  const digits = hex.replace(/^0x/i, "").padStart(IV_BYTES * 2, "0");
  return Uint8Array.from({ length: IV_BYTES }, (_, i) => parseInt(digits.substr(i * 2, 2), 16));
}
