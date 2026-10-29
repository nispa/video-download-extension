# Architettura

[English](ARCHITECTURE.md)

## Livelli

```
app/        punti di ingresso, uno per ogni contesto del browser
  ↓
ui/  platform/  content/
  ↓
engine/     la logica dell'estensione
  ↓
media/      formati: classificazione, HLS, DASH, cifratura, TS → MP4
  ↓
core/       utilità: logger, URL, nomi dei file, formattazione, throttle
```

`core`, `media` ed `engine` non toccano mai il browser: tutto ciò che serve
arriva come parametro di `createEngine` (`src/engine/engine.js`). Per questo lo
stesso motore funziona in Firefox, in Edge e nei test unitari.

## Le due versioni

`pnpm build` copia lo stesso `src/` in due cartelle e scrive un manifest diverso
per ciascuna (`scripts/manifests.js`).

|                                         | Firefox (`dist/firefox`)                                           | Edge, Chrome (`dist/edge`)                                          |
| --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Manifest                                | V2                                                                 | V3                                                                  |
| Dove gira il motore                     | pagina di background sempre aperta (`app/firefox-background.html`) | offscreen document, una pagina nascosta (`app/edge-offscreen.html`) |
| API del browser                         | `browser.*` direttamente                                           | tramite il service worker (`platform/edge/bridge.js`)               |
| Referer delle richieste dell'estensione | `webRequest` bloccante (`platform/firefox/referer.js`)             | regole `declarativeNetRequest` (`platform/edge/dnrReferer.js`)      |

Perché Edge ha bisogno di un offscreen document: con Manifest V3 il background è
un service worker che il browser sospende dopo pochi secondi di inattività, e non
ha `DOMParser` (i manifest DASH sono XML) né `URL.createObjectURL` (per salvare il
file finale). L'offscreen document li ha, ma dispone solo di `chrome.runtime`. Quindi:

- il service worker (`app/edgeServiceWorker.js`) ascolta gli eventi del browser e
  li inoltra (`platform/edge/eventForwarding.js`);
- l'offscreen document chiede al service worker di chiamare le API che non ha
  (`platform/edge/serviceWorkerCalls.js`); sono permesse solo le chiamate elencate lì;
- le porte di native messaging per yt-dlp restano nel service worker, e i loro
  messaggi vengono girati all'offscreen (`platform/edge/nativeProxy.js`).

`createEdgeApi` dà al motore un oggetto `api` con la stessa forma del `browser`
di Firefox, così `app/background.js` è uguale per entrambi.

## Come si scarica uno stream

Esempio: una pagina riproduce uno stream HLS.

1. Il player scarica `master.m3u8`. `engine/detection.js` vede la risposta,
   `media/classify.js` dice "hls", e l'elemento viene salvato per la scheda
   (`engine/tabStore.js`).
2. Il motore legge la playlist (`media/hls.js`): le qualità finiscono
   sull'elemento, le sotto-playlist e i segmenti vengono nascosti
   (`engine/inspection.js`).
3. L'utente sceglie 720p e clicca Scarica. `engine/streamTasks.js` prepara un
   compito per il video e uno per l'audio separato, se c'è.
4. `engine/streamJob.js` esegue ogni compito: rilegge la playlist, scarica i
   segmenti sei alla volta (`engine/segments.js`) decifrando l'AES-128 standard,
   converte i `.ts` in MP4 (`media/remux.js`) oppure unisce i segmenti, e salva
   il file (`engine/downloadService.js`).
5. Ogni cambiamento di un download arriva al pannello come messaggio
   `state-changed`, raggruppato da `core/throttle.js` a pochi al secondo.

## Messaggi

Il pannello e il content script parlano con il motore tramite messaggi runtime,
elencati in `engine/messages.js` e controllati da `parseRequest` prima dell'uso:
un content script gira dentro qualsiasi pagina web, quindi i suoi messaggi non
sono affidabili.

## yt-dlp

`native-host/` è un piccolo programma Node che il browser avvia per ogni
richiesta (native messaging). `install.ps1` lo registra per Firefox, Edge, Chrome
e Chromium. Lancia yt-dlp con argomenti fissi (`native-host/ytdlpArgs.js`);
l'indirizzo della pagina viene sempre dopo `--`, quindi non può mai essere letto
come un'opzione.
