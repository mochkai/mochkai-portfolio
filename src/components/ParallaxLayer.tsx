"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { startParallax } from "@/lib/parallax";

/** Props for {@link ParallaxLayer}. */
export interface ParallaxLayerProps {
  /** Decorative content (for example a {@link RuneCircuit}); stays server-rendered. */
  children: ReactNode;
  /** Fraction of its distance from the viewport centre the layer lags by. */
  speed?: number;
  /** Largest offset in pixels. */
  max?: number;
  /** Position and size the layer (it is usually `absolute` inside a `relative` parent). */
  className?: string;
}

/**
 * A decorative layer that moves slightly slower than the page on scroll (gentle parallax,
 * at most a few pixels). Hidden from assistive tech and never hit-tested.
 *
 * Off under `prefers-reduced-motion: reduce`: no listener runs and no transform is set. The hook
 * reports reduced motion on the server and during hydration, so the server HTML is always still.
 * Per-frame work happens outside React ({@link startParallax}). `data-parallax` mirrors the state
 * (`on` / `off`) for tests.
 */
export function ParallaxLayer({ children, speed, max, className }: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const layer = ref.current;
    if (!layer || reducedMotion) return;
    return startParallax(layer, { speed, max });
  }, [reducedMotion, speed, max]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-testid="parallax-layer"
      data-parallax={reducedMotion ? "off" : "on"}
      className={cx("pointer-events-none", className)}
    >
      {children}
    </div>
  );
}
