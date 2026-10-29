import { REQUEST, STATE_CHANGED, WAKE_ENGINE } from "../../engine/messages.js";
import { normalizeSettings } from "../../engine/settings.js";
import { api, send } from "../api.js";
import { localizePage } from "../i18n.js";
import { renderItemCard } from "./itemCard.js";
import { renderJobCard } from "./jobCard.js";
import { setupYtdlpSection } from "./ytdlpSection.js";

/** In Edge the engine may still be starting when the popup opens. */
const RETRY_STATE_MS = 300;

const elements = {
  items: document.getElementById("items"),
  empty: document.getElementById("empty"),
  jobs: document.getElementById("jobs"),
  jobsSection: document.getElementById("jobs-section"),
  ytdlpSection: document.getElementById("ytdlp"),
  ytdlpDrm: document.getElementById("ytdlp-drm"),
};
const chosenVariants = new Map(); // item id -> quality index
/** Tab id with no media, used when the popup has no active tab. */
const NO_TAB = -1;
let tabId = NO_TAB;
let settings = normalizeSettings(undefined);
let lastItems = "";

function openSettings() {
  api.runtime.openOptionsPage();
  window.close();
}

function renderItems(items) {
  // Progress updates arrive several times a second: redrawing the list would close
  // an open quality menu. Redraw only when items change and no menu is in use.
  const serialized = JSON.stringify(items);
  const menuOpen = document.activeElement?.tagName === "SELECT";
  if (serialized === lastItems || menuOpen) return;
  lastItems = serialized;
  const cards = items.map((item) =>
    renderItemCard(item, {
      allowEncrypted: settings.allowEncrypted,
      variantIndex: chosenVariants.get(item.id) ?? 0,
      onSelectVariant: (index) => chosenVariants.set(item.id, index),
      onDownload: () =>
        send({
          type: REQUEST.DOWNLOAD,
          itemId: item.id,
          variantIndex: chosenVariants.get(item.id) ?? 0,
        }),
      onOpenSettings: openSettings,
    }),
  );
  elements.items.replaceChildren(...cards);
}

function renderJobs(jobs) {
  const cards = jobs.map((job) =>
    renderJobCard(job, {
      onCancel: () => send({ type: REQUEST.CANCEL, jobId: job.id }),
      onDismiss: () => send({ type: REQUEST.DISMISS, jobId: job.id }),
    }),
  );
  elements.jobs.replaceChildren(...cards);
  elements.jobsSection.hidden = jobs.length === 0;
}

async function refresh() {
  const state = await send({ type: REQUEST.GET_STATE, tabId }).catch(() => null);
  if (!state?.items) {
    setTimeout(refresh, RETRY_STATE_MS);
    return;
  }
  renderItems(state.items);
  renderJobs(state.jobs);
  elements.empty.hidden = state.items.length > 0;
  elements.ytdlpDrm.hidden = !state.items.some((item) => item.drm);
}

async function start() {
  localizePage(document);
  document.getElementById("settings").addEventListener("click", openSettings);
  api.runtime.onMessage.addListener((message) => {
    if (message?.type === STATE_CHANGED) refresh();
  });
  await send(WAKE_ENGINE).catch(() => {}); // Edge only; nobody answers in Firefox
  settings = normalizeSettings(await api.storage.local.get(null));
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? NO_TAB;
  refresh();
  setupYtdlpSection(tab, elements.ytdlpSection);
}

start();
