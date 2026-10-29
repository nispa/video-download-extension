import { describe, expect, it } from "vitest";
import { YTDLP_FORMATS } from "../src/engine/ytdlp.js";
import { buildArgs, FORMATS, parseOutputLine } from "./ytdlpArgs.js";

describe("buildArgs", () => {
  it("ends with the URL after --, so it is never read as an option", () => {
    const args = buildArgs("--exec=calc", "best", "C:/Downloads");

    expect(args.slice(-2)).toEqual(["--", "--exec=calc"]);
  });

  it("limits the resolution for capped formats and extracts audio for audio", () => {
    expect(buildArgs("https://v.example/w", "720p", "out")).toContain("res:720,ext:mp4:m4a");
    expect(buildArgs("https://v.example/w", "audio", "out")).toContain("-x");
  });

  it("uses the best format for unknown names and saves to the output folder", () => {
    const args = buildArgs("https://v.example/w", "8k", "D:/Video");

    expect(args).toContain("res,ext:mp4:m4a");
    expect(args[args.indexOf("-P") + 1]).toBe("D:/Video");
  });

  it("knows the same formats as the extension", () => {
    expect(FORMATS).toEqual(YTDLP_FORMATS);
  });
});

describe("parseOutputLine", () => {
  it("turns progress lines into progress messages", () => {
    expect(parseOutputLine("VGP  42.5%| 1.20MiB/s|00:10")).toEqual({
      kind: "message",
      message: { type: "progress", percent: 42.5, speed: "1.20MiB/s", eta: "00:10" },
    });
    expect(parseOutputLine("VGP NA|NA|NA").message.percent).toBe(0);
  });

  it("reads the title, the final file and errors", () => {
    expect(parseOutputLine("VGT A talk").message).toEqual({ type: "title", title: "A talk" });
    expect(parseOutputLine("VGF C:/Downloads/A talk [x1].mp4")).toEqual({
      kind: "file",
      file: "C:/Downloads/A talk [x1].mp4",
    });
    expect(parseOutputLine("ERROR: Unsupported URL")).toEqual({
      kind: "error",
      error: "Unsupported URL",
    });
  });

  it("ignores other output", () => {
    expect(parseOutputLine("[youtube] Extracting URL")).toBeNull();
  });
});
