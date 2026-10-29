import { describe, expect, it, vi } from "vitest";
import { assembleChunks, createSegmentFetcher, mapId, runInParallel } from "./segments.js";

const AES_KEY = { method: "AES-128", keyFormat: "identity", url: "https://a.example/k", iv: null };
const DRM_KEY = { ...AES_KEY, method: "SAMPLE-AES" };

function setup() {
  const network = { bytes: vi.fn(async (url) => `bytes of ${url}`) };
  const subtle = {
    importKey: vi.fn(async () => "crypto key"),
    decrypt: vi.fn(async (algorithm, key, data) => `decrypted ${data}`),
  };
  const fetcher = createSegmentFetcher({ network, referer: "r", signal: undefined, subtle });
  return { network, subtle, fetcher };
}

describe("createSegmentFetcher", () => {
  it("returns clear segments as fetched", async () => {
    const { fetcher } = setup();

    expect(await fetcher.segment({ url: "https://a.example/1.ts", range: null, key: null })).toBe(
      "bytes of https://a.example/1.ts",
    );
  });

  it("decrypts AES-128 segments, importing each key once", async () => {
    const { subtle, fetcher } = setup();
    const segment = (n) => ({
      url: `https://a.example/${n}.ts`,
      range: null,
      key: AES_KEY,
      sequence: n,
    });

    const results = await Promise.all([fetcher.segment(segment(1)), fetcher.segment(segment(2))]);

    expect(results).toEqual([
      "decrypted bytes of https://a.example/1.ts",
      "decrypted bytes of https://a.example/2.ts",
    ]);
    expect(subtle.importKey).toHaveBeenCalledOnce();
    expect(subtle.decrypt.mock.calls[0][0].iv[15]).toBe(1);
  });

  it("keeps DRM segments encrypted", async () => {
    const { subtle, fetcher } = setup();

    await fetcher.segment({ url: "https://a.example/1.ts", range: null, key: DRM_KEY });

    expect(subtle.decrypt).not.toHaveBeenCalled();
  });

  it("fetches each init segment once", async () => {
    const { network, fetcher } = setup();
    const map = { url: "https://a.example/init.mp4", range: null };

    await Promise.all([fetcher.init(map), fetcher.init({ ...map })]);

    expect(network.bytes).toHaveBeenCalledOnce();
  });
});

describe("runInParallel", () => {
  it("returns results in order and reports each one", async () => {
    const reported = [];
    const signal = new AbortController().signal;

    const results = await runInParallel(5, async (i) => i * 10, {
      concurrency: 2,
      signal,
      onResult: (result) => reported.push(result),
    });

    expect(results).toEqual([0, 10, 20, 30, 40]);
    expect(reported.sort((a, b) => a - b)).toEqual([0, 10, 20, 30, 40]);
  });

  it("starts no new tasks once aborted", async () => {
    const controller = new AbortController();
    const task = vi.fn(async () => controller.abort());

    await runInParallel(10, task, { concurrency: 1, signal: controller.signal });

    expect(task).toHaveBeenCalledOnce();
  });

  it("rejects with the first failure", async () => {
    const signal = new AbortController().signal;
    const task = async (i) => {
      if (i === 2) throw new Error("segment 2 failed");
      return i;
    };

    await expect(runInParallel(4, task, { concurrency: 2, signal })).rejects.toThrow("segment 2");
  });
});

describe("assembleChunks", () => {
  it("inserts each init segment before the first segment that uses it", async () => {
    const first = { url: "https://a.example/i1.mp4", range: null };
    const second = { url: "https://a.example/i2.mp4", range: { offset: 0, length: 9 } };
    const segments = [{ map: first }, { map: first }, { map: second }, { map: null }];

    const chunks = await assembleChunks(segments, ["s0", "s1", "s2", "s3"], async (map) =>
      mapId(map),
    );

    expect(chunks).toEqual([
      "https://a.example/i1.mp4|",
      "s0",
      "s1",
      "https://a.example/i2.mp4|0",
      "s2",
      "s3",
    ]);
  });
});
