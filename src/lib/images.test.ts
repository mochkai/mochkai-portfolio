import { describe, expect, it } from "vitest";
import { isSvgImage } from "./images";

describe("isSvgImage", () => {
  it.each([
    ["/images/a.svg", true],
    ["/images/A.SVG", true],
    ["/images/a.png", false],
    ["/images/svg.png", false],
  ])("%s -> %s", (src, expected) => {
    expect(isSvgImage(src)).toBe(expected);
  });
});
