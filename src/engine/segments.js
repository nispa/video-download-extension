import { isClearKey, segmentIv } from "../media/encryption.js";

/**
 * Fetches the segments of one stream: decrypts standard AES-128, and fetches each
 * key and init segment only once. DRM-protected segments are kept as they are.
 * @param {object} deps
 * @param {{ bytes: Function }} deps.network
 * @param {string} deps.referer
 * @param {AbortSignal} deps.signal
 * @param {SubtleCrypto} deps.subtle
 */
export function createSegmentFetcher({ network, referer, signal, subtle }) {
  const keys = new Map();
  const inits = new Map();

  const cryptoKey = (keyInfo) => {
    if (!keys.has(keyInfo.url)) {
      const raw = network.bytes(keyInfo.url, referer, null, signal);
      keys.set(
        keyInfo.url,
        raw.then((bytes) => subtle.importKey("raw", bytes, "AES-CBC", false, ["decrypt"])),
      );
    }
    return keys.get(keyInfo.url);
  };

  return {
    /** Bytes of one media segment, decrypted when it uses a clear AES-128 key. */
    async segment(segment) {
      const data = await network.bytes(segment.url, referer, segment.range, signal);
      if (segment.key === null || !isClearKey(segment.key)) return data;
      const key = await cryptoKey(segment.key);
      return subtle.decrypt({ name: "AES-CBC", iv: segmentIv(segment) }, key, data);
    },

    /** Bytes of an init segment, fetched once however many segments use it. */
    init(map) {
      const id = mapId(map);
      if (!inits.has(id)) inits.set(id, network.bytes(map.url, referer, map.range, signal));
      return inits.get(id);
    },
  };
}

/**
 * Identity of an init segment (URL plus byte range).
 * @param {{ url: string, range: { offset: number } | null }} map
 */
export function mapId(map) {
  return `${map.url}|${map.range ? map.range.offset : ""}`;
}

/**
 * Runs `task(index)` for indexes 0..count-1 with a fixed number of parallel
 * workers and returns the results in order. Stops starting new tasks when the
 * signal aborts; the first failure rejects.
 * @template T
 * @param {number} count
 * @param {(index: number) => Promise<T>} task
 * @param {{ concurrency: number, signal: AbortSignal, onResult?: (result: T) => void }} options
 * @returns {Promise<T[]>}
 */
export async function runInParallel(count, task, { concurrency, signal, onResult = () => {} }) {
  const results = new Array(count);
  let next = 0;
  const worker = async () => {
    while (next < count && !signal.aborted) {
      const index = next++;
      results[index] = await task(index);
      onResult(results[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));
  return results;
}

/**
 * Chunks of the final file: the segments in order, with each init segment
 * inserted where it first applies or changes.
 * @param {{ map: object | null }[]} segments
 * @param {ArrayBuffer[]} parts
 * @param {(map: object) => Promise<ArrayBuffer>} loadInit
 */
export async function assembleChunks(segments, parts, loadInit) {
  const chunks = [];
  let currentMap = null;
  for (let index = 0; index < segments.length; index++) {
    const { map } = segments[index];
    if (map && mapId(map) !== currentMap) {
      chunks.push(await loadInit(map));
      currentMap = mapId(map);
    }
    chunks.push(parts[index]);
  }
  return chunks;
}
