const BYTE_UNITS = ["B", "KB", "MB", "GB"];
const BYTES_PER_UNIT = 1024;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const BITS_PER_MEGABIT = 1e6;

/**
 * Human-readable size ("1.5 MB"); empty when unknown.
 * @param {number} bytes
 */
export function formatSize(bytes) {
  if (!bytes) return "";
  let value = bytes;
  let unit = 0;
  while (value >= BYTES_PER_UNIT && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${BYTE_UNITS[unit]}`;
}

/**
 * Duration as m:ss or h:mm:ss; empty when unknown.
 * @param {number} seconds
 */
export function formatDuration(seconds) {
  if (!seconds) return "";
  const total = Math.round(seconds);
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const pad = (value) => String(value).padStart(2, "0");
  const rest = pad(total % SECONDS_PER_MINUTE);
  return hours ? `${hours}:${pad(minutes)}:${rest}` : `${minutes}:${rest}`;
}

/**
 * Bitrate in megabits per second ("1.5 Mbps").
 * @param {number} bitsPerSecond
 */
export function formatBitrate(bitsPerSecond) {
  return `${(bitsPerSecond / BITS_PER_MEGABIT).toFixed(1)} Mbps`;
}
