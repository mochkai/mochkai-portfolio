import type { KeyboardEvent, RefObject } from "react";
import { CARD_SURFACE } from "@/components/ui/Card";
import { cx } from "@/lib/cx";
import type { MapViewport } from "@/lib/hooks/use-map-viewport";
import {
  START_ID,
  hubNodeLabel,
  isLinkOnPath,
  nodeLabelText,
  skillNodeLabel,
  startNodeLabel,
  type SkillMap,
  type SkillMapLayout,
} from "@/lib/skill-tree";
import { SkillMapLabel } from "./SkillMapLabel";
import { SkillMapNode } from "./SkillMapNode";

/** Props for {@link SkillMapCanvas}. */
export interface SkillMapCanvasProps {
  map: SkillMap;
  layout: SkillMapLayout;
  /** Pan and zoom state and handlers, from `useMapViewport`. */
  viewport: MapViewport;
  /** The frame element, so a details chip can scroll the map into view. */
  frameRef: RefObject<HTMLDivElement | null>;
  /** Node ids on the lit path (empty when nothing is traced). */
  path: ReadonlySet<string>;
  /** The node traced right now (hovered or selected); keys the lit overlay so it re-charges. */
  tracedId: string | null;
  selectedId: string | null;
  /** The map's one Tab stop. */
  tabbableId: string;
  /** Prefix for element ids (from `useId`). */
  idPrefix: string;
  /** Id of the details panel the nodes control. */
  detailsId: string;
  onActivate: (id: string) => void;
  onFocusNode: (id: string) => void;
  onHover: (id: string | null) => void;
  onNodeKeyDown: (event: KeyboardEvent<SVGGElement>, id: string) => void;
  registerNode: (id: string, element: SVGGElement | null) => void;
}

/** Delay between consecutive skills in the rank ring unlock stagger. */
export const SKILL_STAGGER_MS = 35;

/**
 * The map frame: a fixed-height panel (about 70 % of the small viewport height on phones,
 * capped on desktop) holding only the SVG map: the zoom buttons live in the toolbar above it,
 * so nothing ever covers a node. The SVG is complete on the server, with a `viewBox` that fits
 * the whole map; panning and zooming only change that
 * `viewBox`. The pan surface has `touch-action: none`, so a finger on the map pans it while a
 * finger anywhere else still scrolls the page.
 *
 * Layers, bottom to top: connectors, the lit path (a neon copy plus a flowing dash under
 * `motion-safe:`), the start node and one group per branch (hub, then skills), then every
 * label, so no disc ever covers a name.
 */
