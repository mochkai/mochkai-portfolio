import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Label } from "./Label";

describe("Label", () => {
  it("renders normal-case text styled as an uppercase mono HUD label", () => {
    render(<Label>Player 1</Label>);
    const label = screen.getByText("Player 1");
    expect(label.tagName).toBe("SPAN");
    // Uppercase is CSS only, so assistive tech reads the words as written.
    expect(label.textContent).toBe("Player 1");
    expect(label).toHaveClass("font-mono", "uppercase", "text-neon");
    expect(screen.queryByTestId("label-rune")).toBeNull();
  });

  it("renders a decorative rune hidden from assistive tech", () => {
    render(<Label rune>Quest 02</Label>);
    const rune = screen.getByTestId("label-rune");
    expect(rune).toHaveAttribute("aria-hidden", "true");
    expect(rune.textContent).toBe("");
    expect(screen.getByText("Quest 02")).toContainElement(rune);
  });

  it("renders as the requested element", () => {
    render(
      <Label as="p" className="extra">
        Inventory
      </Label>,
    );
    const label = screen.getByText("Inventory");
    expect(label.tagName).toBe("P");
    expect(label).toHaveClass("extra");
  });
});
