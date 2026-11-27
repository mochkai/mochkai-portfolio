import { describe, expect, it } from "vitest";
import profileData from "@/data/profile.json";
import { makeProject } from "../../tests/fixtures";
import {
  SKILL_TREE_METRICS,
  buildSkillTree,
  computeDepths,
  edgePath,
  findCycle,
  findSkillTreeIssues,
  isEdgeOnPath,
  joinNames,
  layoutBranch,
  pathToRoot,
  rovingIndex,
  skillNodeLabel,
  spreadRow,
  treeHeightRem,
  viewBoxHeightFor,
  type SkillTreeBranchInput,
} from "./skill-tree";

/** The draft Front end branch from issue #27. */
const frontEnd: SkillTreeBranchInput = {
  id: "frontend",
  name: "Front end",
  skills: [
    { id: "html-css", name: "HTML & CSS", rank: "mastered" },
    { id: "javascript", name: "JavaScript", rank: "mastered", requires: ["html-css"] },
    { id: "typescript", name: "TypeScript", rank: "mastered", requires: ["javascript"] },
    { id: "react", name: "React", rank: "mastered", requires: ["typescript"] },
    { id: "nextjs", name: "Next.js", rank: "mastered", requires: ["react"] },
    { id: "tailwind", name: "Tailwind CSS", rank: "proficient", requires: ["html-css"] },
  ],
};

/** The draft Back end branch: three roots and a skill with two prerequisites. */
const backEnd: SkillTreeBranchInput = {
  id: "backend",
  name: "Back end",
  skills: [
    { id: "python", name: "Python", rank: "proficient" },
    { id: "fastapi", name: "FastAPI", rank: "proficient", requires: ["python"] },
    { id: "nodejs", name: "Node.js", rank: "proficient" },
    { id: "rest", name: "REST APIs", rank: "mastered", requires: ["python", "nodejs"] },
    { id: "sql", name: "SQL", rank: "proficient" },
    { id: "postgres", name: "PostgreSQL", rank: "proficient", requires: ["sql"] },
  ],
};

describe("findSkillTreeIssues", () => {
  it("accepts a valid tree, including the real profile.json", () => {
    expect(findSkillTreeIssues([frontEnd, backEnd])).toEqual([]);
    expect(findSkillTreeIssues(profileData.skillTree as SkillTreeBranchInput[])).toEqual([]);
  });

  it("reports duplicate branch and skill ids with their paths", () => {
    const issues = findSkillTreeIssues([
      { id: "a", name: "A", skills: [{ id: "x", name: "X", rank: "mastered" }] },
      { id: "a", name: "B", skills: [{ id: "x", name: "Y", rank: "mastered" }] },
    ]);
    expect(issues).toEqual([
      { message: 'Duplicate branch id "a"', path: [1, "id"] },
      { message: 'Duplicate skill id "x"', path: [1, "skills", 0, "id"] },
    ]);
  });

  it("reports duplicate names case-insensitively, since names are quest filters", () => {
    const issues = findSkillTreeIssues([
      {
        id: "a",
        name: "A",
        skills: [
          { id: "x", name: "React", rank: "mastered" },
          { id: "y", name: " react", rank: "mastered" },
        ],
      },
    ]);
    expect(issues.map((issue) => issue.message)).toEqual(['Duplicate skill name " react"']);
  });

  it("reports unknown, self, repeated and cross-branch requires", () => {
    const issues = findSkillTreeIssues([
      {
        id: "a",
        name: "A",
        skills: [
          { id: "x", name: "X", rank: "mastered", requires: ["ghost", "x"] },
          { id: "y", name: "Y", rank: "mastered", requires: ["x", "x", "z"] },
        ],
      },
      { id: "b", name: "B", skills: [{ id: "z", name: "Z", rank: "mastered" }] },
    ]);
    expect(issues).toEqual([
      {
        message: '"x" requires unknown skill "ghost"',
        path: [0, "skills", 0, "requires", 0],
      },
      { message: '"x" requires itself', path: [0, "skills", 0, "requires", 1] },
      { message: '"y" requires "x" twice', path: [0, "skills", 1, "requires", 1] },
      {
        message: '"y" requires "z" from another branch',
        path: [0, "skills", 1, "requires", 2],
      },
    ]);
  });

  it("reports a cycle once, naming its skills", () => {
    const issues = findSkillTreeIssues([
      {
        id: "a",
        name: "A",
        skills: [
          { id: "root", name: "Root", rank: "mastered" },
          { id: "x", name: "X", rank: "mastered", requires: ["root", "z"] },
          { id: "y", name: "Y", rank: "mastered", requires: ["x"] },
          { id: "z", name: "Z", rank: "mastered", requires: ["y"] },
        ],
      },
    ]);
    expect(issues).toEqual([
      { message: "Cycle in skill tree: x -> z -> y -> x", path: [0, "skills"] },
    ]);
  });

  it("does not report a diamond (two paths to the same skill) as a cycle", () => {
    const issues = findSkillTreeIssues([
      {
        id: "a",
        name: "A",
        skills: [
          { id: "top", name: "Top", rank: "mastered" },
          { id: "left", name: "Left", rank: "mastered", requires: ["top"] },
          { id: "right", name: "Right", rank: "mastered", requires: ["top"] },
          { id: "bottom", name: "Bottom", rank: "mastered", requires: ["left", "right"] },
        ],
      },
    ]);
    expect(issues).toEqual([]);
  });
});

