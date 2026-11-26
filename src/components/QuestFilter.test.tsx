import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { toPublicProjects } from "@/lib/projects";
import { makeProject } from "../../tests/fixtures";
import { QuestFilter } from "./QuestFilter";

const projects = toPublicProjects([
  makeProject({ slug: "a", title: "Alpha", tech: ["Next.js", "React"] }),
  makeProject({ slug: "b", title: "Beta", tech: ["Go"] }),
  makeProject({ slug: "c", title: "Gamma", tech: [" next.js "] }),
]);

describe("QuestFilter", () => {
  it("lists the matching projects under a heading spelled as in the data", () => {
    render(<QuestFilter projects={projects} tech="NEXT.JS" />);
    const region = screen.getByRole("region", { name: "Quests using Next.js" });
    expect(
      within(region)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Alpha", "Gamma"]);
    expect(within(region).getByRole("link", { name: "Show all quests" })).toHaveAttribute(
      "href",
      "/projects",
    );
  });

  it("shows the empty state for an unknown or empty value without echoing it", () => {
    const { rerender } = render(<QuestFilter projects={projects} tech="Haskell" />);
    expect(screen.getByRole("heading", { name: "No matching quests" })).toBeVisible();
    expect(screen.getByText("No quests use that technology yet.")).toBeVisible();
    expect(screen.queryByText(/Haskell/)).not.toBeInTheDocument();
    rerender(<QuestFilter projects={projects} tech="" />);
    expect(screen.getByRole("heading", { name: "No matching quests" })).toBeVisible();
    expect(screen.queryAllByTestId("project-card")).toHaveLength(0);
  });
});
