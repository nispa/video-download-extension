/** Forgotten after this long: the requests they were for have long been sent. */
const ENTRY_LIFETIME_MS = 10 * 60 * 1000;
const PRUNE_INTERVAL_MS = 60 * 1000;
/** Requests not made by a tab (the extension's own) have tab id -1. */
const NO_TAB = -1;

/**
 * Referer and Origin for the extension's own requests, set with Firefox's
 * blocking webRequest: each URL gets the page it was found on.
 * @param {typeof browser.webRequest} webRequest
 * @returns {{ setReferer: (url: string, referer: string) => void }}
 */
export function createFirefoxReferer(webRequest) {
  const referers = new Map(); // url -> { referer, time }

  const setReferer = (url, referer) => {
    if (referer) referers.set(url, { referer, time: Date.now() });
  };

  webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      const entry = details.tabId === NO_TAB ? referers.get(details.url) : undefined;
      if (!entry) return undefined;
      return { requestHeaders: withReferer(details.requestHeaders, entry.referer) };
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"],
  );

  webRequest.onBeforeRedirect.addListener(
    (details) => {
      const entry = referers.get(details.url);
      if (details.tabId === NO_TAB && entry) setReferer(details.redirectUrl, entry.referer);
    },
    { urls: ["<all_urls>"] },
  );

  setInterval(() => {
    const oldest = Date.now() - ENTRY_LIFETIME_MS;
    for (const [url, entry] of referers) if (entry.time < oldest) referers.delete(url);
  }, PRUNE_INTERVAL_MS);

  return { setReferer };
}

/** Request headers with the page's Referer, and its Origin when the request has one. */
function withReferer(headers, referer) {
  const result = headers.filter((header) => header.name.toLowerCase() !== "referer");
  result.push({ name: "Referer", value: referer });
  const origin = result.find((header) => header.name.toLowerCase() === "origin");
  if (origin) origin.value = new URL(referer).origin;
  return result;
}
