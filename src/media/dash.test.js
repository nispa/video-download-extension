// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { parseIsoDuration, parseMpd } from "./dash.js";

const MANIFEST_URL = "https://cdn.example/p/stream.mpd?token=x";

function parse(xml) {
  const root = new DOMParser().parseFromString(xml, "application/xml").documentElement;
  return parseMpd(root, MANIFEST_URL);
}

// Shaped like Unified Streaming manifests: templates on the AdaptationSet, $Time$ and $Number$.
const STATIC_MPD = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT1M2.5S">
 <Period id="1">
  <BaseURL>dash/</BaseURL>
  <AdaptationSet mimeType="audio/mp4" lang="en" contentType="audio">
   <SegmentTemplate timescale="48000" initialization="a-$RepresentationID$.dash"
     media="a-$RepresentationID$-$Time$.dash">
    <SegmentTimeline><S t="0" d="96000" r="30"/><S d="24000"/></SegmentTimeline>
   </SegmentTemplate>
   <Representation id="audio=128000" bandwidth="128000" codecs="mp4a.40.2"/>
  </AdaptationSet>
  <AdaptationSet mimeType="video/mp4" contentType="video">
   <SegmentTemplate timescale="25" initialization="v-$RepresentationID$.dash"
     media="v-$RepresentationID$-$Number%05d$.dash" startNumber="0" duration="50"/>
   <Representation id="video=996000" bandwidth="996000" width="960" height="540"/>
  </AdaptationSet>
  <AdaptationSet mimeType="video/mp4">
   <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" value="cenc"/>
   <Representation id="drm" bandwidth="1"><BaseURL>drm.mp4</BaseURL></Representation>
  </AdaptationSet>
  <AdaptationSet mimeType="text/vtt"><Representation id="subs"/></AdaptationSet>
 </Period>
</MPD>`;

describe("parseMpd with SegmentTemplate", () => {
  const mpd = parse(STATIC_MPD);
  const [audio, video, protectedVideo] = mpd.representations;

  it("reads the duration and keeps only audio and video", () => {
    expect(mpd.live).toBe(false);
    expect(mpd.duration).toBe(62.5);
    expect(mpd.representations.map((r) => r.id)).toEqual(["audio=128000", "video=996000", "drm"]);
  });

  it("expands a SegmentTimeline with $Time$", () => {
    expect(audio.segments).toHaveLength(32);
    expect(audio.segments[0].url).toBe("https://cdn.example/p/dash/a-audio=128000-0.dash");
    expect(audio.segments[31].url).toBe("https://cdn.example/p/dash/a-audio=128000-2976000.dash");
    expect(audio.segments[0].map.url).toBe("https://cdn.example/p/dash/a-audio=128000.dash");
  });

  it("counts fixed-duration segments with padded $Number$", () => {
    expect(video).toMatchObject({ width: 960, height: 540, lang: "" });
    expect(video.segments).toHaveLength(32);
    expect(video.segments[31].url).toBe("https://cdn.example/p/dash/v-video=996000-00031.dash");
  });

  it("marks protected representations and uses their BaseURL as a single file", () => {
    expect(protectedVideo.drm).toBe(true);
    expect(protectedVideo.segments).toEqual([
      { url: "https://cdn.example/p/dash/drm.mp4", range: null, map: null, key: null },
    ]);
  });
});

describe("parseMpd with SegmentList and several periods", () => {
  const mpd = parse(`<MPD type="dynamic" mediaPresentationDuration="PT20S">
    <Period duration="PT10S"><AdaptationSet mimeType="video/mp4">
      <Representation id="v" bandwidth="1"><SegmentList>
        <Initialization sourceURL="i.mp4" range="0-99"/>
        <SegmentURL media="a.mp4"/><SegmentURL mediaRange="100-199"/>
      </SegmentList></Representation>
    </AdaptationSet></Period>
    <Period><AdaptationSet mimeType="video/mp4">
      <Representation id="v" bandwidth="1"><SegmentList><SegmentURL media="b.mp4"/></SegmentList>
      </Representation>
      <Representation id="only-in-second" bandwidth="1"/>
    </AdaptationSet></Period>
  </MPD>`);
  const [video] = mpd.representations;

  it("reads segments, byte ranges and the init segment", () => {
    expect(video.segments[0]).toEqual({
      url: "https://cdn.example/p/a.mp4",
      range: null,
      map: { url: "https://cdn.example/p/i.mp4", range: { offset: 0, length: 100 } },
      key: null,
    });
    expect(video.segments[1].range).toEqual({ offset: 100, length: 100 });
  });

  it("appends later periods to the same representation and reports live manifests", () => {
    expect(mpd.live).toBe(true);
    // A SegmentURL without media addresses the base URL itself (a byte range of it).
    expect(video.segments.map((s) => s.url.split("/").pop())).toEqual([
      "a.mp4",
      "stream.mpd?token=x",
      "b.mp4",
    ]);
    expect(mpd.representations).toHaveLength(1);
  });
});

describe("parseMpd edge cases", () => {
  it("rejects documents that are not manifests", () => {
    expect(() => parse("<html/>")).toThrow("Not a DASH manifest.");
  });

  it("repeats r=-1 entries up to the next timestamp and returns nothing without media", () => {
    const mpd = parse(`<MPD mediaPresentationDuration="PT8S"><Period start="PT0S">
      <AdaptationSet contentType="video"><SegmentTemplate media="$Number$.m4s">
        <SegmentTimeline><S t="0" d="2" r="-1"/><S t="6" d="2"/></SegmentTimeline>
      </SegmentTemplate><Representation id="v"/></AdaptationSet>
      <AdaptationSet contentType="audio"><SegmentTemplate initialization="i.mp4"/>
        <Representation id="a"/></AdaptationSet>
    </Period></MPD>`);

    expect(mpd.representations[0].segments.map((s) => s.url.split("/").pop())).toEqual([
      "1.m4s",
      "2.m4s",
      "3.m4s",
      "4.m4s",
    ]);
    expect(mpd.representations[1].segments).toEqual([]);
  });
});

describe("parseIsoDuration", () => {
  it("converts days, hours, minutes and fractional seconds", () => {
    expect(parseIsoDuration("P1DT1H2M3.5S")).toBe(86400 + 3723.5);
  });

  it("is zero for missing or invalid values", () => {
    expect(parseIsoDuration(null)).toBe(0);
    expect(parseIsoDuration("10 minutes")).toBe(0);
  });
});
