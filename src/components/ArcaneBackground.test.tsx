import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIELD_OPACITY } from "@/lib/arcane-field";
import { FINE_POINTER_QUERY } from "@/lib/hooks/use-media-query";
import { overdriveStore } from "@/lib/overdrive";
import { ArcaneBackground } from "./ArcaneBackground";

/** Stubs `matchMedia` for the reduced-motion and fine-pointer queries. */
function mockMedia({
  reducedMotion,
  finePointer,
}: {
  reducedMotion: boolean;
  finePointer: boolean;
}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches:
        query === FINE_POINTER_QUERY
          ? finePointer
          : query === "(prefers-reduced-motion: reduce)"
            ? reducedMotion
            : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** A minimal 2D context so the field can draw in jsdom (which has no canvas). */
function stubCanvas() {
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setTransform: vi.fn(),
    globalAlpha: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  return ctx;
}

let frames: FrameRequestCallback[];

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("IntersectionObserver", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ArcaneBackground", () => {
  it("is decorative, fixed behind the content and never intercepts the pointer", () => {
    mockMedia({ reducedMotion: true, finePointer: true });
    stubCanvas();
    render(<ArcaneBackground />);
    const root = screen.getByTestId("arcane-background");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveClass("pointer-events-none", "fixed", "inset-0", "-z-10");
    expect(screen.getByTestId("arcane-canvas")).toHaveStyle({ opacity: String(FIELD_OPACITY) });
  });

  it("paints one static frame and runs no loop under reduced motion", () => {
    mockMedia({ reducedMotion: true, finePointer: true });
    const ctx = stubCanvas();
    render(<ArcaneBackground />);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(0);
    expect(screen.getByTestId("arcane-canvas")).toHaveAttribute("data-animating", "false");
  });

  it("animates when motion is allowed", () => {
    mockMedia({ reducedMotion: false, finePointer: false });
    stubCanvas();
    render(<ArcaneBackground />);
    expect(screen.getByTestId("arcane-canvas")).toHaveAttribute("data-animating", "true");
    expect(frames.length).toBeGreaterThan(0);
  });

  it("overdrive under reduced motion repaints one brighter static frame, with no loop", () => {
    mockMedia({ reducedMotion: true, finePointer: true });
    const ctx = stubCanvas();
    const alphas: number[] = [];
    Object.defineProperty(ctx, "globalAlpha", {
      get: () => alphas.at(-1) ?? 1,
      set: (value: number) => alphas.push(value),
    });
    render(<ArcaneBackground />);
    const canvas = screen.getByTestId("arcane-canvas");
    expect(canvas).toHaveAttribute("data-overdrive", "false");
    const calmTraceAlpha = alphas[0];

    act(() => overdriveStore.engage());
    try {
      expect(canvas).toHaveAttribute("data-overdrive", "true");
      expect(ctx.clearRect).toHaveBeenCalledTimes(2);
      expect(frames).toHaveLength(0);
      expect(canvas).toHaveAttribute("data-animating", "false");
      // The second frame's traces are brighter than the first's.
      const surgeTraceAlpha = alphas[alphas.lastIndexOf(1, alphas.length - 2) + 1];
      expect(surgeTraceAlpha).toBeGreaterThan(calmTraceAlpha);
    } finally {
      act(() => overdriveStore.stop());
    }
    expect(canvas).toHaveAttribute("data-overdrive", "false");
  });

  it("renders nothing broken when the canvas has no 2D context", () => {
    mockMedia({ reducedMotion: false, finePointer: true });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<ArcaneBackground />);
    expect(screen.getByTestId("arcane-canvas")).toHaveAttribute("data-animating", "false");
  });

  it("stops the loop when unmounted", () => {
    mockMedia({ reducedMotion: false, finePointer: true });
    stubCanvas();
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<ArcaneBackground />);
    unmount();
    expect(remove.mock.calls.map(([type]) => type)).toContain("visibilitychange");
  });
});
