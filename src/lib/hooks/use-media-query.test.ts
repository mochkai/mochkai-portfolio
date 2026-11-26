import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./use-media-query";

/** Installs a controllable `matchMedia` stub; returns a setter that fires change events. */
function mockMatchMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initial,
    addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
  };
  const matchMedia = vi.fn(() => mql as unknown as MediaQueryList);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    set(value: boolean) {
      mql.matches = value;
      for (const listener of listeners) listener();
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("reports whether the query matches and updates on change", () => {
    const media = mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(pointer: fine)"));
    expect(result.current).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith("(pointer: fine)");
    act(() => media.set(false));
    expect(result.current).toBe(false);
  });

  it("falls back to the server value without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(renderHook(() => useMediaQuery("(pointer: fine)")).result.current).toBe(false);
    expect(renderHook(() => useMediaQuery("(pointer: fine)", true)).result.current).toBe(true);
  });

  it("uses the server value during server rendering", () => {
    mockMatchMedia(true);
    /** Renders the hook's value as text. */
    function Probe() {
      return createElement("span", null, String(useMediaQuery("(pointer: fine)")));
    }
    expect(renderToString(createElement(Probe))).toContain("false");
  });
});
