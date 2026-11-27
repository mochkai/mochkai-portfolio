"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useMapViewport } from "@/lib/hooks/use-map-viewport";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { useSkillMapLayout } from "@/lib/hooks/use-skill-map-layout";
import { readableScale } from "@/lib/map-view";
import { layoutStore } from "@/lib/skill-map-layout";
import {
  SKILL_MAP_METRICS,
  START_ID,
  focusOrder,
  pathToStart,
  rovingIndex,
  type SkillMapData,
} from "@/lib/skill-tree";
import { SkillDetails, type SkillMapSelection } from "./SkillDetails";
import { SkillMapCanvas } from "./SkillMapCanvas";
import { SkillMapLayoutToggle } from "./SkillMapLayoutToggle";
import { SkillMapZoomControls } from "./SkillMapZoomControls";

/** Props for {@link SkillTree}. */
export interface SkillTreeProps {
  /** The derived map and both layouts, from `buildSkillMap` on the server. */
  data: SkillMapData;
  /** Heading for the start node's details (the owner's name). */
  startTitle: string;
  /** Line under it (the character class). */
  startSubtitle: string;
}

/** The scale at which the smallest (skill) label is readable. */
const READABLE_SCALE = readableScale(SKILL_MAP_METRICS.fontSize.skill);

/** Room kept around a revealed node for its label, in map units. */
const REVEAL_RADIUS = 60;

/**
 * The About page skill map: a game-like map of every skill that the visitor can pan and zoom,
 * in one of two layouts (Constellation, the default, or World tree; the choice is remembered
 * per visitor), with a details panel beside it from 1280 px and below it on narrower screens,
 * so the map gets the full column width wherever space is tight.
 *
 * - The whole map renders on the server (Constellation, fitted); pan, zoom and the stored
 *   layout are client enhancements applied after hydration, so the markup always matches.
 * - Hover previews a node's path back to the start node; a click, tap or focus selects it,
 *   lights the same path and fills the details panel. A drag never selects anything.
 * - The nodes are one Tab stop (roving tabindex): arrow keys, Home and End move between them in
 *   reading order (start, then each hub and its skills), focus pans the node into view, and
 *   +, − and 0 zoom and reset while focus is in the map.
 * - Motion (the path power-up and flowing dash, ring unlock, zoom animations and the drag
 *   glide) runs only when the visitor allows motion.
 *
 * Ids come from `useId`, because Next keeps the previous page mounted during navigation.
 */
export function SkillTree({ data, startTitle, startSubtitle }: SkillTreeProps) {
  const uid = useId();
  const { map, layouts } = data;
  const layoutKind = useSkillMapLayout();
  const layout = layouts[layoutKind];
  const reducedMotion = usePrefersReducedMotion();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const frameRef = useRef<HTMLDivElement>(null);
  const viewport = useMapViewport({
    bounds: layout.bounds,
    start: layout.positions[START_ID],
    readable: READABLE_SCALE,
    viewKey: layoutKind,
    reducedMotion,
  });

  const detailsId = `${uid}-details`;
  const tracedId = hoveredId ?? selectedId;
  const path = useMemo(() => pathToStart(map, tracedId), [map, tracedId]);
  const order = useMemo(() => focusOrder(map), [map]);
  const tabbableId = selectedId ?? START_ID;
  const selection = useMemo(() => selectionFor(data, selectedId), [data, selectedId]);

  /** Selects a node and pans it into view (focus, or a chip in the details panel). */
  const onFocusNode = (id: string) => {
    setSelectedId(id);
    const placement = layout.positions[id];
    if (placement) viewport.reveal(placement, REVEAL_RADIUS);
  };

  /** A press without movement: select the node and move focus to it (which pans it in). */
  const onActivate = (id: string) => {
    setSelectedId(id);
    const element = nodeRefs.current.get(id);
    if (element && element !== document.activeElement) element.focus({ preventScroll: true });
  };

  /**
   * A details chip: select its node, and when the map frame is not fully on screen (phones,
   * where the panel sits below the map) scroll the frame into view so the pan is visible.
   */
  const onNavigate = (id: string) => {
    onActivate(id);
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      frame.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    }
  };

  /** Enter and Space select; arrows, Home and End move focus through the nodes. */
  const onNodeKeyDown = (event: KeyboardEvent<SVGGElement>, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate(id);
      return;
    }
    const next = rovingIndex(event.key, order.indexOf(id), order.length);
    if (next === null) return;
    event.preventDefault();
    nodeRefs.current.get(order[next])?.focus({ preventScroll: true });
  };

  /** Keeps a node's element for roving focus. */
  const registerNode = (id: string, element: SVGGElement | null) => {
    if (element) nodeRefs.current.set(id, element);
    else nodeRefs.current.delete(id);
  };

  return (
    <div
      data-testid="skill-tree"
      className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SkillMapLayoutToggle layout={layoutKind} onChange={layoutStore.set} />
          <div role="group" aria-label="Map view" className="flex flex-wrap gap-2">
            <SkillMapZoomControls onZoomIn={viewport.zoomIn} onZoomOut={viewport.zoomOut} />
            <Button variant="secondary" size="sm" onClick={viewport.fullView}>
              Full view
            </Button>
            <Button variant="secondary" size="sm" onClick={viewport.centre}>
              Centre
            </Button>
          </div>
        </div>
        <SkillMapCanvas
          map={map}
          layout={layout}
          viewport={viewport}
          frameRef={frameRef}
          path={path}
          tracedId={tracedId}
          selectedId={selectedId}
          tabbableId={tabbableId}
          idPrefix={uid}
          detailsId={detailsId}
          onActivate={onActivate}
          onFocusNode={onFocusNode}
          onHover={setHoveredId}
          onNodeKeyDown={onNodeKeyDown}
          registerNode={registerNode}
        />
        <p className="font-mono text-xs text-muted">
          <span className="pointer-coarse:hidden">
            Drag to pan. Ctrl or ⌘ + scroll to zoom. Double-click empty space to recentre.
          </span>
          <span className="hidden pointer-coarse:inline">
            Drag to pan, pinch to zoom, double-tap empty space to recentre.
          </span>
        </p>
      </div>

      <SkillDetails
        id={detailsId}
        selection={selection}
        startTitle={startTitle}
        startSubtitle={startSubtitle}
        onNavigate={onNavigate}
      />
    </div>
  );
}

/**
 * What the details panel shows for a selected node id.
 *
 * @param data - The derived map.
 * @param id - The selected node id, or `null`.
 * @returns The selection, or `null` for nothing (or an unknown id).
 */
function selectionFor({ map }: SkillMapData, id: string | null): SkillMapSelection | null {
  if (id === null) return null;
  if (id === START_ID) return { kind: "start", branches: map.branches };
  const byId = new Map(map.skills.map((skill) => [skill.id, skill]));
  const hub = map.branches.find((branch) => branch.nodeId === id);
  if (hub) {
    return {
      kind: "hub",
      branch: hub,
      skills: hub.skillIds.flatMap((skillId) => byId.get(skillId) ?? []),
    };
  }
  const skill = byId.get(id);
  const branch = skill && map.branches.find((item) => item.id === skill.branchId);
  if (!skill || !branch) return null;
  return {
    kind: "skill",
    skill,
    branch,
    unlocks: skill.unlocks.flatMap((unlockId) => byId.get(unlockId) ?? []),
  };
}
