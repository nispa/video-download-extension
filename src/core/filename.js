/** Longest file name kept; longer page titles are cut. */
const MAX_NAME_LENGTH = 120;
/** Characters Windows, macOS or Linux refuse in file names, plus control characters. */
// eslint-disable-next-line no-control-regex -- control characters are exactly what must go
const FORBIDDEN_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]/g;
const FALLBACK_NAME = "video";

/**
 * Turns a page title or URL fragment into a file name valid on every system.
 * @param {string} name
 */
export function sanitizeFilename(name) {
  const clean = name
    .replace(FORBIDDEN_CHARACTERS, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return clean || FALLBACK_NAME;
}
