import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { questUsageLabel, rankLabel, techFilterHref, type SkillGroupWithUsage } from "@/lib/skills";
import { SkillRankPips } from "./SkillRankPips";

/** Props for {@link SkillTree}. */
export interface SkillTreeProps {
  /** Skill groups with their usage counts, from `getSkillUsage`. */
  groups: readonly SkillGroupWithUsage[];
}

/** Delay between consecutive skills in the unlock stagger, across the whole tree. */
const SKILL_STAGGER_MS = 35;

/**
 * A stable, unique id for a category heading, for `aria-labelledby`. The index keeps it unique
 * even if two categories share a name.
 *
 * @param category - The category name, e.g. "Frontend".
 * @param index - The category's position in the tree.
 * @returns For example `skills-1-frontend`.
 */
function categoryId(category: string, index: number): string {
  return `skills-${index}-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/**
 * The About page skill tree: one panel per category (an `<h3>` with a list of skills), each skill
 * on a branch of a dashed rune line. Each panel is a size container, so every skill in a panel
 * gets the same layout: in a narrow panel (under 20rem) the pips and rank label sit on their own
 * line under the name, left-aligned; in a wider panel the row is a grid with the name in a
 * flexible column and a fixed-width rank column on the right. Names wrap only between words. The
 * quest usage always spans the line below. A skill shows its name, its rank as 3 pips plus a text label
 * ("Mastered", "Proficient", "Learning"), and "Used in N quests", which links to
 * `/projects?tech=<name>` when N > 0 and is plain text ("No quests yet") otherwise.
 *
 * Screen readers read each skill as "React, Mastered, Used in 2 quests"; the pips are hidden from
 * them. There are no percentage bars, numeric levels or years-per-skill (DESIGN.md).
 */
export function SkillTree({ groups }: SkillTreeProps) {
  // Position of each group's first skill in the whole tree, for the unlock stagger.
  const offsets = groups.map((_, index) =>
    groups.slice(0, index).reduce((total, group) => total + group.items.length, 0),
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map((group, groupIndex) => {
        const headingId = categoryId(group.category, groupIndex);
        return (
          <Card
            key={headingId}
            as="section"
            aria-labelledby={headingId}
            data-testid="skill-category"
            className="@container px-5 py-5 sm:px-6 sm:py-6"
          >
            <Label as="h3" id={headingId} rune>
              {group.category}
            </Label>
            <ul className="relative mt-3 ml-0.5 border-l border-dashed border-neon/30">
              {group.items.map((skill, itemIndex) => {
                const delay = (offsets[groupIndex] + itemIndex) * SKILL_STAGGER_MS;
                return (
                  <li
                    key={skill.name}
                    data-testid="skill"
                    className="relative grid grid-cols-1 items-center gap-x-4 gap-y-1 py-3 pl-5 before:absolute before:top-6 before:left-0 before:h-px before:w-3 before:bg-neon/30 before:content-[''] @xs:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <span data-testid="skill-name" className="min-w-0 font-medium text-foreground">
                      {skill.name}
                      <span className="sr-only">, </span>
                    </span>
                    {/* Narrow panel: own line, left. Wide panel: fixed-width column on the right. */}
                    <span className="inline-flex items-center gap-2.5 justify-self-start @xs:justify-self-end">
                      <SkillRankPips rank={skill.rank} unlockDelayMs={delay} />
                      <span className="w-[10ch] font-mono text-xs text-muted">
                        {rankLabel(skill.rank)}
                      </span>
                    </span>
                    <span className="col-span-full text-sm">
                      <span className="sr-only">, </span>
                      {skill.questCount > 0 ? (
                        <Link
                          href={techFilterHref(skill.name)}
                          className="text-neon underline-offset-4 hover:underline"
                        >
                          {/* The skill name tells the links apart for screen readers. */}
                          {questUsageLabel(skill.questCount)}{" "}
                          <span className="sr-only">({skill.name})</span>
                        </Link>
                      ) : (
                        <span className="text-muted">{questUsageLabel(skill.questCount)}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
