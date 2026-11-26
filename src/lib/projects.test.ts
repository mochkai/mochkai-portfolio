import { describe, expect, it } from "vitest";
import { makeProject, projectFixtures } from "../../tests/fixtures";
import { toPublicProject, toPublicProjects } from "./projects";

describe("toPublicProject", () => {
  it("omits startDate and endDate entirely and keeps every other field", () => {
    const project = makeProject({ startDate: "2024-01", endDate: "2024-06" });
    const result = toPublicProject(project);
    expect(Object.keys(result)).not.toContain("startDate");
    expect(Object.keys(result)).not.toContain("endDate");
    expect(result).toEqual({
      slug: project.slug,
      title: project.title,
      summary: project.summary,
      description: project.description,
      tech: project.tech,
      links: project.links,
      featured: project.featured,
      image: project.image,
      status: "complete",
    });
  });

  it("marks an open-ended project as active and a finished one as complete", () => {
    expect(toPublicProject(makeProject({ endDate: null })).status).toBe("active");
    expect(toPublicProject(makeProject({ endDate: "2024-06" })).status).toBe("complete");
  });

  it("leaves no date string anywhere in the serialized result", () => {
    const json = JSON.stringify(
      toPublicProject(makeProject({ startDate: "2021-03", endDate: "2022-11" })),
    );
    expect(json).not.toContain("2021-03");
    expect(json).not.toContain("2022-11");
    expect(json).not.toMatch(/\b(19|20)\d{2}\b/);
  });

  it("does not mutate a frozen input", () => {
    const project = Object.freeze(makeProject());
    expect(() => toPublicProject(project)).not.toThrow();
    expect(project.startDate).toBe("2024-01");
  });
});

describe("toPublicProjects", () => {
  it("redacts every project and keeps the input order", () => {
    const result = toPublicProjects(projectFixtures);
    expect(result.map((p) => p.slug)).toEqual(projectFixtures.map((p) => p.slug));
    for (const project of result) {
      expect(project).not.toHaveProperty("startDate");
      expect(project).not.toHaveProperty("endDate");
    }
  });

  it("returns an empty list for no projects", () => {
    expect(toPublicProjects([])).toEqual([]);
  });
});
