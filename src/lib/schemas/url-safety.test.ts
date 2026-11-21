import { describe, expect, it } from "vitest";
import { makeExperience, makeProfile, makeProject } from "../../../tests/fixtures";
import {
  END_BEFORE_START_MESSAGE,
  experienceSchema,
  httpUrlSchema,
  imageSrcSchema,
  profileSchema,
  projectSchema,
} from "./index";

const UNSAFE_URLS = [
  "javascript:alert(1)",
  "JAVASCRIPT:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "ftp://files.example.com/a.png",
  "file:///etc/passwd",
  "vbscript:msgbox(1)",
];

describe("httpUrlSchema", () => {
  it.each([
    "https://example.com",
    "http://localhost:4000/path?q=1",
    "https://cdn.example.com/a.png",
  ])("accepts %s", (value) => {
    expect(httpUrlSchema.safeParse(value).success).toBe(true);
  });

  it.each(UNSAFE_URLS)("rejects %s", (value) => {
    const result = httpUrlSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Expected an http or https URL");
  });
});

describe("imageSrcSchema URL safety", () => {
  it.each([...UNSAFE_URLS, "//evil.example/a.png", "/\\evil.example/a.png", "///evil.example"])(
    "rejects %s",
    (value) => {
      expect(imageSrcSchema.safeParse(value).success).toBe(false);
    },
  );

  it("accepts site paths only", () => {
    expect(imageSrcSchema.safeParse("/images/a.svg").success).toBe(true);
    expect(imageSrcSchema.safeParse("/").success).toBe(true);
    expect(imageSrcSchema.safeParse("http://cdn.example.com/a.png").success).toBe(false);
    expect(imageSrcSchema.safeParse("https://cdn.example.com/a.png").success).toBe(false);
  });
});

describe("links and avatars only allow http(s)", () => {
  it.each(UNSAFE_URLS)("rejects project links set to %s", (url) => {
    expect(projectSchema.safeParse(makeProject({ links: { repo: url } })).success).toBe(false);
    expect(projectSchema.safeParse(makeProject({ links: { live: url } })).success).toBe(false);
  });

  it.each(UNSAFE_URLS)("rejects a social link or avatar set to %s", (url) => {
    expect(profileSchema.safeParse(makeProfile({ socials: [{ label: "X", url }] })).success).toBe(
      false,
    );
    expect(profileSchema.safeParse(makeProfile({ avatar: url })).success).toBe(false);
  });

  it("rejects a protocol-relative project image or avatar", () => {
    expect(projectSchema.safeParse(makeProject({ image: "//evil.example/a.png" })).success).toBe(
      false,
    );
    expect(profileSchema.safeParse(makeProfile({ avatar: "//evil.example/a.png" })).success).toBe(
      false,
    );
  });

  it("rejects an email that tries to smuggle a URL scheme", () => {
    expect(profileSchema.safeParse(makeProfile({ email: "javascript:alert(1)" })).success).toBe(
      false,
    );
  });
});

describe("date ranges", () => {
  it.each([
    [
      "project",
      () => projectSchema.safeParse(makeProject({ startDate: "2024-06", endDate: "2024-01" })),
    ],
    [
      "experience",
      () =>
        experienceSchema.safeParse(makeExperience({ startDate: "2023-05", endDate: "2021-02" })),
    ],
  ])("reports an end before start on endDate for a %s", (_name, parse) => {
    const result = parse();
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["endDate"], message: END_BEFORE_START_MESSAGE }),
    ]);
  });

  it("accepts an end in the same month as the start, or an open end", () => {
    expect(
      projectSchema.safeParse(makeProject({ startDate: "2024-06", endDate: "2024-06" })).success,
    ).toBe(true);
    expect(experienceSchema.safeParse(makeExperience({ endDate: null })).success).toBe(true);
  });
});
