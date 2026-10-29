import { childElements, firstChild } from "./xml.js";

/**
 * Segment lists of a DASH representation. Each segment is
 * `{ url, range, map, key: null }`, where `map` is the init segment to put before it.
 */

const DEFAULT_START_NUMBER = 1;
const DEFAULT_TIMESCALE = 1;

/**
 * Fills a SegmentTemplate URL: $RepresentationID$, $Number$, $Time$, $Bandwidth$,
 * optionally zero-padded ($Number%05d$), and $$ for a literal dollar.
 * @param {string} template
 * @param {Record<string, string | number>} values
 */
export function fillTemplate(template, values) {
  const pattern = /\$(RepresentationID|Number|Time|Bandwidth)(?:%0(\d+)d)?\$|\$\$/g;
  return template.replace(pattern, (match, name, width) => {
    if (match === "$$") return "$";
    const value = String(values[name]);
    return width ? value.padStart(Number(width), "0") : value;
  });
}

/**
 * SegmentTemplate attributes inherited Period -> AdaptationSet -> Representation,
 * with the most specific SegmentTimeline.
 * @param {(Element | null)[]} templates outermost first
 */
export function mergeTemplates(templates) {
  const attributes = {};
  let timeline = null;
  for (const template of templates.filter(Boolean)) {
    for (const attribute of template.attributes) attributes[attribute.name] = attribute.value;
    timeline = firstChild(template, "SegmentTimeline") ?? timeline;
  }
  return { attributes, timeline };
}

/**
 * Segments described by a (merged) SegmentTemplate.
 * @param {{ attributes: Record<string, string>, timeline: Element | null }} template
 * @param {{ id: string, bandwidth: number }} representation
 * @param {string} base
 * @param {number} periodSeconds
 */
export function templateSegments({ attributes, timeline }, representation, base, periodSeconds) {
  if (!attributes.media) return [];
  const values = { RepresentationID: representation.id, Bandwidth: representation.bandwidth };
  const map = attributes.initialization
    ? { url: new URL(fillTemplate(attributes.initialization, values), base).href, range: null }
    : null;
  const toSegment = ({ number, time }) => ({
    url: new URL(fillTemplate(attributes.media, { ...values, Number: number, Time: time }), base)
      .href,
    range: null,
    map,
    key: null,
  });
  const timescale = Number(attributes.timescale) || DEFAULT_TIMESCALE;
  const startNumber = Number(attributes.startNumber ?? DEFAULT_START_NUMBER);
  const periodEnd = Number(attributes.presentationTimeOffset ?? 0) + periodSeconds * timescale;
  const slots = timeline
    ? timelineSlots(childElements(timeline, "S"), startNumber, periodEnd)
    : durationSlots(Number(attributes.duration), startNumber, periodSeconds * timescale);
  return slots.map(toSegment);
}

/** Slots of a SegmentTimeline; r="-1" repeats up to the next S or the end of the period. */
function timelineSlots(entries, startNumber, periodEnd) {
  const slots = [];
  let time = 0;
  entries.forEach((entry, index) => {
    if (entry.hasAttribute("t")) time = Number(entry.getAttribute("t"));
    const duration = Number(entry.getAttribute("d"));
    let repeat = Number(entry.getAttribute("r") ?? 0);
    if (repeat < 0) {
      const next = entries[index + 1];
      const end = next?.hasAttribute("t") ? Number(next.getAttribute("t")) : periodEnd;
      repeat = Math.max(0, Math.ceil((end - time) / duration) - 1);
    }
    for (let k = 0; k <= repeat; k++) {
      slots.push({ number: startNumber + slots.length, time });
      time += duration;
    }
  });
  return slots;
}

/** Slots of a template with a fixed segment duration and no timeline. */
function durationSlots(duration, startNumber, periodLength) {
  if (!duration) return [];
  const count = Math.ceil(periodLength / duration);
  return Array.from({ length: count }, (_, k) => ({ number: startNumber + k, time: k * duration }));
}

/**
 * Segments of a SegmentList, with its Initialization as init segment.
 * @param {Element} list
 * @param {string} base
 */
export function listSegments(list, base) {
  const init = firstChild(list, "Initialization");
  const map = init
    ? {
        url: new URL(init.getAttribute("sourceURL") ?? "", base).href,
        range: parseRange(init.getAttribute("range")),
      }
    : null;
  return childElements(list, "SegmentURL").map((segment) => ({
    url: new URL(segment.getAttribute("media") ?? "", base).href,
    range: parseRange(segment.getAttribute("mediaRange")),
    map,
    key: null,
  }));
}

/** DASH byte range `first-last` as `{ offset, length }`. */
function parseRange(value) {
  if (!value) return null;
  const [first, last] = value.split("-").map(Number);
  return { offset: first, length: last - first + 1 };
}
