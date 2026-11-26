"use client";

import { useEffect, useRef } from "react";
import { FIELD_OPACITY, startArcaneField } from "@/lib/arcane-field";
import { FINE_POINTER_QUERY, useMediaQuery } from "@/lib/hooks/use-media-query";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

/**
 * The living Arcane Tech backdrop: a faint rune circuit of neon nodes and stepped traces on a 2D
 * canvas, rendered once in the root layout behind every page.
 *
 * - Purely decorative: `aria-hidden`, `pointer-events: none`, `position: fixed` at `-z-10`
 *   (behind all content, never in the focus order, no layout shift).
 * - Mounts after hydration: the server HTML is an empty canvas, and drawing starts in an effect,
 *   so it never delays the LCP.
 * - Motion allowed: slow ambient pulses and gentle scroll parallax; with a fine pointer, nodes
 *   and traces near the cursor brighten and drift a few pixels. Touch devices get the ambient
 *   pulse only, at a lower frame rate and with fewer nodes.
 * - Reduced motion: one static frame, no loop, no parallax and no pointer reaction. The hook
 *   reports reduced motion on the server and during hydration, so the first paint is static.
 * - The frame loop lives outside React ({@link startArcaneField}): it never re-renders, pauses
 *   while the tab is hidden or the canvas is off-screen, and caps the pixel ratio.
 *
 * Contrast: the canvas only draws the neon ink and is shown at a capped opacity, so text on the
 * bare page background keeps WCAG AA (asserted in `arcane-field.test.ts`).
 */
export function ArcaneBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  // Server snapshot `false`: no pointer reaction until the browser confirms a fine pointer.
  const finePointer = useMediaQuery(FINE_POINTER_QUERY, false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    return startArcaneField(canvas, ctx, { animate: !reducedMotion, pointer: finePointer });
  }, [reducedMotion, finePointer]);

  return (
    <div
      aria-hidden="true"
      data-testid="arcane-background"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        data-testid="arcane-canvas"
        data-animating="false"
        style={{ opacity: FIELD_OPACITY }}
        className="block size-full"
      />
    </div>
  );
}
