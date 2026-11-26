/**
 * The Arcane Tech backdrop: a sparse "rune circuit" of glowing nodes joined by stepped traces,
 * drawn on a 2D canvas behind the whole site (see `ArcaneBackground`).
 *
 * This module holds the pure geometry and drawing (unit tested) and {@link startArcaneField},
 * the small controller that runs the frame loop outside React. No WebGL, no 3D, no dependencies.
 */

/** Neon token (`--neon`, #39a8ff) as the only ink: the canvas never draws a brighter color. */
export const FIELD_INK = "#39a8ff";

/**
 * CSS opacity of the whole canvas. Because the canvas only ever draws {@link FIELD_INK}, its
 * brightest possible pixel is `neon` at this opacity over `background`, which keeps text that
 * sits straight on the page background at WCAG AA (see `arcane-field.test.ts`).
 */
export const FIELD_OPACITY = 0.26;

/**
 * Opacity of the decorative {@link RuneCircuit} behind the Home hero text. It is applied to the
 * whole SVG (one compositing group, strokes drawn in solid neon), so where traces and nodes
 * overlap the tint never stacks above this value. Checked against `muted` on `accent-soft` in
 * `arcane-field.test.ts`.
 */
export const HERO_CIRCUIT_OPACITY = 0.12;

/**
 * Opacity of the {@link RuneCircuit} beside `PageHeader` (lg+). It only covers empty space next
 * to the header, never text, so it may be brighter than the hero tint.
 */
export const HEADER_CIRCUIT_OPACITY = 0.25;

/** Largest device-pixel ratio the canvas renders at. Sharper is not worth the fill cost. */
export const MAX_DPR = 2;

/** Node cap on wide screens with a fine pointer. */
export const MAX_NODES_WIDE = 96;

/** Node cap on small screens and touch (coarse pointer) devices. */
export const MAX_NODES_COMPACT = 44;

/** Screens narrower than this (px) use {@link MAX_NODES_COMPACT}. */
export const COMPACT_WIDTH = 640;

/** Smallest lattice spacing in pixels, so the circuit stays sparse on any screen. */
const MIN_CELL = 96;

/** How far from the pointer (px) nodes and traces start to brighten. */
export const POINTER_RADIUS = 170;

/** Largest drift (px) of a node towards the pointer. */
export const POINTER_DRIFT = 5;

/** The backdrop scrolls at this fraction of the page speed (gentle parallax). */
export const PARALLAX_FACTOR = 0.06;

/** Frame interval (ms) with a fine pointer: 30 fps is plenty for slow pulses. */
export const FRAME_MS_FINE = 1000 / 30;

/** Frame interval (ms) on touch devices: slow ambient pulse only, 15 fps. */
export const FRAME_MS_COARSE = 1000 / 15;

/** Timestamp jitter (ms) tolerated by the frame throttle. */
const FRAME_TOLERANCE_MS = 2;

/** Base alpha of the traces (inside the canvas, before {@link FIELD_OPACITY}). */
const TRACE_ALPHA = 0.32;

/**
 * Trace alpha during the "overdrive" Easter egg (#13): the circuit surges brighter, but still
 * only in {@link FIELD_INK} at most at full alpha, so the {@link FIELD_OPACITY} contrast cap
 * (WCAG AA for text on the bare background) still holds.
 */
export const SURGE_TRACE_ALPHA = 0.8;

/** Extra node alpha during overdrive (clamped to 1, like the pointer boost). */
export const SURGE_NODE_BOOST = 0.4;

/** One glowing junction of the circuit. */
export interface FieldNode {
  /** Position inside the tile, in CSS pixels. */
  x: number;
  y: number;
  /** Phase of the ambient pulse, in radians. */
  phase: number;
  /** Lit nodes are larger and brighter, like the rune markers in the UI. */
  lit: boolean;
}

/** A stepped trace between two neighbouring nodes. */
export interface FieldEdge {
  from: number;
  to: number;
  /** `right`: same row; `down`: next row (bends horizontally halfway). */
  kind: "right" | "down";
  /** True when the `to` node sits in row 0 of the next tile (the lattice wraps vertically). */
  wraps: boolean;
}

/** A vertically repeating tile of the circuit. */
export interface Field {
  nodes: FieldNode[];
  edges: FieldEdge[];
  /** Lattice spacing in pixels. */
  cell: number;
  /** Height of one tile; the tile repeats vertically so parallax can scroll forever. */
  tileHeight: number;
}

/** Inputs for one frame of {@link drawField}. */
export interface FrameState {
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
  /** Animation clock in ms (0 for the static frame). */
  time: number;
  /** Parallax scroll offset in pixels (0 for the static frame). */
  offsetY: number;
  /** Pointer position in viewport pixels, or `null` when there is none (or it may not react). */
  pointer: { x: number; y: number } | null;
  /** Overdrive: traces and nodes drawn brighter (never brighter than the ink). Default off. */
  surge?: boolean;
}

