/** Requests not made by a tab (the extension's own) have tab id -1. */
const NO_TAB = -1;
const RULE_PRIORITY = 1;

/**
 * Referer and Origin for the extension's own requests in Manifest V3, which has
 * no blocking webRequest: one declarativeNetRequest session rule per host,
 * limited to requests made outside tabs.
 * @param {(path: string, ...args: unknown[]) => Promise<unknown>} callServiceWorker
 * @returns {{ setReferer: (url: string, referer: string) => Promise<void> }}
 */
export function createDnrReferer(callServiceWorker) {
  const rules = new Map(); // host -> { id, referer }
  let nextRuleId = 1;

  async function setReferer(url, referer) {
    if (!referer) return;
    const host = new URL(url).hostname;
    const current = rules.get(host);
    if (current?.referer === referer) return;
    const id = current?.id ?? nextRuleId++;
    rules.set(host, { id, referer });
    await callServiceWorker("declarativeNetRequest.updateSessionRules", {
      removeRuleIds: [id],
      addRules: [refererRule(id, host, referer)],
    });
  }

  return { setReferer };
}

function refererRule(id, host, referer) {
  return {
    id,
    priority: RULE_PRIORITY,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        { header: "referer", operation: "set", value: referer },
        { header: "origin", operation: "set", value: new URL(referer).origin },
      ],
    },
    condition: { requestDomains: [host], tabIds: [NO_TAB] },
  };
}
