import { describe, expect, it } from "vitest";
import { parseRequest, REQUEST } from "./messages.js";

describe("parseRequest", () => {
  it("accepts well-formed requests", () => {
    const valid = [
      { type: REQUEST.GET_STATE, tabId: 3 },
      { type: REQUEST.DOWNLOAD, itemId: "item-1", variantIndex: 2 },
      { type: REQUEST.DOWNLOAD, itemId: "item-1" },
      { type: REQUEST.CANCEL, jobId: "job-1" },
      { type: REQUEST.DISMISS, jobId: "job-1" },
      { type: REQUEST.YTDLP_STATUS },
      { type: REQUEST.YTDLP_DOWNLOAD, url: "https://v.example/w", format: "720p", title: "T" },
      { type: REQUEST.FOUND_ELEMENTS, urls: ["https://v.example/a.mp4"] },
    ];

    for (const message of valid) expect(parseRequest(message)).toBe(message);
  });

  it("rejects malformed requests", () => {
    const invalid = [
      null,
      "get-state",
      { type: "unknown" },
      { type: "toString" },
      { type: REQUEST.GET_STATE, tabId: "3" },
      { type: REQUEST.DOWNLOAD, itemId: "item-1", variantIndex: -1 },
      { type: REQUEST.CANCEL },
      { type: REQUEST.YTDLP_DOWNLOAD, url: "file:///etc/passwd", format: "best" },
      { type: REQUEST.YTDLP_DOWNLOAD, url: "https://v.example/w", format: "--exec" },
      { type: REQUEST.YTDLP_DOWNLOAD, url: "https://v.example/w", format: "best", title: 1 },
      { type: REQUEST.FOUND_ELEMENTS, urls: [1] },
    ];

    for (const message of invalid) expect(parseRequest(message)).toBeNull();
  });
});