export function SkillMapCanvas({
  map,
  layout,
  viewport,
  frameRef,
  path,
  tracedId,
  selectedId,
  tabbableId,
  idPrefix,
  detailsId,
  onActivate,
  onFocusNode,
  onHover,
  onNodeKeyDown,
  registerNode,
}: SkillMapCanvasProps) {
  const { attachSurface, surfaceProps, dragging, viewBox } = viewport;
  const glowId = `${idPrefix}-glow`;
  const { positions } = layout;
  const litEdges = layout.edges.filter((edge) => isLinkOnPath(edge, path));
  const skillIndex = new Map(map.skills.map((skill, index) => [skill.id, index]));
  const lit = (id: string) => path.has(id) || selectedId === id;
  /** Props every node shares. */
  const common = (id: string) => ({
    id,
    placement: positions[id],
    onPath: path.has(id),
    selected: selectedId === id,
    tabbable: tabbableId === id,
    detailsId,
    glowId,
    onActivate,
    onFocusNode,
    onHover,
    onKeyDown: onNodeKeyDown,
    registerNode,
  });

  return (
    <div
      ref={frameRef}
      data-testid="skill-map-frame"
      className={cx(
        CARD_SURFACE,
        "h-[min(70svh,40rem)] min-h-80 overflow-hidden lg:h-[min(85svh,46rem)]",
        "bg-radial-[at_50%_45%] from-neon/8 to-transparent to-60%",
      )}
    >
      <div
        ref={attachSurface}
        {...surfaceProps}
        data-testid="skill-map-surface"
        data-dragging={dragging}
        className={cx(
          "absolute inset-0 touch-none select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <svg
          role="group"
          aria-label="Skill map"
          data-testid="skill-map"
          data-layout={layout.kind}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="block size-full"
        >
          <defs>
            <radialGradient id={glowId}>
              <stop offset="0" style={{ stopColor: "var(--neon)", stopOpacity: 0.3 }} />
              <stop offset="1" style={{ stopColor: "var(--neon)", stopOpacity: 0 }} />
            </radialGradient>
          </defs>

          <g aria-hidden="true" fill="none" strokeWidth={2} className="stroke-neon/30">
            {layout.edges.map((edge) => (
              <path
                key={`${edge.from}>${edge.to}`}
                d={edge.d}
                vectorEffect="non-scaling-stroke"
                data-testid="skill-edge"
                data-from={edge.from}
                data-to={edge.to}
                data-lit={isLinkOnPath(edge, path)}
              />
            ))}
          </g>

          {litEdges.length > 0 && (
            // The glow sits on a wrapper: the charge animation sets `filter` on the inner group,
            // which would otherwise replace the drop-shadow until the animation ends.
            <g aria-hidden="true" fill="none" className="drop-shadow-glow">
              <g
                key={tracedId ?? "none"}
                data-testid="skill-path"
                className="motion-safe:animate-path-charge"
              >
                {litEdges.map((edge) => (
                  <path
                    key={`${edge.from}>${edge.to}`}
                    d={edge.d}
                    strokeWidth={2.5}
                    vectorEffect="non-scaling-stroke"
                    className="stroke-neon"
                  />
                ))}
                {litEdges.map((edge) => (
                  <path
                    key={`flow-${edge.from}>${edge.to}`}
                    d={edge.d}
                    strokeWidth={2}
                    strokeDasharray="3 14"
                    vectorEffect="non-scaling-stroke"
                    data-testid="skill-flow"
                    className="stroke-foreground opacity-85 motion-safe:animate-skill-flow"
                  />
                ))}
              </g>
            </g>
          )}

          <SkillMapNode
            {...common(START_ID)}
            kind="start"
            accessibleName={startNodeLabel(map.branches.length)}
            labelText={nodeLabelText("start", "")}
            iconName={null}
            unlockDelayMs={0}
          />
          {map.branches.map((branch) => (
            <g
              key={branch.id}
              role="group"
              aria-label={`${branch.name} branch`}
              data-testid="skill-branch"
              data-branch-id={branch.id}
            >
              <SkillMapNode
                {...common(branch.nodeId)}
                kind="hub"
                accessibleName={hubNodeLabel(branch)}
                labelText={branch.name}
                iconName={branch.iconName}
                unlockDelayMs={0}
              />
              {map.skills
                .filter((skill) => skill.branchId === branch.id)
                .map((skill) => (
                  <SkillMapNode
                    key={skill.id}
                    {...common(skill.id)}
                    kind="skill"
                    accessibleName={skillNodeLabel(skill)}
                    labelText={skill.name}
                    iconName={skill.iconName}
                    rank={skill.rank}
                    unlockDelayMs={(skillIndex.get(skill.id) ?? 0) * SKILL_STAGGER_MS}
                  />
                ))}
            </g>
          ))}

          <g aria-hidden="true">
            <SkillMapLabel
              kind="start"
              placement={positions[START_ID]}
              text={nodeLabelText("start", "")}
              lit
            />
            {map.branches.map((branch) => (
              <SkillMapLabel
                key={branch.id}
                kind="hub"
                placement={positions[branch.nodeId]}
                text={branch.name}
                lit
              />
            ))}
            {map.skills.map((skill) => (
              <SkillMapLabel
                key={skill.id}
                kind="skill"
                placement={positions[skill.id]}
                text={skill.name}
                lit={lit(skill.id)}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
