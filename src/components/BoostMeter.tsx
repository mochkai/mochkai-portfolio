"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/lib/cx";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { getScrollProgress } from "@/lib/scroll-progress";

/**
 * Thin glowing "boost meter" fixed to the top of the viewport that fills with reading progress
 * (0 % at the top of the document, 100 % at the bottom).
 *
 * - Decorative: `aria-hidden`, `pointer-events: none`, and `position: fixed` so it never shifts
 *   layout.
 * - Updates are throttled to one per animation frame from a passive scroll listener, plus
 *   window resizes and body size changes (content loading in). The fill is scaled with a
 *   `transform` written straight to the DOM, so scrolling never re-renders React.
 * - Reduced motion: the meter still shows the position, but jumps to it without easing.
 *   The glow is static in both modes.
 * - The current value is mirrored to `data-progress` (0 to 1, three decimals) for tests.
 */
export function BoostMeter() {
  const meterRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const meter = meterRef.current;
    const fill = fillRef.current;
    if (!meter || !fill) return;

    let frame = 0;

    /** Reads the scroll position and paints the fill. */
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const progress = getScrollProgress(window.scrollY, root.scrollHeight, root.clientHeight);
      fill.style.transform = `scaleX(${progress})`;
      meter.dataset.progress = progress.toFixed(3);
    };

    /** Coalesces bursts of scroll/resize events into one update per frame. */
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resizeObserver?.observe(document.body);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resizeObserver?.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={meterRef}
      aria-hidden="true"
      data-testid="boost-meter"
      data-progress="0.000"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 bg-surface-raised/80"
    >
      <div
        ref={fillRef}
        data-testid="boost-meter-fill"
        style={{ transform: "scaleX(0)" }}
        className={cx(
          "h-full origin-left bg-linear-to-r from-brand via-neon to-glow shadow-glow-sm",
          reducedMotion
            ? "transition-none"
            : "motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-reduce:transition-none",
        )}
      />
    </div>
  );
}
