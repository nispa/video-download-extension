import { button, el } from "../dom.js";
import { t } from "../i18n.js";
import { itemFacts, itemName, itemWarning, tagLabel, variantLabel } from "./labels.js";

const COPIED_FEEDBACK_MS = 1200;

/**
 * Card of a detected item: name, facts, quality choice and actions.
 * @param {object} item
 * @param {object} options
 * @param {boolean} options.allowEncrypted
 * @param {number} options.variantIndex the quality chosen so far
 * @param {(index: number) => void} options.onSelectVariant
 * @param {() => void} options.onDownload
 * @param {() => void} options.onOpenSettings
 */
export function renderItemCard(item, options) {
  const warning = itemWarning(item, t, options.allowEncrypted);
  const card = el("li", { className: "card" }, [
    el("div", { className: "title" }, [
      el("span", { className: `tag ${item.kind}`, textContent: tagLabel(item) }),
      el("span", { className: "name", textContent: itemName(item), title: item.url }),
    ]),
    el("div", { className: "meta", textContent: itemFacts(item, t).join(" · ") }),
  ]);
  if (warning) card.append(el("div", { className: "meta error", textContent: warning }));
  card.append(actionsRow(item, options));
  if (item.drm && !item.error) card.append(drmButton(options));
  return card;
}

function actionsRow(item, options) {
  const row = el("div", { className: "actions" });
  if (item.variants?.length) row.append(qualitySelect(item.variants, options));
  const canDownload = (item.kind !== "dash" || item.variants) && !item.error;
  // DRM items get their own, clearly different button.
  if (!item.drm && item.variants?.length !== 0) {
    row.append(button(t("download"), options.onDownload, { disabled: !canDownload }));
  }
  row.append(copyButton(item.url));
  return row;
}

function qualitySelect(variants, options) {
  const select = el(
    "select",
    {},
    variants.map((variant, index) =>
      el("option", { value: String(index), textContent: variantLabel(variant, t) }),
    ),
  );
  select.value = String(options.variantIndex);
  select.addEventListener("change", () => options.onSelectVariant(Number(select.value)));
  return select;
}

function copyButton(url) {
  const copy = button(
    t("copyUrl"),
    async () => {
      await navigator.clipboard.writeText(url);
      copy.textContent = t("copied");
      setTimeout(() => {
        copy.textContent = t("copyUrl");
      }, COPIED_FEEDBACK_MS);
    },
    { className: "secondary" },
  );
  return copy;
}

function drmButton(options) {
  if (options.allowEncrypted)
    return button(t("drmDownload"), options.onDownload, { className: "danger" });
  return button(t("drmEnable"), options.onOpenSettings, { className: "danger" });
}
