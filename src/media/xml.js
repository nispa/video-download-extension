/**
 * Helpers over DOM elements from DOMParser (browser) or happy-dom (tests).
 * Matching uses localName, so XML namespaces in DASH manifests do not matter.
 */

/**
 * Direct children of an element with the given local name.
 * @param {Element} element
 * @param {string} name
 * @returns {Element[]}
 */
export function childElements(element, name) {
  return [...element.children].filter((child) => child.localName === name);
}

/**
 * First direct child with the given local name, or null.
 * @param {Element} element
 * @param {string} name
 */
export function firstChild(element, name) {
  return childElements(element, name)[0] ?? null;
}

/**
 * The element's BaseURL child resolved against `base`, or `base` itself.
 * @param {Element} element
 * @param {string} base
 */
export function resolveBaseUrl(element, base) {
  const baseUrl = firstChild(element, "BaseURL");
  return baseUrl ? new URL(baseUrl.textContent.trim(), base).href : base;
}
