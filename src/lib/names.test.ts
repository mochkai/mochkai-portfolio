import { describe, expect, it } from "vitest";
import { toNameKey } from "./names";

describe("toNameKey", () => {
  it("trims and lowercases", () => {
    expect(toNameKey("  Next.JS ")).toBe("next.js");
    expect(toNameKey("   ")).toBe("");
  });
});