/**
 * Small seeded PRNG (mulberry32), so the circuit is identical on every visit and in tests.
 *
 * @param seed - Any 32-bit integer.
 * @returns A function returning numbers in `[0, 1)`.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The node cap for a viewport: fewer nodes on small screens and touch devices.
 *
 * @param width - Viewport width in CSS pixels.
 * @param finePointer - Whether the device has a fine, hovering pointer.
 */
export function nodeCap(width: number, finePointer: boolean): number {
  return finePointer && width >= COMPACT_WIDTH ? MAX_NODES_WIDE : MAX_NODES_COMPACT;
}

/**
 * Clamps a device-pixel ratio to `[1, MAX_DPR]`.
 *
 * @param ratio - `window.devicePixelRatio` (may be missing or 0 in odd environments).
 */
export function clampDpr(ratio: number | undefined): number {
  if (!ratio || !Number.isFinite(ratio)) return 1;
  return Math.min(MAX_DPR, Math.max(1, ratio));
}

/**
 * Builds the circuit for a viewport: a jittered lattice with one node per cell, joined to some
 * right and lower neighbours. The lattice spacing grows until the node count fits `maxNodes`.
 *
 * @param width - Viewport width in CSS pixels.
 * @param height - Viewport height in CSS pixels.
 * @param maxNodes - Upper bound on the number of nodes.
 * @param seed - PRNG seed; the same inputs always give the same circuit.
 */
export function createField(width: number, height: number, maxNodes: number, seed = 0x5eed): Field {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let cell = Math.max(MIN_CELL, Math.sqrt((w * h) / Math.max(1, maxNodes)));
  let cols = 0;
  let rows = 0;
  // One spare column for the right edge and one spare row so the tile is taller than the viewport.
  for (;;) {
    cols = Math.ceil(w / cell) + 1;
    rows = Math.ceil(h / cell) + 1;
    if (cols * rows <= maxNodes) break;
    cell *= 1.08;
  }

  const random = createRandom(seed);
  const nodes: FieldNode[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      nodes.push({
        x: (col + 0.2 + random() * 0.6) * cell,
        y: (row + 0.2 + random() * 0.6) * cell,
        phase: random() * Math.PI * 2,
        lit: random() < 0.16,
      });
    }
  }

  const edges: FieldEdge[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (col + 1 < cols && random() < 0.42) {
        edges.push({ from: index, to: index + 1, kind: "right", wraps: false });
      }
      if (random() < 0.36) {
        const nextRow = (row + 1) % rows;
        edges.push({ from: index, to: nextRow * cols + col, kind: "down", wraps: row + 1 >= rows });
      }
    }
  }

  return { nodes, edges, cell, tileHeight: rows * cell };
}

/**
 * Whether a resize needs a new circuit: only when the width changed, or when the viewport grew
 * taller than the tile still covers (one spare row). Height-only changes within the tile just
 * resize the backing store and repaint.
 *
 * @param field - The current circuit.
 * @param builtWidth - The width it was built for.
 * @param width - The new viewport width.
 * @param height - The new viewport height.
 */
export function needsRebuild(field: Field, builtWidth: number, width: number, height: number) {
  return width !== builtWidth || height > field.tileHeight - field.cell;
}

/**
 * How strongly the pointer lights a point: 1 on top of it, easing to 0 at `radius`.
 *
 * @param dx - Horizontal distance from the pointer, in pixels.
 * @param dy - Vertical distance from the pointer, in pixels.
 * @param radius - Reach in pixels. Defaults to {@link POINTER_RADIUS}.
 */
export function pointerBoost(dx: number, dy: number, radius: number = POINTER_RADIUS): number {
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return 0;
  const t = 1 - distance / radius;
  return t * t;
}

/**
 * The shift (a multiple of `tileHeight`) that brings `y` into `[-margin, tileHeight - margin)`.
 *
 * @param y - A node's y after the parallax offset.
 * @param tileHeight - Height of one tile.
 * @param margin - How far above the viewport a node may sit before it wraps to the bottom.
 */
export function wrapShift(y: number, tileHeight: number, margin: number): number {
  return -Math.floor((y + margin) / tileHeight) * tileHeight;
}

/**
 * Draws one frame of the circuit. Only {@link FIELD_INK} is used, so no pixel is ever brighter
 * than neon (the canvas element then applies {@link FIELD_OPACITY}).
 *
 * @param ctx - A 2D context already scaled to CSS pixels.
 * @param field - The circuit from {@link createField}.
 * @param frame - Viewport size, clock, parallax offset and pointer.
 */
