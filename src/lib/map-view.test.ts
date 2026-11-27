import { describe, expect, it } from "vitest";
import {
  DRAG_THRESHOLD_PX,
  MAX_SCALE,
  MIN_LABEL_PX,
  boxViewBox,
  clampView,
  decayVelocity,
  easeInOutCubic,
  ensureVisible,
  fitView,
  frameToMap,
  interpolateView,
  isDrag,
  panBy,
  pinchView,
  readableScale,
  sameView,
  startView,
  viewBoxFor,
  zoomAt,
  zoomLimits,
} from "./map-view";

/** A 1000 x 800 map from (-500, -400). */
const bounds = { x: -500, y: -400, width: 1000, height: 800 };
const desktop = { width: 800, height: 640 };
const phone = { width: 340, height: 560 };
const limits = zoomLimits(fitView(bounds, phone).scale, readableScale(13));

describe("isDrag (the drag-vs-click threshold)", () => {
  it("is a click below the threshold and a drag from it on", () => {
    expect(isDrag({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false);
    expect(isDrag({ x: 0, y: 0 }, { x: DRAG_THRESHOLD_PX, y: 0 })).toBe(true);
    expect(isDrag({ x: 10, y: 10 }, { x: 10, y: 4 })).toBe(true);
    expect(isDrag({ x: 0, y: 0 }, { x: 9, y: 0 }, 10)).toBe(false);
  });
});

describe("fitView and startView", () => {
  it("fits the whole box, centred, as large as the frame allows", () => {
    expect(fitView(bounds, desktop)).toEqual({ cx: 0, cy: 0, scale: 0.8 });
    expect(fitView(bounds, phone).scale).toBeCloseTo(0.34);
  });

  it("opens at the full view when its labels are readable", () => {
    // 16-unit labels are readable at 0.66, below the 0.8 fit.
    expect(startView(bounds, desktop, { x: 0, y: 0 }, readableScale(16))).toEqual(
      fitView(bounds, desktop),
    );
  });

  it("opens zoomed to the readable scale, centred on the start node, on a phone", () => {
    const view = startView(bounds, phone, { x: 0, y: 0 }, readableScale(13));
    expect(view).toEqual({ cx: 0, cy: 0, scale: MIN_LABEL_PX / 13 });
    expect(13 * view.scale).toBeGreaterThanOrEqual(10);
  });

  it("keeps a start node near the edge of the box from leaving empty space in view", () => {
    // A World tree: the start node at the top edge of the box.
    const tree = { x: -500, y: -100, width: 1000, height: 800 };
    const view = startView(tree, phone, { x: 0, y: 0 }, readableScale(13));
    const halfHeight = phone.height / view.scale / 2;
    expect(view.cy - halfHeight).toBeCloseTo(tree.y);
    expect(view.cx).toBe(0);
  });
});

describe("zoomLimits and clampView", () => {
  it("allows zooming out a little past the full view and in to the maximum", () => {
    const fit = fitView(bounds, phone).scale;
    expect(limits.min).toBeCloseTo(fit * 0.85);
    expect(limits.max).toBe(MAX_SCALE);
    expect(zoomLimits(0.2, 2).max).toBe(4);
  });

  it("clamps the scale into the zoom range", () => {
    expect(clampView({ cx: 0, cy: 0, scale: 99 }, bounds, limits, phone).scale).toBe(limits.max);
    expect(clampView({ cx: 0, cy: 0, scale: 0.01 }, bounds, limits, phone).scale).toBe(limits.min);
  });

  it("keeps the visible area inside the box, so the map never slides away", () => {
    const view = clampView({ cx: 10_000, cy: -10_000, scale: 1 }, bounds, limits, phone);
    expect(view.cx + phone.width / 2).toBeCloseTo(bounds.x + bounds.width);
    expect(view.cy - phone.height / 2).toBeCloseTo(bounds.y);
  });

  it("centres an axis where the whole box fits in the frame", () => {
    const view = clampView({ cx: 300, cy: 200, scale: 0.3 }, bounds, limits, phone);
    expect(view).toMatchObject({ cx: 0, cy: 0 });
  });
});

describe("viewBoxFor and frameToMap", () => {
  it("derives a viewBox with the frame's aspect ratio", () => {
    expect(viewBoxFor({ cx: 0, cy: 0, scale: 0.8 }, desktop)).toBe("-500 -400 1000 800");
    expect(viewBoxFor({ cx: 10, cy: -20, scale: 2 }, { width: 100, height: 50 })).toBe(
      "-15 -32.5 50 25",
    );
    expect(boxViewBox(bounds)).toBe("-500 -400 1000 800");
  });

  it("maps a frame pixel to the map point under it", () => {
    expect(frameToMap({ cx: 0, cy: 0, scale: 0.8 }, desktop, { x: 0, y: 0 })).toEqual({
      x: -500,
      y: -400,
    });
  });
});

describe("panBy, zoomAt and pinchView", () => {
  it("moves the map with the pointer", () => {
    expect(panBy({ cx: 0, cy: 0, scale: 2 }, 20, -10)).toEqual({ cx: -10, cy: 5, scale: 2 });
  });

  it("keeps the map point under the anchor fixed while zooming", () => {
    const view = { cx: 0, cy: 0, scale: 1 };
    const anchor = { x: 100, y: 80 };
    const before = frameToMap(view, phone, anchor);
    const zoomed = zoomAt(view, 1.5, anchor, phone, bounds, limits);
    expect(zoomed.scale).toBeCloseTo(1.5);
    const after = frameToMap(zoomed, phone, anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("stops at the zoom limits", () => {
    const view = { cx: 0, cy: 0, scale: 2 };
    const middle = { x: phone.width / 2, y: phone.height / 2 };
    expect(zoomAt(view, 10, middle, phone, bounds, limits).scale).toBe(limits.max);
  });

  it("pinches by the change in finger distance and follows the midpoint", () => {
    const begin = { cx: 0, cy: 0, scale: 1 };
    const from = [
      { x: 120, y: 280 },
      { x: 220, y: 280 },
    ] as const;
    const apart = [
      { x: 70, y: 280 },
      { x: 270, y: 280 },
    ] as const;
    expect(pinchView(begin, from, apart, phone, bounds, limits).scale).toBeCloseTo(2);
    const moved = [
      { x: 140, y: 300 },
      { x: 240, y: 300 },
    ] as const;
    const panned = pinchView(begin, from, moved, phone, bounds, limits);
    expect(panned).toMatchObject({ cx: -20, cy: -20, scale: 1 });
  });
});

describe("ensureVisible", () => {
  const view = { cx: 0, cy: 0, scale: 1 };

  it("leaves the view alone (same object) when the node is already in view", () => {
    expect(ensureVisible(view, phone, { x: 20, y: 20 }, 30)).toBe(view);
  });

  it("pans the smallest amount that brings an off-screen node in, with a margin", () => {
    const moved = ensureVisible(view, phone, { x: 400, y: 0 }, 30, 40);
    // The node's right edge lands `margin` px inside the frame's right edge.
    expect(moved.cx + phone.width / 2).toBeCloseTo(400 + 30 + 40);
    expect(moved.cy).toBe(0);
  });
});

describe("animation helpers", () => {
  it("interpolates the centre linearly and the scale geometrically", () => {
    const mid = interpolateView({ cx: 0, cy: 0, scale: 1 }, { cx: 10, cy: 20, scale: 4 }, 0.5);
    expect(mid).toEqual({ cx: 5, cy: 10, scale: 2 });
  });

  it("eases in and out", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
  });

  it("decays a glide and ends it once it is too slow", () => {
    const next = decayVelocity({ x: 1, y: 0 }, 16);
    expect(next?.x).toBeCloseTo(0.92);
    expect(decayVelocity({ x: 0.01, y: 0 }, 16)).toBeNull();
  });

  it("compares views within a rounding error", () => {
    expect(sameView({ cx: 0, cy: 0, scale: 1 }, { cx: 0.2, cy: -0.2, scale: 1.001 })).toBe(true);
    expect(sameView({ cx: 0, cy: 0, scale: 1 }, { cx: 5, cy: 0, scale: 1 })).toBe(false);
  });
});
