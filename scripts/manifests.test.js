import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { edgeManifest, firefoxManifest } from "./manifests.js";

const pkg = { version: "1.2.3", author: "nispa" };
const CHROMIUM_ID = "kkepmgeaianpmifckpogfjhddmhbdnlg";

/** Chromium derives an extension ID from the SHA-256 of its public key, as letters a-p. */
function extensionId(base64Key) {
  const hash = createHash("sha256").update(Buffer.from(base64Key, "base64")).digest("hex");
  return [...hash.slice(0, 32)]
    .map((digit) => String.fromCharCode(97 + parseInt(digit, 16)))
    .join("");
}

describe("firefoxManifest", () => {
  const manifest = firefoxManifest(pkg);

  it("is Manifest V2 with a persistent background page", () => {
    expect(manifest.manifest_version).toBe(2);
    expect(manifest.background).toEqual({
      page: "src/app/firefox-background.html",
      persistent: true,
    });
    expect(manifest.permissions).toContain("webRequestBlocking");
  });

  it("takes version and author from package.json and texts from _locales", () => {
    expect(manifest).toMatchObject({ version: "1.2.3", author: "nispa", name: "__MSG_extName__" });
  });
});

describe("edgeManifest", () => {
  const manifest = edgeManifest(pkg);

  it("is Manifest V3 with a module service worker and an offscreen document", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background).toEqual({
      service_worker: "src/app/edgeServiceWorker.js",
      type: "module",
    });
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["offscreen", "declarativeNetRequestWithHostAccess"]),
    );
  });

  it("has the key of the ID allowed by native-host/install.ps1", () => {
    expect(extensionId(manifest.key)).toBe(CHROMIUM_ID);
  });
});
