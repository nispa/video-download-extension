import { parseMpd } from "../media/dash.js";
import { hasDrm } from "../media/encryption.js";
import { parseM3u8 } from "../media/hls.js";
import { EngineError, ERROR } from "./errors.js";
import { audioSuffix, dashExtension, hlsExtension, qualitySuffix } from "./output.js";

/**
 * Builds the tasks that download an HLS or DASH item. A task is
 * `{ name, referer, load(signal) }`, where `load` re-reads the manifest at
 * download time and returns `{ segments, extension, live, encrypted }`.
 * @param {object} deps
 * @param {{ text: Function }} deps.network
 * @param {(text: string) => Element} deps.parseXml
 * @param {() => { allowEncrypted: boolean }} deps.settings
 */
export function createStreamTasks({ network, parseXml, settings }) {
  async function loadPlaylist(url, referer, signal) {
    const response = await network.text(url, referer, signal);
    return parseM3u8(response.text, response.url);
  }

  async function loadMpd(url, referer, signal) {
    const response = await network.text(url, referer, signal);
    return parseMpd(parseXml(response.text), response.url);
  }

  const refuseDrm = (encrypted) => {
    if (encrypted && !settings().allowEncrypted) throw new EngineError(ERROR.DRM);
  };

  const hlsTask = (url, referer, name) => ({
    name,
    referer,
    async load(signal) {
      const playlist = await loadPlaylist(url, referer, signal);
      if (playlist.type !== "media") throw new EngineError(ERROR.UNEXPECTED_PLAYLIST);
      const encrypted = hasDrm(playlist.segments);
      refuseDrm(encrypted);
      const extension = hlsExtension(playlist.segments);
      return { segments: playlist.segments, extension, live: !playlist.endList, encrypted };
    },
  });

  const dashTask = (item, wanted, name) => ({
    name,
    referer: item.referer,
    async load(signal) {
      const mpd = await loadMpd(item.url, item.referer, signal);
      const representation = mpd.representations.find(
        (r) => r.id === wanted.id && r.type === wanted.type,
      );
      if (!representation) throw new EngineError(ERROR.QUALITY_GONE);
      refuseDrm(representation.drm);
      return {
        segments: representation.segments,
        extension: dashExtension(representation),
        live: mpd.live,
        encrypted: representation.drm,
      };
    },
  });

  return {
    loadPlaylist,
    loadMpd,

    /** The chosen HLS quality, plus its separate audio rendition when it has one. */
    forHls(item, variantIndex, name) {
      const variant = item.variants?.[variantIndex];
      const tasks = [
        hlsTask(variant?.url ?? item.url, item.referer, name + qualitySuffix(variant)),
      ];
      const audio = variant ? pickHlsAudio(item.audios ?? [], variant.audio) : null;
      if (audio) tasks.push(hlsTask(audio.url, item.referer, name + audioSuffix(audio.language)));
      return tasks;
    },

    /** The chosen DASH quality, plus the audio track: DASH always keeps them apart. */
    forDash(item, variantIndex, name) {
      const variant = item.variants?.[variantIndex];
      if (!variant) return [];
      const tasks = [dashTask(item, variant, name + qualitySuffix(variant))];
      if (item.audio) tasks.push(dashTask(item, item.audio, name + audioSuffix(item.audio.lang)));
      return tasks;
    },
  };
}

/**
 * Audio rendition of a quality's group: the default one, else the first.
 * @param {{ groupId: string, isDefault: boolean }[]} audios
 * @param {string | null} groupId
 */
export function pickHlsAudio(audios, groupId) {
  if (!groupId) return null;
  const group = audios.filter((audio) => audio.groupId === groupId);
  return group.find((audio) => audio.isDefault) ?? group[0] ?? null;
}
