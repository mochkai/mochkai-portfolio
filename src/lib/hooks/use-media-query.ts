"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, updating live when it changes. One `MediaQueryList` is
 * created per subscription and snapshot read, not per event.
 *
 * @param query - A media query, for example `(hover: hover) and (pointer: fine)`.
 * @param serverValue - Value used during server rendering and hydration, and where
 * `matchMedia` is unavailable. Pick the calm/off state so effects never flash on.
 * @returns `true` when the query matches.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onChange);
      return () => mediaQueryList.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = () =>
    typeof window.matchMedia === "function" ? window.matchMedia(query).matches : serverValue;
  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}
