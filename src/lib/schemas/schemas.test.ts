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

  it("rejects an invalid email, social URL, avatar or empty skill group", () => {
    expect(profileSchema.safeParse(makeProfile({ email: "nope" })).success).toBe(false);
    expect(
      profileSchema.safeParse(makeProfile({ socials: [{ label: "X", url: "x.com" }] })).success,
    ).toBe(false);
    expect(profileSchema.safeParse(makeProfile({ avatar: "avatar.svg" })).success).toBe(false);
    expect(
      profileSchema.safeParse(makeProfile({ skills: [{ category: "Empty", items: [] }] })).success,
    ).toBe(false);
  });
});
