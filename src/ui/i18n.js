import { api } from "./api.js";

/**
 * Translated message from _locales; `$1`, `$2`... are replaced by the substitutions.
 * Falls back to the key, so a missing translation is visible but harmless.
 * @param {string} key
 * @param {...(string | number)} substitutions
 */
export function t(key, ...substitutions) {
  return api.i18n.getMessage(key, substitutions.map(String)) || key;
}

/**
 * Translates static markup: `data-i18n` sets the text, `data-i18n-title` the tooltip.
 * @param {ParentNode} root
 */
export function localizePage(root) {
  for (const element of root.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of root.querySelectorAll("[data-i18n-title]")) {
    element.title = t(element.dataset.i18nTitle);
  }
}
