import { describe, expect, it } from "vitest";
import projectsData from "@/data/projects.json";
import { makeProject } from "../../../tests/fixtures";
import { isUnknownProjectPath, loadKnownProjectSlugs, projectSlugFromPath } from "./project-slugs";

const known: ReadonlySet<string> = new Set(["project-one", "project-two"]);

describe("loadKnownProjectSlugs", () => {
  it("returns the slugs of the bundled projects by default", () => {
    expect(loadKnownProjectSlugs()).toEqual(new Set(projectsData.map((p) => p.slug)));
  });

  it("reads slugs from a custom source", () => {
    const source = [makeProject({ slug: "alpha" }), makeProject({ slug: "beta" })];
    expect(loadKnownProjectSlugs(source)).toEqual(new Set(["alpha", "beta"]));
  });

  it("returns null when the data fails validation", () => {
    expect(loadKnownProjectSlugs([{ slug: "missing-fields" }])).toBeNull();
    expect(loadKnownProjectSlugs("not a list")).toBeNull();
  });
});

describe("projectSlugFromPath", () => {
  it.each([
    ["/projects/project-one", "project-one"],
    ["/projects/project-one/", "project-one"],
    ["/projects/project%2Done", "project-one"],
    ["/projects/caf%C3%A9", "café"],
  ])("extracts the decoded slug from %s", (path, slug) => {
    expect(projectSlugFromPath(path)).toBe(slug);
  });

  it.each(["/projects", "/projects/", "/projects/a/b", "/about", "/api/projects/project-one"])(
    "ignores %s",
    (path) => {
      expect(projectSlugFromPath(path)).toBeUndefined();
    },
  );

  it("returns null for malformed percent-encoding", () => {
    expect(projectSlugFromPath("/projects/%E0%A4%A")).toBeNull();
  });
});

describe("isUnknownProjectPath", () => {
  it.each(["/projects/project-one", "/projects/project-two/", "/projects/project%2Dtwo"])(
    "lets known slug %s through",
    (path) => {
      expect(isUnknownProjectPath(path, known)).toBe(false);
    },
  );

  it.each([
    "/projects/does-not-exist",
    "/projects/Project-One",
    "/projects/PROJECT-ONE",
    "/projects/project-one%20",
    "/projects/%E0%A4%A",
  ])("flags %s as unknown (exact, case-sensitive match)", (path) => {
    expect(isUnknownProjectPath(path, known)).toBe(true);
  });

  it("ignores paths outside /projects/<slug>", () => {
    expect(isUnknownProjectPath("/projects", known)).toBe(false);
    expect(isUnknownProjectPath("/about", known)).toBe(false);
  });

  it("lets everything through when the slug list is unavailable", () => {
    expect(isUnknownProjectPath("/projects/does-not-exist", null)).toBe(false);
  });
});
