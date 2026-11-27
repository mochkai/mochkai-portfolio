import { toNameKey } from "@/lib/names";
import type { Project, SkillRank } from "@/lib/schemas";
import { countProjectsUsingSkill, rankLabel } from "@/lib/skills";

/*
 * The About page skill tree: validation, depth and layout derivation, and the path helpers the
 * client component uses for highlighting. Everything here is pure and has no React or DOM
 * dependency, so the server can compute the whole layout (node positions and connector paths)
 * and the page renders complete without measuring anything.
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
  /** Ids of prerequisite skills in the same branch. Missing or empty: hangs off the root. */
  requires?: readonly string[];
}

/** One branch as written in `profile.json`, before layout. */
export interface SkillTreeBranchInput {
  id: string;
  name: string;
  skills: readonly SkillTreeSkillInput[];
}

/** A validation problem: a message and the path inside the `skillTree` array. */
export interface SkillTreeIssue {
  message: string;
  path: (string | number)[];
}

/**
 * Sizes shared by the layout maths and the rendered component, in rem. The SVG connectors and
 * the absolutely positioned nodes both derive from these, so they always line up.
 */
export const SKILL_TREE_METRICS = {
  /** Distance from the top of one row to the top of the next. */
  rowRem: 6.5,
  /** Height of every node box (skill nodes and the branch root). */
  nodeHeightRem: 5,
  /** Width of a skill node box. */
  nodeWidthRem: 5.5,
  /** Horizontal room per node in the widest row: the branch's minimum width per slot. */
  slotRem: 6,
  /** Widest a branch root box gets. */
  rootMaxWidthRem: 9,
} as const;

/** SVG user units per row in the connector view box (rows are 100 units tall). */
const ROW_UNITS = 100;

/** A skill after layout, with everything the component needs to render and highlight it. */
export interface SkillTreeNode {
  id: string;
  name: string;
  rank: SkillRank;
  /** Prerequisite ids (empty for skills that hang off the root). */
  requires: string[];
  /** Prerequisite names in `requires` order, for the accessible name and the details panel. */
  requiresNames: string[];
  /** Longest prerequisite chain: 1 for a skill on the root, 2 for one that requires it, ... */
  depth: number;
  /** Horizontal centre as a percentage of the branch width (0 to 100). */
  x: number;
  /** Projects whose `tech` lists the skill name ("Used in N quests"). */
  questCount: number;
}

/** One connector line, from a prerequisite (or the branch root) to a skill. */
export interface SkillTreeEdge {
  /** Prerequisite skill id, or `null` for the branch root. */
  from: string | null;
  to: string;
  /** SVG path data in the branch's connector view box. */
  d: string;
}

/** A laid-out branch: its root, nodes and connectors. */
export interface SkillTreeBranch {
  id: string;
  name: string;
  /** Row count including the root row (deepest skill depth + 1). */
  rows: number;
  /** Nodes in the widest row; the branch needs `slots * slotRem` of width. */
  slots: number;
  nodes: SkillTreeNode[];
  edges: SkillTreeEdge[];
  /** The connector view box height in SVG units (width is always 100). */
  viewBoxHeight: number;
}

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
 * root at depth 1; otherwise its depth is one more than its deepest prerequisite. Expects a
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
 * Places one row of nodes in a branch `width` slots wide. Each node wants to sit at its ideal
 * centre (in slot units, for example under its prerequisites); nodes must stay at least one
 * slot apart and inside `[0.5, width - 0.5]`. Overlapping nodes are merged into clusters that
 * centre on the mean of their ideals, then clamped into the branch.
 *
 * @param ideals - Ideal centres, already in left-to-right order.
 * @param width - Slots in the branch (at least `ideals.length`).
 * @returns The centres, in the same order, in slot units.
 */
export function spreadRow(ideals: readonly number[], width: number): number[] {
  interface Cluster {
    sum: number;
    count: number;
    start: number;
  }
  /** Where a cluster starts: centred on its mean ideal, clamped inside the branch. */
  const place = (sum: number, count: number) => {
    const start = sum / count - (count - 1) / 2;
    return Math.min(Math.max(start, 0.5), width - 0.5 - (count - 1));
  };
  const clusters: Cluster[] = [];
  for (const ideal of ideals) {
    let cluster: Cluster = { sum: ideal, count: 1, start: place(ideal, 1) };
    // Merge backwards while the previous cluster overlaps this one.
    while (clusters.length > 0) {
      const previous = clusters[clusters.length - 1];
      if (previous.start + previous.count <= cluster.start + 1e-9) break;
      clusters.pop();
      const sum = previous.sum + cluster.sum;
      const count = previous.count + cluster.count;
      cluster = { sum, count, start: place(sum, count) };
    }
    clusters.push(cluster);
  }
  return clusters.flatMap((cluster) =>
    Array.from({ length: cluster.count }, (_, index) => cluster.start + index),
  );
}

