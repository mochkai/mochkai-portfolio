import { describe, expect, it } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("joins truthy class names and skips falsy ones", () => {
    expect(cx("a", false, "b", undefined, null, "", "c")).toBe("a b c");
  });

  it("returns an empty string when nothing is truthy", () => {
    expect(cx(false, undefined)).toBe("");
  });
});
