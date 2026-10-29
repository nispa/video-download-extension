/**
 * Native messaging framing used by browsers: each message is a 32-bit
 * little-endian length followed by that many bytes of UTF-8 JSON.
 */

const HEADER_BYTES = 4;

/**
 * Encodes one message for stdout.
 * @param {unknown} message
 */
export function encodeMessage(message) {
  const json = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt32LE(json.length, 0);
  return Buffer.concat([header, json]);
}

/**
 * Collects stdin chunks and calls `onMessage` for every complete message,
 * whatever the chunk boundaries.
 * @param {(message: unknown) => void} onMessage
 * @returns {(chunk: Buffer) => void}
 */
export function createMessageReader(onMessage) {
  let buffer = Buffer.alloc(0);
  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= HEADER_BYTES) {
      const length = buffer.readUInt32LE(0);
      if (buffer.length < HEADER_BYTES + length) return;
      const body = buffer.subarray(HEADER_BYTES, HEADER_BYTES + length);
      buffer = buffer.subarray(HEADER_BYTES + length);
      onMessage(JSON.parse(body.toString("utf8")));
    }
  };
}
