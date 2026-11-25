/**
 * Reading progress of a scrollable document, from `0` (at the top) to `1` (at the bottom).
 *
 * A page that cannot scroll (content no taller than the viewport) reports `0`, so short pages
 * show an empty boost meter instead of a permanently full one. Values outside the range (for
 * example during overscroll "rubber banding") are clamped.
 *
 * @param scrollTop - Current vertical scroll offset in px (`window.scrollY`).
 * @param scrollHeight - Full height of the document in px (`documentElement.scrollHeight`).
 * @param viewportHeight - Visible height in px (`documentElement.clientHeight`).
 * @returns Progress between `0` and `1`.
 */
export function getScrollProgress(
  scrollTop: number,
  scrollHeight: number,
  viewportHeight: number,
): number {
  const maxScroll = scrollHeight - viewportHeight;
  if (!Number.isFinite(maxScroll) || maxScroll <= 0) return 0;
  const progress = scrollTop / maxScroll;
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}
