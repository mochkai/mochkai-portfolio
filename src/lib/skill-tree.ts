import { toNameKey } from "@/lib/names";
import type { Project, SkillRank } from "@/lib/schemas";
import { resolveSkillIconName, type SkillIconName } from "@/lib/skill-icons";
import { countProjectsUsingSkill, rankLabel } from "@/lib/skills";

/*
 * The About page skill map: validation, depth derivation, the two layouts (Constellation and
 * World tree) and the path helpers the client component uses for highlighting. Everything here
 * is pure and has no React or DOM dependency, so the server computes both layouts (node
 * positions, connector paths and the bounding box) and the page renders the whole map without
 * measuring anything.
 *
 * The input types are structural (not the zod-inferred ones) so the profile schema can call
 * {@link findSkillTreeIssues} without an import cycle.
 */

/** One skill as written in `profile.json`, before layout. */
export interface SkillTreeSkillInput {
  /** Stable slug, unique across the whole tree, e.g. `nextjs`. */
  id: string;
  /** Display name; also the `/projects?tech=` filter. */
  name: string;
  rank: SkillRank;
  /** Ids of prerequisite skills in the same branch. Missing or empty: hangs off the hub. */
  requires?: readonly string[];
  /** Icon name (a key of `SKILL_ICONS`); defaults to the icon keyed by the skill id. */
  icon?: string;
}

/** One branch as written in `profile.json`, before layout. */
export interface SkillTreeBranchInput {
  id: string;
  name: string;
  /** Icon name for the hub; defaults to the icon keyed by the branch id. */
  icon?: string;
  skills: readonly SkillTreeSkillInput[];
}

/** A validation problem: a message and the path inside the `skillTree` array. */
export interface SkillTreeIssue {
  message: string;
  path: (string | number)[];
}

/** Node id of the start node. Skill and branch ids are slugs, so `@` never collides. */
export const START_ID = "@start";

/**
 * The node id of a branch's hub.
 *
 * @param branchId - The branch id from the data.
 * @returns `@hub-<branchId>`, which can never collide with a skill id (slugs have no `@`).
 */
export function hubNodeId(branchId: string): string {
  return `@hub-${branchId}`;
}

/** The three kinds of node on the map. */
export type SkillMapNodeKind = "start" | "hub" | "skill";

/** A skill after derivation, with everything the map and the details panel need. */
export interface SkillMapSkill {
  id: string;
  name: string;
  rank: SkillRank;
  branchId: string;
  /** Resolved icon, or `null` for the neutral fallback glyph. */
  iconName: SkillIconName | null;
  /** Prerequisite ids (empty for skills that hang off the hub). */
  requires: string[];
  /** Prerequisite names in `requires` order, for the accessible name and the details panel. */
  requiresNames: string[];
  /** Ids of the skills that require this one ("Unlocks ..."), in data order. */
  unlocks: string[];
  /** Longest prerequisite chain: 1 for a skill on the hub, 2 for one that requires it, ... */
  depth: number;
  /** Position across the branch's row, from 0 to 1 (0.5 is the branch's centre line). */
  offset: number;
  /** Projects whose `tech` lists the skill name ("Used in N quests"). */
  questCount: number;
}

/** A branch after derivation: its hub and the ids of its skills. */
export interface SkillMapBranch {
  id: string;
  name: string;
  /** The hub's node id ({@link hubNodeId}). */
  nodeId: string;
  iconName: SkillIconName | null;
  /** Skill ids in data order. */
  skillIds: string[];
  /** Skills in the widest row (at least 1). */
  slots: number;
  /** Deepest skill depth. */
  depth: number;
}

/** The derived map: branches and skills, without positions. */
export interface SkillMap {
  branches: SkillMapBranch[];
  skills: SkillMapSkill[];
}

/** One connector, between two node ids. */
export interface SkillMapLink {
  from: string;
  to: string;
}

/** The two layouts a visitor can switch between. */
export const SKILL_MAP_LAYOUTS = ["constellation", "tree"] as const;

/** `constellation` (radial, the default) or `tree` (top-down World tree). */
export type SkillMapLayoutKind = (typeof SKILL_MAP_LAYOUTS)[number];

/** An axis-aligned box in map units. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Which side of its node a label sits on. */
export type LabelSide = "below" | "above" | "right" | "left";

/** Every label side, in the default order of preference. */
export const LABEL_SIDES: readonly LabelSide[] = ["below", "above", "right", "left"];

