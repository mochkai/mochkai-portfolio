import { describe, expect, it } from "vitest";
import { makeExperience, makeProfile, makeProject, projectFixtures } from "../../../tests/fixtures";
import { JsonRepository } from "./json-repository";
import { sortByStartDateDesc } from "./repository";

/** A repository over fixture content, so assertions do not depend on the bundled JSON. */
function fixtureRepository() {
  return new JsonRepository({
    profile: makeProfile(),
    projects: projectFixtures,
    experience: [
      makeExperience({ id: "old", startDate: "2018-01", endDate: "2019-12" }),
      makeExperience({ id: "new", startDate: "2022-03" }),
    ],
  });
}

describe("JsonRepository", () => {
  it("validates the bundled JSON and filters featured projects", async () => {
    const repository = new JsonRepository();
    const all = await repository.getProjects();
    const featured = await repository.getProjects({ featured: true });
    expect(all.length).toBeGreaterThan(0);
    expect(featured.every((project) => project.featured)).toBe(true);
    expect(await repository.getProjectBySlug("does-not-exist")).toBeNull();
  });

  it("returns all projects newest first when no filter is given", async () => {
    const slugs = (await fixtureRepository().getProjects()).map((p) => p.slug);
    expect(slugs).toEqual(["alpha", "gamma", "beta"]);
  });

  it("filters featured projects, keeping newest-first order", async () => {
    const repository = fixtureRepository();
    expect((await repository.getProjects({ featured: true })).map((p) => p.slug)).toEqual([
      "alpha",
      "beta",
    ]);
    expect((await repository.getProjects({ featured: false })).map((p) => p.slug)).toEqual([
      "gamma",
    ]);
  });

  it("treats an explicit undefined featured option as no filter", async () => {
    expect(await fixtureRepository().getProjects({ featured: undefined })).toHaveLength(3);
  });

  it("finds a project by slug", async () => {
    const project = await fixtureRepository().getProjectBySlug("gamma");
    expect(project?.title).toBe("Gamma");
  });

  it("returns null for an unknown or differently-cased slug", async () => {
    const repository = fixtureRepository();
    expect(await repository.getProjectBySlug("missing")).toBeNull();
    expect(await repository.getProjectBySlug("ALPHA")).toBeNull();
    expect(await repository.getProjectBySlug("")).toBeNull();
  });

  it("returns experience most recent first", async () => {
    const ids = (await fixtureRepository().getExperience()).map((e) => e.id);
    expect(ids).toEqual(["new", "old"]);
  });

  it("returns the validated profile", async () => {
    expect(await fixtureRepository().getProfile()).toEqual(makeProfile());
  });

  it("does not mutate the source array when sorting", async () => {
    const source = [...projectFixtures];
    await new JsonRepository({
      profile: makeProfile(),
      projects: source,
      experience: [],
    }).getProjects();
    expect(source.map((p) => p.slug)).toEqual(["beta", "alpha", "gamma"]);
  });

  it("rejects content that does not match the schema", async () => {
    const repository = new JsonRepository({ profile: { name: "" }, projects: [], experience: [] });
    await expect(repository.getProfile()).rejects.toThrow();
  });

  it("surfaces duplicate slugs as a readable validation error", async () => {
    const repository = new JsonRepository({
      profile: makeProfile(),
      projects: [makeProject({ slug: "dup" }), makeProject({ slug: "dup" })],
      experience: [],
    });
    await expect(repository.getProjects()).rejects.toThrow(/Project slugs must be unique/);
    // getProjectBySlug goes through the same validation.
    await expect(repository.getProjectBySlug("dup")).rejects.toThrow(/unique/);
  });

  it("surfaces an invalid field with its path", async () => {
    const repository = new JsonRepository({
      profile: makeProfile(),
      projects: [],
      experience: [makeExperience({ startDate: "2020-13" })],
    });
    await expect(repository.getExperience()).rejects.toThrow(/YYYY-MM/);
  });

  it("validates each collection independently", async () => {
    const repository = new JsonRepository({
      profile: makeProfile(),
      projects: "not an array",
      experience: [],
    });
    await expect(repository.getProfile()).resolves.toBeDefined();
    await expect(repository.getExperience()).resolves.toEqual([]);
    await expect(repository.getProjects()).rejects.toThrow();
  });
});

describe("sortByStartDateDesc", () => {
  it("sorts newest first and leaves the input untouched", () => {
    const input = [{ startDate: "2020-01" }, { startDate: "2024-12" }, { startDate: "2022-06" }];
    expect(sortByStartDateDesc(input).map((i) => i.startDate)).toEqual([
      "2024-12",
      "2022-06",
      "2020-01",
    ]);
    expect(input[0].startDate).toBe("2020-01");
  });
});
