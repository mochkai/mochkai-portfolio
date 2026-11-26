import { describe, expect, it } from "vitest";
import { DATED_AT_FOUR, experienceFixtures, makeExperience } from "../../tests/fixtures";
import { deepFreeze } from "./data/repository";
import {
  DATED_COMPANY_LIMIT,
  getDatedCompanies,
  isDatedExperience,
  toPublicExperience,
} from "./experience";

/** Ids of the entries that kept their dates. */
function datedIds(entries: ReturnType<typeof toPublicExperience>): string[] {
  return entries.filter(isDatedExperience).map((entry) => entry.id);
}

/** Asserts that `entry` has neither date key at all (not even `undefined` or `null`). */
function expectNoDateKeys(entry: object) {
  expect(Object.keys(entry)).not.toContain("startDate");
  expect(Object.keys(entry)).not.toContain("endDate");
  expect(entry).not.toHaveProperty("startDate");
  expect(entry).not.toHaveProperty("endDate");
}

describe("DATED_COMPANY_LIMIT", () => {
  it("is 0, the owner's current setting: no dates anywhere", () => {
    expect(DATED_COMPANY_LIMIT).toBe(0);
  });
});

describe("toPublicExperience with the current setting (limit 0)", () => {
  it("dates no entry and omits both date keys from every entry", () => {
    const result = toPublicExperience(experienceFixtures);
    expect(result).toHaveLength(experienceFixtures.length);
    expect(datedIds(result)).toEqual([]);
    for (const entry of result) expectNoDateKeys(entry);
  });

  it("leaves no date string anywhere in the serialized result", () => {
    const json = JSON.stringify(toPublicExperience(experienceFixtures));
    expect(json).not.toMatch(/startDate|endDate/);
    expect(json).not.toMatch(/\b(19|20)\d{2}\b/);
  });

  it("matches an explicit limit of 0", () => {
    expect(toPublicExperience(experienceFixtures, 0)).toEqual(
      toPublicExperience(experienceFixtures),
    );
  });

  it("still marks an ongoing role as current, without dates", () => {
    const [ongoing, finished] = toPublicExperience(experienceFixtures);
    expect(ongoing.current).toBe(true);
    expect(finished.current).toBe(false);
    expectNoDateKeys(ongoing);
  });

  it("keeps every non-date field", () => {
    const entry = makeExperience();
    expect(toPublicExperience([entry])).toEqual([
      {
        id: entry.id,
        company: entry.company,
        role: entry.role,
        location: entry.location,
        highlights: entry.highlights,
        tech: entry.tech,
        current: true,
      },
    ]);
  });
});

describe("toPublicExperience with a non-zero limit argument", () => {
  it("dates every entry when there are fewer companies than the limit", () => {
    const entries = experienceFixtures.slice(0, 3); // Nova Labs (2 roles), Orbit Systems
    const result = toPublicExperience(entries, 4);
    expect(datedIds(result)).toEqual(entries.map((e) => e.id));
  });

  it("dates every entry when there are exactly as many companies as the limit", () => {
    const entries = experienceFixtures.slice(0, 5); // Nova, Orbit, Pixel, Quanta
    expect(datedIds(toPublicExperience(entries, 4))).toEqual(entries.map((e) => e.id));
  });

  it("dates only the most recent companies when there are more than the limit", () => {
    const result = toPublicExperience(experienceFixtures, 4);
    expect(datedIds(result)).toEqual(DATED_AT_FOUR);
    for (const entry of result.filter((e) => !DATED_AT_FOUR.includes(e.id))) {
      expectNoDateKeys(entry);
    }
  });

  it("counts several roles at one company once and dates all of them", () => {
    // Nova Labs holds the first two roles, so 4 companies reach down to Quanta Data.
    const result = toPublicExperience(experienceFixtures, 4);
    const nova = result.filter((e) => e.company.trim() === "Nova Labs");
    expect(nova.map((e) => e.id)).toEqual(["nova-staff", "nova-senior", "nova-intern"]);
    expect(nova.every(isDatedExperience)).toBe(true);
    expect(getDatedCompanies(experienceFixtures, 4)).toEqual(
      new Set(["Nova Labs", "Orbit Systems", "Pixel Forge", "Quanta Data"]),
    );
  });

  it("dates an older role at a company in the top set (trimmed exact match)", () => {
    const result = toPublicExperience(experienceFixtures, 4);
    const intern = result.find((e) => e.id === "nova-intern");
    expect(intern).toMatchObject({ startDate: "2015-07", endDate: "2015-10" });
    // It sits below Quanta Data but before the first undated entry.
    expect(result.map((e) => e.id).indexOf("nova-intern")).toBeGreaterThan(
      result.map((e) => e.id).indexOf("quanta"),
    );
  });

  it("returns dated entries with their dates unchanged", () => {
    const result = toPublicExperience(experienceFixtures, 4);
    for (const entry of result.filter(isDatedExperience)) {
      const source = experienceFixtures.find((e) => e.id === entry.id);
      expect(entry).toEqual({ ...source, current: source?.endDate === null });
    }
  });

  it("honours other custom limits", () => {
    expect(datedIds(toPublicExperience(experienceFixtures, 1))).toEqual([
      "nova-staff",
      "nova-senior",
      "nova-intern",
    ]);
    expect(datedIds(toPublicExperience(experienceFixtures, 6))).toEqual(
      experienceFixtures.map((e) => e.id),
    );
    expect(datedIds(toPublicExperience(experienceFixtures, 100))).toHaveLength(
      experienceFixtures.length,
    );
  });

  it("keeps the 'current' flag on dated entries too", () => {
    const [ongoing] = toPublicExperience(experienceFixtures, 4);
    expect(ongoing).toMatchObject({ current: true, endDate: null });
  });
});

describe("toPublicExperience input handling", () => {
  it("preserves the input order", () => {
    for (const limit of [0, 4]) {
      expect(toPublicExperience(experienceFixtures, limit).map((e) => e.id)).toEqual(
        experienceFixtures.map((e) => e.id),
      );
    }
  });

  it("does not mutate the input, even when it is deep-frozen", () => {
    const snapshot = structuredClone(experienceFixtures);
    const frozen = deepFreeze(structuredClone(experienceFixtures));
    expect(() => toPublicExperience(frozen, 4)).not.toThrow();
    expect(() => toPublicExperience(frozen, 0)).not.toThrow();
    toPublicExperience(experienceFixtures, 4);
    expect(experienceFixtures).toEqual(snapshot);
  });

  it("returns an empty list for no entries", () => {
    expect(toPublicExperience([])).toEqual([]);
    expect(toPublicExperience([], 4)).toEqual([]);
  });

  it.each([-1, 1.5, Number.NaN])("rejects an invalid limit (%s)", (limit) => {
    expect(() => toPublicExperience(experienceFixtures, limit)).toThrow(RangeError);
  });
});
