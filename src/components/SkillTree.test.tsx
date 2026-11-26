import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SkillGroupWithUsage } from "@/lib/skills";
import { SkillTree } from "./SkillTree";

const groups: SkillGroupWithUsage[] = [
  {
    category: "Frontend",
    items: [
      { name: "React", rank: "mastered", questCount: 2 },
      { name: "Tailwind CSS", rank: "proficient", questCount: 1 },
    ],
  },
  { category: "AI", items: [{ name: "LangGraph", rank: "learning", questCount: 0 }] },
];

describe("SkillTree", () => {
  it("renders one labelled panel with an h3 per category", () => {
    render(<SkillTree groups={groups} />);
    for (const { category } of groups) {
      const panel = screen.getByRole("region", { name: category });
      expect(within(panel).getByRole("heading", { level: 3, name: category })).toBeVisible();
    }
  });

  it("gives screen readers the skill name and rank as text", () => {
    render(<SkillTree groups={groups} />);
    const items = screen.getAllByTestId("skill");
    expect(items[0]).toHaveTextContent(/^React, Mastered, Used in 2 quests \(React\)$/);
    expect(items[1]).toHaveTextContent(/^Tailwind CSS, Proficient, Used in 1 quest/);
    expect(items[2]).toHaveTextContent(/^LangGraph, Learning, No quests yet$/);
    for (const item of items) {
      expect(within(item).getByTestId("rank-pips")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("links used skills to the filtered quest board and leaves unused ones plain", () => {
    render(<SkillTree groups={groups} />);
    expect(screen.getByRole("link", { name: "Used in 2 quests (React)" })).toHaveAttribute(
      "href",
      "/projects?tech=React",
    );
    expect(screen.getByRole("link", { name: "Used in 1 quest (Tailwind CSS)" })).toHaveAttribute(
      "href",
      "/projects?tech=Tailwind%20CSS",
    );
    const unused = screen.getAllByTestId("skill")[2];
    expect(within(unused).queryByRole("link")).not.toBeInTheDocument();
  });

  it("has no progress bars or percentages", () => {
    const { container } = render(<SkillTree groups={groups} />);
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/%/);
  });

  it("staggers the unlock across the whole tree", () => {
    render(<SkillTree groups={groups} />);
    const firstLit = screen
      .getAllByTestId("skill")
      .map((item) => within(item).getAllByTestId("rank-pip")[0].style.animationDelay);
    expect(firstLit).toEqual(["0ms", "35ms", "70ms"]);
  });
});
