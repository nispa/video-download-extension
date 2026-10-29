# Video Grabber

[English](README.md)

Estensione per **Firefox** ed **Edge** (anche Chrome, Brave e Opera) che trova i
video incorporati in una pagina web e li scarica, nello stile di Video DownloadHelper.

## Cosa fa

- **Trova i video dalla rete**: file diretti (`video/*`, `audio/*`, `.mp4`,
  `.webm`, …), playlist **HLS** (`.m3u8`) e manifest **DASH** (`.mpd`). Legge
  anche i sorgenti dei tag `<video>` e `<audio>`.
- **Mostra ogni stream una volta sola**: i segmenti che il player scarica sono nascosti.
- **Scarica**
  - i file diretti, tramite il gestore download del browser;
  - HLS: scelta della qualità, segmenti in parallelo con nuovi tentativi, AES-128
    standard, fMP4 e byte range; gli stream `.ts` diventano **MP4** senza
    ricodifica (mux.js);
  - DASH: scelta della qualità; video e audio arrivano in due file;
  - **pagine intere con yt-dlp** (YouTube, Vimeo e oltre mille siti), tramite un
    piccolo programma di supporto.
- Invia Referer, Origin e cookie della pagina, che molti CDN richiedono.
- Interfaccia in inglese e in italiano.

Gli stream con **DRM** (Widevine, PlayReady, FairPlay) vengono riconosciuti e non
scaricati. Per fare prove, nelle impostazioni si può permettere di salvarli così
come sono: il file ha estensione `.drm` e resta cifrato. L'estensione non decifra
mai contenuti protetti.

## Installazione per lo sviluppo

Servono Node.js 22 o superiore e pnpm.

```sh
pnpm install
pnpm build          # crea dist/firefox e dist/edge
```

**Firefox**: apri `about:debugging#/runtime/this-firefox` → **Carica componente
aggiuntivo temporaneo…** → `dist/firefox/manifest.json`. Oppure `pnpm start:firefox`.

**Edge** (uguale in Chrome con `chrome://extensions`): apri `edge://extensions`,
attiva **Modalità sviluppatore**, **Carica decompressa** → `dist/edge`.

Dopo una modifica: `pnpm build`, poi ricarica l'estensione e la pagina.

### yt-dlp (facoltativo)

Servono `yt-dlp` e `ffmpeg` nel PATH (`winget install yt-dlp.yt-dlp Gyan.FFmpeg`).

```powershell
powershell -ExecutionPolicy Bypass -File native-host\install.ps1    # collega
powershell -ExecutionPolicy Bypass -File native-host\uninstall.ps1  # scollega
```

Poi riavvia il browser. I file vanno nella cartella Download. Tieni aggiornato
yt-dlp (`yt-dlp -U`): i siti cambiano spesso.

## Test

```sh
pnpm test:coverage   # test unitari, copertura ≥ 90% in core, media, engine
pnpm test:e2e        # la versione Edge in Chromium, su un sito di prova locale
pnpm lint
```

Il primo `test:e2e` richiede il browser di Playwright: `pnpm exec playwright install chromium`.

## Limiti

- Gli MP4 convertiti sono MP4 "frammentati": vanno bene per browser, VLC,
  smartphone e TV. Per un vecchio programma di montaggio:
  `ffmpeg -i video.mp4 -c copy normale.mp4`.
- Per unire video e audio separati: `ffmpeg -i video.mp4 -i audio.m4a -c copy finale.mp4`.
- I file HLS e DASH vengono composti in memoria prima del salvataggio.
- Dirette: si scaricano solo i segmenti presenti al momento del clic.
- In Edge il Referer è l'origine della pagina (`https://sito.it`), non l'indirizzo
  completo: Chromium non fornisce di più alle estensioni.

## Uso responsabile

Scarica solo ciò che hai il diritto di scaricare: i tuoi video, quelli con licenza
libera o con il permesso di chi ne ha i diritti, e nel rispetto delle condizioni
di ogni sito.

## Documentazione

- [Architettura](docs/ARCHITETTURA.md): livelli, le due versioni, come funziona un download.
- [AGENTS.md](AGENTS.md): regole per chi contribuisce (in inglese).
- [ASSETS.md](ASSETS.md): codice di terze parti.

## Licenza

[MIT](LICENSE). mux.js è Apache-2.0 (vedi [ASSETS.md](ASSETS.md)).
