/** Segments converted between pauses that let the background handle other events. */
const SEGMENTS_PER_PAUSE = 20;

/**
 * Builds a converter from MPEG-TS segments to one fragmented MP4, without re-encoding.
 * One flush per segment, as players do: HLS segments start on a keyframe.
 * @param {{ mp4: { Transmuxer: new (options: object) => object } }} muxjs the mux.js library
 * @param {() => Promise<void>} pause yields to the event loop
 * @returns {(parts: ArrayBuffer[], onProgress?: (fraction: number) => void) => Promise<Uint8Array[]>}
 */
export function createTsToMp4(muxjs, pause) {
  return async function tsToMp4(parts, onProgress = () => {}) {
    const transmuxer = new muxjs.mp4.Transmuxer({ remux: true });
    const output = [];
    transmuxer.on("data", (segment) => {
      if (output.length === 0) output.push(segment.initSegment);
      output.push(segment.data);
    });
    for (let index = 0; index < parts.length; index++) {
      transmuxer.push(new Uint8Array(parts[index]));
      transmuxer.flush();
      onProgress((index + 1) / parts.length);
      if ((index + 1) % SEGMENTS_PER_PAUSE === 0) await pause();
    }
    if (output.length === 0) throw new Error("No audio or video track found.");
    return output;
  };
}
