import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PARALLAX_MAX_PX, parallaxOffset, startParallax } from "./parallax";

describe("parallaxOffset", () => {
  it("is zero when the layer is centred", () => {
    expect(parallaxOffset(400, 400)).toBe(0);
  });

  it("lags behind the page and is clamped to a small range", () => {
    // Below the centre: shifted up a little (it will rise slower than the page).
    expect(parallaxOffset(500, 400, 0.1, 50)).toBeCloseTo(-10);
    expect(parallaxOffset(300, 400, 0.1, 50)).toBeCloseTo(10);
    expect(parallaxOffset(10_000, 400)).toBe(-PARALLAX_MAX_PX);
    expect(parallaxOffset(-10_000, 400)).toBe(PARALLAX_MAX_PX);
  });
});

describe("startParallax", () => {
  let frames: FrameRequestCallback[];
  let observer: { callback: IntersectionObserverCallback } | undefined;

  beforeEach(() => {
    frames = [];
    observer = undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        callback: IntersectionObserverCallback;
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
          observer = { callback };
        }
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  /** A layer inside a parent whose box is centred at `center` px. */
  function setup(center: number) {
    const parent = document.createElement("div");
    const layer = document.createElement("div");
    parent.append(layer);
    parent.getBoundingClientRect = () => ({ top: center - 50, height: 100 }) as DOMRect;
    return layer;
  }

  /** Reports the layer as on- or off-screen. */
  function intersect(isIntersecting: boolean) {
    observer?.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
  }

  it("listens to scroll only while on screen, one update per frame", () => {
    const layer = setup(window.innerHeight / 2 + 100);
    const stop = startParallax(layer, { speed: 0.1, max: 50 });
    window.dispatchEvent(new Event("scroll"));
    expect(frames).toHaveLength(0);

    intersect(true);
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
    expect(frames).toHaveLength(1);
    frames.shift()?.(0);
    expect(layer.style.transform).toBe("translate3d(0px, -10px, 0px)");

    intersect(false);
    window.dispatchEvent(new Event("scroll"));
    expect(frames).toHaveLength(0);
    stop();
  });

  it("removes the transform and listeners on cleanup", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const layer = setup(0);
    const stop = startParallax(layer);
    intersect(true);
    frames.shift()?.(0);
    expect(layer.style.transform).not.toBe("");
    stop();
    expect(layer.style.transform).toBe("");
    expect(remove.mock.calls.map(([type]) => type)).toContain("scroll");
    remove.mockRestore();
  });
});
