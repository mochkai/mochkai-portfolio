"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Card } from "@/components/ui/Card";
import { cx } from "@/lib/cx";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import {
  SKILL_TREE_METRICS,
  pathToRoot,
  rovingIndex,
  type SkillTreeBranch,
} from "@/lib/skill-tree";
import { SkillDetails } from "./SkillDetails";
import { SKILL_STAGGER_MS, SkillTreeBranchView } from "./SkillTreeBranchView";

/** Props for {@link SkillTree}. */
export interface SkillTreeProps {
  /** The laid-out branches, from `buildSkillTree` on the server. */
  branches: readonly SkillTreeBranch[];
}

/** Tailwind's `md` breakpoint: branches side by side from here, tabs below it. */
const WIDE_QUERY = "(min-width: 48rem)";

/**
 * The About page RPG skill tree: one vertical tree per branch (Front end, Back end, ...), each
 * growing down from a root node, with stepped glowing connectors. The whole tree, connectors
 * included, renders on the server from the precomputed layout; interactivity is an enhancement.
 *
 * - Below `md`, one branch at a time, chosen with an ARIA tablist (arrow keys, Home and End).
 *   From `md`, every branch shows side by side (each column at least as wide as its widest
 *   row), scrolling sideways inside the tree only when the columns cannot fit.
 * - Hovering a skill previews its path back to the root; focus, click or tap selects it, which
 *   lights the same path and fills the details panel (rank, prerequisites, "Used in N quests").
 * - The skills are one Tab stop (roving tabindex): arrow keys, Home and End move between the
 *   skills on screen, and Tab then moves on to the details panel's quest link.
 * - Motion (the path power-up, border and glow transitions) is `motion-safe:` only, so under
 *   reduced motion the highlight still appears, without animation.
 *
 * Ids come from `useId`, because Next keeps the previous page mounted during navigation.
 */
export function SkillTree({ branches }: SkillTreeProps) {
  const uid = useId();
  // Server snapshot is the phone layout, so hydration matches; the visual layout is CSS-only.
  const wide = useMediaQuery(WIDE_QUERY, false);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());

  const tracedId = hoveredId ?? selectedId;
  const detailsId = `${uid}-details`;

  // Skill id -> its node and branch name, for the details panel.
  const lookup = useMemo(
    () =>
      new Map(
        branches.flatMap((branch) =>
          branch.nodes.map((node) => [node.id, { node, branchName: branch.name }] as const),
        ),
      ),
    [branches],
  );
  const selection = selectedId === null ? null : (lookup.get(selectedId) ?? null);

  // Where each branch's pip stagger starts, so the unlock runs across the whole tree.
  const offsets = branches.map(
    (_, index) =>
      branches.slice(0, index).reduce((total, branch) => total + branch.nodes.length, 0) *
      SKILL_STAGGER_MS,
  );

  /** Shows another branch on phones and clears a selection from the previous one. */
  const activate = (index: number) => {
    setActiveTab(index);
    setSelectedId(null);
    setHoveredId(null);
  };

  /** APG tabs keyboard support with automatic activation: arrows wrap, Home and End jump. */
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = rovingIndex(event.key, index, branches.length);
    if (next === null) return;
    event.preventDefault();
    activate(next);
    tabRefs.current[next]?.focus();
  };

  // Skills a keyboard user can reach right now: every branch from `md`, the open tab below it.
  const reachable = wide
    ? branches.flatMap((branch) => branch.nodes.map((node) => node.id))
    : (branches[activeTab]?.nodes.map((node) => node.id) ?? []);
  // The tree is one Tab stop (roving tabindex): the selected skill, else the first reachable.
  const tabbableId =
    selectedId !== null && reachable.includes(selectedId) ? selectedId : (reachable[0] ?? null);

  /** Arrow keys, Home and End move focus (and so the selection) between reachable skills. */
  const onNodeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const next = rovingIndex(event.key, reachable.indexOf(id), reachable.length, "both");
    if (next === null) return;
    event.preventDefault();
    nodeRefs.current.get(reachable[next])?.focus();
  };

  /** Keeps a node's element for roving focus. */
  const registerNode = (id: string, element: HTMLButtonElement | null) => {
    if (element) nodeRefs.current.set(id, element);
    else nodeRefs.current.delete(id);
  };

  const tabId = (index: number) => `${uid}-tab-${index}`;
  const panelId = (index: number) => `${uid}-panel-${index}`;
  const headingId = (index: number) => `${uid}-branch-${index}`;
  const { slotRem } = SKILL_TREE_METRICS;
  // Each column is at least as wide as its widest row and shares spare room by that width.
  const columns = branches
    .map((branch) => `minmax(${branch.slots * slotRem + 1.5}rem, ${branch.slots}fr)`)
    .join(" ");

  return (
    <Card as="div" data-testid="skill-tree" className="px-4 py-5 sm:px-6 sm:py-6">
      <div
        role="tablist"
        aria-label="Skill branches"
        className="relative mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 md:hidden"
      >
        {branches.map((branch, index) => {
          const selected = index === activeTab;
          return (
            <button
              key={branch.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={tabId(index)}
              aria-selected={selected}
              aria-controls={panelId(index)}
              tabIndex={selected ? 0 : -1}
              onClick={() => activate(index)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={cx(
                "min-h-11 rounded-md border px-3 font-mono text-xs tracking-[0.15em] uppercase",
                "motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out",
                selected
                  ? "border-neon bg-neon/15 text-foreground shadow-glow-sm"
                  : "border-neon/30 text-muted hover:border-neon/60 hover:text-foreground",
              )}
            >
              {branch.name}
            </button>
          );
        })}
      </div>

      <div className="relative md:overflow-x-auto" data-testid="skill-tree-scroll">
        <div className="md:grid md:gap-y-0" style={{ gridTemplateColumns: columns }}>
          {branches.map((branch, index) => (
            <SkillTreeBranchView
              key={branch.id}
              branch={branch}
              path={pathToRoot(branch.nodes, tracedId)}
              tracedId={tracedId}
              selectedId={selectedId}
              headingId={headingId(index)}
              detailsId={detailsId}
              unlockOffsetMs={offsets[index]}
              hiddenOnPhone={index !== activeTab}
              panelProps={
                wide
                  ? { id: panelId(index), "aria-labelledby": headingId(index) }
                  : { role: "tabpanel", id: panelId(index), "aria-labelledby": tabId(index) }
              }
              tabbableId={tabbableId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
              onNodeKeyDown={onNodeKeyDown}
              registerNode={registerNode}
            />
          ))}
        </div>
      </div>

      <SkillDetails id={detailsId} selection={selection} />
    </Card>
  );
}
