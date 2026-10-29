/** How HLS streams made of .ts segments are saved: converted to MP4, or as they arrive. */
export const HLS_FORMATS = Object.freeze(["mp4", "ts"]);

/**
 * User settings, as stored in storage.local.
 * - hlsFormat: "mp4" converts .ts streams to MP4, "ts" keeps the original segments.
 * - allowEncrypted: DRM streams may be downloaded as they are (encrypted, unplayable).
 */
export const DEFAULT_SETTINGS = Object.freeze({ hlsFormat: "mp4", allowEncrypted: false });

/**
 * Settings read from storage, with every missing or invalid value replaced by its default.
 * @param {unknown} raw
 * @returns {{ hlsFormat: string, allowEncrypted: boolean }}
 */
export function normalizeSettings(raw) {
  const source = typeof raw === "object" && raw !== null ? raw : {};
  return {
    hlsFormat: HLS_FORMATS.includes(source.hlsFormat)
      ? source.hlsFormat
      : DEFAULT_SETTINGS.hlsFormat,
    allowEncrypted:
      typeof source.allowEncrypted === "boolean"
        ? source.allowEncrypted
        : DEFAULT_SETTINGS.allowEncrypted,
  };
}

/**
 * Applies a storage.onChanged change set to the current settings.
 * @param {{ hlsFormat: string, allowEncrypted: boolean }} current
 * @param {Record<string, { newValue?: unknown }>} changes
 */
export function applySettingsChanges(current, changes) {
  const next = { ...current };
  for (const [key, change] of Object.entries(changes)) {
    if (key in DEFAULT_SETTINGS) next[key] = change.newValue;
  }
  return normalizeSettings(next);
}
