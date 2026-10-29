# AGENTS.md

Guidelines for anyone (human or AI agent) contributing to this repository.
Read this file fully before writing code.

## Project overview

A browser extension for Firefox and Edge (and other Chromium browsers) that finds
videos embedded in web pages and downloads them: direct files, HLS and DASH
streams, and whole pages through yt-dlp. It never decrypts DRM-protected content.

## Tech stack

- **Language**: JavaScript, ES modules, no build step for the code: browsers load
  the files in `src/` as they are. JSDoc describes parameters and return values.
- **Unit tests**: Vitest (happy-dom for the few tests that parse XML).
- **End-to-end tests**: Playwright, with the Edge build loaded in Chromium.
- **Lint / format**: ESLint (flat config) + Prettier.
- **Package manager**: pnpm.
- **Third-party code**: mux.js (TS to MP4), copied into the build from `node_modules`.

## Commands

```bash
pnpm install          # install dependencies
pnpm build            # dist/firefox and dist/edge
pnpm start:firefox    # Firefox with the extension loaded
pnpm test             # unit tests (Vitest)
pnpm test:watch       # unit tests in watch mode
pnpm test:coverage    # unit tests with coverage thresholds
pnpm test:e2e         # build dist/edge and run Playwright
pnpm lint             # ESLint + web-ext lint of the Firefox build
pnpm format           # Prettier
```

A change is complete only when `pnpm lint`, `pnpm format:check` and
`pnpm test:coverage` all pass. Run `pnpm test:e2e` before pushing changes to
`app/`, `platform/` or `ui/`.

## Architecture

The code is layered. Dependencies point **downward only**.

```
src/
  core/      Pure utilities: logger, URLs, file names, formatting, throttle.
  media/     Media formats: response classification, HLS and DASH parsers,
             encryption keys, TS to MP4 conversion.
  engine/    The extension's logic: tab store, detection, jobs, network,
             segment downloads, yt-dlp, settings, message validation.
  platform/  Browser adapters. firefox/: Referer via blocking webRequest.
             edge/: service worker, offscreen document, API proxy, Referer
             via declarativeNetRequest.
  ui/        Popup and options page.
  content/   Content script (one classic script: cannot import).
  app/       Composition roots: wire the layers for each browser.
```

Rules:

- `core`, `media` and `engine` **must not import from `platform`, `ui`, `app` or
  `content`**, and must not use `browser`, `chrome`, `window`, `document` or a
  global `fetch`. They run in Node so they can be unit-tested. ESLint enforces it.
- Everything the engine needs from the browser (fetch, downloads, badge, native
  messaging, timers, XML parsing, crypto) arrives as a parameter of `createEngine`.
- Only `app/` knows about all layers. Pass dependencies explicitly; no hidden
  singletons.
- The same engine runs in Firefox's background page and in Edge's offscreen
  document. A browser difference belongs in `platform/`, never in `engine/`.
- How the two builds work: `docs/ARCHITECTURE.md`.

## Test-driven development

For every change in behavior:

1. **Red**: write a failing test that describes the behavior. Run it and confirm
   it fails for the right reason.
2. **Green**: write the minimum code to make it pass.
3. **Refactor**: clean up with all tests green.

Rules:

- Never change or delete an existing test just to make it pass. If a test is
  wrong, explain why in the commit message.
- Never commit `.skip`, `.only` or commented-out tests.
- Bug fixes start with a test that reproduces the bug.
- Tests are deterministic: inject time and timers, no `Date.now()` or
  `Math.random()` in `core`, `media` and `engine`.
- Coverage thresholds (enforced in CI): `core`, `media`, `engine` ≥ 90% lines.

Test style: tests next to the code (`name.test.js`), one behavior per test,
descriptive names (`it("hides the segments of a known stream")`),
Arrange / Act / Assert, no logic in tests.

## Code quality rules

- **Short files**: a module does one thing. ESLint stops files at 200 lines;
  most should be well under 150.
- **Small, well-named functions**: prefer pure functions and factories
  (`createX(deps)`) to classes and module state.
- Descriptive names; no abbreviations except well-known ones (`url`, `id`, `iv`).
- Named exports only; no default exports (tool config files excepted).
- No magic numbers: named constants.
- Validate everything from outside at the boundary: runtime messages
  (`engine/messages.js`), settings (`engine/settings.js`), native host messages
  (`engine/ytdlp.js`). Inside the engine, trust the data.
- Errors: expected failures are `EngineError` with a code from `ERROR`; the UI
  translates the code. Jobs record failures, they never throw to the caller.
- No dead code, no commented-out code, no `console` (use the logger in `core/`).
- Text from web pages goes into the DOM through `textContent`, never `innerHTML`.

## Interface texts

- Every text the user sees is in `_locales/en/messages.json` and
  `_locales/it/messages.json`, with the same keys. `src/ui/locales.test.js`
  checks it.
- The engine returns codes (`error_<code>`, `status_<status>`), never sentences.

## DRM and legal

- The extension never decrypts DRM (Widevine, PlayReady, FairPlay, SAMPLE-AES)
  and never extracts or requests licence keys. Encrypted streams can only be
  saved as they are, with a `.drm` extension, when the user enables it.
- Only standard HLS AES-128 (keys served openly to every player) is decrypted.
- Third-party code must be listed in `ASSETS.md` with source, author and
  license. Only licenses that allow reuse and redistribution.

## Git and pull requests

- Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`,
  `perf:`, `chore:`).
- Small, focused commits; test and implementation together or test first.
- PRs describe what changed, why, and how it was tested. UI changes include a
  screenshot.
- CI (GitHub Actions) runs format check, lint, unit tests with coverage and the
  e2e tests. Do not merge on red.

## Versioning

- The release is the `version` in `package.json`, following SemVer; the build
  writes it into both manifests.
- Bump it in its own commit, `chore(release): vX.Y.Z`, then tag `vX.Y.Z`.
  Patch: fixes only. Minor: new features or sites. Major: settings that no
  longer load unchanged.

## Documentation

- Code, comments, commit messages and docs are in **English**.
- The guides in `docs/` and the README also have an Italian version, linked at
  the top of each; change both. Write them plainly: short sentences, real
  examples from the repository.
- Comment the _why_, not the _what_. Public functions in `core`, `media` and
  `engine` have JSDoc comments.
- Update `README.md` and this file when commands, architecture or conventions
  change.