/** Where a node sits, in map units, and which side its label goes on. */
export interface NodePlacement {
  x: number;
  y: number;
  /** The side chosen by {@link placeLabels} so the label clears every node and label. */
  label: LabelSide;
}

/** Where to draw a label: its anchor point (baseline) and SVG `text-anchor`. */
export interface LabelAnchor {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
}

/** A connector with its SVG path data. */
export interface SkillMapEdge extends SkillMapLink {
  d: string;
}

/** A complete layout: positions, connector paths and the box that fits every node and label. */
export interface SkillMapLayout {
  kind: SkillMapLayoutKind;
  /** Node id -> placement, for the start node, every hub and every skill. */
  positions: Record<string, NodePlacement>;
  edges: SkillMapEdge[];
  /** Fits every node, ring and label, plus {@link SKILL_MAP_METRICS}`.padding`. */
  bounds: Box;
}

/**
 * Sizes shared by the layout maths and the rendered SVG, in map units (1 unit is 1 CSS px at
 * zoom 1). Labels are part of the bounding box, so the fitted view never clips a name.
 */
export const SKILL_MAP_METRICS = {
  /** Disc radius per node kind. */
  radius: { start: 40, hub: 30, skill: 23 },
  /** Gap between a skill's disc and its rank ring. */
  ringGap: 5,
  /** Label font size per node kind. */
  fontSize: { start: 15, hub: 14, skill: 13 },
  /** Gap between a node's outer edge (ring for skills) and its label's nearest edge. */
  labelGap: 6,
  /** Approximate advance per character as a share of the font size (mono, and display caps). */
  charWidth: { start: 0.78, hub: 0.74, skill: 0.62 },
  /** Space around everything in the fitted box. */
  padding: 16,
} as const;

/** The approved Constellation constants (prototype for #29). */
export const CONSTELLATION = {
  /** Distance from the start node to each hub. */
  hubRadius: 130,
  /** Distance between consecutive skill rings. */
  step: 94,
  /** Widest angle a branch may fan out over, in degrees. */
  wedgeDeg: 84,
  /** Angle of the first hub (top left); the others follow clockwise at equal spacing. */
  firstHubDeg: -135,
} as const;

/** The approved World tree constants (desktop values from the prototype). */
export const WORLD_TREE = {
  /** Horizontal room per skill in a branch's widest row. */
  slot: 120,
  /** Distance between skill rows. */
  row: 92,
  /** Distance from the start node down to the hub row. */
  hubY: 130,
} as const;

/**
 * Finds every problem that makes a skill tree unusable: duplicate branch or skill ids,
 * duplicate skill names (each name is also a `/projects?tech=` filter), a `requires` that
 * repeats an id, names itself, points to an unknown id or to a skill in another branch, and
 * cycles. The profile schema reports these as zod issues, so bad data fails the build.
 *
 * @param tree - The raw branches (already shape-checked).
 * @returns The issues found, in data order; empty when the tree is valid.
 */
export function findSkillTreeIssues(tree: readonly SkillTreeBranchInput[]): SkillTreeIssue[] {
  const issues: SkillTreeIssue[] = [];
  const branchIds = new Set<string>();
  // Skill id -> index of the branch that owns it (first occurrence wins).
  const owner = new Map<string, number>();
  const names = new Set<string>();

  tree.forEach((branch, branchIndex) => {
    if (branchIds.has(branch.id)) {
      issues.push({ message: `Duplicate branch id "${branch.id}"`, path: [branchIndex, "id"] });
    }
    branchIds.add(branch.id);
    branch.skills.forEach((skill, skillIndex) => {
      if (owner.has(skill.id)) {
        issues.push({
          message: `Duplicate skill id "${skill.id}"`,
          path: [branchIndex, "skills", skillIndex, "id"],
        });
      } else {
        owner.set(skill.id, branchIndex);
      }
      const key = toNameKey(skill.name);
      if (names.has(key)) {
        issues.push({
          message: `Duplicate skill name "${skill.name}"`,
          path: [branchIndex, "skills", skillIndex, "name"],
        });
      }
      names.add(key);
    });
  });

  tree.forEach((branch, branchIndex) => {
    branch.skills.forEach((skill, skillIndex) => {
      const seen = new Set<string>();
      (skill.requires ?? []).forEach((required, requireIndex) => {
        const path = [branchIndex, "skills", skillIndex, "requires", requireIndex];
        if (seen.has(required)) {
          issues.push({ message: `"${skill.id}" requires "${required}" twice`, path });
        } else if (required === skill.id) {
          issues.push({ message: `"${skill.id}" requires itself`, path });
        } else if (!owner.has(required)) {
          issues.push({ message: `"${skill.id}" requires unknown skill "${required}"`, path });
        } else if (owner.get(required) !== branchIndex) {
          issues.push({
            message: `"${skill.id}" requires "${required}" from another branch`,
            path,
          });
        }
        seen.add(required);
      });
    });
    const cycle = findCycle(branch.skills);
    if (cycle) {
      issues.push({
        message: `Cycle in skill tree: ${cycle.join(" -> ")}`,
        path: [branchIndex, "skills"],
      });
    }
  });
  return issues;
}

