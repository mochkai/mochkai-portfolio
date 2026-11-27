import type { Box } from "@/lib/skill-tree";

/*
 * Pan and zoom maths for the skill map. A view is a centre in map units plus a scale (CSS px
 * per map unit); the SVG `viewBox` is derived from it and the frame size, so the map never
 * letterboxes once the client has measured the frame. Everything here is pure, so the
 * interaction rules (limits, clamping, fit, the drag-vs-click threshold) are unit-tested.
 */

/** A point in map units or in frame pixels, depending on the function. */
export interface Point {
  x: number;
  y: number;
}

/** A frame size in CSS px. */
export interface Size {
  width: number;
  height: number;
}

/** What part of the map is on screen: its centre in map units and CSS px per map unit. */
export interface MapView {
  cx: number;
  cy: number;
  scale: number;
}

/** The zoom range for one map in one frame. */
export interface ZoomLimits {
  min: number;
  max: number;
}

/** Pointer travel, in CSS px, after which a press becomes a drag (and never a click). */
export const DRAG_THRESHOLD_PX = 6;

/** Smallest label size, in CSS px, the map opens at. Phones open zoomed in to reach it. */
export const MIN_LABEL_PX = 10.5;

/** Most zoomed-in scale: 2.5 CSS px per map unit. */
export const MAX_SCALE = 2.5;

/** Zoom step for the + and − buttons and keys. */
export const ZOOM_STEP = 1.4;

/** Space kept between a focused node and the frame edge when it is panned into view. */
export const FOCUS_MARGIN_PX = 48;

/**
 * Whether a pointer has moved far enough from where it went down to count as a drag.
 *
 * @param start - Where the pointer went down, in px.
 * @param current - Where it is now, in px.
 * @param threshold - Travel that makes it a drag.
 * @returns `true` once the press is a drag; a press that never gets here is a click.
 */
export function isDrag(start: Point, current: Point, threshold = DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}

/**
 * The view that shows the whole box, centred, as large as the frame allows.
 *
 * @param bounds - The map's fitted box.
 * @param frame - The frame size.
 * @returns The fitted view.
 */
export function fitView(bounds: Box, frame: Size): MapView {
  return {
    cx: bounds.x + bounds.width / 2,
    cy: bounds.y + bounds.height / 2,
    scale: Math.min(frame.width / bounds.width, frame.height / bounds.height),
  };
}

/**
 * The scale at which a label of `fontSize` map units is `minPx` CSS px tall.
 *
 * @param fontSize - The smallest label's font size, in map units.
 * @param minPx - The smallest readable size, in CSS px.
 * @returns The scale.
 */
export function readableScale(fontSize: number, minPx = MIN_LABEL_PX): number {
  return minPx / fontSize;
}

/**
 * The zoom range: out to a little past the full view (or the readable scale, if that is
 * smaller), in to {@link MAX_SCALE} (or further, if even the readable scale is larger).
 *
 * @param fit - The scale of {@link fitView}.
 * @param readable - From {@link readableScale}.
 * @returns The limits.
 */
export function zoomLimits(fit: number, readable: number): ZoomLimits {
  return { min: Math.min(fit, readable) * 0.85, max: Math.max(MAX_SCALE, readable * 2) };
}

/**
 * Keeps a view inside its limits: the scale within the zoom range and the visible area inside
 * the map's box. On an axis where the visible span is wider than the box, the box is centred;
 * otherwise the view cannot be dragged past the box's edge, so the map never slides off into
 * empty space.
 *
 * @param view - Any view.
 * @param bounds - The map's fitted box.
 * @param limits - The zoom range.
 * @param frame - The frame size.
 * @returns The clamped view (a new object).
 */
