import { urlDir } from "../core/url.js";
import { hasDrm } from "../media/encryption.js";

/**
 * What a parsed manifest tells about its item (`patch`), and which URLs belong to
 * the stream and must not be listed on their own (`hiddenUrls`, `hiddenDirs`).
 */

/**
 * @param {object} playlist result of parseM3u8
 * @param {string} playlistUrl
 */
export function summarizeHls(playlist, playlistUrl) {
  if (playlist.type === "master") {
    const children = [...playlist.variants, ...playlist.audios].map((entry) => entry.url);
    return {
      patch: { variants: playlist.variants, audios: playlist.audios },
      hiddenUrls: children,
      hiddenDirs: unique(children.map(urlDir)),
    };
  }
  return {
    patch: {
      duration: playlist.totalDuration,
      live: !playlist.endList,
      drm: hasDrm(playlist.segments),
    },
    hiddenUrls: playlist.segments.map((segment) => segment.url),
    hiddenDirs: [urlDir(playlistUrl)],
  };
}

/**
 * Qualities offered for a DASH manifest: video representations, best first (or the
 * audio ones for audio-only streams), plus the audio track to download alongside.
 * @param {object} mpd result of parseMpd
 */
export function summarizeDash(mpd) {
  const byBandwidth = (a, b) => b.bandwidth - a.bandwidth;
  const video = mpd.representations.filter((r) => r.type === "video").sort(byBandwidth);
  const audio = mpd.representations.filter((r) => r.type === "audio");
  const main = video.length ? video : [...audio].sort(byBandwidth);
  const urls = mpd.representations.flatMap((r) =>
    r.segments.flatMap((segment) => (segment.map ? [segment.url, segment.map.url] : [segment.url])),
  );
  return {
    patch: {
      variants: main.map(toDashVariant),
      audio: video.length && audio.length ? pickDashAudio(audio) : null,
      duration: mpd.duration,
      live: mpd.live,
      drm: main.length > 0 && main.every((r) => r.drm),
    },
    hiddenUrls: urls,
    hiddenDirs: unique(urls.map(urlDir)),
  };
}

function toDashVariant(representation) {
  return {
    id: representation.id,
    type: representation.type,
    bandwidth: representation.bandwidth,
    resolution: representation.width ? `${representation.width}x${representation.height}` : "",
    codecs: representation.codecs,
  };
}

/** The manifest's first language, at its best quality. */
function pickDashAudio(audio) {
  const firstLanguage = audio[0].lang;
  const [best] = audio
    .filter((r) => r.lang === firstLanguage)
    .sort((a, b) => b.bandwidth - a.bandwidth);
  return { id: best.id, type: best.type, lang: best.lang };
}

function unique(values) {
  return [...new Set(values)];
}
