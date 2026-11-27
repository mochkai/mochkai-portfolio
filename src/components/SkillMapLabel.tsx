import { cx } from "@/lib/cx";
import {
  SKILL_MAP_METRICS,
  labelAnchor,
  type NodePlacement,
  type SkillMapNodeKind,
} from "@/lib/skill-tree";

/** Props for {@link SkillMapLabel}. */
export interface SkillMapLabelProps {
  kind: SkillMapNodeKind;
  placement: NodePlacement;
  text: string;
  /** On the lit path or selected: the label brightens. */
  lit: boolean;
}

/** Type per kind: mono names for skills, display caps for hubs and the start node. */
const KIND_CLASSES: Record<SkillMapNodeKind, string> = {
  skill: "font-mono",
  hub: "font-display font-bold uppercase tracking-[0.12em] fill-foreground",
  start: "font-display font-bold uppercase tracking-[0.16em] fill-glow",
};

/**
 * A node's visible name on the map, always shown at every zoom, on the side the layout chose
 * (below, above or beside the node) so it never covers another node or label. Labels are drawn in their own
 * layer above every node, with a halo in the frame's colour (`paint-order: stroke`) so lines
 * passing underneath never cut through the text. Decorative for assistive technology: each
 * node's accessible name already includes it.
 */
export function SkillMapLabel({ kind, placement, text, lit }: SkillMapLabelProps) {
  const { fontSize } = SKILL_MAP_METRICS;
  const anchor = labelAnchor(kind, placement);
  return (
    <text
      x={anchor.x}
      y={anchor.y}
      fontSize={fontSize[kind]}
      textAnchor={anchor.textAnchor}
      data-label-side={placement.label}
      strokeWidth={4}
      strokeLinejoin="round"
      data-testid={kind === "skill" ? "skill-name" : undefined}
      className={cx(
        "pointer-events-none stroke-surface [paint-order:stroke]",
        KIND_CLASSES[kind],
        kind === "skill" && (lit ? "fill-foreground" : "fill-muted"),
      )}
    >
      {text}
    </text>
  );
}
