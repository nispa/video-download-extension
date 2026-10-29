import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ERROR } from "../engine/errors.js";
import { JOB_STATUS } from "../engine/jobs.js";

const LOCALES_DIR = new URL("../../_locales/", import.meta.url);
const SOURCES = [
  new URL("./popup/", import.meta.url),
  new URL("./options/", import.meta.url),
  new URL("./", import.meta.url),
];

const messages = (locale) =>
  JSON.parse(readFileSync(new URL(`${locale}/messages.json`, LOCALES_DIR), "utf8"));
const locales = readdirSync(LOCALES_DIR);
const english = messages("en");

/** Keys named in UI code: t("key") and data-i18n="key". */
function keysUsedInUi() {
  const keys = new Set();
  for (const dir of SOURCES) {
    for (const file of readdirSync(dir).filter(
      (name) => /\.(js|html)$/.test(name) && !name.includes(".test."),
    )) {
      const text = readFileSync(new URL(file, dir), "utf8");
      for (const [, key] of text.matchAll(/\bt\("([A-Za-z0-9_]+)"/g)) keys.add(key);
      for (const [, key] of text.matchAll(/data-i18n(?:-title)?="([A-Za-z0-9_]+)"/g)) keys.add(key);
    }
  }
  return keys;
}

describe("_locales", () => {
  it("has English and Italian", () => {
    expect(locales.sort()).toEqual(["en", "it"]);
  });

  it("has the same keys in every language", () => {
    for (const locale of locales) {
      expect(Object.keys(messages(locale)).sort()).toEqual(Object.keys(english).sort());
    }
  });

  it("translates every error code and job status", () => {
    for (const code of Object.values(ERROR)) expect(english).toHaveProperty(`error_${code}`);
    for (const status of Object.values(JOB_STATUS))
      expect(english).toHaveProperty(`status_${status}`);
  });

  it("translates every key the UI uses", () => {
    for (const key of keysUsedInUi()) expect(english).toHaveProperty(key);
  });
});
