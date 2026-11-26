"use client";

import { useCallback, useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

/** Media query for devices with a mouse-like pointer that can hover. Tilt only runs there. */
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

/** Largest tilt on either axis, in degrees. */
export const MAX_TILT_DEGREES = 6;

/** Perspective distance for the tilt, in pixels. Large, so the effect stays subtle. */
const PERSPECTIVE_PX = 900;

/** Rotation for a pointer position, in degrees. */
export interface TiltAngles {
  /** Rotation around the horizontal axis: positive tips the top edge away. */
  rotateX: number;
  /** Rotation around the vertical axis: positive tips the right edge away. */
  rotateY: number;
}

/**
 * Computes the tilt for a pointer at (`x`, `y`) inside a `width` x `height` box, so the card
 * leans towards the pointer: the edge under the pointer moves away from the viewer.
 * Positions outside the box are clamped, and the result never exceeds `max` on either axis.
 *
 * @param x - Pointer x relative to the box's left edge, in pixels.
 * @param y - Pointer y relative to the box's top edge, in pixels.
 * @param width - Box width in pixels.
 * @param height - Box height in pixels.
 * @param max - Largest rotation in degrees. Defaults to {@link MAX_TILT_DEGREES}.
 * @returns The rotation angles; `0, 0` at the centre or for an empty box.
 */
export function getTiltAngles(
  x: number,
  y: number,
  width: number,
  height: number,
  max: number = MAX_TILT_DEGREES,
): TiltAngles {
  if (width <= 0 || height <= 0) return { rotateX: 0, rotateY: 0 };
  // Offset from the centre, from -1 (left/top edge) to 1 (right/bottom edge).
  const dx = Math.min(1, Math.max(-1, (x / width) * 2 - 1));
  const dy = Math.min(1, Math.max(-1, (y / height) * 2 - 1));
  // `+ 0` turns -0 into 0 so the centre reads as a clean "no tilt".
  return { rotateX: -dy * max + 0, rotateY: dx * max + 0 };
}

/**
 * Builds the CSS `transform` for a tilt.
 *
 * @param angles - The rotation from {@link getTiltAngles}.
 * @returns A `perspective(...) rotateX(...) rotateY(...)` transform string.
 */
export function tiltTransform({ rotateX, rotateY }: TiltAngles): string {
  return `perspective(${PERSPECTIVE_PX}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
}

/** Props for {@link TiltCard}. */
export interface TiltCardProps {
  /** The card content. Stays server-rendered: it is passed through, not re-created here. */
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper that tilts its content slightly towards the mouse pointer (at most
 * {@link MAX_TILT_DEGREES} degrees, CSS transforms only) and resets when the pointer leaves.
 *
 * The tilt only runs for a mouse on a device matching {@link FINE_POINTER_QUERY}, and never under
 * `prefers-reduced-motion: reduce` (the hook reports reduced motion until hydration finishes, so
 * the server render is always flat). Touch and pen input never tilt. The glow comes from the
 * card itself (`Card interactive`), so it still shows on hover and focus without any movement.
 *
 * Transforms are written straight to the DOM once per animation frame, so moving the pointer
 * never re-renders React. `data-tilt` is `on` only when both gates pass (a fine, hovering
 * pointer and no reduced-motion preference), for tests. Both hooks report the "off" state on the
 * server and during hydration, so the server HTML always says `off` and is always flat.
 */
export function TiltCard({ children, className }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const reducedMotion = usePrefersReducedMotion();
  // Server snapshot `false`: no tilt until the browser confirms a fine pointer.
  const finePointer = useMediaQuery(FINE_POINTER_QUERY, false);
  const enabled = finePointer && !reducedMotion;

  /** Clears any queued frame and the transform. */
  const reset = useCallback(() => {
    if (frame.current !== 0) window.cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (ref.current) ref.current.style.transform = "";
  }, []);

  // Losing either gate (or unmounting) drops any tilt in progress.
  useEffect(() => {
    if (!enabled) reset();
    return reset;
  }, [enabled, reset]);

  /** True when this pointer event may tilt the card. */
  const canTilt = (event: PointerEvent<HTMLDivElement>): boolean =>
    enabled && event.pointerType === "mouse";

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || !canTilt(event)) return;
    const rect = element.getBoundingClientRect();
    const angles = getTiltAngles(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
    );
    if (frame.current !== 0) window.cancelAnimationFrame(frame.current);
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;
      element.style.transform = tiltTransform(angles);
    });
  };

  return (
    <div
      ref={ref}
      data-testid="tilt-card"
      data-tilt={enabled ? "on" : "off"}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      onPointerCancel={reset}
      className={cx(
        "h-full transition-transform duration-150 ease-out",
        "motion-reduce:transform-none! motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