/**
 * Finds one cycle among a branch's skills, following only `requires` that point to another
 * skill of the same list (unknown, cross-branch and self references are reported separately).
 *
 * @param skills - The branch's skills.
 * @returns The cycle as ids, closing on its first id (`a -> b -> a`), or `null` when acyclic.
 */
export function findCycle(skills: readonly SkillTreeSkillInput[]): string[] | null {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  // 1 = on the current DFS stack, 2 = fully explored.
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];

  /** Depth-first search from `id`; returns a cycle when it reaches a node still on the stack. */
  const visit = (id: string): string[] | null => {
    state.set(id, 1);
    stack.push(id);
    for (const required of byId.get(id)?.requires ?? []) {
      if (required === id || !byId.has(required)) continue;
      const mark = state.get(required);
      if (mark === 1) return [...stack.slice(stack.indexOf(required)), required];
      if (mark === undefined) {
        const found = visit(required);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };

  for (const skill of skills) {
    if (state.has(skill.id)) continue;
    const found = visit(skill.id);
    if (found) return found;
  }
  return null;
}

/**
 * Each skill's depth: its longest prerequisite chain. A skill with no `requires` hangs off the
 * hub at depth 1; otherwise its depth is one more than its deepest prerequisite. Expects a
 * validated (acyclic, same-branch) list.
 *
 * @param skills - One branch's skills.
 * @returns Skill id -> depth.
 */
export function computeDepths(skills: readonly SkillTreeSkillInput[]): Map<string, number> {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const depths = new Map<string, number>();

  /** Memoised longest-chain depth for one skill. */
  const depthOf = (id: string): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    const requires = byId.get(id)?.requires ?? [];
    const depth = 1 + Math.max(0, ...requires.map(depthOf));
    depths.set(id, depth);
    return depth;
  };

  for (const skill of skills) depthOf(skill.id);
  return depths;
}

/**
 * Where each skill sits across its branch, from 0 to 1, row by row (the prototype's rule). A
 * row with one skill sits under the mean of its prerequisites (the centre, 0.5, on the hub).
 * A wider row is ordered by that same mean (skills on the hub keep their data order, spread
 * evenly) and then spaced evenly, `(i + 0.5) / n`, so the lines cross as little as possible.
 *
 * @param skills - One validated branch's skills.
 * @param depths - From {@link computeDepths}.
 * @returns Skill id -> offset in `[0, 1]`.
 */
export function computeOffsets(
  skills: readonly SkillTreeSkillInput[],
  depths: ReadonlyMap<string, number>,
): Map<string, number> {
  const rows = new Map<number, SkillTreeSkillInput[]>();
  for (const skill of skills) {
    const depth = depths.get(skill.id) ?? 1;
    rows.set(depth, [...(rows.get(depth) ?? []), skill]);
  }
  const offsets = new Map<string, number>();
  for (const depth of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(depth) ?? [];
    // The mean offset of each skill's prerequisites, or null for a skill on the hub.
    const wanted = row.map((skill, index) => {
      const requires = skill.requires ?? [];
      const mean =
        requires.length === 0
          ? null
          : requires.reduce((sum, id) => sum + (offsets.get(id) ?? 0.5), 0) / requires.length;
      return { skill, index, mean };
    });
    if (wanted.length === 1) {
      offsets.set(wanted[0].skill.id, wanted[0].mean ?? 0.5);
      continue;
    }
    const keyed = wanted.map((item) => ({
      ...item,
      key: item.mean ?? (item.index + 0.5) / wanted.length,
    }));
    // Stable sort: ties keep the data order.
    keyed.sort((a, b) => a.key - b.key);
    keyed.forEach((item, index) => offsets.set(item.skill.id, (index + 0.5) / keyed.length));
  }
  return offsets;
}

/**
 * Derives the map from the validated tree: depths, offsets, icons, "Unlocks" and quest counts.
 *
 * @param tree - The validated `profile.skillTree`.
 * @param questCount - "Used in N quests" for a skill name.
 * @returns The branches and skills, in data order. The input is not mutated.
 */
