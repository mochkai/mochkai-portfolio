import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkillRankPips } from "./SkillRankPips";

describe("SkillRankPips", () => {
  it.each([
    ["mastered", 3],
    ["proficient", 2],
    ["learning", 1],
  ] as const)("lights %s as %i of 3 pips", (rank, lit) => {
    render(<SkillRankPips rank={rank} />);
    const pips = screen.getAllByTestId("rank-pip");
    expect(pips).toHaveLength(3);
    expect(pips.filter((pip) => pip.dataset.lit === "true")).toHaveLength(lit);
  });

  it("is decorative and differs in shape and fill, not only color", () => {
    render(<SkillRankPips rank="proficient" />);
    expect(screen.getByTestId("rank-pips")).toHaveAttribute("aria-hidden", "true");
    const [lit, , unlit] = screen.getAllByTestId("rank-pip");
    expect(lit).toHaveClass("size-2.5", "bg-neon");
    expect(unlit).toHaveClass("size-2", "bg-transparent");
  });

  it("staggers the unlock only on lit pips and only under motion-safe", () => {
    render(<SkillRankPips rank="proficient" unlockDelayMs={100} />);
    const [first, second, third] = screen.getAllByTestId("rank-pip");
    expect(first).toHaveClass("motion-safe:animate-pip-unlock");
    expect(first).not.toHaveClass("animate-pip-unlock");
    expect(first.style.animationDelay).toBe("100ms");
    expect(second.style.animationDelay).toBe("190ms");
    expect(third.className).not.toMatch(/animate/);
    expect(third.style.animationDelay).toBe("");
  });
});