export function clampView(view: MapView, bounds: Box, limits: ZoomLimits, frame: Size): MapView {
  const scale = Math.min(Math.max(view.scale, limits.min), limits.max);
  /** Clamps one axis: centre when the span is wider than the box, else keep the edges in. */
  const axis = (centre: number, start: number, length: number, span: number) => {
    const half = span / scale / 2;
    if (half * 2 >= length) return start + length / 2;
    return Math.min(Math.max(centre, start + half), start + length - half);
  };
  return {
    cx: axis(view.cx, bounds.x, bounds.width, frame.width),
    cy: axis(view.cy, bounds.y, bounds.height, frame.height),
    scale,
  };
}

/**
 * The view the map opens at (and returns to with Centre): the full view when its labels are
 * readable, otherwise the readable scale centred on the start node (as far as the box allows,
 * so a World tree opens with its start node near the top rather than mid-frame).
 *
 * @param bounds - The map's fitted box.
 * @param frame - The frame size.
 * @param start - The start node's position, in map units.
 * @param readable - From {@link readableScale}.
 * @returns The start view.
 */
export function startView(bounds: Box, frame: Size, start: Point, readable: number): MapView {
  const fit = fitView(bounds, frame);
  if (fit.scale >= readable) return fit;
  return clampView(
    { cx: start.x, cy: start.y, scale: readable },
    bounds,
    zoomLimits(fit.scale, readable),
    frame,
  );
}

/**
 * The SVG `viewBox` for a view in a frame.
 *
 * @param view - The view.
 * @param frame - The frame size.
 * @returns `minX minY width height`, rounded to 0.01 units.
 */
export function viewBoxFor(view: MapView, frame: Size): string {
  const width = frame.width / view.scale;
  const height = frame.height / view.scale;
  const round = (value: number) => Math.round(value * 100) / 100 + 0;
  return [view.cx - width / 2, view.cy - height / 2, width, height].map(round).join(" ");
}

/**
 * The `viewBox` of a box, as the server renders it before any view exists.
 *
 * @param box - A box in map units.
 * @returns `minX minY width height`.
 */
export function boxViewBox(box: Box): string {
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
}

/**
 * Converts a frame pixel position to map units.
 *
 * @param view - The view.
 * @param frame - The frame size.
 * @param px - A position in the frame, from its top-left corner.
 * @returns The map point under it.
 */
export function frameToMap(view: MapView, frame: Size, px: Point): Point {
  return {
    x: view.cx + (px.x - frame.width / 2) / view.scale,
    y: view.cy + (px.y - frame.height / 2) / view.scale,
  };
}

/**
 * Moves the view by a pointer drag: the map follows the pointer.
 *
 * @param view - The view.
 * @param dx - Horizontal drag, in CSS px.
 * @param dy - Vertical drag, in CSS px.
 * @returns The moved view (not clamped).
 */
export function panBy(view: MapView, dx: number, dy: number): MapView {
  return { ...view, cx: view.cx - dx / view.scale, cy: view.cy - dy / view.scale };
}

/**
 * Zooms by `factor` around a fixed frame point: the map point under `anchor` stays under it.
 * The result is clamped.
 *
 * @param view - The view.
 * @param factor - Above 1 zooms in, below 1 zooms out.
 * @param anchor - The fixed point, in frame px (the frame centre for buttons and keys).
 * @param frame - The frame size.
 * @param bounds - The map's fitted box.
 * @param limits - The zoom range.
 * @returns The zoomed view.
 */
export function zoomAt(
  view: MapView,
  factor: number,
  anchor: Point,
  frame: Size,
  bounds: Box,
  limits: ZoomLimits,
): MapView {
  const scale = Math.min(Math.max(view.scale * factor, limits.min), limits.max);
  const fixed = frameToMap(view, frame, anchor);
  // Solve for the centre that keeps `fixed` under `anchor` at the new scale.
  const cx = fixed.x - (anchor.x - frame.width / 2) / scale;
  const cy = fixed.y - (anchor.y - frame.height / 2) / scale;
  return clampView({ cx, cy, scale }, bounds, limits, frame);
}

/**
 * The view during a two-finger pinch, from the view when the pinch began: zoomed by the change
 * in finger distance around the first midpoint, then moved with the midpoint.
 *
 * @param begin - The view when the second finger went down.
 * @param from - The two finger positions then, in frame px.
 * @param to - The two finger positions now.
 * @param frame - The frame size.
 * @param bounds - The map's fitted box.
 * @param limits - The zoom range.
 * @returns The pinched view.
 */
