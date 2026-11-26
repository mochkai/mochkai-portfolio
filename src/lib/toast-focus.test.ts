import { afterEach, describe, expect, it, vi } from "vitest";
import { isEscapeClaimed } from "./toast-focus";

afterEach(() => vi.restoreAllMocks());

describe("isEscapeClaimed", () => {
  it("is false for a plain Escape with no modal dialog open", () => {
    expect(isEscapeClaimed({ defaultPrevented: false })).toBe(false);
  });

  it("is true when another handler prevented the default", () => {
    expect(isEscapeClaimed({ defaultPrevented: true })).toBe(true);
  });

  it("is true while a modal dialog is open", () => {
    const modal = document.createElement("dialog");
    vi.spyOn(document, "querySelector").mockImplementation((selector: string) =>
      selector === "dialog:modal" ? modal : null,
    );
    expect(isEscapeClaimed({ defaultPrevented: false })).toBe(true);
  });

  it("is false when the engine does not support :modal", () => {
    vi.spyOn(document, "querySelector").mockImplementation(() => {
      throw new SyntaxError("unsupported");
    });
    expect(isEscapeClaimed({ defaultPrevented: false })).toBe(false);
  });
});