describe("findCycle", () => {
  it("is null for an acyclic list and ignores unknown or self references", () => {
    expect(findCycle(frontEnd.skills)).toBeNull();
    expect(
      findCycle([{ id: "a", name: "A", rank: "mastered", requires: ["a", "missing"] }]),
    ).toBeNull();
  });

  it("is null for a diamond, where a skill is reached by two paths", () => {
    expect(
      findCycle([
        { id: "top", name: "Top", rank: "mastered" },
        { id: "left", name: "Left", rank: "mastered", requires: ["top"] },
        { id: "right", name: "Right", rank: "mastered", requires: ["top"] },
        { id: "bottom", name: "Bottom", rank: "mastered", requires: ["left", "right"] },
      ]),
    ).toBeNull();
  });

  it("finds a two-node cycle", () => {
    expect(
      findCycle([
        { id: "a", name: "A", rank: "mastered", requires: ["b"] },
        { id: "b", name: "B", rank: "mastered", requires: ["a"] },
      ]),
    ).toEqual(["a", "b", "a"]);
  });
});

describe("computeDepths", () => {
  it("is the longest prerequisite chain, with roots at depth 1", () => {
    expect(Object.fromEntries(computeDepths(frontEnd.skills))).toEqual({
      "html-css": 1,
      javascript: 2,
      typescript: 3,
      react: 4,
      nextjs: 5,
      tailwind: 2,
    });
  });

  it("uses the deepest prerequisite when a skill has several", () => {
    const depths = computeDepths([
      { id: "a", name: "A", rank: "mastered" },
      { id: "b", name: "B", rank: "mastered", requires: ["a"] },
      { id: "c", name: "C", rank: "mastered", requires: ["a", "b"] },
    ]);
    expect(depths.get("c")).toBe(3);
  });
});

describe("spreadRow", () => {
  it("keeps nodes at their ideal centres when they do not overlap", () => {
    expect(spreadRow([0.5, 2.5], 3)).toEqual([0.5, 2.5]);
  });

  it("centres a cluster of equal ideals on their mean", () => {
    expect(spreadRow([1.5, 1.5, 1.5], 3)).toEqual([0.5, 1.5, 2.5]);
    expect(spreadRow([1.5, 1.5], 3)).toEqual([1, 2]);
  });

  it("pushes a node right of a neighbour it would overlap", () => {
    expect(spreadRow([0.5, 1, 2.5], 3)).toEqual([0.5, 1.5, 2.5]);
  });

  it("clamps clusters inside the branch", () => {
    expect(spreadRow([0, 0], 2)).toEqual([0.5, 1.5]);
    expect(spreadRow([5], 2)).toEqual([1.5]);
  });
});

