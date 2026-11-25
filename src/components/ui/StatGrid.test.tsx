import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatGrid } from "./StatGrid";

describe("StatGrid", () => {
  it("renders a responsive dl named by its label", () => {
    render(
      <StatGrid label="Stats" className="extra">
        <div />
      </StatGrid>,
    );
    const grid = screen.getByLabelText("Stats");
    expect(grid.tagName).toBe("DL");
    expect(grid).toHaveClass("grid", "extra");
  });
});
