import { formatBitrate, formatDuration, formatSize } from "../../core/format.js";
import { JOB_STATUS } from "../../engine/jobs.js";

/**
 * Texts of the popup, built from items and jobs. Pure functions: `t` translates
 * a message key (see src/ui/i18n.js), so tests can pass a fake.
 */

const PERCENT = 100;

/**
 * Short tag of an item: HLS, DASH, AUDIO or the file's subtype (MP4, WEBM...).
 * @param {{ kind: string, mime: string }} item
 */
export function tagLabel(item) {
  if (item.kind !== "file") return item.kind.toUpperCase();
  if (item.mime.startsWith("audio/")) return "AUDIO";
  return (item.mime.split("/")[1] || "media").toUpperCase();
}

/**
 * Name of an item: the last part of its URL, or the host for bare URLs.
 * @param {{ url: string }} item
 */
export function itemName(item) {
  const url = new URL(item.url);
  const last = url.pathname.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last) || url.hostname;
  } catch {
    return last;
  }
}

/**
 * Facts under an item: size, number of qualities, duration, separate audio, live.
 * @param {object} item
 * @param {(key: string, ...values: unknown[]) => string} t
 */
export function itemFacts(item, t) {
  const facts = [];
  if (item.kind === "file") facts.push(formatSize(item.size) || t("unknownSize"));
  if (item.variants) facts.push(t("qualities", item.variants.length));
  if (item.duration) facts.push(formatDuration(item.duration));
  if (item.audio || item.variants?.some((variant) => variant.audio)) facts.push(t("separateAudio"));
  if (item.live) facts.push(t("live"));
  return facts;
}

/**
 * Warning shown on an item: its error, or what happens with its DRM.
 * @param {object} item
 * @param {(key: string) => string} t
 * @param {boolean} allowEncrypted
 */
export function itemWarning(item, t, allowEncrypted) {
  if (item.error) return errorText(item.error, t);
  if (item.drm) return t(allowEncrypted ? "drmAllowed" : "drmBlocked");
  return "";
}

/**
 * Option text of a quality: "720p · 2.5 Mbps".
 * @param {{ resolution: string, bandwidth: number }} variant
 * @param {(key: string) => string} t
 */
export function variantLabel(variant, t) {
  const parts = [];
  if (variant.resolution) parts.push(`${variant.resolution.split("x")[1]}p`);
  if (variant.bandwidth) parts.push(formatBitrate(variant.bandwidth));
  return parts.join(" · ") || t("unknownQuality");
}

/**
 * Status line of a job: source, status, percentage, size, details and error.
 * @param {object} job
 * @param {(key: string) => string} t
 */
export function jobLine(job, t) {
  const parts = [t(`status_${job.status}`)];
  if (job.via) parts.unshift(job.via);
  const showsPercent =
    job.status === JOB_STATUS.DOWNLOADING || job.status === JOB_STATUS.CONVERTING;
  if (showsPercent) parts.push(`${Math.round(job.progress * PERCENT)}%`);
  if (job.bytes) parts.push(formatSize(job.bytes));
  if (job.detail) parts.push(job.detail);
  if (job.error) parts.push(errorText(job.error, t));
  return parts.join(" · ");
}

/**
 * Translated error, with its technical detail in brackets.
 * @param {{ code: string, detail: string }} error
 * @param {(key: string) => string} t
 */
export function errorText(error, t) {
  const text = t(`error_${error.code}`);
  return error.detail ? `${text} (${error.detail})` : text;
}