export function deriveSkillMap(
  tree: readonly SkillTreeBranchInput[],
  questCount: (name: string) => number = () => 0,
): SkillMap {
  const branches: SkillMapBranch[] = [];
  const skills: SkillMapSkill[] = [];
  for (const branch of tree) {
    const depths = computeDepths(branch.skills);
    const offsets = computeOffsets(branch.skills, depths);
    const names = new Map(branch.skills.map((skill) => [skill.id, skill.name]));
    const rowSizes = new Map<number, number>();
    for (const depth of depths.values()) rowSizes.set(depth, (rowSizes.get(depth) ?? 0) + 1);
    branches.push({
      id: branch.id,
      name: branch.name,
      nodeId: hubNodeId(branch.id),
      iconName: resolveSkillIconName(branch.id, branch.icon),
      skillIds: branch.skills.map((skill) => skill.id),
      slots: Math.max(1, ...rowSizes.values()),
      depth: Math.max(0, ...depths.values()),
    });
    for (const skill of branch.skills) {
      const requires = [...(skill.requires ?? [])];
      skills.push({
        id: skill.id,
        name: skill.name,
        rank: skill.rank,
        branchId: branch.id,
        iconName: resolveSkillIconName(skill.id, skill.icon),
        requires,
        requiresNames: requires.map((id) => names.get(id) ?? id),
        unlocks: branch.skills
          .filter((other) => other.requires?.includes(skill.id))
          .map((other) => other.id),
        depth: depths.get(skill.id) ?? 1,
        offset: offsets.get(skill.id) ?? 0.5,
        questCount: questCount(skill.name),
      });
    }
  }
  return { branches, skills };
}

/**
 * Every connector on the map: the start node to each hub, each hub to the skills that hang off
 * it, and each prerequisite to the skills that require it.
 *
 * @param map - The derived map.
 * @returns The links, hubs first, then skills in data order.
 */
export function skillMapLinks(map: SkillMap): SkillMapLink[] {
  const links: SkillMapLink[] = map.branches.map((branch) => ({
    from: START_ID,
    to: branch.nodeId,
  }));
  for (const skill of map.skills) {
    if (skill.requires.length === 0) links.push({ from: hubNodeId(skill.branchId), to: skill.id });
    for (const id of skill.requires) links.push({ from: id, to: skill.id });
  }
  return links;
}

/** Rounds to 0.1 units so path data and positions stay short and stable. */
function round(value: number): number {
  // `+ 0` turns -0 into 0, so the server markup never shows "-0".
  return Math.round(value * 10) / 10 + 0;
}

/** Degrees to radians. */
function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * The Constellation connector from a parent to a child: out along the parent's ray to a ring
 * halfway to the next step, around that ring to the child's angle, then out to the child. A
 * link from the start node is a straight spoke. When the child is more than one ring further
 * out (its depth comes from a longer chain through another prerequisite), the last leg runs
 * straight out through the rings in between; it never turns again on a later ring.
 *
 * @param from - Parent position in polar form (`r` from the start node, angle `a` in radians).
 * @param to - Child position in polar form.
 * @returns SVG path data.
 */
export function radialEdgePath(
  from: { r: number; a: number },
  to: { r: number; a: number },
): string {
  const point = (r: number, a: number) => `${round(r * Math.cos(a))},${round(r * Math.sin(a))}`;
  if (from.r === 0) return `M0,0L${point(to.r, to.a)}`;
  const ring = from.r + CONSTELLATION.step / 2;
  // Same angle: no arc, the connector runs straight out.
  const arc =
    Math.abs(to.a - from.a) < 1e-4
      ? ""
      : `A${round(ring)},${round(ring)} 0 0 ${to.a > from.a ? 1 : 0} ${point(ring, to.a)}`;
  return `M${point(from.r, from.a)}L${point(ring, from.a)}${arc}L${point(to.r, to.a)}`;
}

/**
 * The World tree connector: down from the parent to a bus line, across, then down into the
 * child (the stepped circuit line from #27).
 *
 * @param from - Parent position.
 * @param to - Child position.
 * @param busY - Height of the horizontal run.
 * @returns SVG path data.
 */
export function treeEdgePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  busY: number,
): string {
  if (round(from.x) === round(to.x)) return `M${round(from.x)},${round(from.y)}V${round(to.y)}`;
  return `M${round(from.x)},${round(from.y)}V${round(busY)}H${round(to.x)}V${round(to.y)}`;
}

