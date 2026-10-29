import { chromium, expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startServer } from "./server.js";

const EXTENSION = fileURLToPath(new URL("../dist/edge", import.meta.url));
const FINISHED = ["done", "handed", "error", "cancelled"];

let server;
let context;
let worker;

test.beforeAll(async () => {
  server = await startServer();
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
});

test.afterAll(async () => {
  await context?.close();
  await server?.close();
});

/** Asks the engine (in the offscreen document) through the service worker's runtime. */
const engine = (message) => worker.evaluate((m) => chrome.runtime.sendMessage(m), message);

async function openTestPage() {
  const page = await context.newPage();
  await page.goto(`${server.url}/page.html`);
  const tabId = await worker.evaluate(
    async (url) => (await chrome.tabs.query({ url }))[0].id,
    `${server.url}/page.html`,
  );
  return { page, tabId };
}

test("finds the direct file, the HLS stream and the DASH stream of a page", async () => {
  const { tabId } = await openTestPage();

  // The order depends on what the page loads first.
  await expect
    .poll(async () =>
      (await engine({ type: "get-state", tabId })).items.map((item) => item.kind).sort(),
    )
    .toEqual(["dash", "file", "hls"]);
  const { items } = await engine({ type: "get-state", tabId });
  const dash = items.find((item) => item.kind === "dash");
  expect(dash.variants[0].resolution).toBe("160x90");
  expect(dash.audio).not.toBeNull();
  expect(await worker.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId)).toBe("3");
});

test("downloads every item, converting HLS to MP4, with the page as referer", async () => {
  const { tabId } = await openTestPage();
  await expect.poll(async () => (await engine({ type: "get-state", tabId })).items.length).toBe(3);
  const { items } = await engine({ type: "get-state", tabId });

  for (const item of items) await engine({ type: "download", itemId: item.id, variantIndex: 0 });
  // One job for the file, one for HLS, two for DASH (video and audio).
  const allFinished = async () => {
    const { jobs } = await engine({ type: "get-state", tabId });
    return jobs.length === 4 && jobs.every((job) => FINISHED.includes(job.status));
  };
  await expect.poll(allFinished, { timeout: 30_000 }).toBe(true);

  const { jobs } = await engine({ type: "get-state", tabId });
  expect(jobs.map((job) => [job.status, job.filename]).sort()).toEqual([
    ["done", "Test page (audio).m4a"],
    ["done", "Test page [90p].mp4"],
    ["done", "Test page.mp4"],
    ["handed", "Test page.mp4"],
  ]);
  const segmentRequest = server.requests.find((request) => request.path.endsWith(".ts"));
  expect(segmentRequest.referer).toContain(server.url);
});

test("saves real MP4 files", async () => {
  const downloads = await worker.evaluate(() => chrome.downloads.search({ state: "complete" }));
  const blobs = downloads.filter((download) => download.url.startsWith("blob:"));

  expect(blobs.length).toBeGreaterThanOrEqual(3);
  for (const download of blobs) {
    const bytes = await readFile(download.filename);
    expect(bytes.subarray(4, 8).toString("latin1")).toBe("ftyp"); // ISO base media file
  }
});
