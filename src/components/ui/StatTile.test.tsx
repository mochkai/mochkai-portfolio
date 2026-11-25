import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatGrid } from "./StatGrid";
import { StatTile } from "./StatTile";

describe("StatTile and StatGrid", () => {
  it("render a labelled description list of term/value pairs", () => {
    render(
      <StatGrid label="Character stats">
        <StatTile label="Projects completed" value={3} />
        <StatTile label="Class" value="Full-stack developer" />
      </StatGrid>,
    );
    const list = screen.getByLabelText("Character stats");
    expect(list.tagName).toBe("DL");
    const terms = within(list).getAllByRole("term");
    const values = within(list).getAllByRole("definition");
    expect(terms.map((t) => t.textContent)).toEqual(["Projects completed", "Class"]);
    expect(values.map((d) => d.textContent)).toEqual(["3", "Full-stack developer"]);
  });

  it("style the label as a mono HUD label and the value as a glowing number", () => {
    render(
      <dl>
        <StatTile label="Technologies" value={12} className="extra" />
      </dl>,
    );
    expect(screen.getByRole("term")).toHaveClass("font-mono", "uppercase");
    expect(screen.getByRole("definition")).toHaveClass("text-glow", "text-shadow-glow-sm");
    expect(screen.getByRole("term").parentElement).toHaveClass("extra");
  });
});
