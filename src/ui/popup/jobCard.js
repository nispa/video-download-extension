import { isActive, JOB_STATUS } from "../../engine/jobs.js";
import { button, el } from "../dom.js";
import { t } from "../i18n.js";
import { errorText, jobLine } from "./labels.js";

const PERCENT = 100;

/**
 * Card of a download: file name, status line, progress bar, cancel or remove.
 * @param {object} job
 * @param {{ onCancel: () => void, onDismiss: () => void }} actions
 */
export function renderJobCard(job, actions) {
  const active = isActive(job.status);
  const card = el("li", { className: `card ${job.status}` }, [
    el("div", { className: "title" }, [
      el("span", { className: "name", textContent: job.filename, title: job.filename }),
      active
        ? button(t("cancel"), actions.onCancel, { className: "secondary" })
        : button(t("remove"), actions.onDismiss, { className: "secondary" }),
    ]),
    el("div", {
      className: job.status === JOB_STATUS.ERROR ? "meta error" : "meta",
      textContent: jobLine(job, t),
    }),
  ]);
  if (job.warning)
    card.append(el("div", { className: "meta error", textContent: errorText(job.warning, t) }));
  if (active || job.status === JOB_STATUS.DONE) card.append(progressBar(job.progress));
  return card;
}

function progressBar(fraction) {
  const fill = el("div");
  fill.style.width = `${fraction * PERCENT}%`;
  return el("div", { className: "progress" }, [fill]);
}
