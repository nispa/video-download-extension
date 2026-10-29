/**
 * Calls `action` at most once per `delayMs`, after the last burst of calls.
 * Download progress arrives many times a second; the popup needs far fewer updates.
 * @param {() => void} action
 * @param {number} delayMs
 * @param {(callback: () => void, delayMs: number) => unknown} schedule setTimeout, or a fake in tests
 * @returns {() => void}
 */
export function createThrottle(action, delayMs, schedule) {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    schedule(() => {
      pending = false;
      action();
    }, delayMs);
  };
}
