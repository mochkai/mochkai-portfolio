import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REDUCED_MOTION_QUERY, usePrefersReducedMotion } from "./use-prefers-reduced-motion";

type Listener = (event: MediaQueryListEvent) => void;

/** Installs a controllable `window.matchMedia` stub and returns a setter for the preference. */
function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    media: REDUCED_MOTION_QUERY,
    addEventListener: vi.fn((_type: string, listener: Listener) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: Listener) => listeners.delete(listener)),
  };
  const matchMedia = vi.fn(() => mql as unknown as MediaQueryList);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    mql,
    matchMedia,
    listeners,
    set(value: boolean) {
      mql.matches = value;
      for (const listener of listeners) listener({ matches: value } as MediaQueryListEvent);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePrefersReducedMotion", () => {
  it("returns true when the user prefers reduced motion", () => {
    const media = mockMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("returns false when motion is allowed", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("updates when the OS setting changes and unsubscribes on unmount", () => {
    const media = mockMatchMedia(false);
    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => media.set(true));
    expect(result.current).toBe(true);

    act(() => media.set(false));
    expect(result.current).toBe(false);

    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it("falls back to false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("renders the calm state (true) on the server", () => {
    mockMatchMedia(false);
    /** Prints the hook's value so the server render can be inspected. */
    function Probe() {
      return createElement("span", null, String(usePrefersReducedMotion()));
    }
    expect(renderToString(createElement(Probe))).toContain("true");
  });
});
