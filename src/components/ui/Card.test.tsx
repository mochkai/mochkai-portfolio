import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders a div panel with the rune line by default", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveTextContent("Content");
    expect(card).toHaveClass("bg-surface", "border-line", "before:border-dashed");
    expect(card).not.toHaveClass("hover:shadow-glow");
    expect(card).not.toHaveAttribute("data-interactive");
  });

  it("renders as the requested element and keeps landmark labelling", () => {
    render(
      <>
        <h2 id="card-heading">Quest</h2>
        <Card as="section" aria-labelledby="card-heading">
          Body
        </Card>
      </>,
    );
    expect(screen.getByRole("region", { name: "Quest" })).toHaveTextContent("Body");
  });

  it("renders as a list item inside a list", () => {
    render(
      <ul>
        <Card as="li">One</Card>
      </ul>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("One");
  });

  it("adds a short hover and focus-within glow in the interactive variant, off under reduced motion", () => {
    render(
      <Card as="article" interactive className="extra" data-testid="card">
        <button type="button">Open</button>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card.tagName).toBe("ARTICLE");
    expect(card).toHaveAttribute("data-interactive", "true");
    expect(card).toHaveClass(
      "hover:shadow-glow",
      "focus-within:shadow-glow",
      "duration-150",
      "motion-reduce:transition-none",
      "extra",
    );
  });
});