describe("edgePath and tree height", () => {
  it("draws a straight line when centres align and a stepped one otherwise", () => {
    const { rowRem, nodeHeightRem } = SKILL_TREE_METRICS;
    const mid = Math.round((nodeHeightRem / 2 / rowRem) * 100 * 100) / 100;
    expect(edgePath(50, 0, 50, 1)).toBe(`M50 ${mid} V${100 + mid}`);
    expect(edgePath(50, 0, 25, 1)).toMatch(new RegExp(`^M50 ${mid} V[\\d.]+ H25 V${100 + mid}$`));
  });

  it("turns in the gap just below the parent when the child skips rows", () => {
    const { rowRem, nodeHeightRem } = SKILL_TREE_METRICS;
    const round = (value: number) => Math.round(value * 100) / 100;
    const mid = round((nodeHeightRem / 2 / rowRem) * 100);
    const gapMid = round(((rowRem - nodeHeightRem) / 2 / rowRem) * 100);
    // Row 1 to row 3: across between rows 1 and 2, not between rows 2 and 3.
    expect(edgePath(25, 1, 75, 3)).toBe(
      `M25 ${100 + mid} V${round(200 - gapMid)} H75 V${300 + mid}`,
    );
    // Adjacent rows: the gap below the parent is the gap above the child.
    expect(edgePath(25, 1, 75, 2)).toBe(
      `M25 ${100 + mid} V${round(200 - gapMid)} H75 V${200 + mid}`,
    );
  });

  it("matches the view box to the rendered height", () => {
    const { rowRem, nodeHeightRem } = SKILL_TREE_METRICS;
    expect(treeHeightRem(1)).toBe(nodeHeightRem);
    expect(treeHeightRem(3)).toBe(2 * rowRem + nodeHeightRem);
    expect(viewBoxHeightFor(3) / 100).toBeCloseTo(treeHeightRem(3) / rowRem);
  });
});

describe("layoutBranch", () => {
  it("derives rows, slots and positions from depth alone", () => {
    const layout = layoutBranch(frontEnd);
    expect(layout.rows).toBe(6);
    expect(layout.slots).toBe(2);
    const x = Object.fromEntries(layout.nodes.map((node) => [node.id, node.x]));
    // HTML & CSS under the root; JavaScript and Tailwind split; the chain stays on the left.
    expect(x).toEqual({
      "html-css": 50,
      javascript: 25,
      tailwind: 75,
      typescript: 25,
      react: 25,
      nextjs: 25,
    });
  });

  it("places a multi-prerequisite skill between its parents and keeps data order", () => {
    const layout = layoutBranch(backEnd);
    expect(layout.slots).toBe(3);
    const x = Object.fromEntries(layout.nodes.map((node) => [node.id, node.x]));
    expect(x.python).toBeCloseTo(100 / 6);
    expect(x.nodejs).toBe(50);
    expect(x.sql).toBeCloseTo(500 / 6);
    expect(x.fastapi).toBeCloseTo(100 / 6);
    expect(x.rest).toBe(50);
    expect(x.postgres).toBeCloseTo(500 / 6);
  });

  it("emits one edge per requires, plus root edges, and the prerequisite names", () => {
    const layout = layoutBranch(backEnd);
    expect(layout.edges.map((edge) => `${edge.from ?? "root"}>${edge.to}`)).toEqual([
      "root>python",
      "python>fastapi",
      "root>nodejs",
      "python>rest",
      "nodejs>rest",
      "root>sql",
      "sql>postgres",
    ]);
    expect(layout.nodes.find((node) => node.id === "rest")?.requiresNames).toEqual([
      "Python",
      "Node.js",
    ]);
  });

  it("keeps a row-skipping connector's horizontal run out of the rows in between", () => {
    const { rowRem, nodeHeightRem } = SKILL_TREE_METRICS;
    // "late" needs "base" (row 1) and "deep" (row 3), so it sits in row 4 and its connector
    // from "base" skips rows 2 and 3, where "mid" and "deep" sit.
    const layout = layoutBranch({
      id: "b",
      name: "B",
      skills: [
        { id: "base", name: "Base", rank: "mastered" },
        { id: "side", name: "Side", rank: "mastered" },
        { id: "mid", name: "Mid", rank: "mastered", requires: ["side"] },
        { id: "deep", name: "Deep", rank: "mastered", requires: ["mid"] },
        { id: "late", name: "Late", rank: "mastered", requires: ["base", "deep"] },
      ],
    });
    const edge = layout.edges.find((item) => item.from === "base" && item.to === "late");
    const turn = edge?.d.match(/^M[\d.]+ [\d.]+ V([\d.]+) H/);
    expect(turn).not.toBeNull();
    const turnY = Number(turn?.[1]);
    const rowOneBottom = 100 + (nodeHeightRem / rowRem) * 100;
    // Between the bottom of row 1's boxes and the top of row 2's.
    expect(turnY).toBeGreaterThan(rowOneBottom);
    expect(turnY).toBeLessThan(200);
  });

  it("does not mutate its input", () => {
    const snapshot = structuredClone(backEnd);
    layoutBranch(backEnd);
    expect(backEnd).toEqual(snapshot);
  });
});