/**
 * The stepped "circuit" connector from a parent box to a child box: down from the parent's
 * centre, across in the gap just below the parent's row, then down into the child's centre.
 * For a child in the next row that gap is also the one just above the child; for a child that
 * skips rows, turning right below the parent keeps the horizontal run out of the rows in
 * between, so it never crosses under an unrelated node there. Both ends sit under opaque node
 * boxes, so only the parts between nodes show.
 *
 * @param fromX - Parent centre, percent of the branch width.
 * @param fromRow - Parent row (0 is the root).
 * @param toX - Child centre, percent of the branch width.
 * @param toRow - Child row.
 * @returns SVG path data in the branch's view box (100 units wide, 100 units per row).
 */
export function edgePath(fromX: number, fromRow: number, toX: number, toRow: number): string {
  const { rowRem, nodeHeightRem } = SKILL_TREE_METRICS;
  const boxMid = (nodeHeightRem / 2 / rowRem) * ROW_UNITS;
  const gapMid = ((rowRem - nodeHeightRem) / 2 / rowRem) * ROW_UNITS;
  const startY = fromRow * ROW_UNITS + boxMid;
  // The gap below the parent's row (the same gap as above the child when toRow = fromRow + 1).
  const turnY = (fromRow + 1) * ROW_UNITS - gapMid;
  const endY = toRow * ROW_UNITS + boxMid;
  const round = (value: number) => Math.round(value * 100) / 100;
  if (round(fromX) === round(toX)) {
    return `M${round(fromX)} ${round(startY)} V${round(endY)}`;
  }
  return `M${round(fromX)} ${round(startY)} V${round(turnY)} H${round(toX)} V${round(endY)}`;
}

/**
 * The connector view box height for a branch with `rows` rows: down to the bottom of the last
 * row's node boxes (there is no gap after the last row).
 *
 * @param rows - Rows including the root row.
 * @returns Height in SVG units.
 */
export function viewBoxHeightFor(rows: number): number {
  const { rowRem, nodeHeightRem } = SKILL_TREE_METRICS;
  return (rows - 1) * ROW_UNITS + (nodeHeightRem / rowRem) * ROW_UNITS;
}

/**
 * The rendered height of a branch's tree area, matching {@link viewBoxHeightFor}.
 *
 * @param rows - Rows including the root row.
 * @returns Height in rem.
 */
export function treeHeightRem(rows: number): number {
  const { rowRem, nodeHeightRem } = SKILL_TREE_METRICS;
  return (rows - 1) * rowRem + nodeHeightRem;
}

/**
 * Lays out one validated branch: depth per skill, then row by row, top down, each skill's ideal
 * centre is the mean of its prerequisites' centres (the root's for depth 1), and
 * {@link spreadRow} resolves overlaps. Ties keep the data order. Connectors come from the
 * final positions, so the data needs no coordinates.
 *
 * @param branch - A branch from the validated profile.
 * @param questCount - "Used in N quests" for a skill name.
 * @returns The positioned branch.
 */
