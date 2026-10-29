import { normalizeSettings } from "../../engine/settings.js";
import { api } from "../api.js";
import { localizePage } from "../i18n.js";

/** Shows the stored settings and saves every change at once (no Save button). */
async function start() {
  localizePage(document);
  const settings = normalizeSettings(await api.storage.local.get(null));

  for (const radio of document.querySelectorAll('input[name="hlsFormat"]')) {
    radio.checked = radio.value === settings.hlsFormat;
    radio.addEventListener("change", () => api.storage.local.set({ hlsFormat: radio.value }));
  }

  const allowEncrypted = document.getElementById("allowEncrypted");
  allowEncrypted.checked = settings.allowEncrypted;
  allowEncrypted.addEventListener("change", () =>
    api.storage.local.set({ allowEncrypted: allowEncrypted.checked }),
  );
}

start();
