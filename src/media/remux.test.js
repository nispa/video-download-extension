import { describe, expect, it, vi } from "vitest";
import { createTsToMp4 } from "./remux.js";

/** Stand-in for mux.js: every flush emits the bytes pushed since the last one. */
function fakeMuxjs({ emits = true } = {}) {
  class Transmuxer {
    constructor() {
      this.pending = [];
      this.listeners = [];
    }
    on(event, listener) {
      this.listeners.push(listener);
    }
    push(bytes) {
      this.pending.push(...bytes);
    }
    flush() {
      const data = Uint8Array.from(this.pending.splice(0));
      if (emits) this.listeners.forEach((listener) => listener({ initSegment: "init", data }));
    }
  }
  return { mp4: { Transmuxer } };
}

describe("createTsToMp4", () => {
  it("puts the init segment once, then one fragment per input segment", async () => {
    const tsToMp4 = createTsToMp4(fakeMuxjs(), async () => {});

    const output = await tsToMp4([new Uint8Array([1, 2]).buffer, new Uint8Array([3]).buffer]);

    expect(output).toEqual(["init", Uint8Array.from([1, 2]), Uint8Array.from([3])]);
  });

  it("reports progress after each segment and pauses every 20 segments", async () => {
    const pause = vi.fn(async () => {});
    const progress = [];
    const tsToMp4 = createTsToMp4(fakeMuxjs(), pause);
    const parts = Array.from({ length: 40 }, () => new Uint8Array([0]).buffer);

    await tsToMp4(parts, (fraction) => progress.push(fraction));

    expect(progress).toHaveLength(40);
    expect(progress.at(-1)).toBe(1);
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it("fails when no track is found", async () => {
    const tsToMp4 = createTsToMp4(fakeMuxjs({ emits: false }), async () => {});

    await expect(tsToMp4([new Uint8Array([0]).buffer])).rejects.toThrow("No audio or video");
  });
});
