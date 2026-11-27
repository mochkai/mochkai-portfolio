"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  ZOOM_STEP,
  boxViewBox,
  clampView,
  decayVelocity,
  easeInOutCubic,
  ensureVisible,
  fitView,
  interpolateView,
  isDrag,
  panBy,
  pinchView,
  startView,
  viewBoxFor,
  zoomAt,
  zoomLimits,
  type MapView,
  type Point,
  type Size,
} from "@/lib/map-view";
import type { Box } from "@/lib/skill-tree";

/** Options for {@link useMapViewport}. */
export interface MapViewportOptions {
  /** The current layout's fitted box (the server's `viewBox`). */
  bounds: Box;
  /** The start node's position: phones open centred on it. */
  start: Point;
  /** The scale at which the smallest label is readable. */
  readable: number;
  /** Changes when the layout changes; the view then resets to the start view. */
  viewKey: string;
  /** Instant zooms and no inertia when `true`. */
  reducedMotion: boolean;
}

/** Everything the map frame needs from {@link useMapViewport}. */
export interface MapViewport {
  /** Attach to the pan surface (the element that holds the SVG). */
  attachSurface: (element: HTMLDivElement | null) => void;
  /** The SVG `viewBox`: the fitted box until the frame is measured, then the live view. */
  viewBox: string;
  /** A drag or pinch is in progress (for the grabbing cursor). */
  dragging: boolean;
  /** Pointer, click and key handlers for the pan surface. */
  surfaceProps: {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
    onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => void;
    onClickCapture: (event: MouseEvent<HTMLDivElement>) => void;
    onMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  };
  zoomIn: () => void;
  zoomOut: () => void;
  /** Fits the whole map. */
  fullView: () => void;
  /** Returns to the start view. */
  centre: () => void;
  /** Pans the smallest amount that brings a point (with `radius` around it) into view. */
  reveal: (point: Point, radius: number) => void;
}

/** How long an animated zoom or pan takes. */
const ANIMATION_MS = 280;

/** Two taps on empty space within this time and distance return to the start view. */
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_PX = 30;

/** Only pointer samples this recent count towards the release velocity. */
const VELOCITY_WINDOW_MS = 90;

/** Releases slower than this (px per ms) do not glide. */
const MIN_GLIDE_SPEED = 0.08;

/** Per-gesture bookkeeping, kept in a ref because it changes on every pointer event. */
interface Gesture {
  /** Active pointers, in frame px. */
  pointers: Map<number, Point>;
  /** The view and pointer positions when the current phase (one or two fingers) began. */
  begin: { view: MapView; points: Point[] } | null;
  /** The latest view set by this gesture. */
  view: MapView | null;
  /** The press moved past the drag threshold or became a pinch: it is never a click. */
  moved: boolean;
  /** Swallow the click that follows a drag. */
  suppressClick: boolean;
  /** Recent single-pointer positions with timestamps, for the release velocity. */
  samples: { t: number; x: number; y: number }[];
  /** The last tap on empty space, for double-tap detection. */
  lastTap: { t: number; x: number; y: number } | null;
}

/**
 * Pan and zoom for the skill map, hand-rolled on pointer events (no dependency):
 *
 * - One pointer (mouse or a finger) drags to pan once it travels `DRAG_THRESHOLD_PX`;
 *   a press that never does is left alone so it can select a node, and a drag's click is
 *   swallowed. Two fingers pinch to zoom; Ctrl or Cmd + wheel (and trackpad pinch) zooms at
 *   the pointer while a plain wheel scrolls the page. A double tap on empty space returns to
 *   the start view. + / − / 0 zoom and reset while focus is inside the surface.
 * - Releasing a fast drag glides to a stop, and the buttons animate, unless reduced motion is
 *   on: then every change is instant and there is no inertia.
 * - The server and the first client render use the fitted box as the `viewBox`; the view is
 *   set only once a `ResizeObserver` has measured the frame, so hydration always matches.
 *
 * @param options - The layout's box, start point, readable scale, reset key and motion flag.
 * @returns The `viewBox`, the surface ref and handlers, and the zoom actions.
 */
