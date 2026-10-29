import { isHttpUrl } from "../../core/url.js";
import { REQUEST } from "../../engine/messages.js";
import { send } from "../api.js";
import { t } from "../i18n.js";
import { errorText } from "./labels.js";

/**
 * The "whole page with yt-dlp" section: shown on web pages, usable once the
 * native host answers.
 * @param {{ url?: string, title?: string } | undefined} tab
 * @param {HTMLElement} section
 */
export async function setupYtdlpSection(tab, section) {
  if (!tab?.url || !isHttpUrl(tab.url)) return;
  section.hidden = false;
  const info = section.querySelector("#ytdlp-info");
  const actions = section.querySelector("#ytdlp-actions");

  const status = await send({ type: REQUEST.YTDLP_STATUS });
  if (!status?.ok) {
    info.textContent = errorText(status?.error ?? { code: "ytdlpMissing", detail: "" }, t);
    info.classList.add("error");
    actions.hidden = true;
    return;
  }
  info.textContent = t("ytdlpReady", status.version);
  section.querySelector("#ytdlp-download").addEventListener("click", () => {
    const format = section.querySelector("#ytdlp-format").value;
    send({ type: REQUEST.YTDLP_DOWNLOAD, url: tab.url, format, title: tab.title ?? "" });
  });
}
