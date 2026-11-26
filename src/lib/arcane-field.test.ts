import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIELD_INK,
  FIELD_OPACITY,
  FRAME_MS_FINE,
  HERO_CIRCUIT_OPACITY,
  MAX_DPR,
  MAX_NODES_COMPACT,
  MAX_NODES_WIDE,
  clampDpr,
  createField,
  createRandom,
  drawField,
  needsRebuild,
  nodeCap,
  pointerBoost,
  startArcaneField,
  wrapShift,
} from "./arcane-field";

/** The `:root` block of `src/app/globals.css`, where the color tokens are defined. */
const ROOT_BLOCK = (() => {
  // Resolved from the project root (Vitest's cwd): jsdom gives `import.meta.url` an http URL.
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const match = /^:root\s*\{([\s\S]*?)^\}/m.exec(css);
  if (!match) throw new Error("globals.css has no :root block");
  return match[1];
})();

/**
 * A color token's hex value, read from `globals.css` (lowercase `#rrggbb`).
 *
 * @param name - The custom property name without `--`, for example `muted`.
 */
function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(ROOT_BLOCK);
  if (!match) throw new Error(`globals.css has no hex value for --${name}`);
  return match[1].toLowerCase();
}

/** sRGB hex to relative luminance (WCAG 2.2). */
function luminance([r, g, b]: readonly number[]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** `#rrggbb` to `[r, g, b]`. */
function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** `top` at `alpha` over `bottom`. */
function mix(top: number[], bottom: number[], alpha: number): number[] {
  return top.map((value, i) => value * alpha + bottom[i] * (1 - alpha));
}

/** WCAG contrast ratio of two colors. */
function contrast(a: number[], b: number[]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** A 2D context stub that records the calls the field makes. */
function stubContext() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setTransform: vi.fn(),
    globalAlpha: 1,
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
  };
}

