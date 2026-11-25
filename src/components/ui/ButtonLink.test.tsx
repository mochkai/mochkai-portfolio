import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonLink } from "./ButtonLink";

describe("ButtonLink", () => {
  it("renders a link named by its text with the primary style by default", () => {
    render(<ButtonLink href="/projects">See all projects</ButtonLink>);
    const link = screen.getByRole("link", { name: "See all projects" });
    expect(link).toHaveAttribute("href", "/projects");
    expect(link).toHaveClass("shadow-glow", "motion-reduce:transition-none");
  });

  it.each([
    ["secondary", "border-neon/50"],
    ["ghost", "text-muted"],
  ] as const)("applies the %s variant", (variant, expected) => {
    render(
      <ButtonLink href="/about" variant={variant} className="extra">
        About
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "About" });
    expect(link).toHaveClass(expected, "extra");
    expect(link).not.toHaveClass("shadow-glow");
  });

  it("passes link attributes through", () => {
    render(
      <ButtonLink href="/experience" aria-current="page">
        Quest log
      </ButtonLink>,
    );
    expect(screen.getByRole("link", { name: "Quest log" })).toHaveAttribute("aria-current", "page");
  });
});
