import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { layoutBranch, type SkillTreeBranch } from "@/lib/skill-tree";
import { SkillTree } from "./SkillTree";

const usage: Record<string, number> = { React: 2, "Tailwind CSS": 1 };

const branches: SkillTreeBranch[] = [
  layoutBranch(
    {
      id: "frontend",
      name: "Front end",
      skills: [
        { id: "typescript", name: "TypeScript", rank: "mastered" },
        { id: "react", name: "React", rank: "mastered", requires: ["typescript"] },
        { id: "tailwind", name: "Tailwind CSS", rank: "proficient" },
      ],
    },
    (name) => usage[name] ?? 0,
  ),
  layoutBranch({
    id: "ai",
    name: "AI dev",
    skills: [
      { id: "llm", name: "LLM APIs", rank: "proficient" },
      { id: "langgraph", name: "LangGraph", rank: "learning", requires: ["llm"] },
    ],
  }),
];

/** Makes `matchMedia` report a wide (true) or phone (false) viewport. */
function mockViewport(wide: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: wide && query.includes("min-width"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The node button for a skill name. */
function node(name: string) {
  return screen.getByRole("button", { name: new RegExp(`^${name},`) });
}

describe("SkillTree", () => {
  it("server-renders every branch, node and connector from the layout", () => {
    const html = renderToString(<SkillTree branches={branches} />);
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(container.querySelectorAll('[data-testid="skill-branch"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-testid="skill-node"]')).toHaveLength(5);
    // Root edges for TypeScript, Tailwind and LLM APIs, plus one per requires.
    const edges = container.querySelectorAll('[data-testid="skill-edge"]');
    expect(edges).toHaveLength(5);
    for (const edge of edges) expect(edge.getAttribute("d")).toMatch(/^M[\d.]+ [\d.]+ V/);
  });

  it("gives each node an accessible name with rank and prerequisites", () => {
    render(<SkillTree branches={branches} />);
    expect(node("React")).toHaveAccessibleName("React, Mastered, requires TypeScript");
    expect(node("TypeScript")).toHaveAccessibleName("TypeScript, Mastered");
    expect(node("LangGraph")).toHaveAccessibleName("LangGraph, Learning, requires LLM APIs");
    for (const pips of screen.getAllByTestId("rank-pips")) {
      expect(pips).toHaveAttribute("aria-hidden", "true");
    }
  });

  describe("tabs (phones)", () => {
    it("is an ARIA tablist that shows one branch at a time", async () => {
      mockViewport(false);
      const user = userEvent.setup();
      render(<SkillTree branches={branches} />);
      const tabs = within(screen.getByRole("tablist", { name: "Skill branches" })).getAllByRole(
        "tab",
      );
      expect(tabs.map((tab) => tab.textContent)).toEqual(["Front end", "AI dev"]);
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(tabs[1]).toHaveAttribute("tabindex", "-1");

      const panels = screen.getAllByRole("tabpanel");
      expect(panels[0]).toHaveAccessibleName("Front end");
      expect(tabs[0]).toHaveAttribute("aria-controls", panels[0].id);
      expect(panels[0]).not.toHaveClass("max-md:hidden");
      expect(panels[1]).toHaveClass("max-md:hidden");

      await user.click(tabs[1]);
      expect(tabs[1]).toHaveAttribute("aria-selected", "true");
      expect(panels[0]).toHaveClass("max-md:hidden");
      expect(panels[1]).not.toHaveClass("max-md:hidden");
    });

    it("moves between tabs with the arrow keys, Home and End", async () => {
      mockViewport(false);
      const user = userEvent.setup();
      render(<SkillTree branches={branches} />);
      const tabs = screen.getAllByRole("tab");
      tabs[0].focus();
      await user.keyboard("{ArrowRight}");
      expect(tabs[1]).toHaveFocus();
      expect(tabs[1]).toHaveAttribute("aria-selected", "true");
      await user.keyboard("{ArrowRight}");
      expect(tabs[0]).toHaveFocus();
      await user.keyboard("{End}");
      expect(tabs[1]).toHaveFocus();
      await user.keyboard("{Home}");
      expect(tabs[0]).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(tabs[1]).toHaveFocus();
    });

    it("labels the branches as regions on wide screens", () => {
      mockViewport(true);
      render(<SkillTree branches={branches} />);
      expect(screen.queryAllByRole("tabpanel")).toHaveLength(0);
      expect(screen.getByRole("region", { name: "Front end" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 3, name: "AI dev" })).toBeInTheDocument();
    });
  });

  describe("path highlighting", () => {
    /** How many connectors are lit. */
    function litEdges(container: HTMLElement) {
      return [...container.querySelectorAll('[data-testid="skill-edge"][data-lit="true"]')].length;
    }

    it("lights the path back to the root on hover and clears it on leave", () => {
      const { container } = render(<SkillTree branches={branches} />);
      fireEvent.pointerEnter(node("React"));
      expect(node("React")).toHaveAttribute("data-on-path", "true");
      expect(node("TypeScript")).toHaveAttribute("data-on-path", "true");
      expect(node("Tailwind CSS")).toHaveAttribute("data-on-path", "false");
      expect(litEdges(container)).toBe(2);
      expect(screen.getAllByTestId("skill-root")[0]).toHaveAttribute("data-on-path", "true");
      expect(screen.getAllByTestId("skill-root")[1]).toHaveAttribute("data-on-path", "false");
      fireEvent.pointerLeave(node("React"));
      expect(node("React")).toHaveAttribute("data-on-path", "false");
      expect(litEdges(container)).toBe(0);
    });

    it("lights the same path on keyboard focus", async () => {
      const user = userEvent.setup();
      const { container } = render(<SkillTree branches={branches} />);
      node("TypeScript").focus();
      await user.keyboard("{ArrowDown}");
      expect(node("React")).toHaveFocus();
      expect(node("TypeScript")).toHaveAttribute("data-on-path", "true");
      expect(node("React")).toHaveAttribute("data-selected", "true");
      expect(litEdges(container)).toBe(2);
      expect(screen.getByTestId("skill-path")).toBeInTheDocument();
    });

    it("is one Tab stop with arrow-key roving focus, then Tab reaches the quest link", async () => {
      mockViewport(true);
      const user = userEvent.setup();
      render(<SkillTree branches={branches} />);
      const tabbable = screen.getAllByTestId("skill-node").filter((b) => b.tabIndex === 0);
      expect(tabbable).toEqual([node("TypeScript")]);
      node("TypeScript").focus();
      await user.keyboard("{ArrowRight}");
      expect(node("React")).toHaveFocus();
      expect(node("React")).toHaveAttribute("tabindex", "0");
      expect(node("TypeScript")).toHaveAttribute("tabindex", "-1");
      await user.keyboard("{End}");
      expect(node("LangGraph")).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(node("TypeScript")).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      expect(node("LangGraph")).toHaveFocus();
      await user.keyboard("{Home}{ArrowRight}");
      expect(node("React")).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("link", { name: "Used in 2 quests (React)" })).toHaveFocus();
    });

    it("keeps roving focus inside the open tab on phones", async () => {
      mockViewport(false);
      const user = userEvent.setup();
      render(<SkillTree branches={branches} />);
      node("Tailwind CSS").focus();
      await user.keyboard("{ArrowDown}");
      expect(node("TypeScript")).toHaveFocus();
      await user.click(screen.getAllByRole("tab")[1]);
      expect(node("LLM APIs")).toHaveAttribute("tabindex", "0");
      expect(node("TypeScript")).toHaveAttribute("tabindex", "-1");
    });

    it("powers up the lit path only under motion-safe", () => {
      render(<SkillTree branches={branches} />);
      fireEvent.pointerEnter(node("React"));
      const lit = screen.getByTestId("skill-path");
      // The glow is on a wrapper so the animated filter cannot replace it mid-charge.
      expect(lit.parentElement).toHaveClass("drop-shadow-glow");
      expect(lit).not.toHaveClass("drop-shadow-glow");
      const classes = [...lit.classList];
      expect(classes).toContain("motion-safe:animate-path-charge");
      expect(classes.filter((name) => name.includes("animate"))).toEqual([
        "motion-safe:animate-path-charge",
      ]);
      for (const button of screen.getAllByTestId("skill-node")) {
        for (const name of button.classList) {
          if (/transition|animate/.test(name)) expect(name).toMatch(/^motion-safe:/);
        }
      }
    });
  });

  describe("details panel", () => {
    it("invites a selection, then shows rank, prerequisites and the quest link", async () => {
      const user = userEvent.setup();
      render(<SkillTree branches={branches} />);
      const details = screen.getByTestId("skill-details");
      const status = screen.getByTestId("skill-details-status");
      // Only the quest line is live: the button name already reads name, rank and prerequisites.
      expect(details).not.toHaveAttribute("aria-live");
      expect(details).not.toHaveAttribute("aria-atomic");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toBeEmptyDOMElement();
      expect(details).toHaveTextContent(/focus a skill/);
      expect(node("React")).toHaveAttribute("aria-controls", details.id);

      await user.click(node("React"));
      expect(details).toHaveTextContent(/^React, Mastered, /);
      expect(details).toHaveTextContent("Requires TypeScript");
      expect(status).toHaveTextContent(/^Used in 2 quests$/);
      expect(
        within(details).getByRole("link", { name: "Used in 2 quests (React)" }),
      ).toHaveAttribute("href", "/projects?tech=React");

      await user.click(node("Tailwind CSS"));
      expect(details).toHaveTextContent("Starts the Front end branch");
      expect(status).toHaveTextContent(/^Used in 1 quest$/);
      expect(
        within(details).getByRole("link", { name: "Used in 1 quest (Tailwind CSS)" }),
      ).toHaveAttribute("href", "/projects?tech=Tailwind%20CSS");
    });

    it("shows plain text without a link when no quest uses the skill", async () => {
      const user = userEvent.setup();
      render(<SkillTree branches={branches} />);
      await user.click(node("LangGraph"));
      const details = screen.getByTestId("skill-details");
      expect(details).toHaveTextContent("No quests yet");
      expect(within(details).queryByRole("link")).not.toBeInTheDocument();
    });

    it("keeps the selection when the pointer previews another skill", async () => {
      const user = userEvent.setup();
      render(<SkillTree branches={branches} />);
      await user.click(node("React"));
      fireEvent.pointerEnter(node("Tailwind CSS"));
      expect(node("Tailwind CSS")).toHaveAttribute("data-on-path", "true");
      expect(node("React")).toHaveAttribute("data-on-path", "false");
      expect(screen.getByTestId("skill-details")).toHaveTextContent(/^React/);
      fireEvent.pointerLeave(node("Tailwind CSS"));
      expect(node("React")).toHaveAttribute("data-on-path", "true");
    });

    it("clears the selection when another tab opens", async () => {
      mockViewport(false);
      const user = userEvent.setup();
      render(<SkillTree branches={branches} />);
      await user.click(node("React"));
      await user.click(screen.getAllByRole("tab")[1]);
      expect(screen.getByTestId("skill-details")).toHaveTextContent(/focus a skill/);
    });
  });

  it("labels each branch's node container as a group", () => {
    render(<SkillTree branches={branches} />);
    for (const branch of branches) {
      const group = screen.getByRole("group", { name: `${branch.name} skills` });
      expect(within(group).getAllByTestId("skill-node")).toHaveLength(branch.nodes.length);
    }
  });

  it("has no progress bars or percentages", () => {
    const { container } = render(<SkillTree branches={branches} />);
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/%/);
  });

  it("staggers the pip unlock across the whole tree", () => {
    render(<SkillTree branches={branches} />);
    const firstLit = screen
      .getAllByTestId("skill-node")
      .map((button) => within(button).getAllByTestId("rank-pip")[0].style.animationDelay);
    expect(firstLit).toEqual(["0ms", "35ms", "70ms", "105ms", "140ms"]);
  });
});
