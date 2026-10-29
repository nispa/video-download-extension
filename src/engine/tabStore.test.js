import { describe, expect, it } from "vitest";
import { createTabStore } from "./tabStore.js";

const MIN_SIZE = 1000;
const file = (url, size = 0) => ({ url, kind: "file", mime: "video/mp4", size, referer: "" });

describe("createTabStore", () => {
  it("adds media with a unique id and lists it per tab", () => {
    const store = createTabStore({ minFileSize: MIN_SIZE });

    const { item, change } = store.add(1, file("https://a.example/v.mp4", 5000));

    expect(change).toBe("added");
    expect(item).toMatchObject({ id: "item-1", tabId: 1 });
    expect(store.items(1)).toEqual([item]);
    expect(store.items(2)).toEqual([]);
    expect(store.count(1)).toBe(1);
  });

  it("ignores duplicates but takes a size they bring", () => {
    const store = createTabStore({ minFileSize: MIN_SIZE });
    store.add(1, file("https://a.example/v.mp4"));

    const first = store.add(1, file("https://a.example/v.mp4", 5000));
    const second = store.add(1, file("https://a.example/v.mp4", 6000));

    expect(first.change).toBe("updated");
    expect(second.change).toBe("none");
    expect(store.items(1)[0].size).toBe(5000);
  });

  it("ignores files smaller than the minimum size", () => {
    const store = createTabStore({ minFileSize: MIN_SIZE });

    expect(store.add(1, file("https://a.example/thumb.mp4", 10)).change).toBe("none");
  });

  it("hides and removes segments of a stream, by path and by folder", () => {
    const store = createTabStore({ minFileSize: MIN_SIZE });
    store.add(1, file("https://cdn-a.example/s/seg-1.mp4?t=1", 5000));
    store.add(1, file("https://cdn-a.example/other/v.mp4", 5000));

    store.hide(1, ["https://cdn-b.example/s/seg-1.mp4"], ["/s/"]);
    const later = store.add(1, file("https://cdn-a.example/s/seg-2.mp4", 5000));

    expect(store.items(1).map((item) => item.url)).toEqual(["https://cdn-a.example/other/v.mp4"]);
    expect(later.change).toBe("none");
  });

  it("does not hide playlists in a hidden folder", () => {
    const store = createTabStore({ minFileSize: MIN_SIZE });
    store.hide(1, [], ["/s/"]);

    const { change } = store.add(1, { url: "https://a.example/s/master.m3u8", kind: "hls" });

    expect(change).toBe("added");
  });

  it("finds live items by id and forgets cleared tabs", () => {
    const store = createTabStore({ minFileSize: MIN_SIZE });
    const { item } = store.add(3, file("https://a.example/v.mp4", 5000));

    expect(store.find(item.id)).toBe(item);
    store.clear(3);
    expect(store.find(item.id)).toBeNull();
    expect(store.count(3)).toBe(0);
  });
});