/**
 * The text of a node's visible label.
 *
 * @param kind - The node kind.
 * @param name - The skill or branch name (ignored for the start node).
 * @returns The label text as rendered (hub and start labels are uppercased by CSS, so the
 * estimate uses the same text).
 */
export function nodeLabelText(kind: SkillMapNodeKind, name: string): string {
  return kind === "start" ? "Start" : name;
}

/**
 * A node's outer radius: its disc, plus the rank ring for skills, plus a hair for the stroke.
 *
 * @param kind - The node kind.
 * @returns The radius every other node and label must keep clear of.
 */
export function outerRadius(kind: SkillMapNodeKind): number {
  const { radius, ringGap } = SKILL_MAP_METRICS;
  return radius[kind] + (kind === "skill" ? ringGap + 2 : 2);
}

/**
 * Where a label is drawn for a node and side: centred under or over the node, or beside it,
 * vertically centred, reading away from the node.
 *
 * @param kind - The node kind.
 * @param placement - The node's position and label side.
 * @returns The baseline anchor and `text-anchor`.
 */
export function labelAnchor(kind: SkillMapNodeKind, placement: NodePlacement): LabelAnchor {
  const { fontSize, labelGap } = SKILL_MAP_METRICS;
  const outer = outerRadius(kind);
  const font = fontSize[kind];
  const { x, y } = placement;
  // Cap height is about 0.75 of the font size and descenders about 0.25 below the baseline,
  // so a baseline 0.8 em below the box top (or 0.25 em above its bottom) fits the text.
  switch (placement.label) {
    case "above":
      return { x, y: y - outer - labelGap - font * 0.25, textAnchor: "middle" };
    case "right":
      return { x: x + outer + labelGap, y: y + font * 0.3, textAnchor: "start" };
    case "left":
      return { x: x - outer - labelGap, y: y + font * 0.3, textAnchor: "end" };
    default:
      return { x, y: y + outer + labelGap + font * 0.8, textAnchor: "middle" };
  }
}

/**
 * The box a label takes up, estimated from its length (the fonts are self-hosted, so the
 * estimate is stable): 0.8 em above the baseline and 0.25 em below it.
 *
 * @param kind - The node kind.
 * @param placement - The node's position and label side.
 * @param text - The visible label text.
 * @returns The label's box in map units.
 */
export function labelBox(kind: SkillMapNodeKind, placement: NodePlacement, text: string): Box {
  const { fontSize, charWidth } = SKILL_MAP_METRICS;
  const font = fontSize[kind];
  const width = text.length * charWidth[kind] * font;
  const anchor = labelAnchor(kind, placement);
  const left =
    anchor.textAnchor === "start"
      ? anchor.x
      : anchor.textAnchor === "end"
        ? anchor.x - width
        : anchor.x - width / 2;
  return { x: left, y: anchor.y - font * 0.8, width, height: font * 1.05 };
}

/**
 * The box a node takes up, including its rank ring and its label, for fitting the view.
 *
 * @param kind - The node kind.
 * @param placement - Where the node sits and which side its label is on.
 * @param label - The visible label text.
 * @returns The node's box in map units.
 */
export function nodeBox(kind: SkillMapNodeKind, placement: NodePlacement, label: string): Box {
  const outer = outerRadius(kind);
  const disc = {
    x: placement.x - outer,
    y: placement.y - outer,
    width: outer * 2,
    height: outer * 2,
  };
  return fitBoxes([disc, labelBox(kind, placement, label)]);
}

/**
 * Whether two boxes overlap (touching edges do not count).
 *
 * @param a - A box.
 * @param b - Another box.
 * @returns `true` when they overlap.
 */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Whether a box overlaps a circle.
 *
 * @param box - A box.
 * @param centre - The circle's centre.
 * @param radius - The circle's radius.
 * @returns `true` when they overlap.
 */
export function boxHitsCircle(box: Box, centre: { x: number; y: number }, radius: number): boolean {
  // The point of the box closest to the centre.
  const x = Math.min(Math.max(centre.x, box.x), box.x + box.width);
  const y = Math.min(Math.max(centre.y, box.y), box.y + box.height);
  return Math.hypot(x - centre.x, y - centre.y) < radius;
}

/** Clearance kept between a label and any other node or label, in map units. */
export const LABEL_CLEARANCE = 3;

/** One node for {@link placeLabels}: where it is, its kind, label text and preferred sides. */
export interface LabelCandidate {
  id: string;
  kind: SkillMapNodeKind;
  x: number;
  y: number;
  text: string;
  /** Sides to try, best first; the rest of {@link LABEL_SIDES} are tried after them. */
  prefer: readonly LabelSide[];
}

