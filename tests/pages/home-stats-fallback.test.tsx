import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { makeProfile, makeProject } from "../fixtures";

/** A profile without the optional scoreboard fields. */
const { characterClass: _c, currentlyLearning: _l, ...bareProfile } = makeProfile();
void _c;
void _l;

const projects = [
  makeProject({ slug: "a", title: "A", tech: ["React", " react", "Go"], featured: true }),
  makeProject({ slug: "b", title: "B", tech: ["GO", "Rust"] }),
];

vi.mock("@/lib/data", () => ({
  getRepository: () => ({
    getProfile: async () => bareProfile,
    getProjects: async (options?: { featured?: boolean }) =>
      options?.featured ? projects.filter((p) => p.featured) : projects,
  }),
}));

describe("HomePage scoreboard with a profile lacking the optional fields", () => {
  it("falls back to the title for Class and hides Currently learning", async () => {
    render(await HomePage());
    const grid = screen.getByLabelText("Player stats");
    const terms = within(grid)
      .getAllByRole("term")
      .map((t) => t.textContent);
    const values = within(grid)
      .getAllByRole("definition")
      .map((d) => d.textContent);
    expect(terms).toEqual(["Quests completed", "Skills unlocked", "Class"]);
    // 2 projects (all, not just featured); React/Go/Rust after case-insensitive trimmed dedupe.
    expect(values).toEqual(["2", "3", bareProfile.title]);
  });
});