describe("arcane field geometry", () => {
  it("is deterministic for a seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const values = Array.from({ length: 5 }, () => a());
    expect(values).toEqual(Array.from({ length: 5 }, () => b()));
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("caps the node count, with fewer nodes on small screens and touch devices", () => {
    expect(nodeCap(1280, true)).toBe(MAX_NODES_WIDE);
    expect(nodeCap(375, true)).toBe(MAX_NODES_COMPACT);
    expect(nodeCap(1280, false)).toBe(MAX_NODES_COMPACT);
    for (const [width, height] of [
      [375, 812],
      [768, 1024],
      [1280, 800],
      [2560, 1440],
      [3840, 2160],
    ]) {
      for (const fine of [true, false]) {
        const cap = nodeCap(width, fine);
        const field = createField(width, height, cap);
        expect(field.nodes.length).toBeLessThanOrEqual(cap);
        expect(field.nodes.length).toBeGreaterThan(0);
        // The tile is at least a viewport plus one row tall, so wrapping never shows a gap.
        expect(field.tileHeight - field.cell).toBeGreaterThanOrEqual(height);
      }
    }
  });

  it("joins only existing nodes, and only the last row wraps", () => {
    const field = createField(1280, 800, MAX_NODES_WIDE);
    expect(field.edges.length).toBeGreaterThan(0);
    for (const edge of field.edges) {
      expect(field.nodes[edge.from]).toBeDefined();
      expect(field.nodes[edge.to]).toBeDefined();
      if (edge.kind === "right") expect(edge.wraps).toBe(false);
      if (edge.wraps) expect(field.nodes[edge.to].y).toBeLessThan(field.nodes[edge.from].y);
    }
  });

  it("rebuilds only for a new width or a viewport taller than the tile covers", () => {
    const field = createField(400, 700, MAX_NODES_COMPACT);
    expect(needsRebuild(field, 400, 400, 700)).toBe(false);
    expect(needsRebuild(field, 400, 400, 640)).toBe(false);
    expect(needsRebuild(field, 400, 400, field.tileHeight - field.cell)).toBe(false);
    expect(needsRebuild(field, 400, 400, field.tileHeight - field.cell + 1)).toBe(true);
    expect(needsRebuild(field, 400, 401, 700)).toBe(true);
  });

  it("caps the device-pixel ratio", () => {
    expect(clampDpr(3)).toBe(MAX_DPR);
    expect(clampDpr(1.5)).toBe(1.5);
    expect(clampDpr(0)).toBe(1);
    expect(clampDpr(undefined)).toBe(1);
    expect(clampDpr(Number.NaN)).toBe(1);
  });

  it("lights points near the pointer only", () => {
    expect(pointerBoost(0, 0, 100)).toBe(1);
    expect(pointerBoost(50, 0, 100)).toBeCloseTo(0.25);
    expect(pointerBoost(100, 0, 100)).toBe(0);
    expect(pointerBoost(300, 400, 100)).toBe(0);
  });

  it("wraps a y position into the tile", () => {
    for (const y of [-500, -60, 0, 120, 999, 2400]) {
      const wrapped = y + wrapShift(y, 1000, 50);
      expect(wrapped).toBeGreaterThanOrEqual(-50);
      expect(wrapped).toBeLessThan(950);
    }
  });
});

describe("arcane field contrast", () => {
  // Token values come from the one source of truth, `globals.css`, never copied here.
  const background = rgb(token("background"));
  const accentSoft = rgb(token("accent-soft"));
  const surface = rgb(token("surface"));
  const neon = rgb(token("neon"));
  const muted = rgb(token("muted"));
  // The brightest pixel the canvas can produce: only FIELD_INK, shown at FIELD_OPACITY.
  const brightest = mix(rgb(FIELD_INK), background, FIELD_OPACITY);

  it("draws with the neon token", () => {
    expect(FIELD_INK.toLowerCase()).toBe(token("neon"));
  });

  it("keeps body text on the bare page background at WCAG AA (4.5:1)", () => {
    for (const name of ["foreground", "muted", "neon", "glow"]) {
      expect(contrast(rgb(token(name)), brightest), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps muted text over the hero rune circuit at AA on both ends of the hero gradient", () => {
    // RuneCircuit applies its opacity to the whole SVG (one compositing group) and draws in
    // solid neon, so overlapping traces never stack: HERO_CIRCUIT_OPACITY is the worst case.
    for (const panel of [accentSoft, surface]) {
      const pixel = mix(neon, panel, HERO_CIRCUIT_OPACITY);
      expect(contrast(muted, pixel)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("would fail with per-element alpha that stacks (why the opacity is group-level)", () => {
    // Two overlapping strokes at 12 % each reach about 23 %, below AA for muted text.
    const stacked = 1 - (1 - HERO_CIRCUIT_OPACITY) ** 2;
    expect(stacked).toBeCloseTo(0.2256, 3);
    expect(contrast(muted, mix(neon, accentSoft, stacked))).toBeLessThan(4.5);
  });
});

describe("drawField", () => {
  const field = createField(800, 600, MAX_NODES_WIDE);
  const base = { width: 800, height: 600, time: 0, offsetY: 0, pointer: null };

  it("draws only with the neon ink and never above full alpha", () => {
    const ctx = stubContext();
    const alphas: number[] = [];
    let alpha = 1;
    Object.defineProperty(ctx, "globalAlpha", {
      get: () => alpha,
      set: (value: number) => {
        alpha = value;
        alphas.push(value);
      },
    });
    drawField(ctx as unknown as CanvasRenderingContext2D, field, {
      ...base,
      pointer: { x: 400, y: 300 },
    });
    expect(ctx.strokeStyle).toBe(FIELD_INK);
    expect(ctx.fillStyle).toBe(FIELD_INK);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.fill).toHaveBeenCalled();
    for (const value of alphas) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("is a pure function of its inputs (the static frame never changes)", () => {
    const first = stubContext();
    const second = stubContext();
    drawField(first as unknown as CanvasRenderingContext2D, field, base);
    drawField(second as unknown as CanvasRenderingContext2D, field, base);
    expect(second.lineTo.mock.calls).toEqual(first.lineTo.mock.calls);
  });

  it("brightens traces near the pointer with extra strokes", () => {
    const calm = stubContext();
    const lit = stubContext();
    drawField(calm as unknown as CanvasRenderingContext2D, field, base);
    drawField(lit as unknown as CanvasRenderingContext2D, field, {
      ...base,
      pointer: { x: field.nodes[0].x, y: field.nodes[0].y },
    });
    expect(lit.stroke.mock.calls.length).toBeGreaterThan(calm.stroke.mock.calls.length);
  });
});

describe("startArcaneField", () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextId: number;
  let observers: Array<{ callback: IntersectionObserverCallback; disconnect: () => void }>;

  /** Runs every queued animation frame once at `time`. */
  function runFrames(time: number) {
    const queued = [...frames.entries()];
    frames.clear();
    for (const [, callback] of queued) callback(time);
  }

  /** Sets `document.visibilityState` and fires `visibilitychange`. */
  function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
    document.dispatchEvent(new Event("visibilitychange"));
  }

  beforeEach(() => {
    frames = new Map();
    nextId = 1;
    observers = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        callback: IntersectionObserverCallback;
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
          observers.push(this);
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("devicePixelRatio", 3);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setVisibility("visible");
  });

  /** Starts the field on a fresh canvas with a stub context. */
  function start(animate: boolean, pointer = true) {
    const canvas = document.createElement("canvas");
    const ctx = stubContext();
    const stop = startArcaneField(canvas, ctx as unknown as CanvasRenderingContext2D, {
      animate,
      pointer,
    });
    return { canvas, ctx, stop };
  }

  it("paints one static frame and runs no loop under reduced motion", () => {
    const { canvas, ctx, stop } = start(false);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(canvas.dataset.animating).toBe("false");
    expect(frames.size).toBe(0);
    expect(observers).toHaveLength(0);
    // Scrolling or moving the mouse does nothing.
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("pointermove"));
    expect(frames.size).toBe(0);
    stop();
  });

  it("caps the backing store at MAX_DPR", () => {
    const { canvas, ctx, stop } = start(false);
    expect(canvas.width).toBe(Math.round(window.innerWidth * MAX_DPR));
    expect(ctx.setTransform).toHaveBeenCalledWith(MAX_DPR, 0, 0, MAX_DPR, 0, 0);
    stop();
  });

  it("animates with a throttled frame loop when motion is allowed", () => {
    const { canvas, ctx, stop } = start(true);
    expect(canvas.dataset.animating).toBe("true");
    expect(frames.size).toBe(1);
    ctx.clearRect.mockClear();
    runFrames(1000);
    runFrames(1000 + FRAME_MS_FINE / 2);
    runFrames(1000 + FRAME_MS_FINE);
    // Three frames, but only two paints: the middle one is inside the frame interval.
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
    stop();
  });

  it("pauses while the tab is hidden and resumes when it is visible again", () => {
    const { canvas, stop } = start(true);
    setVisibility("hidden");
    expect(canvas.dataset.animating).toBe("false");
    expect(frames.size).toBe(0);
    setVisibility("visible");
    expect(canvas.dataset.animating).toBe("true");
    expect(frames.size).toBe(1);
    stop();
  });

  it("pauses while the canvas is off-screen", () => {
    const { canvas, stop } = start(true);
    const [observer] = observers;
    observer.callback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
    expect(canvas.dataset.animating).toBe("false");
    expect(frames.size).toBe(0);
    observer.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
    expect(frames.size).toBe(1);
    stop();
  });

  it("listens to the pointer only with a fine pointer", () => {
    const add = vi.spyOn(window, "addEventListener");
    const coarse = start(true, false);
    expect(add.mock.calls.map(([type]) => type)).not.toContain("pointermove");
    coarse.stop();
    const fine = start(true, true);
    expect(add.mock.calls.map(([type]) => type)).toContain("pointermove");
    fine.stop();
    add.mockRestore();
  });

  it("keeps the circuit on height-only resizes and rebuilds it when the width changes", () => {
    const { canvas, ctx, stop } = start(false);
    let width = 400;
    let height = 700;
    Object.defineProperty(canvas, "clientWidth", { configurable: true, get: () => width });
    Object.defineProperty(canvas, "clientHeight", { configurable: true, get: () => height });
    /** Resizes, runs the coalesced frame and returns the nodes' drawn x positions. */
    const resizeTo = (w: number, h: number) => {
      width = w;
      height = h;
      ctx.moveTo.mockClear();
      window.dispatchEvent(new Event("resize"));
      runFrames(0);
      return ctx.moveTo.mock.calls.map(([x]) => x as number);
    };
    const first = resizeTo(400, 700);
    // The mobile address bar shows: the canvas is 100 px shorter. A rebuild at that height would
    // use one row fewer and reshuffle every trace; instead only the backing store follows.
    const shorter = resizeTo(400, 600);
    expect(canvas.height).toBe(600 * MAX_DPR);
    expect(shorter.slice(0, 20)).toEqual(first.slice(0, 20));
    // Back to full height (still inside the tile): same circuit again.
    expect(resizeTo(400, 700).slice(0, 20)).toEqual(first.slice(0, 20));
    // Taller than the tile covers: rebuilt so no gap shows.
    const built = createField(400, 700, nodeCap(400, true));
    resizeTo(400, built.tileHeight);
    expect(canvas.height).toBe(Math.round(built.tileHeight * MAX_DPR));
    // A new width rebuilds the lattice for it.
    resizeTo(400, 700);
    const wider = resizeTo(900, 700);
    expect(wider.slice(0, 20)).not.toEqual(first.slice(0, 20));
    stop();
  });

  it("stops the loop and every listener on cleanup", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { canvas, stop } = start(true);
    stop();
    expect(frames.size).toBe(0);
    expect(canvas.dataset.animating).toBe("false");
    const removed = remove.mock.calls.map(([type]) => type);
    expect(removed).toEqual(expect.arrayContaining(["resize", "pointermove", "pointerout"]));
    remove.mockRestore();
  });
});
