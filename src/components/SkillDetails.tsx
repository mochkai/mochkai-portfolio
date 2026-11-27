import Link from "next/link";
import { joinNames, type SkillTreeNode } from "@/lib/skill-tree";
import { questUsageLabel, rankLabel, techFilterHref } from "@/lib/skills";
import { SkillRankPips } from "./SkillRankPips";

/** Props for {@link SkillDetails}. */
export interface SkillDetailsProps {
  /** Element id, referenced by each node's `aria-controls`. */
  id: string;
  /** The selected skill and its branch name, or `null` before anything is selected. */
  selection: { node: SkillTreeNode; branchName: string } | null;
}

/**
 * The skill tree's details panel: the selected skill's name, rank (pips plus label), what it
 * requires and "Used in N quests", which links to `/projects?tech=<name>` when N > 0.
 *
 * The panel itself is not a live region: the focused node's button name already reads the
 * name, rank and prerequisites, so announcing the whole panel too would read every arrow press
 * twice. Only the quest line, the one fact the button name lacks, goes to a small polite live
 * region, which is always rendered so screen readers register it before it changes.
 */
export function SkillDetails({ id, selection }: SkillDetailsProps) {
  return (
    <div
      id={id}
      data-testid="skill-details"
      className="relative mt-5 min-h-24 border-t border-dashed border-neon/20 pt-5"
    >
      {selection === null ? (
        <p className="max-w-prose text-sm text-muted">
          Hover, tap or focus a skill to light its path back to the root and see the quests that use
          it. With a keyboard, the arrow keys move between skills.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight font-semibold text-foreground">
              {selection.node.name}
              <span className="sr-only">, </span>
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
              <SkillRankPips rank={selection.node.rank} />
              <span className="font-mono text-xs">{rankLabel(selection.node.rank)}</span>
              <span className="sr-only">, </span>
              <span aria-hidden="true">·</span>
              <span>
                {selection.node.requiresNames.length > 0
                  ? `Requires ${joinNames(selection.node.requiresNames)}`
                  : `Starts the ${selection.branchName} branch`}
              </span>
            </p>
          </div>
          <p className="shrink-0 text-sm">
            <span className="sr-only">, </span>
            {selection.node.questCount > 0 ? (
              <Link
                href={techFilterHref(selection.node.name)}
                className="text-neon underline-offset-4 hover:underline"
              >
                {/* The skill name tells the links apart for screen readers. */}
                {questUsageLabel(selection.node.questCount)}{" "}
                <span className="sr-only">({selection.node.name})</span>
              </Link>
            ) : (
              <span className="text-muted">{questUsageLabel(selection.node.questCount)}</span>
            )}
          </p>
        </div>
      )}
      <p aria-live="polite" data-testid="skill-details-status" className="sr-only">
        {selection === null ? "" : questUsageLabel(selection.node.questCount)}
      </p>
    </div>
  );
}
