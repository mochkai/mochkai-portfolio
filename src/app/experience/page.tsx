import type { Metadata } from "next";
import { Collectible } from "@/components/Collectible";
import { PageHeader } from "@/components/PageHeader";
import { QuestChapter } from "@/components/QuestChapter";
import { getRepository } from "@/lib/data";
import { DATED_COMPANY_LIMIT, toPublicExperience } from "@/lib/experience";

export const metadata: Metadata = {
  title: "Experience",
  description: "Where I have worked and what I did there.",
};

/**
 * Work history as a quest log: a glowing rune line with one expandable chapter per role, most
 * recent first and numbered from the newest (`Chapter 01` is the latest role, which starts
 * open). A hidden rune shard waits at the end of the rail. Only redacted entries
 * ({@link toPublicExperience}) are rendered, so dates outside the {@link DATED_COMPANY_LIMIT}
 * never reach the HTML or the RSC payload.
 */
export default async function ExperiencePage() {
  const experience = toPublicExperience(await getRepository().getExperience(), DATED_COMPANY_LIMIT);

  return (
    <>
      <PageHeader title="Experience" label="Quest log">
        <p>Where I have worked and what I did there, most recent first.</p>
      </PageHeader>

      {experience.length === 0 ? (
        <p className="text-muted">No experience entries published yet.</p>
      ) : (
        <>
          {/* The rune line is the list's decorative ::before (a span is not allowed inside
              <ol>): a glowing rail behind the chapter nodes that fades out after the oldest
              role. */}
          <ol
            data-testid="quest-log"
            className="relative max-w-3xl space-y-6 before:pointer-events-none before:absolute before:top-2 before:bottom-0 before:left-[11px] before:w-0.5 before:rounded-full before:bg-linear-to-b before:from-neon before:via-brand/70 before:to-transparent before:shadow-glow-sm before:content-['']"
          >
            {experience.map((entry, index) => (
              <QuestChapter
                key={entry.id}
                entry={entry}
                chapter={index + 1}
                defaultOpen={index === 0}
              />
            ))}
          </ol>
          {/* Hidden rune shard 4, at the end of the rail: its 44 px target is centred on the
              rail line (11 px + 1 px), so it hangs 10 px into main's 16 px side padding. */}
          <div className="mt-4 -ml-2.5 flex">
            <Collectible id="quest-log-end" />
          </div>
        </>
      )}
    </>
  );
}
