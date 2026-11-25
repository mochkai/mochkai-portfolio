import { describe, expect, it } from "vitest";
import { getScrollProgress } from "./scroll-progress";

describe("getScrollProgress", () => {
  it("is 0 at the top and 1 at the bottom of a long page", () => {
    expect(getScrollProgress(0, 3000, 1000)).toBe(0);
    expect(getScrollProgress(2000, 3000, 1000)).toBe(1);
  });

  it("is proportional in between", () => {
    expect(getScrollProgress(500, 3000, 1000)).toBe(0.25);
    expect(getScrollProgress(1000, 3000, 1000)).toBe(0.5);
  });

  it("clamps overscroll to the 0 to 1 range", () => {
    expect(getScrollProgress(-40, 3000, 1000)).toBe(0);
    expect(getScrollProgress(2100, 3000, 1000)).toBe(1);
  });

  it("is 0 when the page cannot scroll", () => {
    expect(getScrollProgress(0, 800, 1000)).toBe(0);
    expect(getScrollProgress(0, 1000, 1000)).toBe(0);
  });

  it("is 0 for non-finite input", () => {
    expect(getScrollProgress(Number.NaN, 3000, 1000)).toBe(0);
    expect(getScrollProgress(0, Number.POSITIVE_INFINITY, 1000)).toBe(0);
  });
});
