import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { TechList } from "@/components/TechList";
import { getRepository } from "@/lib/data";
import { formatDateRange } from "@/lib/format";

export const metadata: Metadata = {
  title: "Experience",
  description: "Where I have worked and what I did there.",
};

/** Work history as a vertical timeline, most recent role first. */
export default async function ExperiencePage() {
  const experience = await getRepository().getExperience();

  return (
    <>
      <PageHeader title="Experience">
        <p>Where I have worked and what I did there, most recent first.</p>
      </PageHeader>

      {experience.length === 0 ? (
        <p className="text-muted">No experience entries published yet.</p>
      ) : (
        <ol className="relative max-w-3xl border-l border-line">
          {experience.map((entry) => (
            <li key={entry.id} className="relative pb-12 pl-8 last:pb-0">
              {/* Timeline marker sitting on the vertical rule. */}
              <span
                aria-hidden="true"
                className="absolute top-2 -left-[5px] size-[9px] rounded-full bg-accent"
              />
              <p className="font-mono text-xs text-muted">
                {formatDateRange(entry.startDate, entry.endDate)}
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
                {entry.role}, {entry.company}
              </h2>
              <p className="text-sm text-muted">{entry.location}</p>
              {entry.highlights.length > 0 && (
                <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed marker:text-muted">
                  {entry.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              )}
              <div className="mt-4">
                <TechList items={entry.tech} label={`Technologies used at ${entry.company}`} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
