import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Experience } from "@/lib/schemas";
import { formatDateRange, formatMonth } from "@/lib/format";
import { DATED_AT_FOUR, experienceFixtures } from "../fixtures";

/** Every way an entry's dates could show up in markup: raw months, formatted months, the range. */
function dateStrings(entry: Experience): string[] {
  const months = [entry.startDate, entry.endDate].filter((d): d is string => d !== null);
  return [...months, ...months.map(formatMonth), formatDateRange(entry.startDate, entry.endDate)];
}

/** Duration or "earlier experience" wording that must never appear for undated entries. */
const FORBIDDEN_TEXT = [
  /\b\d+\s*(yrs?|years?|mos?|months?)\b/i,
  /\bearlier\b/i,
  /\bprevious(ly)?\b/i,
  /\bsince\b/i,
];

/**
 * Loads the Experience page with the fixture repository and, when given, a different
 * `DATED_COMPANY_LIMIT` (the page passes the constant explicitly, so mocking it takes effect).
 */
async function loadPage({
  entries = experienceFixtures,
  limit,
}: { entries?: Experience[]; limit?: number } = {}) {
  vi.resetModules();
  vi.doMock("@/lib/data", () => ({
    getRepository: () => ({ getExperience: async () => entries }),
  }));
  if (limit !== undefined) {
    vi.doMock("@/lib/experience", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/experience")>()),
      DATED_COMPANY_LIMIT: limit,
    }));
  }
  const { default: ExperiencePage } = await import("@/app/experience/page");
  return ExperiencePage;
}

afterEach(() => {
  vi.doUnmock("@/lib/data");
  vi.doUnmock("@/lib/experience");
});