export function pinchView(
  begin: MapView,
  from: readonly [Point, Point],
  to: readonly [Point, Point],
  frame: Size,
  bounds: Box,
  limits: ZoomLimits,
): MapView {
  const distance = (pair: readonly [Point, Point]) =>
    Math.max(1, Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y));
  const middle = (pair: readonly [Point, Point]) => ({
    x: (pair[0].x + pair[1].x) / 2,
    y: (pair[0].y + pair[1].y) / 2,
  });
  const start = middle(from);
  const now = middle(to);
  const zoomed = zoomAt(begin, distance(to) / distance(from), start, frame, bounds, limits);
  return clampView(panBy(zoomed, now.x - start.x, now.y - start.y), bounds, limits, frame);
}

/**
 * The smallest pan that brings a node fully into the frame, with a margin. A node that is
 * already in view leaves the view unchanged (the same object), so focus never jiggles the map.
 *
 * @param view - The view.
 * @param frame - The frame size.
 * @param point - The node's centre, in map units.
 * @param radius - The node's radius (with its label), in map units.
 * @param margin - Space to keep from the frame edge, in CSS px.
 * @returns The panned view, or `view` itself when no pan is needed.
 */
export function ensureVisible(
  view: MapView,
  frame: Size,
  point: Point,
  radius: number,
  margin = FOCUS_MARGIN_PX,
): MapView {
  // Half the visible span in map units, less the node and margin; never negative.
  const reachX = Math.max(0, frame.width / 2 / view.scale - radius - margin / view.scale);
  const reachY = Math.max(0, frame.height / 2 / view.scale - radius - margin / view.scale);
  const shift = (centre: number, target: number, reach: number) =>
    target > centre + reach ? target - reach : target < centre - reach ? target + reach : centre;
  const cx = shift(view.cx, point.x, reachX);
  const cy = shift(view.cy, point.y, reachY);
  return cx === view.cx && cy === view.cy ? view : { ...view, cx, cy };
}

/**
 * Blends two views for an animated move; the scale blends geometrically so zooms feel even.
 *
 * @param from - The view at `t = 0`.
 * @param to - The view at `t = 1`.
 * @param t - Progress from 0 to 1 (already eased).
 * @returns The view in between.
 */
export function interpolateView(from: MapView, to: MapView, t: number): MapView {
  return {
    cx: from.cx + (to.cx - from.cx) * t,
    cy: from.cy + (to.cy - from.cy) * t,
    scale: from.scale * Math.pow(to.scale / from.scale, t),
  };
}

/**
 * Cubic ease-in-out for view animations.
 *
 * @param t - Linear progress from 0 to 1.
 * @returns Eased progress.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * One frame of drag inertia: the velocity decays by `friction` per 16 ms frame.
 *
 * @param velocity - Current velocity, in CSS px per ms.
 * @param elapsedMs - Time since the last frame.
 * @param friction - Share of the velocity kept per 16 ms.
 * @returns The new velocity; `null` once it is too slow to matter, which ends the glide.
 */
export function decayVelocity(velocity: Point, elapsedMs: number, friction = 0.92): Point | null {
  const keep = Math.pow(friction, elapsedMs / 16);
  const next = { x: velocity.x * keep, y: velocity.y * keep };
  return Math.hypot(next.x, next.y) < 0.02 ? null : next;
}

/**
 * Whether two views are the same to within a rounding error (used to tell whether the map is
 * at its start view).
 *
 * @param a - A view.
 * @param b - Another view.
 * @returns `true` when they match.
 */
export function sameView(a: MapView, b: MapView): boolean {
  return (
    Math.abs(a.cx - b.cx) < 0.5 &&
    Math.abs(a.cy - b.cy) < 0.5 &&
    Math.abs(a.scale / b.scale - 1) < 0.005
  );
}