/**
 * Picks each node's label side so no label overlaps another node's disc and ring or another
 * label. Nodes are placed in order; each takes its first preferred side that is clear (with
 * {@link LABEL_CLEARANCE}), else the side with the fewest collisions. Diagonal single-file
 * chains in the Constellation, where the label under one skill would sit on the next, end up
 * with their labels beside the nodes.
 *
 * @param nodes - Every node, in priority order (start node, hubs, then skills).
 * @returns Node id -> placement.
 */
export function placeLabels(nodes: readonly LabelCandidate[]): Record<string, NodePlacement> {
  const placed: Box[] = [];
  const positions: Record<string, NodePlacement> = {};
  /** Collisions of one label box with other nodes and the labels placed so far. */
  const collisions = (node: LabelCandidate, box: Box) => {
    const grown = {
      x: box.x - LABEL_CLEARANCE,
      y: box.y - LABEL_CLEARANCE,
      width: box.width + LABEL_CLEARANCE * 2,
      height: box.height + LABEL_CLEARANCE * 2,
    };
    const nodeHits = nodes.filter(
      (other) => other.id !== node.id && boxHitsCircle(grown, other, outerRadius(other.kind)),
    ).length;
    return nodeHits + placed.filter((label) => boxesOverlap(grown, label)).length;
  };
  for (const node of nodes) {
    const sides = [...node.prefer, ...LABEL_SIDES.filter((side) => !node.prefer.includes(side))];
    let best: { side: LabelSide; box: Box; hits: number } | null = null;
    for (const side of sides) {
      const box = labelBox(node.kind, { x: node.x, y: node.y, label: side }, node.text);
      const hits = collisions(node, box);
      if (best === null || hits < best.hits) best = { side, box, hits };
      if (hits === 0) break;
    }
    if (best === null) continue;
    placed.push(best.box);
    positions[node.id] = { x: node.x, y: node.y, label: best.side };
  }
  return positions;
}

/**
 * The smallest box containing every box, grown by `padding` on each side.
 *
 * @param boxes - Boxes to fit (at least one).
 * @param padding - Space to add around the union.
 * @returns The fitted box.
 */
export function fitBoxes(boxes: readonly Box[], padding = 0): Box {
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return {
    x: round(minX - padding),
    y: round(minY - padding),
    width: round(maxX - minX + padding * 2),
    height: round(maxY - minY + padding * 2),
  };
}

/**
 * Every node's kind and visible label, in label priority order (start node, hubs, skills).
 *
 * @param map - The derived map.
 * @returns Node id, kind and label text.
 */
export function nodeLabels(map: SkillMap): { id: string; kind: SkillMapNodeKind; label: string }[] {
  return [
    { id: START_ID, kind: "start", label: nodeLabelText("start", "") },
    ...map.branches.map((branch) => ({
      id: branch.nodeId,
      kind: "hub" as const,
      label: branch.name,
    })),
    ...map.skills.map((skill) => ({ id: skill.id, kind: "skill" as const, label: skill.name })),
  ];
}

/**
 * The input for {@link placeLabels}: every node with its position and preferred sides.
 *
 * @param map - The derived map.
 * @param where - A node's position and preferred label sides.
 * @returns The candidates, start node first, then hubs, then skills.
 */
function labelCandidates(
  map: SkillMap,
  where: (
    id: string,
    kind: SkillMapNodeKind,
  ) => { x: number; y: number; prefer: readonly LabelSide[] },
): LabelCandidate[] {
  return nodeLabels(map).map(({ id, kind, label }) => ({
    id,
    kind,
    text: label,
    ...where(id, kind),
  }));
}

/**
 * Finishes a layout: the box that fits every node, ring and label.
 *
 * @param map - The derived map.
 * @param kind - Which layout this is.
 * @param positions - Every node's placement.
 * @param edges - The connectors with their paths.
 * @returns The layout.
 */
function finishLayout(
  map: SkillMap,
  kind: SkillMapLayoutKind,
  positions: Record<string, NodePlacement>,
  edges: SkillMapEdge[],
): SkillMapLayout {
  const boxes = nodeLabels(map).map((node) => nodeBox(node.kind, positions[node.id], node.label));
  return { kind, positions, edges, bounds: fitBoxes(boxes, SKILL_MAP_METRICS.padding) };
}

/**
 * The Constellation layout: the start node at the origin, the hubs on a ring around it (the
 * first at the top left, then clockwise; with four branches they sit on the diagonals) and each
 * branch's skills on rings further out, one step per depth, fanned across a wedge that narrows
 * for narrow branches. Hub labels sit on the side facing the start node.
 *
 * @param map - The derived map.
 * @returns Positions, arc connectors and the fitted box.
 */