describe("ExperiencePage quest log", () => {
  it("renders one chapter per role in an ordered list, newest first, numbered from the newest", async () => {
    const ExperiencePage = await loadPage();
    render(await ExperiencePage());
    expect(screen.getByText("Quest log")).toHaveClass("font-mono");
    const log = screen.getByTestId("quest-log");
    expect(log.tagName).toBe("OL");
    const chapters = within(log).getAllByTestId("quest-chapter");
    expect(chapters).toHaveLength(experienceFixtures.length);
    chapters.forEach((chapter, index) => {
      const entry = experienceFixtures[index];
      expect(chapter.tagName).toBe("DETAILS");
      const summary = chapter.querySelector("summary");
      expect(summary).not.toBeNull();
      expect(within(summary as HTMLElement).getByRole("heading", { level: 2 })).toHaveTextContent(
        `${entry.role}, ${entry.company.trim()}`,
      );
      expect(summary).toHaveTextContent(`Chapter ${String(index + 1).padStart(2, "0")}`);
      expect(summary).toHaveTextContent(entry.location);
    });
  });

  it("opens only the latest chapter and keeps every chapter's content in the DOM", async () => {
    const ExperiencePage = await loadPage();
    render(await ExperiencePage());
    const chapters = screen.getAllByTestId("quest-chapter") as HTMLDetailsElement[];
    expect(chapters.map((c) => c.open)).toEqual(chapters.map((_, i) => i === 0));
    for (const entry of experienceFixtures) {
      for (const highlight of entry.highlights) {
        expect(screen.getByText(highlight, { exact: true })).toBeInTheDocument();
      }
    }
    expect(
      screen.getByRole("list", { name: "Technologies used at Summit Apps", hidden: true }),
    ).toBeInTheDocument();
  });

  // jsdom has no keyboard activation for <summary>; Enter/Space is covered in e2e/pages.spec.ts.
  it("toggles a collapsed chapter with a click on its summary", async () => {
    const user = userEvent.setup();
    const ExperiencePage = await loadPage();
    render(await ExperiencePage());
    const second = screen.getAllByTestId("quest-chapter")[1] as HTMLDetailsElement;
    const summary = second.querySelector("summary") as HTMLElement;
    expect(second.open).toBe(false);
    await user.click(summary);
    expect(second.open).toBe(true);
    await user.click(summary);
    expect(second.open).toBe(false);
  });

  it("marks only the ongoing role as Current, without dates", async () => {
    const ExperiencePage = await loadPage();
    render(await ExperiencePage());
    const chapters = screen.getAllByTestId("quest-chapter");
    expect(within(chapters[0]).getByText("Current")).toBeInTheDocument();
    for (const chapter of chapters.slice(1)) {
      expect(within(chapter).queryByText("Current")).not.toBeInTheDocument();
    }
    expect(document.body.textContent).not.toMatch(/active quest|\bpresent\b/i);
  });

  it("turns the reveal animation and the marker rotation transition off under reduced motion", async () => {
    const ExperiencePage = await loadPage();
    render(await ExperiencePage());
    for (const body of screen.getAllByTestId("chapter-body")) {
      // motion-safe: so the reveal only exists without a reduced-motion preference; a plain
      // motion-reduce:animate-none could not override the higher-specificity group-open rule.
      expect(body).toHaveClass("motion-safe:group-open:animate-chapter-reveal");
      expect(body.className).not.toMatch(/(^|\s)group-open:animate-/);
    }
    for (const marker of screen.getAllByTestId("chapter-marker")) {
      expect(marker).toHaveClass("group-open:rotate-90", "motion-reduce:transition-none");
      expect(marker).toHaveAttribute("aria-hidden", "true");
    }
    for (const node of screen.getAllByTestId("chapter-node")) {
      expect(node).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("keeps the empty state", async () => {
    const ExperiencePage = await loadPage({ entries: [] });
    render(await ExperiencePage());
    expect(screen.getByText("No experience entries published yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("quest-log")).not.toBeInTheDocument();
  });
});

describe("ExperiencePage dates with the current setting (DATED_COMPANY_LIMIT = 0)", () => {
  it("renders no date, range or duration for any entry, in text or attributes", async () => {
    const ExperiencePage = await loadPage();
    const html = renderToString(await ExperiencePage());
    const { container } = render(await ExperiencePage());
    const text = container.textContent ?? "";
    for (const entry of experienceFixtures) {
      for (const value of dateStrings(entry)) expect(html).not.toContain(value);
    }
    expect(html).not.toMatch(/\b(19|20)\d{2}-(0[1-9]|1[0-2])\b/);
    expect(html).not.toMatch(/<time|datetime=/i);
    expect(text).not.toMatch(/\b(19|20)\d{2}\b/);
    for (const pattern of FORBIDDEN_TEXT) expect(text).not.toMatch(pattern);
  });
});

describe("ExperiencePage dates with a non-zero limit (4)", () => {
  const dated = experienceFixtures.filter((e) => DATED_AT_FOUR.includes(e.id));
  const undated = experienceFixtures.filter((e) => !DATED_AT_FOUR.includes(e.id));

  it("shows the date range of every entry at the 4 most recent companies", async () => {
    const ExperiencePage = await loadPage({ limit: 4 });
    render(await ExperiencePage());
    const chapters = screen.getAllByTestId("quest-chapter");
    for (const entry of dated) {
      const chapter = chapters[experienceFixtures.indexOf(entry)];
      const summary = chapter.querySelector("summary") as HTMLElement;
      expect(summary).toHaveTextContent(formatDateRange(entry.startDate, entry.endDate));
    }
  });

  it("renders no dates, durations or 'earlier' heading for the older entries", async () => {
    const ExperiencePage = await loadPage({ limit: 4 });
    const html = renderToString(await ExperiencePage());
    const { container } = render(await ExperiencePage());
    const text = container.textContent ?? "";
    expect(undated.length).toBeGreaterThan(0);
    for (const entry of undated) {
      for (const value of dateStrings(entry)) expect(html).not.toContain(value);
      // Still listed, with the same content as the dated chapters.
      expect(
        screen.getByRole("heading", { name: `${entry.role}, ${entry.company.trim()}` }),
      ).toBeVisible();
    }
    for (const pattern of FORBIDDEN_TEXT) expect(text).not.toMatch(pattern);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(experienceFixtures.length);
  });
});
