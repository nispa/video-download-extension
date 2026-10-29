import { describe, expect, it, vi } from "vitest";
import { createNetwork } from "./network.js";

const okResponse = (body, url = "") => ({
  ok: true,
  status: 200,
  url,
  text: async () => body,
  arrayBuffer: async () => new TextEncoder().encode(body).buffer,
});
const failedResponse = { ok: false, status: 503 };

function setup(responses) {
  const fetch = vi.fn(async () => responses.shift());
  const setReferer = vi.fn();
  const sleep = vi.fn(async () => {});
  return { fetch, setReferer, sleep, network: createNetwork({ fetch, setReferer, sleep }) };
}

describe("createNetwork", () => {
  it("sets the page's referer and sends cookies", async () => {
    const { fetch, setReferer, network } = setup([okResponse("#EXTM3U")]);

    await network.text("https://cdn.example/a.m3u8", "https://page.example/");

    expect(setReferer).toHaveBeenCalledWith("https://cdn.example/a.m3u8", "https://page.example/");
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });

  it("returns text with the final URL after redirects", async () => {
    const { network } = setup([okResponse("body", "https://other.example/a.m3u8")]);

    const result = await network.text("https://cdn.example/a.m3u8", "");

    expect(result).toEqual({ text: "body", url: "https://other.example/a.m3u8" });
  });

  it("keeps the requested URL when the response has none", async () => {
    const { network } = setup([okResponse("body")]);

    expect((await network.text("https://cdn.example/a", "")).url).toBe("https://cdn.example/a");
  });

  it("asks for byte ranges with a Range header", async () => {
    const { fetch, network } = setup([okResponse("abc")]);

    await network.bytes("https://cdn.example/v.mp4", "", { offset: 100, length: 50 });

    expect(fetch.mock.calls[0][1].headers).toEqual({ Range: "bytes=100-149" });
  });

  it("retries failed downloads with a growing delay", async () => {
    const { sleep, network } = setup([failedResponse, failedResponse, okResponse("ok")]);

    const bytes = await network.bytes("https://cdn.example/1.ts", "", null);

    expect(new TextDecoder().decode(bytes)).toBe("ok");
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
  });

  it("gives up after the last attempt with an http error", async () => {
    const { network } = setup([failedResponse, failedResponse, failedResponse]);

    await expect(network.bytes("https://cdn.example/1.ts", "", null)).rejects.toMatchObject({
      code: "http",
      detail: "503 https://cdn.example/1.ts",
    });
  });

  it("does not retry after the download was cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetch, network } = setup([failedResponse, okResponse("late")]);

    await expect(
      network.bytes("https://cdn.example/1.ts", "", null, controller.signal),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  });
});