export function layoutConstellation(map: SkillMap): SkillMapLayout {
  const { hubRadius, step, wedgeDeg, firstHubDeg } = CONSTELLATION;
  const sector = 360 / Math.max(1, map.branches.length);
  // With more than four branches the wedges shrink so neighbouring branches never overlap.
  const wedge = radians(Math.min(wedgeDeg, sector - 6));
  const polar = new Map<string, { r: number; a: number }>([[START_ID, { r: 0, a: 0 }]]);
  const branchAngle = new Map<string, number>();
  map.branches.forEach((branch, index) => {
    const angle = radians(firstHubDeg + index * sector);
    branchAngle.set(branch.id, angle);
    polar.set(branch.nodeId, { r: hubRadius, a: angle });
  });
  const slots = new Map(map.branches.map((branch) => [branch.id, branch.slots]));
  for (const skill of map.skills) {
    const centre = branchAngle.get(skill.branchId) ?? 0;
    const spread = wedge * Math.min(1, (slots.get(skill.branchId) ?? 1) / 3 + 0.25);
    polar.set(skill.id, {
      r: hubRadius + skill.depth * step,
      a: centre + (skill.offset - 0.5) * spread,
    });
  }

  const positions = placeLabels(
    labelCandidates(map, (id, kind) => {
      const { r, a } = polar.get(id) ?? { r: 0, a: 0 };
      // Hubs below the start node put their label above, facing the centre.
      const prefer: LabelSide[] = kind === "hub" && Math.sin(a) > 1e-6 ? ["above"] : ["below"];
      return { x: round(r * Math.cos(a)), y: round(r * Math.sin(a)), prefer };
    }),
  );
  const edges = skillMapLinks(map).map((link) => ({
    ...link,
    d: radialEdgePath(polar.get(link.from) ?? { r: 0, a: 0 }, polar.get(link.to) ?? { r: 0, a: 0 }),
  }));
  return finishLayout(map, "constellation", positions, edges);
}

/**
 * The World tree layout: the start node at the top, the hubs in a row below it (each branch as
 * wide as its widest row, side by side, centred on the start node), and each branch's skills
 * growing down, one row per depth, with stepped circuit connectors. The start label sits above
 * the start node so the bus line to the hubs stays clear.
 *
 * @param map - The derived map.
 * @returns Positions, stepped connectors and the fitted box.
 */
export function layoutWorldTree(map: SkillMap): SkillMapLayout {
  const { slot, row, hubY } = WORLD_TREE;
  const points: Record<string, { x: number; y: number }> = { [START_ID]: { x: 0, y: 0 } };
  const total = map.branches.reduce((sum, branch) => sum + branch.slots, 0) * slot;
  // Left edge and width of each branch's column.
  const columns = new Map<string, { left: number; width: number }>();
  let left = -total / 2;
  for (const branch of map.branches) {
    const width = branch.slots * slot;
    columns.set(branch.id, { left, width });
    points[branch.nodeId] = { x: round(left + width / 2), y: hubY };
    left += width;
  }
  for (const skill of map.skills) {
    const column = columns.get(skill.branchId) ?? { left: 0, width: slot };
    points[skill.id] = {
      x: round(column.left + skill.offset * column.width),
      y: hubY + skill.depth * row,
    };
  }
  const positions = placeLabels(
    labelCandidates(map, (id, kind) => ({
      ...points[id],
      // The start label goes above so the bus line to the hubs stays clear.
      prefer: kind === "start" ? ["above"] : ["below"],
    })),
  );
  const edges = skillMapLinks(map).map((link) => {
    const from = positions[link.from];
    const to = positions[link.to];
    // The bus from the start node runs halfway down; below a hub or skill, half a row down.
    const busY = link.from === START_ID ? (from.y + to.y) / 2 : from.y + row / 2;
    return { ...link, d: treeEdgePath(from, to, busY) };
  });
  return finishLayout(map, "tree", positions, edges);
}

/** Everything the About page passes to the client skill map. */
export interface SkillMapData {
  map: SkillMap;
  layouts: Record<SkillMapLayoutKind, SkillMapLayout>;
}

/**
 * Derives the map and both layouts for the About page, with quest counts from the projects.
 *
 * @param tree - The validated `profile.skillTree`.
 * @param projects - All projects (only `tech` is read).
 * @returns The map and its Constellation and World tree layouts. The input is not mutated.
 */
