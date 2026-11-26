/** Default parallax speed: the layer lags the page by 8 % of its distance from the centre. */
export const PARALLAX_SPEED = 0.08;

/** Default largest parallax offset, in pixels. Small, so layers never drift far. */
export const PARALLAX_MAX_PX = 16;

/**
 * Vertical offset for a parallax layer, so it moves slightly slower than the page: zero when
 * the layer's box is centred in the viewport, growing with its distance from the centre and
 * clamped to `±max`.
 *
 * @param boxCenter - Centre of the layer's (untransformed) box, in viewport pixels.
 * @param viewportCenter - Centre of the viewport, in pixels.
 * @param speed - Fraction of the distance to lag by. Defaults to {@link PARALLAX_SPEED}.
 * @param max - Largest offset in pixels. Defaults to {@link PARALLAX_MAX_PX}.
 * @returns The `translateY` in pixels.
 */
export function parallaxOffset(
  boxCenter: number,
  viewportCenter: number,
  speed: number = PARALLAX_SPEED,
  max: number = PARALLAX_MAX_PX,
): number {
  const offset = (viewportCenter - boxCenter) * speed;
  // `+ 0` turns -0 into 0.
  return Math.min(max, Math.max(-max, offset)) + 0;
}

/** Options for {@link startParallax}. */
export interface ParallaxOptions {
  speed?: number;
  max?: number;
}

/**
 * Moves `layer` with {@link parallaxOffset} as the page scrolls and returns a cleanup function.
 *
 * The offset is measured from `layer`'s parent (so the layer's own transform never feeds back),
 * updated at most once per animation frame from a passive scroll listener, and written straight
 * to `style.transform`. The scroll listener is only attached while the layer is near the
 * viewport (`IntersectionObserver`), so off-screen layers cost nothing. Cleanup removes the
 * transform.
 *
 * @param layer - The decorative element to move.
 * @param options - Speed and maximum offset.
 */
export function startParallax(
  layer: HTMLElement,
  { speed, max }: ParallaxOptions = {},
): () => void {
  const anchor = layer.parentElement ?? layer;
  let frame = 0;
  let listening = false;

  /** Measures the anchor and writes the offset. */
  const update = () => {
    frame = 0;
    const rect = anchor.getBoundingClientRect();
    const offset = parallaxOffset(rect.top + rect.height / 2, window.innerHeight / 2, speed, max);
    layer.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
  };

  /** Coalesces scroll bursts into one update per frame. */
  const schedule = () => {
    if (frame === 0) frame = window.requestAnimationFrame(update);
  };

  const listen = (on: boolean) => {
    if (on === listening) return;
    listening = on;
    if (on) {
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      schedule();
    } else {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    }
  };

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === "undefined") {
    listen(true);
  } else {
    observer = new IntersectionObserver(
      (entries) => listen(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: "100px 0px" },
    );
    observer.observe(anchor);
  }

  return () => {
    observer?.disconnect();
    listen(false);
    if (frame !== 0) window.cancelAnimationFrame(frame);
    frame = 0;
    layer.style.transform = "";
  };
}
