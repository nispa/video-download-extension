import { urlDir, urlKey } from "../core/url.js";

/**
 * Media found in each tab. Segments and child playlists of a known stream are
 * hidden, so each stream is listed once.
 * @param {{ minFileSize: number }} options files smaller than this are previews or segments
 */
export function createTabStore({ minFileSize }) {
  const tabs = new Map();
  let nextId = 1;

  const stateOf = (tabId) => {
    if (!tabs.has(tabId)) tabs.set(tabId, { items: new Map(), hidden: new Set(), dirs: new Set() });
    return tabs.get(tabId);
  };
  const isHidden = (state, url, kind) =>
    state.hidden.has(urlKey(url)) || (kind === "file" && state.dirs.has(urlDir(url)));

  return {
    /**
     * Adds a detected media. Returns the new item and what changed: "added", "updated"
     * (a duplicate brought the missing size) or "none" (duplicate, hidden or too small).
     */
    add(tabId, data) {
      const state = stateOf(tabId);
      if (isHidden(state, data.url, data.kind)) return { item: null, change: "none" };
      const existing = state.items.get(data.url);
      if (existing) {
        if (existing.size || !data.size) return { item: null, change: "none" };
        existing.size = data.size;
        return { item: null, change: "updated" };
      }
      if (data.kind === "file" && data.size && data.size < minFileSize) {
        return { item: null, change: "none" };
      }
      const item = { id: `item-${nextId++}`, tabId, ...data };
      state.items.set(item.url, item);
      return { item, change: "added" };
    },

    /** Hides URLs (and, for plain files, whole folders) that belong to a stream. */
    hide(tabId, urls, dirs) {
      const state = stateOf(tabId);
      for (const url of urls) state.hidden.add(urlKey(url));
      for (const dir of dirs) state.dirs.add(dir);
      for (const [url, item] of state.items) {
        if (isHidden(state, url, item.kind)) state.items.delete(url);
      }
    },

    /** Forgets everything about a tab (new page, or tab closed). */
    clear(tabId) {
      tabs.delete(tabId);
    },

    /** Copies of the tab's items, in detection order. */
    items(tabId) {
      return [...(tabs.get(tabId)?.items.values() ?? [])].map((item) => ({ ...item }));
    },

    count(tabId) {
      return tabs.get(tabId)?.items.size ?? 0;
    },

    /** The live item with this id, in any tab, or null. */
    find(id) {
      for (const state of tabs.values()) {
        for (const item of state.items.values()) if (item.id === id) return item;
      }
      return null;
    },
  };
}
