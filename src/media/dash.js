import { listSegments, mergeTemplates, templateSegments } from "./dashSegments.js";
import { childElements, firstChild, resolveBaseUrl } from "./xml.js";

const SECONDS = { D: 86400, H: 3600, M: 60, S: 1 };

/**
 * Parses a DASH manifest into its audio and video representations, each with
 * the full list of segments. Several Periods (e.g. ad breaks) are joined:
 * segments of a representation are appended by id.
 * @param {Element} root the <MPD> element
 * @param {string} url the manifest URL, for relative addresses
 */
export function parseMpd(root, url) {
  if (root?.localName !== "MPD") throw new Error("Not a DASH manifest.");
  const totalSeconds = parseIsoDuration(root.getAttribute("mediaPresentationDuration"));
  const periods = childElements(root, "Period");
  const base = resolveBaseUrl(root, url);
  const representations = [];
  periods.forEach((period, index) => {
    const seconds = periodSeconds(period, periods[index + 1], totalSeconds);
    for (const representation of periodRepresentations(period, base, seconds)) {
      const known = representations.find(
        (other) => other.id === representation.id && other.type === representation.type,
      );
      if (known) known.segments.push(...representation.segments);
      else if (index === 0) representations.push(representation);
    }
  });
  return { live: root.getAttribute("type") === "dynamic", duration: totalSeconds, representations };
}

/**
 * ISO 8601 duration (PT1H2M3.5S, P1DT2H) in seconds; 0 when missing or invalid.
 * @param {string | null} value
 */
export function parseIsoDuration(value) {
  const match = /^P(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?)?$/.exec(
    value ?? "",
  );
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match.map(Number);
  return (
    (days || 0) * SECONDS.D +
    (hours || 0) * SECONDS.H +
    (minutes || 0) * SECONDS.M +
    (seconds || 0) * SECONDS.S
  );
}

function periodSeconds(period, nextPeriod, totalSeconds) {
  const start = parseIsoDuration(period.getAttribute("start"));
  const explicit = parseIsoDuration(period.getAttribute("duration"));
  if (explicit) return explicit;
  const nextStart = nextPeriod ? parseIsoDuration(nextPeriod.getAttribute("start")) : 0;
  return nextStart ? nextStart - start : totalSeconds - start;
}

function periodRepresentations(period, rootBase, seconds) {
  const periodBase = resolveBaseUrl(period, rootBase);
  return childElements(period, "AdaptationSet").flatMap((set) => {
    const setBase = resolveBaseUrl(set, periodBase);
    return childElements(set, "Representation")
      .map((element) => toRepresentation({ period, set, element, base: setBase, seconds }))
      .filter((representation) => representation !== null);
  });
}

function toRepresentation({ period, set, element, base, seconds }) {
  const attribute = (name) => element.getAttribute(name) ?? set.getAttribute(name) ?? "";
  const mime = attribute("mimeType");
  const type = set.getAttribute("contentType") ?? mime.split("/")[0];
  if (type !== "video" && type !== "audio") return null;
  const representation = {
    id: element.getAttribute("id") ?? "",
    type,
    mime,
    bandwidth: Number(element.getAttribute("bandwidth")) || 0,
    width: Number(attribute("width")) || 0,
    height: Number(attribute("height")) || 0,
    codecs: attribute("codecs"),
    lang: set.getAttribute("lang") ?? "",
    drm: isProtected(set) || isProtected(element),
  };
  const ownBase = resolveBaseUrl(element, base);
  const templates = [period, set, element].map((node) => firstChild(node, "SegmentTemplate"));
  const list = firstChild(element, "SegmentList") ?? firstChild(set, "SegmentList");
  let segments;
  if (templates.some(Boolean)) {
    segments = templateSegments(mergeTemplates(templates), representation, ownBase, seconds);
  } else if (list) {
    segments = listSegments(list, ownBase);
  } else {
    segments = [{ url: ownBase, range: null, map: null, key: null }];
  }
  return { ...representation, segments };
}

/** ContentProtection means the segments are encrypted (CENC) and need a DRM licence. */
function isProtected(element) {
  return childElements(element, "ContentProtection").length > 0;
}
