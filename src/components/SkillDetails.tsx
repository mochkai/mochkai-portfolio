import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { joinNames, type SkillMapBranch, type SkillMapSkill } from "@/lib/skill-tree";
import { questUsageLabel, rankLabel, techFilterHref } from "@/lib/skills";
import { SkillDetailsChip } from "./SkillDetailsChip";
import { SkillDetailsHeading } from "./SkillDetailsHeading";
import { SkillIcon } from "./SkillIcon";
import { SkillMapLogo } from "./SkillMapLogo";
import { SkillRankPips } from "./SkillRankPips";

/** What the details panel shows: the start node, a hub or a skill. */
export type SkillMapSelection =
  | { kind: "start"; branches: readonly SkillMapBranch[] }
  | { kind: "hub"; branch: SkillMapBranch; skills: readonly SkillMapSkill[] }
  | {
      kind: "skill";
      skill: SkillMapSkill;
      branch: SkillMapBranch;
      /** The skills it unlocks, in data order. */
      unlocks: readonly SkillMapSkill[];
    };

/** Props for {@link SkillDetails}. */
export interface SkillDetailsProps {
  /** Element id, referenced by each node's `aria-controls`. */
  id: string;
  /** The selected node, or `null` before anything is selected. */
  selection: SkillMapSelection | null;
  /** Heading for the start node (the owner's name). */
  startTitle: string;
  /** Line under the start node's heading (the character class). */
  startSubtitle: string;
  /** Selects a node from a chip and pans the map to it. */
  onNavigate: (nodeId: string) => void;
}

/**
 * The skill map's details panel, beside the map on desktop and below it on phones:
 *
 * - a skill: its icon, branch, name, rank (pips plus label), "Builds on ..." (or the first
 *   skill of its branch), "Unlocks ..." chips that select that skill and pan the map to it, and
 *   "Used in N quests", which links to `/projects?tech=<name>` when N > 0;
 * - a hub: the branch's skill count and a chip per skill;
 * - the start node: the owner's name and class and a chip per branch.
 *
 * The panel itself is not a live region: the focused node's name already reads the name, rank
 * and prerequisites. Only a skill's quest line, the one fact the node name lacks, goes to a
 * small polite live region, which is always rendered so screen readers register it before it
 * changes.
 */
export function SkillDetails({
  id,
  selection,
  startTitle,
  startSubtitle,
  onNavigate,
}: SkillDetailsProps) {
  return (
    <Card
      as="div"
      id={id}
      data-testid="skill-details"
      className="flex flex-col gap-4 bg-radial-[at_15%_0%] from-accent-soft to-surface to-70% px-5 py-5 sm:px-6"
    >
      {selection === null && (
        <>
          <p className="font-mono text-xs tracking-[0.2em] text-neon uppercase">Skill details</p>
          <p className="max-w-prose text-sm text-muted">
            Hover, tap or focus a skill to light its path back to the start and see the quests that
            use it. Drag to explore the map. With a keyboard, the arrow keys move between nodes and
            + and − zoom.
          </p>
        </>
      )}

      {selection?.kind === "start" && (
        <>
          <SkillDetailsHeading
            badge={<SkillMapLogo className="size-11" />}
            label="Start node"
            name={startTitle}
          />
          <p className="text-sm text-muted">{startSubtitle}. Every branch starts here.</p>
          <ul aria-label="Branches" className="flex flex-wrap gap-2">
            {selection.branches.map((branch) => (
              <SkillDetailsChip
                key={branch.id}
                nodeId={branch.nodeId}
                name={branch.name}
                icon={<SkillIcon name={branch.iconName} className="size-4 shrink-0" />}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </>
      )}

      {selection?.kind === "hub" && (
        <>
          <SkillDetailsHeading
            badge={<SkillIcon name={selection.branch.iconName} className="size-6" />}
            label="Branch"
            name={selection.branch.name}
          />
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground">
              {selection.skills.length} {selection.skills.length === 1 ? "skill" : "skills"}
            </span>{" "}
            in this branch.
          </p>
          <ul aria-label={`${selection.branch.name} skills`} className="flex flex-wrap gap-2">
            {selection.skills.map((skill) => (
              <SkillDetailsChip
                key={skill.id}
                nodeId={skill.id}
                name={skill.name}
                icon={<SkillIcon name={skill.iconName} className="size-4 shrink-0" />}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </>
      )}

      {selection?.kind === "skill" && (
        <>
          <SkillDetailsHeading
            badge={<SkillIcon name={selection.skill.iconName} className="size-6" />}
            label={selection.branch.name}
            name={selection.skill.name}
          />
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-glow">
            <SkillRankPips rank={selection.skill.rank} />
            <span className="font-mono text-xs">{rankLabel(selection.skill.rank)}</span>
          </p>
          <p className="text-sm text-muted">
            {selection.skill.requiresNames.length > 0 ? (
              <>
                Builds on{" "}
                <span className="font-semibold text-foreground">
                  {joinNames(selection.skill.requiresNames)}
                </span>
              </>
            ) : (
              <>
                First skill in the{" "}
                <span className="font-semibold text-foreground">{selection.branch.name}</span>{" "}
                branch
              </>
            )}
          </p>
          {selection.unlocks.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">Unlocks</p>
              <ul
                aria-label={`Unlocked by ${selection.skill.name}`}
                className="flex flex-wrap gap-2"
              >
                {selection.unlocks.map((skill) => (
                  <SkillDetailsChip
                    key={skill.id}
                    nodeId={skill.id}
                    name={skill.name}
                    icon={<SkillIcon name={skill.iconName} className="size-4 shrink-0" />}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm">
            {selection.skill.questCount > 0 ? (
              <Link
                href={techFilterHref(selection.skill.name)}
                className="text-neon underline-offset-4 hover:underline"
              >
                {/* The skill name tells the links apart for screen readers. */}
                {questUsageLabel(selection.skill.questCount)}{" "}
                <span className="sr-only">({selection.skill.name})</span>
              </Link>
            ) : (
              <span className="text-muted">{questUsageLabel(selection.skill.questCount)}</span>
            )}
          </p>
        </>
      )}

      <p aria-live="polite" data-testid="skill-details-status" className="sr-only">
        {selection?.kind === "skill" ? questUsageLabel(selection.skill.questCount) : ""}
      </p>
    </Card>
  );
}
