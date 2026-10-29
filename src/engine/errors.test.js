import { describe, expect, it } from "vitest";
import { ERROR, EngineError, toErrorInfo } from "./errors.js";

describe("EngineError", () => {
  it("carries a code and a detail", () => {
    const error = new EngineError(ERROR.HTTP, "404 https://a.example/x");

    expect(error).toMatchObject({ code: "http", detail: "404 https://a.example/x" });
    expect(error.message).toBe("http: 404 https://a.example/x");
  });

  it("uses the code alone as message when there is no detail", () => {
    expect(new EngineError(ERROR.DRM).message).toBe("drmProtected");
  });
});

describe("toErrorInfo", () => {
  it("keeps the code of engine errors", () => {
    expect(toErrorInfo(new EngineError(ERROR.NO_SEGMENTS))).toEqual({
      code: "noSegments",
      detail: "",
    });
  });

  it("reports other errors as unexpected, with their message", () => {
    expect(toErrorInfo(new TypeError("boom"))).toEqual({ code: "unexpected", detail: "boom" });
    expect(toErrorInfo("text")).toEqual({ code: "unexpected", detail: "text" });
  });
});
