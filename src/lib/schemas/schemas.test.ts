import { describe, expect, it } from "vitest";
import experienceData from "@/data/experience.json";
import profileData from "@/data/profile.json";
import projectsData from "@/data/projects.json";
import { makeExperience, makeProfile, makeProject } from "../../../tests/fixtures";
import {
  experienceListSchema,
  experienceSchema,
  imageSrcSchema,
  profileSchema,
  projectListSchema,
  projectSchema,
  slugSchema,
  yearMonthSchema,
  type Profile,
} from "./index";

describe("yearMonthSchema", () => {
  it.each(["2024-01", "1999-12", "2025-10"])("accepts %s", (value) => {
    expect(yearMonthSchema.safeParse(value).success).toBe(true);
  });

  it.each(["2024-13", "2024-00", "2024-1", "24-01", "2024/01", "2024-01-15", "", "abcd-ef"])(
    "rejects %j",
    (value) => {
      const result = yearMonthSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Expected a month in YYYY-MM format");
    },
  );
});

describe("slugSchema", () => {
  it.each(["a", "project-one", "v2-api", "123"])("accepts %s", (value) => {
    expect(slugSchema.safeParse(value).success).toBe(true);
  });

  it.each(["Project", "with space", "-leading", "trailing-", "double--dash", "under_score", ""])(
    "rejects %j",
    (value) => {
      expect(slugSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("imageSrcSchema", () => {
  it("accepts site-relative paths", () => {
    expect(imageSrcSchema.safeParse("/images/a.svg").success).toBe(true);
  });

  it("rejects remote URLs until next/image remotePatterns are configured", () => {
    expect(imageSrcSchema.safeParse("https://cdn.example.com/a.png").success).toBe(false);
  });

  it("rejects bare relative paths", () => {
    expect(imageSrcSchema.safeParse("images/a.svg").success).toBe(false);
  });
});

describe("bundled content", () => {
  it("passes every schema", () => {
    expect(profileSchema.safeParse(profileData).success).toBe(true);
    expect(projectListSchema.safeParse(projectsData).success).toBe(true);
    expect(experienceListSchema.safeParse(experienceData).success).toBe(true);
  });
});

describe("projectSchema", () => {
  it("parses a valid project, including an ongoing one with no links", () => {
    const project = makeProject({ endDate: null, links: {} });
    expect(projectSchema.parse(project)).toEqual(project);
  });

  it("rejects a missing required field", () => {
    const { title: _title, ...withoutTitle } = makeProject();
    void _title;
    expect(projectSchema.safeParse(withoutTitle).success).toBe(false);
  });

  it("rejects an empty title, an invalid slug and a non-URL link", () => {
    expect(projectSchema.safeParse(makeProject({ title: "" })).success).toBe(false);
    expect(projectSchema.safeParse(makeProject({ slug: "Bad Slug" })).success).toBe(false);
    expect(projectSchema.safeParse(makeProject({ links: { repo: "not a url" } })).success).toBe(
      false,
    );
  });

  it("rejects a malformed start or end date", () => {
    expect(projectSchema.safeParse(makeProject({ startDate: "2024-13" })).success).toBe(false);
    expect(projectSchema.safeParse(makeProject({ endDate: "June 2024" })).success).toBe(false);
  });

  it("rejects an end date that is before the start date", () => {
    const result = projectSchema.safeParse(
      makeProject({ startDate: "2024-06", endDate: "2024-01" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean featured flag", () => {
    expect(projectSchema.safeParse({ ...makeProject(), featured: "true" }).success).toBe(false);
  });
});

describe("projectListSchema", () => {
  it("accepts distinct slugs and an empty list", () => {
    expect(projectListSchema.safeParse([]).success).toBe(true);
    expect(
      projectListSchema.safeParse([makeProject({ slug: "a" }), makeProject({ slug: "b" })]).success,
    ).toBe(true);
  });

  it("rejects duplicate slugs with a clear message", () => {
    const result = projectListSchema.safeParse([
      makeProject({ slug: "same" }),
      makeProject({ slug: "same", title: "Other" }),
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Project slugs must be unique",
    );
  });
});

describe("experienceSchema", () => {
  it("parses a valid current role", () => {
    const entry = makeExperience();
    expect(experienceSchema.parse(entry)).toEqual(entry);
  });

  it("rejects a malformed date and an empty highlight", () => {
    expect(experienceSchema.safeParse(makeExperience({ startDate: "2022-1" })).success).toBe(false);
    expect(experienceSchema.safeParse(makeExperience({ highlights: [""] })).success).toBe(false);
  });

  it("rejects an end date that is before the start date", () => {
    const result = experienceSchema.safeParse(
      makeExperience({ startDate: "2023-05", endDate: "2021-02" }),
    );
    expect(result.success).toBe(false);
  });
});

describe("experienceListSchema", () => {
  it("rejects duplicate ids with a clear message", () => {
    const result = experienceListSchema.safeParse([
      makeExperience({ id: "dup" }),
      makeExperience({ id: "dup", company: "Other" }),
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Experience ids must be unique",
    );
  });
});

describe("profileSchema", () => {
  it("parses a valid profile, with or without an email", () => {
    expect(profileSchema.safeParse(makeProfile()).success).toBe(true);
    const { email: _email, ...withoutEmail } = makeProfile();
    void _email;
    expect(profileSchema.safeParse(withoutEmail).success).toBe(true);
  });

  it("rejects an invalid email, social URL, avatar, empty tree or empty branch", () => {
    expect(profileSchema.safeParse(makeProfile({ email: "nope" })).success).toBe(false);
    expect(
      profileSchema.safeParse(makeProfile({ socials: [{ label: "X", url: "x.com" }] })).success,
    ).toBe(false);
    expect(profileSchema.safeParse(makeProfile({ avatar: "avatar.svg" })).success).toBe(false);
    expect(profileSchema.safeParse(makeProfile({ skillTree: [] })).success).toBe(false);
    expect(
      profileSchema.safeParse(
        makeProfile({ skillTree: [{ id: "empty", name: "Empty", skills: [] }] }),
      ).success,
    ).toBe(false);
  });

  it("accepts the skill tree shape with every rank and optional requires", () => {
    const skillTree = [
      {
        id: "frontend",
        name: "Front end",
        skills: [
          { id: "typescript", name: "TypeScript", rank: "mastered" as const },
          { id: "react", name: "React", rank: "proficient" as const, requires: ["typescript"] },
          { id: "css", name: "CSS", rank: "learning" as const, requires: [] },
        ],
      },
    ];
    expect(profileSchema.parse(makeProfile({ skillTree })).skillTree).toEqual(skillTree);
  });

  it("accepts a known icon override on skills and branches and rejects an unknown one", () => {
    const skillTree = [
      {
        id: "tools",
        name: "Tools",
        icon: "devops" as const,
        skills: [
          { id: "compose", name: "Compose", rank: "proficient" as const, icon: "docker" as const },
        ],
      },
    ];
    expect(profileSchema.parse(makeProfile({ skillTree })).skillTree).toEqual(skillTree);
    // Raw data, as it would come from profile.json (safeParse takes unknown input).
    const result = profileSchema.safeParse({
      ...makeProfile(),
      skillTree: [
        {
          id: "tools",
          name: "Tools",
          skills: [{ id: "x", name: "X", rank: "mastered", icon: "kubernetes" }],
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["skillTree", 0, "skills", 0, "icon"],
      message: expect.stringMatching(/^Unknown icon "kubernetes"\. Use one of: html-css, /),
    });
  });

  it("validates the real profile.json skill tree", () => {
    expect(profileSchema.parse(profileData).skillTree.length).toBeGreaterThan(0);
  });

  it("rejects bad skill fields: unknown rank, blank name, bad id, string skill", () => {
    const withSkills = (skills: unknown[]) =>
      profileSchema.safeParse({
        ...makeProfile(),
        skillTree: [{ id: "frontend", name: "Front end", skills }],
      }).success;
    expect(withSkills([{ id: "react", name: "React", rank: "expert" }])).toBe(false);
    expect(withSkills([{ id: "react", name: "React", rank: "Mastered" }])).toBe(false);
    expect(withSkills([{ id: "react", name: "   ", rank: "mastered" }])).toBe(false);
    expect(withSkills([{ id: "React JS", name: "React", rank: "mastered" }])).toBe(false);
    expect(withSkills([{ name: "React", rank: "mastered" }])).toBe(false);
    expect(withSkills(["React"])).toBe(false);
    expect(withSkills([{ id: "react", name: "React", rank: "mastered" }])).toBe(true);
  });

  it("rejects a blank branch name", () => {
    const result = profileSchema.safeParse(
      makeProfile({
        skillTree: [
          { id: "frontend", name: "  ", skills: [{ id: "a", name: "A", rank: "mastered" }] },
        ],
      }),
    );
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Skill branch name must not be empty",
    );
  });

  it("fails on duplicate ids, unknown or cross-branch requires and cycles", () => {
    const messages = (skillTree: Profile["skillTree"]) =>
      profileSchema.safeParse(makeProfile({ skillTree })).error?.issues.map((i) => i.message) ?? [];
    expect(
      messages([
        { id: "a", name: "A", skills: [{ id: "x", name: "X", rank: "mastered" }] },
        { id: "b", name: "B", skills: [{ id: "x", name: "Y", rank: "mastered" }] },
      ]),
    ).toContain('Duplicate skill id "x"');
    expect(
      messages([
        {
          id: "a",
          name: "A",
          skills: [{ id: "x", name: "X", rank: "mastered", requires: ["nope"] }],
        },
      ]),
    ).toContain('"x" requires unknown skill "nope"');
    expect(
      messages([
        { id: "a", name: "A", skills: [{ id: "x", name: "X", rank: "mastered" }] },
        {
          id: "b",
          name: "B",
          skills: [{ id: "y", name: "Y", rank: "mastered", requires: ["x"] }],
        },
      ]),
    ).toContain('"y" requires "x" from another branch');
    expect(
      messages([
        {
          id: "a",
          name: "A",
          skills: [
            { id: "x", name: "X", rank: "mastered", requires: ["y"] },
            { id: "y", name: "Y", rank: "mastered", requires: ["x"] },
          ],
        },
      ]),
    ).toContain("Cycle in skill tree: x -> y -> x");
  });

  it("rejects duplicate skill names across branches, case-insensitively after trimming", () => {
    const result = profileSchema.safeParse(
      makeProfile({
        skillTree: [
          { id: "a", name: "A", skills: [{ id: "react", name: "React", rank: "mastered" }] },
          { id: "b", name: "B", skills: [{ id: "react-2", name: " react ", rank: "learning" }] },
        ],
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'Duplicate skill name " react "',
    );
  });

  it("parses a profile with or without characterClass and currentlyLearning", () => {
    const full = makeProfile({ currentlyLearning: ["LangGraph", "Rust"] });
    expect(profileSchema.parse(full)).toEqual(full);
    const {
      characterClass: _characterClass,
      currentlyLearning: _currentlyLearning,
      ...withoutStats
    } = makeProfile();
    void _characterClass;
    void _currentlyLearning;
    expect(profileSchema.parse(withoutStats)).toEqual(withoutStats);
    expect(profileSchema.safeParse(makeProfile({ currentlyLearning: [] })).success).toBe(true);
  });

  it("rejects an empty characterClass or an empty currentlyLearning entry", () => {
    expect(profileSchema.safeParse(makeProfile({ characterClass: "" })).success).toBe(false);
    expect(profileSchema.safeParse(makeProfile({ currentlyLearning: [""] })).success).toBe(false);
    expect(
      profileSchema.safeParse(makeProfile({ currentlyLearning: ["LangGraph", ""] })).success,
    ).toBe(false);
  });
});
