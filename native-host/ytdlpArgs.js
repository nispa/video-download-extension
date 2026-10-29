/**
 * yt-dlp command lines and output parsing. Output lines the host cares about are
 * printed with VG* prefixes through --print and --progress-template.
 */

// Best resolution first; at equal resolution mp4/m4a, which play everywhere.
const FORMAT_ARGS = {
  best: ["-f", "bv*+ba/b", "-S", "res,ext:mp4:m4a", "--merge-output-format", "mp4"],
  "1080p": ["-f", "bv*+ba/b", "-S", "res:1080,ext:mp4:m4a", "--merge-output-format", "mp4"],
  "720p": ["-f", "bv*+ba/b", "-S", "res:720,ext:mp4:m4a", "--merge-output-format", "mp4"],
  audio: ["-f", "ba/b", "-x", "--audio-format", "mp3"],
};

const PREFIX = { PROGRESS: "VGP ", TITLE: "VGT ", FILE: "VGF ", ERROR: "ERROR:" };

/** Formats the extension may ask for. */
export const FORMATS = Object.freeze(Object.keys(FORMAT_ARGS));

/**
 * Arguments for downloading one page. The URL comes after "--", so it can never
 * be read as an option.
 * @param {string} url
 * @param {string} format one of FORMATS
 * @param {string} outputDir
 */
export function buildArgs(url, format, outputDir) {
  return [
    ...(FORMAT_ARGS[format] ?? FORMAT_ARGS.best),
    "--no-playlist",
    "--newline",
    "--progress",
    "--color",
    "never",
    "--encoding",
    "utf-8",
    "--no-simulate",
    "--progress-template",
    `download:${PREFIX.PROGRESS}%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s`,
    "--print",
    `video:${PREFIX.TITLE}%(title)s`,
    "--print",
    `after_move:${PREFIX.FILE}%(filepath)s`,
    "-P",
    outputDir,
    "-o",
    "%(title).150B [%(id)s].%(ext)s",
    "--",
    url,
  ];
}

/**
 * Meaning of one output line: a message for the extension, a final file or an
 * error, or null for lines of no interest.
 * @param {string} line
 */
export function parseOutputLine(line) {
  if (line.startsWith(PREFIX.PROGRESS)) {
    const [percent, speed, eta] = line
      .slice(PREFIX.PROGRESS.length)
      .split("|")
      .map((part) => part.trim());
    return {
      kind: "message",
      message: { type: "progress", percent: parseFloat(percent) || 0, speed, eta },
    };
  }
  if (line.startsWith(PREFIX.TITLE)) {
    return { kind: "message", message: { type: "title", title: line.slice(PREFIX.TITLE.length) } };
  }
  if (line.startsWith(PREFIX.FILE)) return { kind: "file", file: line.slice(PREFIX.FILE.length) };
  if (line.startsWith(PREFIX.ERROR))
    return { kind: "error", error: line.slice(PREFIX.ERROR.length).trim() };
  return null;
}
