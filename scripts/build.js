import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { edgeManifest, firefoxManifest } from "./manifests.js";

// Puts together the extensions, ready to load in the browser:
//   dist/firefox  Manifest V2 (about:debugging, "Load Temporary Add-on")
//   dist/edge     Manifest V3 (edge://extensions, "Load unpacked"; works in Chrome too)
// No bundler: browsers load the ES modules in src/ as they are.
// Usage: node scripts/build.js [firefox|edge]   (both when no target is given)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFESTS = { firefox: firefoxManifest, edge: edgeManifest };
const COPIED = ["src", "_locales", "icons"];
const isShipped = (source) => !source.endsWith(".test.js");

function muxjsPath() {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve("mux.js/package.json")), "dist", "mux.min.js");
}

function build(target, pkg) {
  const out = join(ROOT, "dist", target);
  rmSync(out, { recursive: true, force: true });
  for (const folder of COPIED) {
    cpSync(join(ROOT, folder), join(out, folder), { recursive: true, filter: isShipped });
  }
  mkdirSync(join(out, "vendor"));
  cpSync(muxjsPath(), join(out, "vendor", "mux.min.js"));
  const manifest = MANIFESTS[target](pkg);
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`dist/${target} ready (v${pkg.version})`);
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const requested = process.argv.slice(2);
for (const target of requested.length > 0 ? requested : Object.keys(MANIFESTS)) {
  if (!Object.hasOwn(MANIFESTS, target)) {
    console.error(`Unknown target "${target}". Valid: ${Object.keys(MANIFESTS).join(", ")}.`);
    process.exit(1);
  }
  build(target, pkg);
}
