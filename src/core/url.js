/** Query parameters some players (e.g. Facebook) add to request one byte range of a file. */
const RANGE_PARAMS = ["bytestart", "byteend"];

/**
 * True for http(s) URLs, the only ones the extension handles.
 * @param {string} url
 */
export function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

/**
 * Identity of a URL inside a stream: its decoded path only. Query strings carry
 * tokens and ranges, CDNs rotate hosts, and players disagree on percent-encoding
 * ("video%3D123" and "video=123" are the same segment).
 * @param {string} url
 */
export function urlKey(url) {
  const path = new URL(url).pathname;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * The folder part of urlKey, ending with "/".
 * @param {string} url
 */
export function urlDir(url) {
  const key = urlKey(url);
  return key.slice(0, key.lastIndexOf("/") + 1);
}

/**
 * Removes byte-range query parameters, giving the URL of the whole file.
 * @param {string} url
 */
export function stripRangeParams(url) {
  const parsed = new URL(url);
  if (!RANGE_PARAMS.some((param) => parsed.searchParams.has(param))) return url;
  for (const param of RANGE_PARAMS) parsed.searchParams.delete(param);
  return parsed.href;
}

/**
 * Last path segment of a URL without its extension, decoded when possible.
 * @param {string} url
 */
export function fileStem(url) {
  const last = new URL(url).pathname.split("/").pop() ?? "";
  const stem = last.replace(/\.[^.]+$/, "");
  try {
    return decodeURIComponent(stem);
  } catch {
    return stem;
  }
}
