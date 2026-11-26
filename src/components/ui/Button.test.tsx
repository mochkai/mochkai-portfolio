import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { buttonClasses } from "./buttonStyles";

describe("Button", () => {
  it("renders a native button named by its text that defaults to type=button", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Press start</Button>);
    const button = screen.getByRole("button", { name: "Press start" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is keyboard reachable", async () => {
    render(<Button>Focus me</Button>);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Focus me" })).toHaveFocus();
  });

  it.each([
    ["primary", "shadow-glow"],
    ["secondary", "border-neon/50"],
    ["ghost", "text-muted"],
  ] as const)("applies the %s variant", (variant, expected) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass(expected);
  });

  it("uses the primary variant by default and keeps custom classes and type", () => {
    render(
      <Button type="submit" className="w-full">
        Send
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Send" });
    expect(button).toHaveClass("shadow-glow", "w-full");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("keeps hover effects short and turns them off under reduced motion", () => {
    render(<Button>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toHaveClass(
      "motion-safe:duration-150",
      "motion-safe:active:translate-y-px",
      "motion-reduce:transition-none",
    );
    // Motion exists only under motion-safe:, never as a base class a motion-reduce: must beat.
    expect(button.className).not.toMatch(
      /(^|\s)(transition-(?!none)|duration-|ease-|animate-|active:translate)/,
    );
  });

  it("has a compact sm size with no conflicting md padding", () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole("button", { name: "Small" });
    expect(button).toHaveClass("min-h-11", "px-3.5", "text-sm");
    expect(button).not.toHaveClass("px-5");
    expect(button).not.toHaveClass("py-2.5");
    expect(buttonClasses("ghost", undefined, "sm").split(/\s+/)).not.toContain("px-5");
    expect(buttonClasses("ghost").split(/\s+/)).toContain("px-5");
  });

  it("does not fire clicks when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Locked
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Locked" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