export function buildSkillMap(
  tree: readonly SkillTreeBranchInput[],
  projects: readonly Pick<Project, "tech">[],
): SkillMapData {
  const map = deriveSkillMap(tree, (name) => countProjectsUsingSkill(name, projects));
  return {
    map,
    layouts: { constellation: layoutConstellation(map), tree: layoutWorldTree(map) },
  };
}

/**
 * The nodes on the path from a node back to the start node: for a skill, the skill, every
 * transitive prerequisite, the hub (reached through the skills that hang off it) and the start
 * node; for a hub, the hub and the start node; for the start node, itself.
 *
 * @param map - The derived map.
 * @param id - A node id, or `null`.
 * @returns The node ids on the path; empty for `null` or an unknown id.
 */
export function pathToStart(map: SkillMap, id: string | null): Set<string> {
  const path = new Set<string>();
  if (id === null) return path;
  if (id === START_ID) return path.add(START_ID);
  const branch = map.branches.find((item) => item.nodeId === id);
  if (branch) return path.add(branch.nodeId).add(START_ID);
  const byId = new Map(map.skills.map((skill) => [skill.id, skill]));
  const pending = byId.has(id) ? [id] : [];
  while (pending.length > 0) {
    const current = byId.get(pending.pop()!);
    if (!current || path.has(current.id)) continue;
    path.add(current.id);
    if (current.requires.length === 0) path.add(hubNodeId(current.branchId)).add(START_ID);
    pending.push(...current.requires);
  }
  return path;
}

/**
 * Whether a connector is on a traced path: both of its ends are on it.
 *
 * @param link - A connector.
 * @param path - From {@link pathToStart}.
 * @returns `true` when the connector should light up.
 */
export function isLinkOnPath(link: SkillMapLink, path: ReadonlySet<string>): boolean {
  return path.has(link.from) && path.has(link.to);
}

/**
 * The order the roving focus moves through: the start node, then each branch's hub followed by
 * its skills in data order.
 *
 * @param map - The derived map.
 * @returns Node ids in focus order.
 */
export function focusOrder(map: SkillMap): string[] {
  return [START_ID, ...map.branches.flatMap((branch) => [branch.nodeId, ...branch.skillIds])];
}

/**
 * Joins names as English prose: `A`, `A and B`, `A, B and C`.
 *
 * @param names - Names to join.
 * @returns The joined text (empty for no names).
 */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * What a screen reader reads for a skill node: name, rank and prerequisites, for example
 * `React, Mastered, requires TypeScript` or `Git, Mastered` for a skill on the hub.
 *
 * @param node - A skill.
 * @returns The accessible name.
 */
export function skillNodeLabel(node: Pick<SkillMapSkill, "name" | "rank" | "requiresNames">) {
  const base = `${node.name}, ${rankLabel(node.rank)}`;
  return node.requiresNames.length > 0
    ? `${base}, requires ${joinNames(node.requiresNames)}`
    : base;
}

/**
 * What a screen reader reads for a hub, for example `Front end branch, 6 skills`.
 *
 * @param branch - A branch.
 * @returns The accessible name.
 */
export function hubNodeLabel(branch: Pick<SkillMapBranch, "name" | "skillIds">): string {
  const count = branch.skillIds.length;
  return `${branch.name} branch, ${count} ${count === 1 ? "skill" : "skills"}`;
}

/**
 * What a screen reader reads for the start node, for example `Start, 4 branches`.
 *
 * @param branchCount - How many branches leave the start node.
 * @returns The accessible name.
 */
export function startNodeLabel(branchCount: number): string {
  return `Start, ${branchCount} ${branchCount === 1 ? "branch" : "branches"}`;
}

/**
 * Roving focus through the map nodes: the index a key press moves to, wrapping at both ends.
 * ArrowRight / ArrowDown move forward by one, ArrowLeft / ArrowUp back by one, and Home and End
 * jump to the first and last node.
 *
 * @param key - `KeyboardEvent.key`.
 * @param index - The current index (an index outside the list counts as before the first).
 * @param length - Number of items.
 * @returns The new index, or `null` when the key does not move focus.
 */
export function rovingIndex(key: string, index: number, length: number): number | null {
  if (length === 0) return null;
  const forward = key === "ArrowRight" || key === "ArrowDown";
  const backward = key === "ArrowLeft" || key === "ArrowUp";
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (forward) return index < 0 || index >= length - 1 ? 0 : index + 1;
  if (backward) return index <= 0 || index >= length ? length - 1 : index - 1;
  return null;
}
