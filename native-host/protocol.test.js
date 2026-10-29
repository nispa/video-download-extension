import { describe, expect, it } from "vitest";
import { createMessageReader, encodeMessage } from "./protocol.js";

describe("native messaging protocol", () => {
  it("prefixes the JSON with its byte length", () => {
    const encoded = encodeMessage({ type: "check" });

    expect(encoded.readUInt32LE(0)).toBe(16);
    expect(encoded.subarray(4).toString()).toBe('{"type":"check"}');
  });

  it("reads messages split across chunks and several messages in one chunk", () => {
    const received = [];
    const read = createMessageReader((message) => received.push(message));
    const both = Buffer.concat([encodeMessage({ n: "è" }), encodeMessage({ n: 2 })]);

    read(both.subarray(0, 3));
    read(both.subarray(3, 10));
    read(both.subarray(10));

    expect(received).toEqual([{ n: "è" }, { n: 2 }]);
  });
});
