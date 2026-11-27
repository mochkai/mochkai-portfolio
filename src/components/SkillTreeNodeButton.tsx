import type { CSSProperties, KeyboardEvent } from "react";
import { cx } from "@/lib/cx";
import { SKILL_TREE_METRICS, skillNodeLabel, type SkillTreeNode } from "@/lib/skill-tree";
import { rankLabel } from "@/lib/skills";
import { SkillRankPips } from "./SkillRankPips";

/** Props for {@link SkillTreeNodeButton}. */
export interface SkillTreeNodeButtonProps {
  node: SkillTreeNode;
  /** On the highlighted path back to the root. */
  onPath: boolean;
  /** The skill shown in the details panel. */
  selected: boolean;
  /** Id of the details panel this button updates. */
  detailsId: string;
  /** Base delay for the rank pips' unlock stagger. */
  unlockDelayMs: number;
  /** Selects the skill (focus, click or tap). */
  onSelect: (id: string) => void;
  /** Previews the skill's path while the pointer is over it; `null` when it leaves. */
  onHover: (id: string | null) => void;
  /** In the Tab order (the tree's one roving Tab stop). */
  tabbable: boolean;
  /** Roving-focus keys (arrows, Home, End). */
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, id: string) => void;
  /** Keeps the element for roving focus. */
  registerNode: (id: string, element: HTMLButtonElement | null) => void;
}

/** Node box styles shared by every state; positioning comes from inline styles. */
const BASE =
  "absolute flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 " +
  "text-center motion-safe:transition-[border-color,box-shadow,background-color] " +
  "motion-safe:duration-150 motion-safe:ease-out";

/**
 * One skill in the tree: a button with the name, the rank pips and the rank label, placed from
 * the server-computed layout (no DOM measuring). Hover previews the path back to the root;
 * focus, click or tap select it, which lights the same path and fills the details panel.
 * Screen readers read it as "React, Mastered, requires TypeScript". Only one node is in the Tab
 * order at a time; the tree moves focus between nodes with the arrow keys.
 */
export function SkillTreeNodeButton({
  node,
  onPath,
  selected,
  detailsId,
  unlockDelayMs,
  onSelect,
  onHover,
  tabbable,
  onKeyDown,
  registerNode,
}: SkillTreeNodeButtonProps) {
  const { rowRem, nodeWidthRem, nodeHeightRem } = SKILL_TREE_METRICS;
  const style: CSSProperties = {
    left: `calc(${node.x}% - ${nodeWidthRem / 2}rem)`,
    top: `${node.depth * rowRem}rem`,
    width: `${nodeWidthRem}rem`,
    height: `${nodeHeightRem}rem`,
  };
  return (
    <button
      type="button"
      ref={(element) => registerNode(node.id, element)}
      tabIndex={tabbable ? 0 : -1}
      style={style}
      aria-label={skillNodeLabel(node)}
      aria-controls={detailsId}
      data-testid="skill-node"
      data-skill-id={node.id}
      data-on-path={onPath}
      data-selected={selected}
      onClick={() => onSelect(node.id)}
      onFocus={() => onSelect(node.id)}
      onKeyDown={(event) => onKeyDown(event, node.id)}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
      className={cx(
        BASE,
        // One border/shadow set per state, so no two color utilities compete on order.
        selected
          ? "border-glow bg-accent-soft shadow-glow"
          : onPath
            ? "border-neon bg-accent-soft shadow-glow-sm"
            : "border-neon/40 bg-surface-raised hover:border-neon/70",
      )}
    >
      <span
        data-testid="skill-name"
        className="text-xs leading-4 font-medium break-normal hyphens-none text-foreground"
      >
        {node.name}
      </span>
      <SkillRankPips rank={node.rank} unlockDelayMs={unlockDelayMs} />
      <span className="font-mono text-[0.625rem] leading-3.5 text-muted">
        {rankLabel(node.rank)}
      </span>
    </button>
  );
}
