// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createStreamTasks, pickHlsAudio } from "./streamTasks.js";

const MEDIA_PLAYLIST = "#EXTM3U\n#EXTINF:4,\n1.ts\n#EXTINF:4,\n2.ts\n#EXT-X-ENDLIST";
const DRM_PLAYLIST = '#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://k"\n#EXTINF:4,\n1.ts';
const MASTER_PLAYLIST = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nlow.m3u8";
const MPD = `<MPD mediaPresentationDuration="PT8S"><Period>
  <AdaptationSet mimeType="video/mp4"><SegmentTemplate media="v-$Number$.m4s" duration="4"/>
    <Representation id="v1" bandwidth="1" width="640" height="360"/></AdaptationSet>
  <AdaptationSet mimeType="audio/mp4"><ContentProtection/>
    <SegmentTemplate media="a-$Number$.m4s" duration="4"/><Representation id="a1"/></AdaptationSet>
</Period></MPD>`;

function setup(documents, settings = { allowEncrypted: false }) {
  const network = { text: async (url) => ({ text: documents[url], url }) };
  const parseXml = (text) =>
    new DOMParser().parseFromString(text, "application/xml").documentElement;
  return createStreamTasks({ network, parseXml, settings: () => settings });
}

const hlsItem = (extra = {}) => ({
  url: "https://a.example/v.m3u8",
  referer: "https://page/",
  ...extra,
});

describe("createStreamTasks for HLS", () => {
  it("downloads a media playlist directly", async () => {
    const tasks = setup({ "https://a.example/v.m3u8": MEDIA_PLAYLIST }).forHls(
      hlsItem(),
      0,
      "Clip",
    );

    const plan = await tasks[0].load();

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ name: "Clip", referer: "https://page/" });
    expect(plan).toMatchObject({ extension: "ts", live: false, encrypted: false });
    expect(plan.segments).toHaveLength(2);
  });

  it("downloads the chosen quality and its audio rendition", () => {
    const item = hlsItem({
      variants: [{ url: "https://a.example/hi.m3u8", resolution: "1280x720", audio: "aud" }],
      audios: [
        { groupId: "aud", language: "en", isDefault: true, url: "https://a.example/en.m3u8" },
      ],
    });

    const tasks = setup({}).forHls(item, 0, "Clip");

    expect(tasks.map((task) => task.name)).toEqual(["Clip [720p]", "Clip (audio en)"]);
  });

  it("refuses DRM playlists unless encrypted downloads are allowed", async () => {
    const documents = { "https://a.example/v.m3u8": DRM_PLAYLIST };
    const refused = setup(documents).forHls(hlsItem(), 0, "Clip")[0];
    const allowed = setup(documents, { allowEncrypted: true }).forHls(hlsItem(), 0, "Clip")[0];

    await expect(refused.load()).rejects.toMatchObject({ code: "drmProtected" });
    expect((await allowed.load()).encrypted).toBe(true);
  });

  it("rejects a master playlist where a media playlist was expected", async () => {
    const task = setup({ "https://a.example/v.m3u8": MASTER_PLAYLIST }).forHls(
      hlsItem(),
      0,
      "C",
    )[0];

    await expect(task.load()).rejects.toMatchObject({ code: "unexpectedPlaylist" });
  });
});

describe("createStreamTasks for DASH", () => {
  const dashItem = {
    url: "https://a.example/d.mpd",
    referer: "",
    variants: [{ id: "v1", type: "video", resolution: "640x360" }],
    audio: { id: "a1", type: "audio", lang: "" },
  };
  const documents = { "https://a.example/d.mpd": MPD };

  it("downloads the chosen quality and the audio track", async () => {
    const tasks = setup(documents, { allowEncrypted: true }).forDash(dashItem, 0, "Clip");
    const [video, audio] = await Promise.all(tasks.map((task) => task.load()));

    expect(tasks.map((task) => task.name)).toEqual(["Clip [360p]", "Clip (audio)"]);
    expect(video).toMatchObject({ extension: "mp4", encrypted: false });
    expect(video.segments).toHaveLength(2);
    expect(audio).toMatchObject({ extension: "m4a", encrypted: true });
  });

  it("fails when the quality is no longer in the manifest", async () => {
    const item = { ...dashItem, variants: [{ id: "gone", type: "video" }], audio: null };
    const [task] = setup(documents).forDash(item, 0, "Clip");

    await expect(task.load()).rejects.toMatchObject({ code: "qualityGone" });
  });

  it("returns no task for an unknown quality", () => {
    expect(setup(documents).forDash(dashItem, 5, "Clip")).toEqual([]);
  });
});

describe("pickHlsAudio", () => {
  const audios = [
    { groupId: "a", isDefault: false, url: "first" },
    { groupId: "a", isDefault: true, url: "default" },
    { groupId: "b", isDefault: false, url: "other" },
  ];

  it("prefers the default rendition of the group", () => {
    expect(pickHlsAudio(audios, "a").url).toBe("default");
    expect(pickHlsAudio(audios, "b").url).toBe("other");
  });

  it("returns null without a group or a match", () => {
    expect(pickHlsAudio(audios, null)).toBeNull();
    expect(pickHlsAudio(audios, "missing")).toBeNull();
  });
});
