import type { CSSProperties, HTMLAttributes, KeyboardEvent } from "react";
import { cx } from "@/lib/cx";
import {
  SKILL_TREE_METRICS,
  isEdgeOnPath,
  treeHeightRem,
  type SkillTreeBranch,
} from "@/lib/skill-tree";
import { SkillTreeNodeButton } from "./SkillTreeNodeButton";

/** Props for {@link SkillTreeBranchView}. */
export interface SkillTreeBranchViewProps {
  branch: SkillTreeBranch;
  /** Ids on the highlighted path in this branch (empty when nothing is traced here). */
  path: Set<string>;
  /** The skill traced right now (hovered or selected); keys the lit overlay so it re-charges. */
  tracedId: string | null;
  /** The skill in the details panel. */
  selectedId: string | null;
  /** Id of the root heading, for `aria-labelledby` on the wide-screen section. */
  headingId: string;
  /** Id of the shared details panel. */
  detailsId: string;
  /** Delay before this branch's first pip lights up, for the stagger across the tree. */
  unlockOffsetMs: number;
  /** Mobile tab semantics: render as a `tabpanel` labelled by its tab, else a `section`. */
  panelProps: HTMLAttributes<HTMLElement> & { id?: string };
  /** Hidden below `md` (another tab is active); always shown from `md`. */
  hiddenOnPhone: boolean;
  /** The one skill in the tree that is in the Tab order (roving tabindex). */
  tabbableId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  /** Roving-focus key handler for a node. */
  onNodeKeyDown: (event: KeyboardEvent<HTMLButtonElement>, id: string) => void;
  /** Keeps each node element for roving focus. */
  registerNode: (id: string, element: HTMLButtonElement | null) => void;
}

/** Delay between consecutive skills in the pip unlock stagger. */
export const SKILL_STAGGER_MS = 35;

/**
 * One vertical branch: the root at the top, skills below it by depth, joined by stepped SVG
 * connectors whose paths come from the layout. The connectors are drawn under the opaque node
 * boxes, so only the parts between nodes show. Lines on the traced path are drawn again, lit,
 * in an overlay; under `motion-safe:` that overlay powers up briefly (opacity only).
 */
export function SkillTreeBranchView({
  branch,
  path,
  tracedId,
  selectedId,
  headingId,
  detailsId,
  unlockOffsetMs,
  panelProps,
  hiddenOnPhone,
  tabbableId,
  onSelect,
  onHover,
  onNodeKeyDown,
  registerNode,
}: SkillTreeBranchViewProps) {
  const { slotRem, nodeHeightRem, rootMaxWidthRem } = SKILL_TREE_METRICS;
  const rootWidth = Math.min(branch.slots * slotRem - 0.5, rootMaxWidthRem);
  const areaStyle: CSSProperties = {
    height: `${treeHeightRem(branch.rows)}rem`,
    minWidth: `${branch.slots * slotRem}rem`,
  };
  const litEdges = branch.edges.filter((edge) => isEdgeOnPath(edge, path));
  const rootLit = path.size > 0;
  const viewBox = `0 0 100 ${branch.viewBoxHeight}`;

  return (
    <section
      {...panelProps}
      data-testid="skill-branch"
      data-branch-id={branch.id}
      className={cx(
        "min-w-0 md:border-l md:border-dashed md:border-neon/15 md:px-3 md:first:border-l-0",
        hiddenOnPhone && "max-md:hidden",
      )}
    >
      <div
        role="group"
        aria-label={`${branch.name} skills`}
        className="relative mx-auto"
        style={areaStyle}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox={viewBox}
          preserveAspectRatio="none"
          fill="none"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          <g stroke="currentColor" strokeWidth="1.5" className="text-neon/45">
            {branch.edges.map((edge) => (
              <path
                key={`${edge.from ?? "root"}-${edge.to}`}
                d={edge.d}
                vectorEffect="non-scaling-stroke"
                data-testid="skill-edge"
                data-lit={isEdgeOnPath(edge, path)}
              />
            ))}
          </g>
          {litEdges.length > 0 && (
            // The glow sits on a wrapper: the charge animation sets `filter` on the inner group,
            // which would otherwise replace the drop-shadow until the animation ends.
            <g className="drop-shadow-glow">
              <g
                key={tracedId ?? "none"}
                stroke="currentColor"
                strokeWidth="2.5"
                data-testid="skill-path"
                className="text-glow motion-safe:animate-path-charge"
              >
                {litEdges.map((edge) => (
                  <path
                    key={`${edge.from ?? "root"}-${edge.to}`}
                    d={edge.d}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            </g>
          )}
        </svg>

        <div
          data-testid="skill-root"
          data-on-path={rootLit}
          style={{
            left: `calc(50% - ${rootWidth / 2}rem)`,
            width: `${rootWidth}rem`,
            height: `${nodeHeightRem}rem`,
          }}
          className={cx(
            "absolute top-0 flex flex-col items-center justify-center gap-2.5 rounded-lg border px-2 text-center",
            "motion-safe:transition-[border-color,box-shadow] motion-safe:duration-150 motion-safe:ease-out",
            rootLit ? "border-neon bg-accent-soft shadow-glow" : "border-neon/50 bg-accent-soft",
          )}
        >
          <span
            aria-hidden="true"
            className="size-4 rotate-45 border border-glow bg-neon/30 shadow-glow-sm"
          />
          <h3
            id={headingId}
            className="font-mono text-xs leading-4 tracking-[0.2em] text-neon uppercase"
          >
            {branch.name}
          </h3>
        </div>

        {branch.nodes.map((node, index) => (
          <SkillTreeNodeButton
            key={node.id}
            node={node}
            onPath={path.has(node.id)}
            selected={selectedId === node.id}
            detailsId={detailsId}
            unlockDelayMs={unlockOffsetMs + index * SKILL_STAGGER_MS}
            tabbable={tabbableId === node.id}
            onSelect={onSelect}
            onHover={onHover}
            onKeyDown={onNodeKeyDown}
            registerNode={registerNode}
          />
        ))}
      </div>
    </section>
  );
}
