import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/schemas";
import { makeExperience, makeProfile, makeProject } from "../../tests/fixtures";
import {
  countDistinctCompanies,
  countDistinctTechnologies,
  getAboutStats,
  getCharacterClass,
  getCurrentlyLearning,
  getHomeStats,
} from "./stats";

/** A profile without the optional scoreboard fields. */
function bareProfile(): Profile {
  const {
    characterClass: _characterClass,
    currentlyLearning: _currentlyLearning,
    ...profile
  } = makeProfile();
  void _characterClass;
  void _currentlyLearning;
  return profile;
}

describe("countDistinctTechnologies", () => {
  it("is 0 for no projects", () => {
    expect(countDistinctTechnologies([])).toBe(0);
  });

  it("dedupes case-insensitively after trimming, across projects", () => {
    const projects = [
      makeProject({ tech: ["React", "TypeScript"] }),
      makeProject({ tech: ["react", " TypeScript ", "Go"] }),
      makeProject({ tech: ["REACT "] }),
    ];
    expect(countDistinctTechnologies(projects)).toBe(3);
  });
});

describe("countDistinctCompanies", () => {
  it("counts repeated companies once", () => {
    const experience = [
      makeExperience({ id: "a1", company: "Acme" }),
      makeExperience({ id: "a2", company: " acme" }),
      makeExperience({ id: "b", company: "Beta Corp" }),
    ];
    expect(countDistinctCompanies(experience)).toBe(2);
    expect(countDistinctCompanies([])).toBe(0);
  });
});

describe("getCharacterClass", () => {
  it("uses characterClass when set, else the title", () => {
    expect(getCharacterClass(makeProfile({ characterClass: "Backend main" }))).toBe("Backend main");
    expect(getCharacterClass(bareProfile())).toBe("Software Engineer");
  });
});

describe("getCurrentlyLearning", () => {
  it("is null when missing or empty", () => {
    expect(getCurrentlyLearning(bareProfile())).toBeNull();
    expect(getCurrentlyLearning(makeProfile({ currentlyLearning: [] }))).toBeNull();
  });

  it("joins several values with a middle dot", () => {
    expect(getCurrentlyLearning(makeProfile({ currentlyLearning: ["LangGraph"] }))).toBe(
      "LangGraph",
    );
    expect(getCurrentlyLearning(makeProfile({ currentlyLearning: ["LangGraph", "Rust"] }))).toBe(
      "LangGraph · Rust",
    );
  });
});

describe("getHomeStats", () => {
  it("returns the tiles in order with values from the data", () => {
    const stats = getHomeStats({
      profile: makeProfile({ characterClass: "Full-stack", currentlyLearning: ["A", "B"] }),
      projects: [makeProject({ tech: ["React"] }), makeProject({ tech: ["react", "Go"] })],
    });
    expect(stats.map(({ label, value }) => [label, value])).toEqual([
      ["Quests completed", 2],
      ["Skills unlocked", 2],
      ["Class", "Full-stack"],
      ["Currently learning", "A · B"],
    ]);
  });

  it("shows 0 quests and 0 skills for no projects, and hides Currently learning when unset", () => {
    const stats = getHomeStats({ profile: bareProfile(), projects: [] });
    expect(stats.map(({ id, value }) => [id, value])).toEqual([
      ["quests", 0],
      ["skills", 0],
      ["class", "Software Engineer"],
    ]);
  });

  it("never produces a date-derived stat", () => {
    const stats = getHomeStats({ profile: makeProfile(), projects: [makeProject()] });
    for (const stat of stats) {
      expect(stat.label).not.toMatch(/year|since|age|experience/i);
    }
  });
});

describe("getAboutStats", () => {
  it("adds Guilds joined (distinct companies) after Skills unlocked", () => {
    const stats = getAboutStats({
      profile: makeProfile({ characterClass: "Full-stack", currentlyLearning: ["A"] }),
      projects: [makeProject({ tech: ["React"] })],
      experience: [
        makeExperience({ id: "a1", company: "Acme" }),
        makeExperience({ id: "a2", company: "acme " }),
        makeExperience({ id: "b", company: "Beta" }),
      ],
    });
    expect(stats.map(({ label, value }) => [label, value])).toEqual([
      ["Quests completed", 1],
      ["Skills unlocked", 1],
      ["Guilds joined", 2],
      ["Class", "Full-stack"],
      ["Currently learning", "A"],
    ]);
  });

  it("matches the home stats when there is no experience", () => {
    const input = { profile: bareProfile(), projects: [makeProject()] };
    expect(getAboutStats({ ...input, experience: [] })).toEqual(getHomeStats(input));
  });

  it("never produces a date-derived stat", () => {
    const stats = getAboutStats({
      profile: makeProfile(),
      projects: [makeProject()],
      experience: [makeExperience()],
    });
    for (const stat of stats) {
      expect(stat.label).not.toMatch(/year|since|age|experience/i);
    }
  });
});