export function useMapViewport({
  bounds,
  start,
  readable,
  viewKey,
  reducedMotion,
}: MapViewportOptions): MapViewport {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  // The view belongs to one layout; a different key means "not set yet for this layout".
  const [stored, setStored] = useState<{ key: string; view: MapView } | null>(null);
  const [dragging, setDragging] = useState(false);
  const frameRequest = useRef<number | null>(null);
  // Where the running zoom animation ends, so quick repeated presses build on each other.
  const animationTarget = useRef<MapView | null>(null);
  const gesture = useRef<Gesture>({
    pointers: new Map(),
    begin: null,
    view: null,
    moved: false,
    suppressClick: false,
    samples: [],
    lastTap: null,
  });

  const limits = size === null ? null : zoomLimits(fitView(bounds, size).scale, readable);
  // The stored view is re-clamped every render, so a resize or rotation never leaves it outside
  // the new limits or showing empty space.
  const view: MapView | null =
    size === null || limits === null
      ? null
      : stored?.key === viewKey
        ? clampView(stored.view, bounds, limits, size)
        : startView(bounds, size, start, readable);

  /** Stores a new view (clamped) for the current layout. */
  const setView = (next: MapView) => {
    if (limits === null || size === null) return;
    const clamped = clampView(next, bounds, limits, size);
    gesture.current.view = clamped;
    setStored({ key: viewKey, view: clamped });
  };

  /** Stops any running zoom animation or glide. */
  const stopMotion = () => {
    if (frameRequest.current !== null) cancelAnimationFrame(frameRequest.current);
    frameRequest.current = null;
    animationTarget.current = null;
  };

  /** Moves to `target`, animated unless reduced motion is on. */
  const animateTo = (target: MapView) => {
    if (view === null || limits === null || size === null) return;
    stopMotion();
    const to = clampView(target, bounds, limits, size);
    if (reducedMotion) {
      setView(to);
      return;
    }
    const from = view;
    const began = performance.now();
    /** One animation frame: blend from `from` to `to`. */
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / ANIMATION_MS);
      setStored({ key: viewKey, view: interpolateView(from, to, easeInOutCubic(progress)) });
      frameRequest.current = progress < 1 ? requestAnimationFrame(step) : null;
      if (progress >= 1) animationTarget.current = null;
    };
    animationTarget.current = to;
    frameRequest.current = requestAnimationFrame(step);
  };

  /** Glides after a fast drag release, slowing to a stop. */
  const glide = (initial: Point) => {
    if (limits === null || size === null) return;
    const frameSize = size;
    let velocity: Point | null = initial;
    let last = performance.now();
    /** One glide frame: move by the velocity, then let friction slow it. */
    const step = (now: number) => {
      const elapsed = Math.min(64, now - last);
      last = now;
      if (velocity === null) {
        frameRequest.current = null;
        return;
      }
      const { x, y } = velocity;
      setStored((previous) => {
        const current = previous?.key === viewKey ? previous.view : null;
        if (current === null) return previous;
        return {
          key: viewKey,
          view: clampView(panBy(current, x * elapsed, y * elapsed), bounds, limits, frameSize),
        };
      });
      velocity = decayVelocity(velocity, elapsed);
      frameRequest.current = velocity === null ? null : requestAnimationFrame(step);
    };
    stopMotion();
    frameRequest.current = requestAnimationFrame(step);
  };

  // Measure the frame; the first measurement makes the view live.
  useEffect(() => {
    if (element === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 1 || height < 1) return;
      setSize((previous) =>
        previous !== null &&
        Math.abs(previous.width - width) < 1 &&
        Math.abs(previous.height - height) < 1
          ? previous
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  // A layout switch or unmount cancels any animation still running for the old view.
  useEffect(
    () => () => {
      // Same as stopMotion(), inlined so the effect depends on nothing but the layout.
      if (frameRequest.current !== null) cancelAnimationFrame(frameRequest.current);
      frameRequest.current = null;
      animationTarget.current = null;
    },
    [viewKey],
  );

  /**
   * Forgets a pointer whose press ended where the surface never heard about it (released
   * outside the frame before the drag captured it, or the capture was lost). Without this a
   * stale pointer would make the next hover pan the map, swallow the next click or turn the
   * next touch drag into a pinch. No click or tap follows such a release.
   */
  const abandonPointer = (pointerId: number) => {
    const g = gesture.current;
    if (!g.pointers.delete(pointerId)) return;
    g.samples = [];
    if (g.pointers.size > 0) {
      if (g.view) {
        g.begin = { view: g.view, points: [...g.pointers.values()] };
      }
      return;
    }
    g.begin = null;
    g.moved = false;
    g.suppressClick = false;
    setDragging(false);
  };

  /** A pointer ended anywhere on the page. */
  const onWindowPointerEnd = useEffectEvent((pointerId: number) => abandonPointer(pointerId));

  // Presses that end outside the surface still end the gesture. (A release on the surface is
  // handled first by React, so by the time it reaches the window the pointer is gone.)
  useEffect(() => {
    const listener = (event: globalThis.PointerEvent) => onWindowPointerEnd(event.pointerId);
    window.addEventListener("pointerup", listener);
    window.addEventListener("pointercancel", listener);
    return () => {
      window.removeEventListener("pointerup", listener);
      window.removeEventListener("pointercancel", listener);
    };
  }, []);

  /** Ctrl or Cmd + wheel (and trackpad pinch) zooms at the pointer; a plain wheel scrolls. */
  const onWheel = useEffectEvent((event: WheelEvent) => {
    if (!(event.ctrlKey || event.metaKey) || view === null || size === null || limits === null) {
      return;
    }
    event.preventDefault();
    stopMotion();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    // Lines and pages are scaled to pixels so every device zooms at a similar rate.
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
    const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setView(zoomAt(view, Math.exp(-delta * 0.002), anchor, size, bounds, limits));
  });

  // React's wheel listeners are passive, so preventing the page zoom needs a native one.
  useEffect(() => {
    if (element === null) return;
    const listener = (event: WheelEvent) => onWheel(event);
    element.addEventListener("wheel", listener, { passive: false });
    return () => element.removeEventListener("wheel", listener);
  }, [element]);

  /** A pointer's position inside the surface, in CSS px. */
  const localPoint = (event: PointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  /** Starts a new gesture phase from the current pointers (one finger or two). */
  const rebase = (current: MapView) => {
    const g = gesture.current;
    g.begin = { view: current, points: [...g.pointers.values()] };
    g.view = current;
  };

  /** Starts a press: one pointer may become a drag, a second one starts a pinch. */
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (view === null || (event.pointerType === "mouse" && event.button !== 0)) return;
    const g = gesture.current;
    stopMotion();
    if (g.pointers.size === 0) {
      g.moved = false;
      g.suppressClick = false;
    }
    const point = localPoint(event);
    g.pointers.set(event.pointerId, point);
    rebase(g.pointers.size === 1 ? view : (g.view ?? view));
    g.samples = [{ t: event.timeStamp, ...point }];
    if (g.pointers.size >= 2) {
      // A pinch is never a click.
      g.moved = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  /** Pans or pinches once the press is a drag. */
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.pointers.has(event.pointerId) || g.begin === null || size === null || limits === null) {
      return;
    }
    // A mouse with no button down is not dragging, whatever we last heard.
    if (event.pointerType === "mouse" && event.buttons === 0) {
      abandonPointer(event.pointerId);
      return;
    }
    const point = localPoint(event);
    g.pointers.set(event.pointerId, point);
    const points = [...g.pointers.values()];
    const { begin } = g;
    if (points.length === 1) {
      if (!g.moved) {
        if (!isDrag(begin.points[0], point)) return;
        g.moved = true;
        setDragging(true);
        // Capture only once it is a drag, so a plain press still clicks the node under it.
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      g.samples = [
        ...g.samples.filter((sample) => event.timeStamp - sample.t < VELOCITY_WINDOW_MS),
        { t: event.timeStamp, ...point },
      ];
      setView(panBy(begin.view, point.x - begin.points[0].x, point.y - begin.points[0].y));
    } else if (begin.points.length >= 2) {
      setView(
        pinchView(
          begin.view,
          [begin.points[0], begin.points[1]],
          [points[0], points[1]],
          size,
          bounds,
          limits,
        ),
      );
    }
  };

  /** Zooms by `factor` around the frame centre. */
  const zoomBy = (factor: number) => {
    if (view === null || size === null || limits === null) return;
    const middle = { x: size.width / 2, y: size.height / 2 };
    const from = animationTarget.current ?? view;
    animateTo(zoomAt(from, factor, middle, size, bounds, limits));
  };
  /** One zoom step in. */
  const zoomIn = () => zoomBy(ZOOM_STEP);
  /** One zoom step out. */
  const zoomOut = () => zoomBy(1 / ZOOM_STEP);
  /** Fits the whole map. */
  const fullView = () => {
    if (size !== null) animateTo(fitView(bounds, size));
  };
  /** Returns to the start view. */
  const centre = () => {
    if (size !== null) animateTo(startView(bounds, size, start, readable));
  };
  /** Pans a point into view if it is not already. */
  const reveal = (point: Point, radius: number) => {
    if (view === null || size === null) return;
    const next = ensureVisible(view, size, point, radius);
    if (next !== view) animateTo(next);
  };

  /** Ends one pointer; shared by pointer up and cancel. */
  const release = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g.pointers.delete(event.pointerId)) return;
    if (g.pointers.size > 0) {
      // One finger left after a pinch: keep panning from where the pinch left the view, with
      // no velocity history, so lifting the last finger never glides.
      if (g.view) rebase(g.view);
      g.samples = [];
      return;
    }
    if (g.moved) {
      setDragging(false);
      g.suppressClick = !cancelled;
      const first = g.samples[0];
      const last = g.samples[g.samples.length - 1];
      const elapsed = last && first ? last.t - first.t : 0;
      if (!cancelled && !reducedMotion && elapsed > 0 && g.begin?.points.length === 1) {
        const velocity = { x: (last.x - first.x) / elapsed, y: (last.y - first.y) / elapsed };
        if (Math.hypot(velocity.x, velocity.y) > MIN_GLIDE_SPEED) glide(velocity);
      }
      return;
    }
    if (cancelled) return;
    // A tap on empty space (not on a node): two in a row return to the start view.
    const onNode = event.target instanceof Element && event.target.closest("[data-node-id]");
    if (onNode) return;
    const point = localPoint(event);
    const previous = g.lastTap;
    if (
      previous &&
      event.timeStamp - previous.t < DOUBLE_TAP_MS &&
      Math.hypot(point.x - previous.x, point.y - previous.y) < DOUBLE_TAP_PX
    ) {
      g.lastTap = null;
      centre();
    } else {
      g.lastTap = { t: event.timeStamp, ...point };
    }
  };

  return {
    attachSurface: setElement,
    viewBox: view === null || size === null ? boxViewBox(bounds) : viewBoxFor(view, size),
    dragging,
    surfaceProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event) => release(event, false),
      onPointerCancel: (event) => release(event, true),
      onLostPointerCapture: (event) => {
        // Only the surface's own capture counts. Chrome implicitly captures a touch to the child
        // under the finger, and when the surface takes the capture (a drag past the threshold or
        // a second pinch finger) that child's `lostpointercapture` bubbles up here: the gesture
        // is still going.
        if (event.target === event.currentTarget) abandonPointer(event.pointerId);
      },
      onClickCapture: (event) => {
        if (!gesture.current.suppressClick) return;
        // The click that ends a drag never selects anything.
        gesture.current.suppressClick = false;
        event.stopPropagation();
        event.preventDefault();
      },
      // Keeps a mouse press from focusing (and so selecting) a node before we know it is not a
      // drag, and from selecting text; a click without movement focuses the node itself.
      onMouseDown: (event) => event.preventDefault(),
      onKeyDown: (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const action =
          event.key === "+" || event.key === "="
            ? zoomIn
            : event.key === "-" || event.key === "_"
              ? zoomOut
              : event.key === "0"
                ? centre
                : null;
        if (action === null) return;
        event.preventDefault();
        action();
      },
    },
    zoomIn,
    zoomOut,
    fullView,
    centre,
    reveal,
  };
}
