import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tag } from "./Tag";

describe("Tag", () => {
  it("renders its text as a mono chip", () => {
    render(<Tag>TypeScript</Tag>);
    const tag = screen.getByText("TypeScript");
    expect(tag.tagName).toBe("SPAN");
    expect(tag).toHaveClass("font-mono", "text-glow", "border-line");
  });

  it("merges custom classes and attributes", () => {
    render(
      <Tag className="extra" title="Language">
        Rust
      </Tag>,
    );
    const tag = screen.getByTitle("Language");
    expect(tag).toHaveTextContent("Rust");
    expect(tag).toHaveClass("font-mono", "extra");
  });
});
