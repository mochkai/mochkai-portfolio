import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { toPublicExperience } from "@/lib/experience";
import { makeExperience } from "../../tests/fixtures";
import { QuestChapter, chapterLabel } from "./QuestChapter";

/** Renders one chapter inside the list it belongs to. */
function renderChapter(props: Parameters<typeof QuestChapter>[0]) {
  return render(
    <ol>
      <QuestChapter {...props} />
    </ol>,
  );
}

describe("chapterLabel", () => {
  it("pads the chapter number to two digits", () => {
    expect(chapterLabel(1)).toBe("Chapter 01");
    expect(chapterLabel(12)).toBe("Chapter 12");
  });
});

describe("QuestChapter", () => {
  const finished = makeExperience({ startDate: "2021-04", endDate: "2023-08" });

  it("shows no dates for an undated entry and stays closed by default", () => {
    const [entry] = toPublicExperience([finished], 0);
    renderChapter({ entry, chapter: 3 });
    const details = screen.getByTestId("quest-chapter") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details).toHaveTextContent("Chapter 03");
    expect(details.textContent).not.toMatch(/2021|2023|Apr|Aug|present/i);
    expect(screen.queryByText("Current")).not.toBeInTheDocument();
  });

  it("shows the formatted range for a dated entry", () => {
    const [entry] = toPublicExperience([finished], 1);
    renderChapter({ entry, chapter: 1, defaultOpen: true });
    expect((screen.getByTestId("quest-chapter") as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByText("Apr 2021 – Aug 2023")).toBeInTheDocument();
  });

  it("tags an ongoing role as Current and fills its node, even when undated", () => {
    const [entry] = toPublicExperience([makeExperience({ endDate: null })], 0);
    renderChapter({ entry, chapter: 1 });
    expect(screen.getByText("Current")).toHaveClass("font-mono");
    expect(screen.getByTestId("chapter-node")).toHaveClass("bg-neon");
  });

  it("uses the card surface with the interactive glow on the disclosure", () => {
    const [entry] = toPublicExperience([finished], 0);
    renderChapter({ entry, chapter: 2 });
    expect(screen.getByTestId("quest-chapter")).toHaveClass(
      "bg-surface",
      "border-line",
      "focus-within:shadow-glow",
      "group",
    );
  });
});
