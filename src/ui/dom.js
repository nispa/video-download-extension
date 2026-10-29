/**
 * Creates an element with properties and children. Text always goes through
 * textContent, never innerHTML: item names come from web pages.
 * @param {string} tag
 * @param {object} [properties]
 * @param {(Node | string)[]} [children]
 */
export function el(tag, properties = {}, children = []) {
  const element = document.createElement(tag);
  Object.assign(element, properties);
  element.append(...children);
  return element;
}

/**
 * A button that runs `onClick`.
 * @param {string} text
 * @param {() => void} onClick
 * @param {object} [properties] e.g. className, disabled
 */
export function button(text, onClick, properties = {}) {
  const element = el("button", { textContent: text, ...properties });
  element.addEventListener("click", onClick);
  return element;
}
