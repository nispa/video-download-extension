import { describe, expect, it } from "vitest";
import { parseAttributes, parseM3u8 } from "./hls.js";

const MASTER = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",LANGUAGE="en",DEFAULT=YES,URI="audio/en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub",NAME="English",URI="subs/en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2",AUDIO="aud"
low/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,AUDIO="aud"
hi/index.m3u8?tok=1
#EXT-X-STREAM-INF:BANDWIDTH=800000
low/index.m3u8`;

const MEDIA = `#EXTM3U
#EXT-X-MEDIA-SEQUENCE:7
#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x0000000000000000000000000000000A
#EXT-X-MAP:URI="init.mp4",BYTERANGE="720@0"
#EXTINF:4.0,
seg1.m4s
#EXT-X-BYTERANGE:1000@0
#EXTINF:4.5,
big.mp4
#EXT-X-BYTERANGE:500
#EXTINF:2,
big.mp4
#EXT-X-KEY:METHOD=NONE
#EXTINF:1,
clear.ts
#EXT-X-ENDLIST`;

describe("parseM3u8 on a master playlist", () => {
  const playlist = parseM3u8(MASTER, "https://cdn.example/v/master.m3u8");

  it("lists each quality once, best first, with absolute URLs", () => {
    expect(playlist.type).toBe("master");
    expect(playlist.variants.map((v) => [v.url, v.bandwidth, v.resolution])).toEqual([
      ["https://cdn.example/v/hi/index.m3u8?tok=1", 5000000, "1920x1080"],
      ["https://cdn.example/v/low/index.m3u8", 800000, "640x360"],
    ]);
  });

  it("keeps the audio group of each quality", () => {
    expect(playlist.variants[1]).toMatchObject({ codecs: "avc1.4d401e,mp4a.40.2", audio: "aud" });
  });

  it("lists audio renditions and skips subtitles", () => {
    expect(playlist.audios).toEqual([
      {
        groupId: "aud",
        name: "English",
        language: "en",
        isDefault: true,
        url: "https://cdn.example/v/audio/en.m3u8",
      },
    ]);
  });
});

describe("parseM3u8 on a media playlist", () => {
  const playlist = parseM3u8(MEDIA, "https://cdn.example/v/hi/index.m3u8");

  it("lists segments with their sequence numbers and total duration", () => {
    expect(playlist.type).toBe("media");
    expect(playlist.endList).toBe(true);
    expect(playlist.totalDuration).toBe(11.5);
    expect(playlist.segments.map((s) => s.sequence)).toEqual([7, 8, 9, 10]);
  });

  it("applies keys and init segments to the following segments", () => {
    const [first, , , last] = playlist.segments;

    expect(first.key).toMatchObject({ method: "AES-128", url: "https://cdn.example/v/hi/key.bin" });
    expect(first.key.iv[15]).toBe(10);
    expect(first.map).toEqual({
      url: "https://cdn.example/v/hi/init.mp4",
      range: { length: 720, offset: 0 },
    });
    expect(last.key).toBeNull();
  });

  it("continues byte ranges without an explicit offset", () => {
    expect(playlist.segments[1].range).toEqual({ length: 1000, offset: 0 });
    expect(playlist.segments[2].range).toEqual({ length: 500, offset: 1000 });
    expect(playlist.segments[3].range).toBeNull();
  });

  it("reports live playlists, which have no end tag", () => {
    const live = parseM3u8("#EXTM3U\n#EXTINF:2,\na.ts", "https://cdn.example/live.m3u8");

    expect(live.endList).toBe(false);
  });
});

describe("parseM3u8 on invalid input", () => {
  it("rejects text that is not a playlist", () => {
    expect(() => parseM3u8("<html>", "https://cdn.example/x")).toThrow("Not an M3U8 playlist.");
  });

  it("accepts a byte order mark before the header", () => {
    const withMark = `${String.fromCharCode(0xfeff)}#EXTM3U\n#EXT-X-ENDLIST`;

    expect(parseM3u8(withMark, "https://a.example/").type).toBe("media");
  });

  it("ignores a quality line with no URI after it", () => {
    const playlist = parseM3u8("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1", "https://a.example/");

    expect(playlist.variants).toEqual([]);
  });
});

describe("parseAttributes", () => {
  it("reads quoted values containing commas", () => {
    expect(parseAttributes('CODECS="avc1,mp4a",BANDWIDTH=10')).toEqual({
      CODECS: "avc1,mp4a",
      BANDWIDTH: "10",
    });
  });
});
