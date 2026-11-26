import { TechList } from "@/components/TechList";
import { CARD_INTERACTIVE, CARD_SURFACE } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { cx } from "@/lib/cx";
import { isDatedExperience, type PublicExperience } from "@/lib/experience";
import { formatDateRange } from "@/lib/format";

/** Props for {@link QuestChapter}. */
export interface QuestChapterProps {
  /** A redacted entry: only {@link PublicExperience} may reach the markup. */
  entry: PublicExperience;
  /** Position counted from the newest role, starting at 1 (`Chapter 01` is the latest role). */
  chapter: number;
  /** Whether the chapter starts expanded (the latest role does). */
  defaultOpen?: boolean;
}

/**
 * Formats a chapter number as a two-digit HUD label, for example `Chapter 03`.
 *
 * @param chapter - Position from the newest role, starting at 1.
 * @returns The label text in normal case (the `Label` uppercases it).
 */
export function chapterLabel(chapter: number): string {
  return `Chapter ${String(chapter).padStart(2, "0")}`;
}

/**
 * One role in the Experience quest log, rendered as a list item on the rune line: a glowing
 * node plus a native `<details>` disclosure (works without JavaScript, toggles with Enter or
 * Space). The `<summary>` shows the chapter label, a "Current" tag for an ongoing role, the
 * role and company, the location and, only for dated entries, the date range. The body holds
 * the highlights and technology tags; it is always in the DOM, so it is searchable and
 * crawlable while collapsed.
 *
 * Opening plays a short fade-and-settle reveal and turns the chevron marker; both are off
 * under reduced motion.
 */
export function QuestChapter({ entry, chapter, defaultOpen = false }: QuestChapterProps) {
  return (
    <li className="relative pl-10 sm:pl-14">
      {/* Node on the rune line: filled and brighter for an ongoing role. */}
      <span
        aria-hidden="true"
        data-testid="chapter-node"
        className={cx(
          "absolute top-6 left-1.5 size-3 rotate-45 border border-neon sm:top-7",
          entry.current ? "bg-neon shadow-glow" : "bg-background shadow-glow-sm",
        )}
      />
      <details
        open={defaultOpen}
        data-testid="quest-chapter"
        className={cx(CARD_SURFACE, CARD_INTERACTIVE, "group")}
      >
        <summary className="relative flex cursor-pointer list-none items-start gap-4 rounded-xl p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Label>{chapterLabel(chapter)}</Label>
              {entry.current && (
                <Label className="rounded-sm border border-neon/40 bg-accent-soft px-2 py-0.5 text-glow">
                  Current
                </Label>
              )}
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-balance">
              {entry.role}, {entry.company}
            </h2>
            <p className="mt-1 text-sm text-muted">{entry.location}</p>
            {isDatedExperience(entry) && (
              <p className="mt-2 font-mono text-xs text-muted">
                {formatDateRange(entry.startDate, entry.endDate)}
              </p>
            )}
          </div>
          {/* Chevron marker: points right when closed, down when open. */}
          <svg
            aria-hidden="true"
            data-testid="chapter-marker"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 size-5 shrink-0 text-neon transition-transform duration-150 ease-out group-open:rotate-90 motion-reduce:transition-none"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </summary>
        <div
          data-testid="chapter-body"
          className="px-5 pb-6 motion-safe:group-open:animate-chapter-reveal sm:px-6"
        >
          <div className="border-t border-dashed border-line pt-5">
            {entry.highlights.length > 0 && (
              <ul className="max-w-prose list-disc space-y-2 pl-5 leading-relaxed marker:text-neon/70">
                {entry.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            )}
            <div className={cx(entry.highlights.length > 0 && "mt-5")}>
              <TechList items={entry.tech} label={`Technologies used at ${entry.company}`} />
            </div>
          </div>
        </div>
      </details>
    </li>
  );
}
