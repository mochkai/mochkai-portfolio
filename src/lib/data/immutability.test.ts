import { describe, expect, it } from "vitest";
import { makeExperience, makeProfile, projectFixtures } from "../../../tests/fixtures";
import { JsonRepository } from "./json-repository";
import { deepFreeze } from "./repository";

describe("deepFreeze", () => {
  it("freezes nested objects and arrays and returns the same value", () => {
    const value = { a: { b: [1, { c: 2 }] } };
    expect(deepFreeze(value)).toBe(value);
    expect(Object.isFrozen(value.a.b)).toBe(true);
    expect(Object.isFrozen(value.a.b[1])).toBe(true);
  });

  it("leaves primitives and null alone", () => {
    expect(deepFreeze(3)).toBe(3);
    expect(deepFreeze(null)).toBeNull();
  });
});

describe("JsonRepository shared data", () => {
  function repository() {
    return new JsonRepository({
      profile: makeProfile(),
      projects: projectFixtures,
      experience: [makeExperience()],
    });
  }

  it("rejects mutation of memoized results, so later calls see the original data", async () => {
    const repo = repository();
    const projects = await repo.getProjects();
    const profile = await repo.getProfile();
    const experience = await repo.getExperience();

    expect(() => projects.pop()).toThrow(TypeError);
    expect(() => {
      projects[0].title = "Changed";
    }).toThrow(TypeError);
    expect(() => projects[0].tech.push("Hacked")).toThrow(TypeError);
    expect(() => {
      profile.socials[0].url = "https://evil.example";
    }).toThrow(TypeError);
    expect(() => experience[0].highlights.push("x")).toThrow(TypeError);

    expect((await repo.getProjects()).length).toBe(projectFixtures.length);
    expect((await repo.getProfile()).socials[0].url).toBe(makeProfile().socials[0].url);
  });

  it("does not freeze the source content it was given", async () => {
    const source = [...projectFixtures.map((p) => ({ ...p, tech: [...p.tech] }))];
    await new JsonRepository({
      profile: makeProfile(),
      projects: source,
      experience: [],
    }).getProjects();
    expect(Object.isFrozen(source[0])).toBe(false);
  });
});