export function drawField(ctx: CanvasRenderingContext2D, field: Field, frame: FrameState): void {
  const { width, height, time, offsetY, pointer, surge = false } = frame;
  const traceAlpha = surge ? SURGE_TRACE_ALPHA : TRACE_ALPHA;
  const nodeBoost = surge ? SURGE_NODE_BOOST : 0;
  const { nodes, edges, cell, tileHeight } = field;

  // Screen positions (after parallax, wrap and pointer drift) and pointer boost per node.
  const xs = new Float32Array(nodes.length);
  const ys = new Float32Array(nodes.length);
  const shifts = new Float32Array(nodes.length);
  const boosts = new Float32Array(nodes.length);
  // Pointer drift on y, kept apart so edges can place their far end in another tile.
  const drifts = new Float32Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const raw = node.y - offsetY;
    const shift = wrapShift(raw, tileHeight, cell);
    let x = node.x;
    let drift = 0;
    let boost = 0;
    if (pointer) {
      const dx = pointer.x - x;
      const dy = pointer.y - (raw + shift);
      boost = pointerBoost(dx, dy);
      if (boost > 0) {
        // Drift a few pixels towards the pointer, stronger when closer.
        const distance = Math.hypot(dx, dy) || 1;
        x += (dx / distance) * POINTER_DRIFT * boost;
        drift = (dy / distance) * POINTER_DRIFT * boost;
      }
    }
    xs[i] = x;
    ys[i] = raw + shift + drift;
    shifts[i] = shift;
    drifts[i] = drift;
    boosts[i] = boost;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = FIELD_INK;
  ctx.fillStyle = FIELD_INK;
  ctx.lineWidth = 1;

  /** Adds one stepped trace to the current path. `toY` is expressed in the `from` node's tile. */
  const trace = (edge: FieldEdge, fromX: number, fromY: number, toX: number, toY: number) => {
    ctx.moveTo(fromX, fromY);
    if (edge.kind === "right") {
      const midX = (fromX + toX) / 2;
      ctx.lineTo(midX, fromY);
      ctx.lineTo(midX, toY);
    } else {
      const midY = (fromY + toY) / 2;
      ctx.lineTo(fromX, midY);
      ctx.lineTo(toX, midY);
    }
    ctx.lineTo(toX, toY);
  };

  /** Where an edge ends, in the `from` node's tile, so a trace never tears at the wrap seam. */
  const edgeEndY = (edge: FieldEdge): number =>
    nodes[edge.to].y -
    offsetY +
    (edge.wraps ? tileHeight : 0) +
    shifts[edge.from] +
    drifts[edge.to];

  // Calm traces share one path; traces near the pointer are stroked brighter, one by one.
  const hot: Array<{ edge: FieldEdge; toY: number; boost: number }> = [];
  ctx.globalAlpha = traceAlpha;
  ctx.beginPath();
  for (const edge of edges) {
    const fromY = ys[edge.from];
    const toY = edgeEndY(edge);
    if (Math.max(fromY, toY) < -cell || Math.min(fromY, toY) > height + cell) continue;
    const boost = Math.max(boosts[edge.from], boosts[edge.to]);
    if (boost > 0.02) hot.push({ edge, toY, boost });
    else trace(edge, xs[edge.from], fromY, xs[edge.to], toY);
  }
  ctx.stroke();

  for (const { edge, toY, boost } of hot) {
    ctx.globalAlpha = Math.min(1, traceAlpha + boost * 0.68);
    ctx.beginPath();
    trace(edge, xs[edge.from], ys[edge.from], xs[edge.to], toY);
    ctx.stroke();
  }

  // Nodes: small diamonds that pulse slowly (period about 7 s) and light up near the pointer.
  for (let i = 0; i < nodes.length; i++) {
    const y = ys[i];
    if (y < -cell || y > height + cell) continue;
    const node = nodes[i];
    const pulse = 0.5 + 0.5 * Math.sin(time / 1100 + node.phase);
    const base = node.lit ? 0.55 + 0.35 * pulse : 0.3 + 0.2 * pulse;
    ctx.globalAlpha = Math.min(1, base + nodeBoost + boosts[i] * 0.6);
    const size = (node.lit ? 3 : 2) + boosts[i] * 1.5;
    const x = xs[i];
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Options for {@link startArcaneField}. */
export interface ArcaneFieldOptions {
  /** Run the frame loop (ambient pulse and parallax). `false` paints one static frame. */
  animate: boolean;
  /** React to a fine mouse pointer. Ignored unless `animate` is true. */
  pointer: boolean;
  /**
   * Overdrive (#13): draw the circuit brighter. Works in the static frame too, so reduced
   * motion gets a still, brighter frame. Default off.
   */
  surge?: boolean;
}

/**
 * Runs the backdrop on `canvas` outside React and returns a cleanup function.
 *
 * - Static (`animate: false`, used under reduced motion): one frame with no parallax and no
 *   pointer, repainted only when the viewport is resized. No frame loop, no scroll or pointer
 *   listeners.
 * - Animated: a `requestAnimationFrame` loop throttled to {@link FRAME_MS_FINE} (or
 *   {@link FRAME_MS_COARSE} without a fine pointer) that reads `scrollY` for the parallax. It
 *   stops while the tab is hidden (`visibilitychange`) or the canvas is off-screen
 *   (`IntersectionObserver`), and resumes when both are true again.
 * - The device-pixel ratio is capped at {@link MAX_DPR} and the node count by {@link nodeCap}.
 * - `data-animating` on the canvas mirrors whether the loop is running, for tests.
 *
 * @param canvas - The canvas to draw on (sized by CSS to the viewport).
 * @param ctx - Its 2D context.
 * @param options - Whether to animate and whether to react to the pointer.
 */
export function startArcaneField(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  { animate, pointer: reactToPointer, surge = false }: ArcaneFieldOptions,
): () => void {
  const pointerEnabled = animate && reactToPointer;
  const frameMs = pointerEnabled ? FRAME_MS_FINE : FRAME_MS_COARSE;
  let width = 0;
  let height = 0;
  let field: Field = createField(1, 1, 1);
  // Width the current circuit was built for; -1 forces the first build.
  let builtWidth = -1;
  let frame = 0;
  let resizeFrame = 0;
  let lastPaint = -Infinity;
  let pageVisible = document.visibilityState !== "hidden";
  let onScreen = true;
  let pointer: FrameState["pointer"] = null;

  /** Paints one frame at clock `time`. */
  const paint = (time: number) => {
    drawField(ctx, field, {
      width,
      height,
      time: animate ? time : 0,
      offsetY: animate ? window.scrollY * PARALLAX_FACTOR : 0,
      pointer: pointerEnabled ? pointer : null,
      surge,
    });
  };

  /**
   * Matches the backing store to the canvas size and repaints. The circuit is only rebuilt when
   * {@link needsRebuild} says so, so a height-only change (a mobile address bar showing or
   * hiding while the user scrolls) never reshuffles it.
   */
  const resize = () => {
    resizeFrame = 0;
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    const dpr = clampDpr(window.devicePixelRatio);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (needsRebuild(field, builtWidth, width, height)) {
      field = createField(width, height, nodeCap(width, reactToPointer));
      builtWidth = width;
    }
    paint(performance.now());
  };

  /** Coalesces resize bursts into one rebuild per frame. */
  const scheduleResize = () => {
    if (resizeFrame === 0) resizeFrame = window.requestAnimationFrame(resize);
  };

  /**
   * One loop step: paints at most once per `frameMs`. The small tolerance keeps a 60 Hz display
   * on every second frame (30 fps) instead of every third when timestamps jitter.
   */
  const tick = (time: number) => {
    frame = 0;
    if (time - lastPaint >= frameMs - FRAME_TOLERANCE_MS) {
      lastPaint = time;
      paint(time);
    }
    frame = window.requestAnimationFrame(tick);
  };

  /** Starts or stops the loop to match visibility, and mirrors the state to `data-animating`. */
  const sync = () => {
    const run = animate && pageVisible && onScreen;
    canvas.dataset.animating = String(run);
    if (run && frame === 0) frame = window.requestAnimationFrame(tick);
    if (!run && frame !== 0) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  const handleVisibility = () => {
    pageVisible = document.visibilityState !== "hidden";
    sync();
  };

  const handlePointerMove = (event: PointerEvent) => {
    pointer = event.pointerType === "mouse" ? { x: event.clientX, y: event.clientY } : null;
  };

  /** The pointer left the window (`relatedTarget` is null) or the window lost focus. */
  const handlePointerOut = (event: PointerEvent) => {
    if (!event.relatedTarget) pointer = null;
  };
  const clearPointer = () => {
    pointer = null;
  };

  resize();
  window.addEventListener("resize", scheduleResize);

  let observer: IntersectionObserver | null = null;
  if (animate) {
    document.addEventListener("visibilitychange", handleVisibility);
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        sync();
      });
      observer.observe(canvas);
    }
  }
  if (pointerEnabled) {
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerout", handlePointerOut, { passive: true });
    window.addEventListener("blur", clearPointer);
  }
  sync();

  return () => {
    window.removeEventListener("resize", scheduleResize);
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerout", handlePointerOut);
    window.removeEventListener("blur", clearPointer);
    observer?.disconnect();
    if (frame !== 0) window.cancelAnimationFrame(frame);
    if (resizeFrame !== 0) window.cancelAnimationFrame(resizeFrame);
    frame = 0;
    resizeFrame = 0;
    canvas.dataset.animating = "false";
  };
}
