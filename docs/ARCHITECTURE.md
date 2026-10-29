# Architecture

[Italiano](ARCHITETTURA.md)

## Layers

```
app/        composition roots, one per browser context
  ↓
ui/  platform/  content/
  ↓
engine/     the extension's logic
  ↓
media/      formats: classification, HLS, DASH, encryption, TS → MP4
  ↓
core/       utilities: logger, URLs, file names, formatting, throttle
```

`core`, `media` and `engine` never touch the browser: everything they need
arrives as a parameter of `createEngine` (`src/engine/engine.js`). That is why the
same engine runs in Firefox, in Edge and in the unit tests.

## The two builds

`pnpm build` copies the same `src/` into two folders and writes a different
manifest for each (`scripts/manifests.js`).

|                                     | Firefox (`dist/firefox`)                                     | Edge, Chrome (`dist/edge`)                                    |
| ----------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| Manifest                            | V2                                                           | V3                                                            |
| Where the engine runs               | background page, always open (`app/firefox-background.html`) | offscreen document, a hidden page (`app/edge-offscreen.html`) |
| Browser APIs                        | `browser.*` directly                                         | through the service worker (`platform/edge/bridge.js`)        |
| Referer of the extension's requests | blocking `webRequest` (`platform/firefox/referer.js`)        | `declarativeNetRequest` rules (`platform/edge/dnrReferer.js`) |

Why Edge needs an offscreen document: in Manifest V3 the background is a
service worker that the browser suspends after a few seconds of quiet, and it has
no `DOMParser` (DASH manifests are XML) and no `URL.createObjectURL` (to save the
joined file). The offscreen document has both, but only `chrome.runtime`. So:

- the service worker (`app/edgeServiceWorker.js`) listens to the browser's events
  and forwards them (`platform/edge/eventForwarding.js`);
- the offscreen document asks the service worker to call the APIs it lacks
  (`platform/edge/serviceWorkerCalls.js`); only the calls listed there are allowed;
- native messaging ports for yt-dlp stay in the service worker, and their
  messages are relayed (`platform/edge/nativeProxy.js`).

`createEdgeApi` gives the engine an `api` object with the same shape as
Firefox's `browser`, so `app/background.js` is the same for both.

## How a stream is downloaded

Example: a page plays an HLS stream.

1. The player fetches `master.m3u8`. `engine/detection.js` sees the response,
   `media/classify.js` says "hls", and the item is stored for the tab
   (`engine/tabStore.js`).
2. The engine reads the playlist (`media/hls.js`): its qualities go on the item,
   and the child playlists and segments are hidden (`engine/inspection.js`).
3. The user picks 720p and clicks Download. `engine/streamTasks.js` builds one
   task for the video and one for the separate audio, if any.
4. `engine/streamJob.js` runs each task: it reads the playlist again, fetches the
   segments six at a time (`engine/segments.js`), decrypting standard AES-128,
   converts `.ts` to MP4 (`media/remux.js`) or joins the segments, and saves the
   file (`engine/downloadService.js`).
5. Every change of a job reaches the popup as a `state-changed` message, grouped
   by `core/throttle.js` to a few per second.

## Messages

The popup and the content script talk to the engine with runtime messages,
listed in `engine/messages.js` and checked by `parseRequest` before use: a
content script runs inside any web page, so its messages are not trusted.

## yt-dlp

`native-host/` is a small Node program the browser starts for each request
(native messaging). `install.ps1` registers it for Firefox, Edge, Chrome and
Chromium. It runs yt-dlp with fixed arguments (`native-host/ytdlpArgs.js`); the
page URL always comes after `--`, so it can never be read as an option.
