import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RuneCircuit } from "./RuneCircuit";

describe("RuneCircuit", () => {
  it("is decorative and hidden from assistive tech", () => {
    render(<RuneCircuit opacity={0.12} className="text-neon" />);
    const svg = screen.getByTestId("rune-circuit");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("fades as one group so overlapping traces never stack into a brighter tint", () => {
    render(<RuneCircuit opacity={0.12} className="text-neon" />);
    const svg = screen.getByTestId("rune-circuit");
    expect(svg).toHaveStyle({ opacity: "0.12" });
    // Every stroke and fill is solid currentColor: no per-element alpha that could compound.
    for (const element of Array.from(svg.querySelectorAll("*"))) {
      expect(element.getAttribute("opacity")).toBeNull();
      expect(element.getAttribute("stroke-opacity")).toBeNull();
      expect(element.getAttribute("fill-opacity")).toBeNull();
      for (const attribute of ["stroke", "fill"]) {
        const value = element.getAttribute(attribute);
        if (value !== null) expect(["currentColor", "none"]).toContain(value);
      }
    }
  });
});
