import { describe, expect, it, vi } from "vitest";
import { createThrottle } from "./throttle.js";

function manualScheduler() {
  const queue = [];
  return {
    schedule: (callback) => queue.push(callback),
    runAll: () => queue.splice(0).forEach((callback) => callback()),
  };
}

describe("createThrottle", () => {
  it("runs the action once for a burst of calls", () => {
    const action = vi.fn();
    const scheduler = manualScheduler();
    const notify = createThrottle(action, 150, scheduler.schedule);

    notify();
    notify();
    notify();
    scheduler.runAll();

    expect(action).toHaveBeenCalledOnce();
  });

  it("runs again for calls after the previous run", () => {
    const action = vi.fn();
    const scheduler = manualScheduler();
    const notify = createThrottle(action, 150, scheduler.schedule);

    notify();
    scheduler.runAll();
    notify();
    scheduler.runAll();

    expect(action).toHaveBeenCalledTimes(2);
  });
});
