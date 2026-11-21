import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TechList } from "./TechList";

describe("TechList", () => {
  it("renders each technology as a list item under an accessible label", () => {
    render(<TechList items={["TypeScript", "React"]} label="Stack" />);
    const list = screen.getByRole("list", { name: "Stack" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["TypeScript", "React"]);
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(<TechList items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
