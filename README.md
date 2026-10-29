# Video Grabber

[Italiano](README.it.md)

A browser extension for **Firefox** and **Edge** (Chrome, Brave and Opera too) that
finds the videos embedded in a web page and downloads them, in the spirit of
Video DownloadHelper.

## What it does

- **Finds media on the network**: direct files (`video/*`, `audio/*`, `.mp4`,
  `.webm`, …), **HLS** playlists (`.m3u8`) and **DASH** manifests (`.mpd`).
  It also reads the sources of `<video>` and `<audio>` tags.
- **Lists each stream once**: the segments a player downloads are hidden.
- **Downloads**
  - direct files, through the browser's download manager;
  - HLS: choice of quality, segments in parallel with retries, standard AES-128,
    fMP4 and byte ranges; `.ts` streams are converted to **MP4** without
    re-encoding (mux.js);
  - DASH: choice of quality; video and audio come as two files;
  - **whole pages with yt-dlp** (YouTube, Vimeo and over a thousand sites),
    through a small native helper.
- Sends the page's Referer, Origin and cookies, which many CDNs require.
- Interface in English and Italian.

**DRM** streams (Widevine, PlayReady, FairPlay) are recognized and not downloaded.
For testing, the settings can allow saving them as they are: the file keeps a
`.drm` extension and stays encrypted. The extension never decrypts protected content.

## Install for development

Requirements: Node.js 22+, pnpm.

```sh
pnpm install
pnpm build          # creates dist/firefox and dist/edge
```

**Firefox**: open `about:debugging#/runtime/this-firefox` → **Load Temporary
Add-on…** → `dist/firefox/manifest.json`. Or run `pnpm start:firefox`.

**Edge** (same in Chrome at `chrome://extensions`): open `edge://extensions`,
enable **Developer mode**, **Load unpacked** → `dist/edge`.

After a change: `pnpm build`, then reload the extension and the page.

### yt-dlp (optional)

Needs `yt-dlp` and `ffmpeg` in the PATH (`winget install yt-dlp.yt-dlp Gyan.FFmpeg`).

```powershell
powershell -ExecutionPolicy Bypass -File native-host\install.ps1    # connect
powershell -ExecutionPolicy Bypass -File native-host\uninstall.ps1  # disconnect
```

Restart the browser afterwards. Files are saved to the Downloads folder. Keep
yt-dlp up to date (`yt-dlp -U`): sites change often.

## Tests

```sh
pnpm test:coverage   # unit tests, coverage ≥ 90% in core, media, engine
pnpm test:e2e        # the Edge build in Chromium, on a local test site
pnpm lint
```

The first `test:e2e` needs Playwright's browser: `pnpm exec playwright install chromium`.

## Limits

- Converted MP4 files are fragmented MP4: fine for browsers, VLC, phones and
  TVs. For an old editor: `ffmpeg -i video.mp4 -c copy plain.mp4`.
- To join separate video and audio: `ffmpeg -i video.mp4 -i audio.m4a -c copy out.mp4`.
- HLS and DASH files are assembled in memory before saving.
- Live streams: only the segments listed when you click are downloaded.
- In Edge the Referer is the page's origin (`https://site.example`), not its full
  address: Chromium does not give extensions more.

## Responsible use

Download only what you are allowed to: your own videos, freely licensed ones, or
with the permission of the rights holder, and within the terms of each site.

## Documentation

- [Architecture](docs/ARCHITECTURE.md): layers, the two builds, how a download works.
- [AGENTS.md](AGENTS.md): rules for contributors.
- [ASSETS.md](ASSETS.md): third-party code.

## License

[MIT](LICENSE). mux.js is Apache-2.0 (see [ASSETS.md](ASSETS.md)).
