"use client";

import { useSyncExternalStore } from "react";

/** Media query that matches when the user asked the OS to minimise motion. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Returns the reduced-motion media query list, or `null` where `matchMedia` is unavailable. */
function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

/** Subscribes to changes of the reduced-motion preference; returns the unsubscribe function. */
function subscribe(onChange: () => void): () => void {
  const mediaQueryList = getMediaQueryList();
  if (!mediaQueryList) return () => {};
  mediaQueryList.addEventListener("change", onChange);
  return () => mediaQueryList.removeEventListener("change", onChange);
}

/** Current preference in the browser. */
function getSnapshot(): boolean {
  return getMediaQueryList()?.matches ?? false;
}

/**
 * Server and hydration snapshot. Returns `true` so the first render is the calm one:
 * JS-driven effects only start once the browser confirms the user allows motion.
 */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Whether the user prefers reduced motion (`prefers-reduced-motion: reduce`).
 *
 * Use it to turn off or simplify JS-driven effects (parallax, animated counters, canvas).
 * CSS transitions are already handled by the global baseline in `globals.css` and the
 * `motion-reduce:` utilities. Updates live when the OS setting changes.
 *
 * @returns `true` when motion should be reduced. During server rendering and hydration it
 * returns `true`, so effects never flash on before the preference is known.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
