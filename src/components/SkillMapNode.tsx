import type { KeyboardEvent, PointerEvent } from "react";
import { cx } from "@/lib/cx";
import type { SkillRank } from "@/lib/schemas";
import type { SkillIconName } from "@/lib/skill-icons";
import {
  SKILL_MAP_METRICS,
  labelBox,
  type NodePlacement,
  type SkillMapNodeKind,
} from "@/lib/skill-tree";
import { SkillIcon } from "./SkillIcon";
import { SkillMapLogo } from "./SkillMapLogo";
import { SkillRankRing } from "./SkillRankRing";

/** Props for {@link SkillMapNode}. */
export interface SkillMapNodeProps {
  /** Node id: a skill id, a hub id or the start id. */
  id: string;
  kind: SkillMapNodeKind;
  placement: NodePlacement;
  /** Accessible name, for example "React, Mastered, requires TypeScript". */
  accessibleName: string;
  /** Visible label text (drawn in the label layer); sizes the click target under the label. */
  labelText: string;
  iconName: SkillIconName | null;
  /** Skills only: drives the rank ring. */
  rank?: SkillRank;
  /** On the lit path back to the start node. */
  onPath: boolean;
  /** Shown in the details panel. */
  selected: boolean;
  /** The map's one Tab stop (roving tabindex). */
  tabbable: boolean;
  /** Id of the details panel this node updates. */
  detailsId: string;
  /** Id of the shared radial glow gradient for the start node and hubs. */
  glowId: string;
  /** Base delay for the rank ring's unlock stagger. */
  unlockDelayMs: number;
  /** A press without movement (click, tap, Enter or Space). */
  onActivate: (id: string) => void;
  /** The node received focus. */
  onFocusNode: (id: string) => void;
  /** Mouse hover preview; `null` when the pointer leaves. */
  onHover: (id: string | null) => void;
  /** Roving-focus and zoom keys. */
  onKeyDown: (event: KeyboardEvent<SVGGElement>, id: string) => void;
  /** Keeps the element for roving focus. */
  registerNode: (id: string, element: SVGGElement | null) => void;
}

/** Disc classes per kind and state. One stroke and one fill per state, so no two compete. */
function discClasses(kind: SkillMapNodeKind, onPath: boolean, selected: boolean): string {
  if (selected) return "fill-accent-soft stroke-foreground";
  if (kind === "start") return "fill-accent-soft stroke-glow";
  if (kind === "hub" || onPath) return "fill-accent-soft stroke-neon";
  return "fill-surface stroke-neon/40 group-hover:stroke-neon/80";
}

/** Disc stroke width per kind (selected nodes get a heavier rim). */
const DISC_STROKE: Record<SkillMapNodeKind, number> = { start: 2.2, hub: 1.8, skill: 1.5 };

/** Icon size per kind, in map units. */
const ICON_SIZE: Record<Exclude<SkillMapNodeKind, "start">, number> = { hub: 26, skill: 22 };

/**
 * One round node on the skill map: the start node (the owner's logo), a branch hub or a skill
 * (icon plus a rank ring), as an SVG `<g role="button">` placed from the server-computed
 * layout. Its visible name is drawn by the label layer on top of every node, so a neighbour's
 * disc never covers it; a transparent target under the label keeps the name clickable.
 *
 * Focus shows a solid ring (`:focus-visible` only); selection adds a dashed halo. Colour
 * changes transition under `motion-safe:` only.
 */
export function SkillMapNode({
  id,
  kind,
  placement,
  accessibleName,
  labelText,
  iconName,
  rank,
  onPath,
  selected,
  tabbable,
  detailsId,
  glowId,
  unlockDelayMs,
  onActivate,
  onFocusNode,
  onHover,
  onKeyDown,
  registerNode,
}: SkillMapNodeProps) {
  const { radius: radii, ringGap } = SKILL_MAP_METRICS;
  const radius = radii[kind];
  const outer = kind === "skill" ? radius + ringGap : radius;
  // The click target under the label, relative to the node centre: the label only, never a
  // neighbour's disc.
  const label = labelBox(kind, placement, labelText);
  const hit = { ...label, x: label.x - placement.x, y: label.y - placement.y };
  const testId = kind === "skill" ? "skill-node" : kind === "hub" ? "skill-hub" : "skill-start";

  /** Hover previews only for a mouse: a touch "hover" would fight the tap that follows. */
  const hover = (event: PointerEvent<SVGGElement>, value: string | null) => {
    if (event.pointerType === "mouse") onHover(value);
  };

  return (
    <g
      ref={(element) => registerNode(id, element)}
      role="button"
      tabIndex={tabbable ? 0 : -1}
      aria-label={accessibleName}
      aria-controls={detailsId}
      data-testid={testId}
      data-node-id={id}
      data-skill-id={kind === "skill" ? id : undefined}
      data-on-path={onPath}
      data-selected={selected}
      transform={`translate(${placement.x},${placement.y})`}
      className="group cursor-pointer outline-none"
      onClick={() => onActivate(id)}
      onFocus={() => onFocusNode(id)}
      onKeyDown={(event) => onKeyDown(event, id)}
      onPointerEnter={(event) => hover(event, id)}
      onPointerLeave={(event) => hover(event, null)}
    >
      <rect {...hit} fill="transparent" />
      {kind !== "skill" && <circle r={radius * 1.6} fill={`url(#${glowId})`} />}
      <circle
        r={outer + 9}
        fill="none"
        strokeWidth={1.2}
        strokeDasharray="2 5"
        data-testid="node-halo"
        className={cx("stroke-neon", selected ? "opacity-100" : "opacity-0")}
      />
      <circle
        r={outer + 5}
        fill="none"
        strokeWidth={2}
        data-testid="node-focus-ring"
        className="stroke-foreground opacity-0 group-focus-visible:opacity-100"
      />
      <circle
        r={radius}
        strokeWidth={selected ? 2.4 : DISC_STROKE[kind]}
        className={cx(
          "motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out",
          discClasses(kind, onPath, selected),
        )}
      />
      {kind === "skill" && rank && (
        <SkillRankRing rank={rank} radius={outer} unlockDelayMs={unlockDelayMs} />
      )}
      {kind === "start" ? (
        <SkillMapLogo x={-radius} y={-radius} width={radius * 2} height={radius * 2} />
      ) : (
        <SkillIcon
          name={iconName}
          x={-ICON_SIZE[kind] / 2}
          y={-ICON_SIZE[kind] / 2}
          width={ICON_SIZE[kind]}
          height={ICON_SIZE[kind]}
          className={cx(onPath || selected ? "text-foreground" : "text-glow")}
        />
      )}
    </g>
  );
}