describe("buildSkillTree", () => {
  it("adds quest counts from project tech, case-insensitively", () => {
    const projects = [
      makeProject({ slug: "a", tech: ["Python", "FastAPI"] }),
      makeProject({ slug: "b", tech: [" python "] }),
    ];
    const [branch] = buildSkillTree([backEnd], projects);
    const counts = Object.fromEntries(branch.nodes.map((node) => [node.id, node.questCount]));
    expect(counts).toMatchObject({ python: 2, fastapi: 1, nodejs: 0 });
  });
});

describe("pathToRoot and isEdgeOnPath", () => {
  const layout = layoutBranch(backEnd);

  it("collects the skill and every prerequisite, through every parent", () => {
    expect([...pathToRoot(layout.nodes, "rest")].sort()).toEqual(["nodejs", "python", "rest"]);
    expect([...pathToRoot(layout.nodes, "postgres")].sort()).toEqual(["postgres", "sql"]);
    expect(pathToRoot(layout.nodes, null).size).toBe(0);
    expect(pathToRoot(layout.nodes, "unknown").size).toBe(0);
  });

  it("lights exactly the connectors on the path", () => {
    const path = pathToRoot(layout.nodes, "rest");
    const lit = layout.edges
      .filter((edge) => isEdgeOnPath(edge, path))
      .map((edge) => `${edge.from ?? "root"}>${edge.to}`);
    expect(lit).toEqual(["root>python", "root>nodejs", "python>rest", "nodejs>rest"]);
  });
});

describe("labels", () => {
  it("joins names as prose", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B"])).toBe("A and B");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });

  it("reads a node as name, rank and prerequisites", () => {
    expect(skillNodeLabel({ name: "React", rank: "mastered", requiresNames: ["TypeScript"] })).toBe(
      "React, Mastered, requires TypeScript",
    );
    expect(
      skillNodeLabel({ name: "REST APIs", rank: "mastered", requiresNames: ["Python", "Node.js"] }),
    ).toBe("REST APIs, Mastered, requires Python and Node.js");
    expect(skillNodeLabel({ name: "Git", rank: "proficient", requiresNames: [] })).toBe(
      "Git, Proficient",
    );
  });
});

describe("rovingIndex", () => {
  it("moves horizontally with wrap-around and jumps with Home and End", () => {
    expect(rovingIndex("ArrowRight", 0, 3)).toBe(1);
    expect(rovingIndex("ArrowRight", 2, 3)).toBe(0);
    expect(rovingIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(rovingIndex("ArrowLeft", 2, 3)).toBe(1);
    expect(rovingIndex("Home", 2, 3)).toBe(0);
    expect(rovingIndex("End", 0, 3)).toBe(2);
  });

  it("uses the vertical arrows only for both axes, and ignores other keys", () => {
    expect(rovingIndex("ArrowDown", 0, 3)).toBeNull();
    expect(rovingIndex("ArrowDown", 0, 3, "both")).toBe(1);
    expect(rovingIndex("ArrowUp", 0, 3, "both")).toBe(2);
    expect(rovingIndex("Enter", 0, 3, "both")).toBeNull();
    expect(rovingIndex("ArrowRight", 0, 0)).toBeNull();
  });

  it("treats an index outside the list as before the first item", () => {
    expect(rovingIndex("ArrowRight", -1, 3)).toBe(0);
    expect(rovingIndex("ArrowLeft", -1, 3)).toBe(2);
  });
});
