import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FINE_POINTER_QUERY,
  MAX_TILT_DEGREES,
  TiltCard,
  getTiltAngles,
  tiltTransform,
} from "./TiltCard";

/** Stubs `matchMedia` so each query matches according to `matches`. */
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

/** Renders a 200 x 100 tilt card at the viewport origin and returns its wrapper. */
function renderCard() {
  render(
    <TiltCard>
      <p>Card body</p>
    </TiltCard>,
  );
  const card = screen.getByTestId("tilt-card");
  card.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }) as DOMRect;
  return card;
}

/** Moves a pointer of `pointerType` to (`x`, `y`) over `element`. */
function movePointer(element: HTMLElement, x: number, y: number, pointerType = "mouse") {
  fireEvent.pointerMove(element, { clientX: x, clientY: y, pointerType });
}

beforeEach(() => {
  // Run animation frames synchronously so transforms apply immediately.
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getTiltAngles", () => {
  it("is flat at the centre", () => {
    expect(getTiltAngles(100, 50, 200, 100)).toEqual({ rotateX: 0, rotateY: 0 });
  });

  it("leans towards the pointer and reaches the maximum at the corners", () => {
    expect(getTiltAngles(200, 0, 200, 100)).toEqual({
      rotateX: MAX_TILT_DEGREES,
      rotateY: MAX_TILT_DEGREES,
    });
    expect(getTiltAngles(0, 100, 200, 100)).toEqual({
      rotateX: -MAX_TILT_DEGREES,
      rotateY: -MAX_TILT_DEGREES,
    });
  });

  it("never exceeds the maximum, even outside the box", () => {
    const { rotateX, rotateY } = getTiltAngles(-500, 900, 200, 100);
    expect(Math.abs(rotateX)).toBeLessThanOrEqual(MAX_TILT_DEGREES);
    expect(Math.abs(rotateY)).toBeLessThanOrEqual(MAX_TILT_DEGREES);
  });

  it("is flat for an empty box", () => {
    expect(getTiltAngles(10, 10, 0, 0)).toEqual({ rotateX: 0, rotateY: 0 });
  });

  it("caps the tilt at about 6 degrees", () => {
    expect(MAX_TILT_DEGREES).toBeLessThanOrEqual(6);
  });
});

describe("tiltTransform", () => {
  it("builds a perspective rotation", () => {
    expect(tiltTransform({ rotateX: 1.5, rotateY: -3 })).toBe(
      "perspective(900px) rotateX(1.50deg) rotateY(-3.00deg)",
    );
  });
});

describe("TiltCard", () => {
  it("renders its children", () => {
    mockMedia({ reducedMotion: false, finePointer: true });
    renderCard();
    expect(screen.getByText("Card body")).toBeInTheDocument();
  });

  it("tilts towards a mouse on a fine pointer and resets when the pointer leaves", () => {
    mockMedia({ reducedMotion: false, finePointer: true });
    const card = renderCard();
    expect(card).toHaveAttribute("data-tilt", "on");

    movePointer(card, 200, 0);
    // The browser normalises "6.00deg" to "6deg".
    expect(card.style.transform).toBe("perspective(900px) rotateX(6deg) rotateY(6deg)");

    movePointer(card, 150, 75);
    expect(card.style.transform).toBe("perspective(900px) rotateX(-3deg) rotateY(3deg)");

    fireEvent.pointerLeave(card);
    expect(card.style.transform).toBe("");
  });

  it("does not tilt under reduced motion (glow only)", () => {
    mockMedia({ reducedMotion: true, finePointer: true });
    const card = renderCard();
    expect(card).toHaveAttribute("data-tilt", "off");
    movePointer(card, 200, 0);
    expect(card.style.transform).toBe("");
    // CSS guard as well, in case a transform was set before the preference changed.
    expect(card).toHaveClass("motion-reduce:transform-none!", "motion-reduce:transition-none");
  });

  it("checks the pointer media query once, not on every pointer move", () => {
    mockMedia({ reducedMotion: false, finePointer: true });
    const card = renderCard();
    const calls = vi.mocked(window.matchMedia).mock.calls.length;
    for (let x = 0; x < 10; x++) movePointer(card, x * 20, 50);
    expect(vi.mocked(window.matchMedia).mock.calls.length).toBe(calls);
  });

  it("does not tilt for touch or pen input", () => {
    mockMedia({ reducedMotion: false, finePointer: true });
    const card = renderCard();
    movePointer(card, 200, 0, "touch");
    movePointer(card, 200, 0, "pen");
    expect(card.style.transform).toBe("");
  });

  it("does not tilt on a device without a fine, hovering pointer", () => {
    mockMedia({ reducedMotion: false, finePointer: false });
    const card = renderCard();
    expect(card).toHaveAttribute("data-tilt", "off");
    movePointer(card, 200, 0);
    expect(card.style.transform).toBe("");
  });
});
