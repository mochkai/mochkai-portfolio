import { describe, expect, it } from "vitest";
import { makeProject } from "../../tests/fixtures";
import {
  RANK_PIPS,
  countProjectsUsingSkill,
  filterProjectsByTech,
  getSkillUsage,
  parseTechParam,
  projectUsesTech,
  questUsageLabel,
  rankLabel,
  techFilterHref,
} from "./skills";

const projects = [
  makeProject({ slug: "a", tech: ["React", "TypeScript"] }),
  makeProject({ slug: "b", tech: [" react ", "Go"] }),
  makeProject({ slug: "c", tech: ["Next.js"] }),
];

describe("rank helpers", () => {
  it("lights 3, 2 and 1 pips and capitalises the label", () => {
    expect(RANK_PIPS).toEqual({ mastered: 3, proficient: 2, learning: 1 });
    expect(rankLabel("mastered")).toBe("Mastered");
    expect(rankLabel("proficient")).toBe("Proficient");
    expect(rankLabel("learning")).toBe("Learning");
  });
});

describe("projectUsesTech", () => {
  it("matches case-insensitively after trimming", () => {
    expect(projectUsesTech(projects[1], "React")).toBe(true);
    expect(projectUsesTech(projects[0], "  REACT")).toBe(true);
    expect(projectUsesTech(projects[2], "next.JS ")).toBe(true);
  });

  it("does not match partial names or a blank name", () => {
    expect(projectUsesTech(projects[2], "Next")).toBe(false);
    expect(projectUsesTech(projects[0], "")).toBe(false);
    expect(projectUsesTech(projects[0], "   ")).toBe(false);
  });
});

describe("countProjectsUsingSkill", () => {
  it("counts 0, 1 and several projects", () => {
    expect(countProjectsUsingSkill("Rust", projects)).toBe(0);
    expect(countProjectsUsingSkill("Go", projects)).toBe(1);
    expect(countProjectsUsingSkill("react", projects)).toBe(2);
    expect(countProjectsUsingSkill("React", [])).toBe(0);
  });
});

describe("filterProjectsByTech", () => {
  it("keeps the matching projects in order", () => {
    expect(filterProjectsByTech(projects, "React").map((p) => p.slug)).toEqual(["a", "b"]);
    expect(filterProjectsByTech(projects, "Unknown")).toEqual([]);
    expect(filterProjectsByTech(projects, "")).toEqual([]);
  });
});

describe("getSkillUsage", () => {
  it("adds a quest count to every skill without mutating the input", () => {
    const skills = [
      {
        category: "Frontend",
        items: [
          { name: "React", rank: "mastered" as const },
          { name: "Svelte", rank: "learning" as const },
        ],
      },
    ];
    const snapshot = structuredClone(skills);
    expect(getSkillUsage(skills, projects)).toEqual([
      {
        category: "Frontend",
        items: [
          { name: "React", rank: "mastered", questCount: 2 },
          { name: "Svelte", rank: "learning", questCount: 0 },
        ],
      },
    ]);
    expect(skills).toEqual(snapshot);
  });
});

describe("questUsageLabel", () => {
  it("says no quests for 0 and uses the singular for 1", () => {
    expect(questUsageLabel(0)).toBe("No quests yet");
    expect(questUsageLabel(1)).toBe("Used in 1 quest");
    expect(questUsageLabel(4)).toBe("Used in 4 quests");
  });
});

describe("techFilterHref", () => {
  it("URL-encodes the skill name", () => {
    expect(techFilterHref("React")).toBe("/projects?tech=React");
    expect(techFilterHref("Tailwind CSS")).toBe("/projects?tech=Tailwind%20CSS");
    expect(techFilterHref("C#/.NET")).toBe("/projects?tech=C%23%2F.NET");
  });
});

describe("parseTechParam", () => {
  it("is null without the param and takes the first of repeated values", () => {
    expect(parseTechParam(undefined)).toBeNull();
    expect(parseTechParam("React")).toBe("React");
    expect(parseTechParam("")).toBe("");
    expect(parseTechParam(["Go", "React"])).toBe("Go");
    expect(parseTechParam([])).toBeNull();
  });
});
