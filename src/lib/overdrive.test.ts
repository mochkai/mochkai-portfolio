import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OVERDRIVE_MS, createOverdriveStore } from "./overdrive";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createOverdriveStore", () => {
  it("is off on the server and until engaged", () => {
    const store = createOverdriveStore();
    expect(store.getServerSnapshot()).toBe(false);
    expect(store.getSnapshot()).toBe(false);
  });

  it("ends on its own after OVERDRIVE_MS", () => {
    const store = createOverdriveStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.engage();
    expect(store.getSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(OVERDRIVE_MS - 1);
    expect(store.getSnapshot()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(store.getSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("lasts a few seconds", () => {
    expect(OVERDRIVE_MS).toBeGreaterThanOrEqual(2000);
    expect(OVERDRIVE_MS).toBeLessThanOrEqual(5000);
  });

  it("restarts the timer when engaged again, without extra notifications", () => {
    const store = createOverdriveStore(1000);
    const listener = vi.fn();
    store.subscribe(listener);
    store.engage();
    vi.advanceTimersByTime(800);
    store.engage();
    vi.advanceTimersByTime(800);
    expect(store.getSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    expect(store.getSnapshot()).toBe(false);
  });

  it("stops at once and cancels the timer", () => {
    const store = createOverdriveStore(1000);
    store.engage();
    store.stop();
    expect(store.getSnapshot()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops notifying after unsubscribe", () => {
    const store = createOverdriveStore(1000);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.engage();
    expect(listener).not.toHaveBeenCalled();
  });
});
