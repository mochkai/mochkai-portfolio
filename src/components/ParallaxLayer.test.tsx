import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParallaxLayer } from "./ParallaxLayer";
import { RuneCircuit } from "./RuneCircuit";

/** Stubs `matchMedia` so `usePrefersReducedMotion` reports `reduce`. */
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  // No IntersectionObserver: the helper falls back to listening straight away.
  vi.stubGlobal("IntersectionObserver", undefined);
});

afterEach(() => vi.unstubAllGlobals());

/** Renders a layer with a rune circuit inside. */
function renderLayer() {
  render(
    <div>
      <ParallaxLayer className="absolute inset-0">
        <RuneCircuit opacity={0.12} className="text-neon" />
      </ParallaxLayer>
    </div>,
  );
  return screen.getByTestId("parallax-layer");
}

describe("ParallaxLayer", () => {
  it("is decorative: hidden from assistive tech and never hit-tested", () => {
    stubReducedMotion(false);
    const layer = renderLayer();
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("pointer-events-none", "absolute", "inset-0");
    const svg = layer.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("moves with the scroll when motion is allowed", () => {
    stubReducedMotion(false);
    const layer = renderLayer();
    expect(layer).toHaveAttribute("data-parallax", "on");
    expect(layer.style.transform).toMatch(/^translate3d\(/);
  });

  it("stays still under reduced motion: no transform, no scroll listener", () => {
    stubReducedMotion(true);
    const add = vi.spyOn(window, "addEventListener");
    const layer = renderLayer();
    expect(layer).toHaveAttribute("data-parallax", "off");
    expect(layer.style.transform).toBe("");
    expect(add.mock.calls.map(([type]) => type)).not.toContain("scroll");
    add.mockRestore();
  });
});