export function layoutBranch(
  branch: SkillTreeBranchInput,
  questCount: (name: string) => number = () => 0,
): SkillTreeBranch {
  const depths = computeDepths(branch.skills);
  const maxDepth = Math.max(0, ...depths.values());
  const rows = maxDepth + 1;
  const byDepth = Array.from({ length: maxDepth + 1 }, () => [] as SkillTreeSkillInput[]);
  for (const skill of branch.skills) byDepth[depths.get(skill.id) ?? 1].push(skill);
  const slots = Math.max(1, ...byDepth.map((row) => row.length));
  const rootCentre = slots / 2;

  // Centre of each placed skill, in slot units.
  const centre = new Map<string, number>();
  for (let depth = 1; depth <= maxDepth; depth++) {
    const row = byDepth[depth].map((skill, order) => {
      const parents = skill.requires ?? [];
      const ideal =
        parents.length === 0
          ? rootCentre
          : parents.reduce((sum, id) => sum + (centre.get(id) ?? rootCentre), 0) / parents.length;
      return { skill, ideal, order };
    });
    row.sort((a, b) => a.ideal - b.ideal || a.order - b.order);
    const placed = spreadRow(
      row.map((item) => item.ideal),
      slots,
    );
    row.forEach((item, index) => centre.set(item.skill.id, placed[index]));
  }

  const toPercent = (slot: number) => Math.round((slot / slots) * 100 * 1000) / 1000;
  const names = new Map(branch.skills.map((skill) => [skill.id, skill.name]));
  const nodes: SkillTreeNode[] = branch.skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    rank: skill.rank,
    requires: [...(skill.requires ?? [])],
    requiresNames: (skill.requires ?? []).map((id) => names.get(id) ?? id),
    depth: depths.get(skill.id) ?? 1,
    x: toPercent(centre.get(skill.id) ?? rootCentre),
    questCount: questCount(skill.name),
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const rootX = toPercent(rootCentre);
  const edges = nodes.flatMap((node): SkillTreeEdge[] =>
    node.requires.length === 0
      ? [{ from: null, to: node.id, d: edgePath(rootX, 0, node.x, node.depth) }]
      : node.requires.map((id) => {
          const parent = byId.get(id);
          return {
            from: id,
            to: node.id,
            d: edgePath(parent?.x ?? rootX, parent?.depth ?? 0, node.x, node.depth),
          };
        }),
  );
  return {
    id: branch.id,
    name: branch.name,
    rows,
    slots,
    nodes,
    edges,
    viewBoxHeight: viewBoxHeightFor(rows),
  };
}

/**
 * Lays out the whole tree for the About page, with quest counts from the projects.
 *
 * @param tree - The validated `profile.skillTree`.
 * @param projects - All projects (only `tech` is read).
 * @returns One laid-out branch per input branch, in order. The input is not mutated.
 */
export function buildSkillTree(
  tree: readonly SkillTreeBranchInput[],
  projects: readonly Pick<Project, "tech">[],
): SkillTreeBranch[] {
  return tree.map((branch) =>
    layoutBranch(branch, (name) => countProjectsUsingSkill(name, projects)),
  );
}

/**
 * The skills on the path from a skill back to its branch root: the skill and every transitive
 * prerequisite. With several prerequisites, every path is included.
 *
 * @param nodes - The branch's nodes.
 * @param id - The skill to trace, or `null`.
 * @returns The ids on the path; empty for `null` or an unknown id.
 */
export function pathToRoot(nodes: readonly SkillTreeNode[], id: string | null): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path = new Set<string>();
  const pending = id !== null && byId.has(id) ? [id] : [];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (path.has(current)) continue;
    path.add(current);
    pending.push(...(byId.get(current)?.requires ?? []));
  }
  return path;
}

/**
 * Whether a connector is on a traced path: its target is on the path and its source is the
 * root or also on the path. (Every prerequisite of a skill on the path is on the path too.)
 *
 * @param edge - A connector.
 * @param path - From {@link pathToRoot}.
 * @returns `true` when the connector should light up.
 */
export function isEdgeOnPath(edge: Pick<SkillTreeEdge, "from" | "to">, path: Set<string>) {
  return path.has(edge.to) && (edge.from === null || path.has(edge.from));
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
 * `React, Mastered, requires TypeScript` or `Git, Mastered` for a skill on the root.
 *
 * @param node - A laid-out skill.
 * @returns The accessible name.
 */
export function skillNodeLabel(node: Pick<SkillTreeNode, "name" | "rank" | "requiresNames">) {
  const base = `${node.name}, ${rankLabel(node.rank)}`;
  return node.requiresNames.length > 0
    ? `${base}, requires ${joinNames(node.requiresNames)}`
    : base;
}

/**
 * Roving focus for the tab list and the skill nodes: the index a key press moves to, wrapping
 * at both ends. ArrowRight / ArrowLeft move by one, and with `axes: "both"` ArrowDown / ArrowUp
 * do too; Home and End jump to the first and last item.
 *
 * @param key - `KeyboardEvent.key`.
 * @param index - The current index (an index outside the list counts as before the first).
 * @param length - Number of items.
 * @param axes - `"horizontal"` for a horizontal tab list, `"both"` for the tree nodes.
 * @returns The new index, or `null` when the key does not move focus.
 */
export function rovingIndex(
  key: string,
  index: number,
  length: number,
  axes: "horizontal" | "both" = "horizontal",
): number | null {
  if (length === 0) return null;
  const forward = key === "ArrowRight" || (axes === "both" && key === "ArrowDown");
  const backward = key === "ArrowLeft" || (axes === "both" && key === "ArrowUp");
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (forward) return index < 0 || index >= length - 1 ? 0 : index + 1;
  if (backward) return index <= 0 || index >= length ? length - 1 : index - 1;
  return null;
}
