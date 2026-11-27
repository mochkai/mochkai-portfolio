import { describe, expect, it } from "vitest";
import profileData from "@/data/profile.json";
import { makeProject } from "../../tests/fixtures";
import {
  CONSTELLATION,
  SKILL_MAP_METRICS,
  START_ID,
  WORLD_TREE,
  buildSkillMap,
  computeDepths,
  computeOffsets,
  deriveSkillMap,
  findCycle,
  findSkillTreeIssues,
  fitBoxes,
  focusOrder,
  hubNodeId,
  hubNodeLabel,
  isLinkOnPath,
  joinNames,
  boxHitsCircle,
  boxesOverlap,
  labelAnchor,
  labelBox,
  nodeLabels,
  outerRadius,
  placeLabels,
  type SkillMapLayout,
  layoutConstellation,
  layoutWorldTree,
  nodeBox,
  pathToStart,
  radialEdgePath,
  rovingIndex,
  skillMapLinks,
  skillNodeLabel,
  startNodeLabel,
  treeEdgePath,
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

describe("computeOffsets", () => {
  it("centres a lone skill under its prerequisites and spreads wider rows evenly", () => {
    const offsets = computeOffsets(frontEnd.skills, computeDepths(frontEnd.skills));
    expect(Object.fromEntries(offsets)).toEqual({
      "html-css": 0.5,
      javascript: 0.25,
      tailwind: 0.75,
      typescript: 0.25,
      react: 0.25,
      nextjs: 0.25,
    });
  });

  it("orders a row by where its prerequisites sit, keeping data order for ties", () => {
    const offsets = computeOffsets(backEnd.skills, computeDepths(backEnd.skills));
    // Three skills on the hub, in data order.
    expect(offsets.get("python")).toBeCloseTo(1 / 6);
    expect(offsets.get("nodejs")).toBeCloseTo(0.5);
    expect(offsets.get("sql")).toBeCloseTo(5 / 6);
    // Row 2: FastAPI (under Python), REST APIs (between Python and Node.js), PostgreSQL (SQL).
    expect(offsets.get("fastapi")).toBeCloseTo(1 / 6);
    expect(offsets.get("rest")).toBeCloseTo(0.5);
    expect(offsets.get("postgres")).toBeCloseTo(5 / 6);
  });
});

describe("deriveSkillMap", () => {
  const map = deriveSkillMap([frontEnd, backEnd], (name) => (name === "React" ? 2 : 0));

  it("derives branches with hub ids, slots, depth and resolved icons", () => {
    expect(
      map.branches.map(({ id, nodeId, slots, depth, iconName }) => [
        id,
        nodeId,
        slots,
        depth,
        iconName,
      ]),
    ).toEqual([
      ["frontend", "@hub-frontend", 2, 5, "frontend"],
      ["backend", "@hub-backend", 3, 2, "backend"],
    ]);
  });

  it("derives each skill's prerequisites, unlocks, quest count and icon", () => {
    const html = map.skills.find((skill) => skill.id === "html-css");
    expect(html).toMatchObject({
      branchId: "frontend",
      requires: [],
      unlocks: ["javascript", "tailwind"],
      depth: 1,
      offset: 0.5,
      iconName: "html-css",
    });
    const rest = map.skills.find((skill) => skill.id === "rest");
    expect(rest).toMatchObject({ requiresNames: ["Python", "Node.js"], unlocks: [] });
    // "rest" and "tailwind" are not icon keys: they fall back to the neutral glyph.
    expect(rest?.iconName).toBeNull();
    expect(map.skills.find((skill) => skill.id === "react")?.questCount).toBe(2);
  });

  it("uses an icon override from the data and ignores unknown names", () => {
    const derived = deriveSkillMap([
      {
        id: "tools",
        name: "Tools",
        icon: "devops",
        skills: [
          { id: "a", name: "A", rank: "mastered", icon: "docker" },
          { id: "b", name: "B", rank: "mastered", icon: "nope" },
        ],
      },
    ]);
    expect(derived.branches[0].iconName).toBe("devops");
    expect(derived.skills.map((skill) => skill.iconName)).toEqual(["docker", null]);
  });

  it("links start to hubs, hubs to root skills and prerequisites to skills", () => {
    const links = skillMapLinks(map).map((link) => `${link.from}>${link.to}`);
    expect(links).toEqual([
      "@start>@hub-frontend",
      "@start>@hub-backend",
      "@hub-frontend>html-css",
      "html-css>javascript",
      "javascript>typescript",
      "typescript>react",
      "react>nextjs",
      "html-css>tailwind",
      "@hub-backend>python",
      "python>fastapi",
      "@hub-backend>nodejs",
      "python>rest",
      "nodejs>rest",
      "@hub-backend>sql",
      "sql>postgres",
    ]);
  });

  it("orders focus as start, then each hub followed by its skills", () => {
    expect(focusOrder(map)).toEqual([
      START_ID,
      "@hub-frontend",
      ...frontEnd.skills.map((skill) => skill.id),
      "@hub-backend",
      ...backEnd.skills.map((skill) => skill.id),
    ]);
  });
});

describe("connector paths", () => {
  it("draws a straight spoke from the start node", () => {
    expect(radialEdgePath({ r: 0, a: 0 }, { r: 130, a: -Math.PI / 2 })).toBe("M0,0L0,-130");
  });

  it("runs out along the parent's ray, around the mid ring, then out to the child", () => {
    const d = radialEdgePath({ r: 130, a: 0 }, { r: 224, a: Math.PI / 2 });
    // Ring radius: parent radius + half a step.
    const ring = 130 + CONSTELLATION.step / 2;
    expect(d).toBe(`M130,0L${ring},0A${ring},${ring} 0 0 1 0,${ring}L0,224`);
    // Sweeping the other way flips the sweep flag.
    expect(radialEdgePath({ r: 130, a: 0 }, { r: 224, a: -Math.PI / 2 })).toContain(" 0 0 0 ");
  });

  it("skips the arc when parent and child share an angle", () => {
    expect(radialEdgePath({ r: 130, a: 0 }, { r: 224, a: 0 })).toBe("M130,0L177,0L224,0");
  });

  it("steps the World tree connector through its bus line", () => {
    expect(treeEdgePath({ x: 0, y: 0 }, { x: -120, y: 130 }, 65)).toBe("M0,0V65H-120V130");
    expect(treeEdgePath({ x: 40, y: 130 }, { x: 40, y: 222 }, 176)).toBe("M40,130V222");
  });
});

describe("bounding boxes", () => {
  it("fits boxes with padding", () => {
    expect(
      fitBoxes(
        [
          { x: 0, y: 0, width: 10, height: 10 },
          { x: -5, y: 20, width: 10, height: 5 },
        ],
        2,
      ),
    ).toEqual({ x: -7, y: -2, width: 19, height: 29 });
  });

  it("includes a skill's ring and its label below, or a label above", () => {
    const { fontSize, labelGap, charWidth } = SKILL_MAP_METRICS;
    const outer = outerRadius("skill");
    const below = nodeBox("skill", { x: 0, y: 0, label: "below" }, "Prompt engineering");
    const width = 18 * charWidth.skill * fontSize.skill;
    expect(below.width).toBeCloseTo(width, 0);
    expect(below.y).toBeCloseTo(-outer, 0);
    expect(below.y + below.height).toBeCloseTo(outer + labelGap + fontSize.skill * 1.05, 0);
    const above = nodeBox("hub", { x: 10, y: 0, label: "above" }, "AI");
    // A short label never makes the box narrower than the disc.
    expect(above.width).toBeCloseTo(outerRadius("hub") * 2, 0);
    expect(above.y + above.height).toBeCloseTo(outerRadius("hub"), 0);
  });

  it("anchors side labels beside the ring, reading away from the node", () => {
    const outer = outerRadius("skill");
    const right = labelAnchor("skill", { x: 0, y: 0, label: "right" });
    expect(right).toMatchObject({ textAnchor: "start" });
    expect(right.x).toBeGreaterThan(outer);
    const left = labelBox("skill", { x: 0, y: 0, label: "left" }, "Git");
    expect(left.x + left.width).toBeLessThan(-outer);
    // Vertically centred on the node.
    expect(left.y + left.height / 2).toBeCloseTo(0, 0);
    expect(labelAnchor("skill", { x: 0, y: 0, label: "below" }).y).toBeGreaterThan(outer);
    expect(labelAnchor("hub", { x: 0, y: 0, label: "above" }).y).toBeLessThan(-outerRadius("hub"));
  });
});

describe("placeLabels", () => {
  it("takes the preferred side when it is clear", () => {
    const positions = placeLabels([
      { id: "a", kind: "skill", x: 0, y: 0, text: "Alpha", prefer: ["below"] },
      { id: "b", kind: "skill", x: 300, y: 0, text: "Beta", prefer: ["above"] },
    ]);
    expect(positions.a.label).toBe("below");
    expect(positions.b.label).toBe("above");
  });

  it("moves a label off a node that sits where it would go", () => {
    // B sits right under A, where A's label would be.
    const positions = placeLabels([
      { id: "a", kind: "skill", x: 0, y: 0, text: "Prompt engineering", prefer: ["below"] },
      { id: "b", kind: "skill", x: 0, y: 60, text: "B", prefer: ["below"] },
    ]);
    expect(positions.a.label).not.toBe("below");
    expect(positions.b.label).toBe("below");
  });

  it("moves a label off another label", () => {
    const positions = placeLabels([
      { id: "a", kind: "skill", x: 0, y: 0, text: "A long name", prefer: ["right"] },
      { id: "b", kind: "skill", x: 180, y: 0, text: "Other", prefer: ["left"] },
    ]);
    expect(positions.a.label).toBe("right");
    expect(positions.b.label).not.toBe("left");
  });
});

/**
 * Every collision in a layout: a label over another node's disc and ring, or two labels
 * overlapping, as "<id> label hits <id>" strings.
 */
function labelCollisions(map: ReturnType<typeof deriveSkillMap>, layout: SkillMapLayout) {
  const nodes = nodeLabels(map);
  const boxes = nodes.map((node) => labelBox(node.kind, layout.positions[node.id], node.label));
  const problems: string[] = [];
  nodes.forEach((node, i) => {
    nodes.forEach((other, j) => {
      if (i === j) return;
      if (boxHitsCircle(boxes[i], layout.positions[other.id], outerRadius(other.kind))) {
        problems.push(`${node.id} label hits ${other.id}`);
      }
      if (j > i && boxesOverlap(boxes[i], boxes[j])) {
        problems.push(`${node.id} label overlaps the ${other.id} label`);
      }
    });
  });
  return problems;
}

describe("labels never cover nodes or other labels", () => {
  const map = deriveSkillMap(profileData.skillTree as SkillTreeBranchInput[]);

  it("in the Constellation, including the diagonal AI dev chain", () => {
    const layout = layoutConstellation(map);
    expect(labelCollisions(map, layout)).toEqual([]);
    // Below would put "Prompt engineering" on AI agents, the next node down the diagonal.
    expect(layout.positions["prompt-engineering"].label).not.toBe("below");
  });

  it("in the World tree", () => {
    expect(labelCollisions(map, layoutWorldTree(map))).toEqual([]);
  });

  it("would collide without placement, so the check is meaningful", () => {
    const layout = layoutConstellation(map);
    const allBelow = Object.fromEntries(
      Object.entries(layout.positions).map(([id, placement]) => [
        id,
        {
          ...placement,
          label: id === START_ID || !id.startsWith("@hub-") ? "below" : placement.label,
        },
      ]),
    ) as SkillMapLayout["positions"];
    expect(labelCollisions(map, { ...layout, positions: allBelow })).not.toEqual([]);
  });
});

describe("layoutConstellation", () => {
  const map = deriveSkillMap(profileData.skillTree as SkillTreeBranchInput[]);
  const layout = layoutConstellation(map);
  /** Distance from the start node. */
  const radiusOf = (id: string) => Math.hypot(layout.positions[id].x, layout.positions[id].y);
  /** Angle from the start node, in degrees. */
  const angleOf = (id: string) =>
    (Math.atan2(layout.positions[id].y, layout.positions[id].x) * 180) / Math.PI;

  it("puts the start node at the origin and the four hubs on the diagonals", () => {
    expect(layout.positions[START_ID]).toMatchObject({ x: 0, y: 0 });
    const hubs = map.branches.map((branch) => branch.nodeId);
    expect(hubs.map((id) => Math.round(angleOf(id)))).toEqual([-135, -45, 45, 135]);
    for (const id of hubs) expect(radiusOf(id)).toBeCloseTo(CONSTELLATION.hubRadius, 0);
  });

  it("puts each skill one step further out per depth, inside its branch's wedge", () => {
    for (const skill of map.skills) {
      expect(radiusOf(skill.id)).toBeCloseTo(
        CONSTELLATION.hubRadius + skill.depth * CONSTELLATION.step,
        0,
      );
      const hubAngle = angleOf(hubNodeId(skill.branchId));
      expect(Math.abs(angleOf(skill.id) - hubAngle)).toBeLessThanOrEqual(
        CONSTELLATION.wedgeDeg / 2 + 0.1,
      );
    }
    // A one-wide branch (AI dev) runs straight out along its hub's ray.
    expect(Math.round(angleOf("langgraph"))).toBe(135);
  });

  it("puts hub labels on the side facing the start node", () => {
    expect(map.branches.map((branch) => layout.positions[branch.nodeId].label)).toEqual([
      "below",
      "below",
      "above",
      "above",
    ]);
  });

  it("runs a connector that skips rings straight out through the rings in between", () => {
    // A child two rings out from its parent: one arc at the parent's mid ring, then a straight
    // leg; no second arc on the ring it passes.
    const d = radialEdgePath({ r: 224, a: 0 }, { r: 412, a: 0.2 });
    expect(d.match(/A/g)).toHaveLength(1);
    const lastLeg = d
      .slice(d.lastIndexOf("L") + 1)
      .split(",")
      .map(Number);
    expect(Math.hypot(lastLeg[0], lastLeg[1])).toBeCloseTo(412, 0);
  });

  it("draws one arc connector per link and fits every node in the bounds", () => {
    expect(layout.edges).toHaveLength(skillMapLinks(map).length);
    expect(layout.edges.find((edge) => edge.from === START_ID)?.d).toMatch(/^M0,0L/);
    expect(
      layout.edges.filter((edge) => edge.from !== START_ID).every((edge) => edge.d.includes("L")),
    ).toBe(true);
    const { bounds } = layout;
    for (const [id, placement] of Object.entries(layout.positions)) {
      const kind = id === START_ID ? "start" : id.startsWith("@hub-") ? "hub" : "skill";
      const r = SKILL_MAP_METRICS.radius[kind];
      expect(placement.x - r, id).toBeGreaterThan(bounds.x);
      expect(placement.x + r, id).toBeLessThan(bounds.x + bounds.width);
      expect(placement.y - r, id).toBeGreaterThan(bounds.y);
      expect(placement.y + r, id).toBeLessThan(bounds.y + bounds.height);
    }
  });

  it("narrows the wedges when there are more than four branches", () => {
    const six = deriveSkillMap(
      Array.from({ length: 6 }, (_, index) => ({
        id: `b${index}`,
        name: `B${index}`,
        skills: [
          { id: `b${index}-x`, name: `X${index}`, rank: "mastered" as const },
          { id: `b${index}-y`, name: `Y${index}`, rank: "mastered" as const },
          { id: `b${index}-z`, name: `Z${index}`, rank: "mastered" as const },
        ],
      })),
    );
    const sixLayout = layoutConstellation(six);
    const angles = ["b0-x", "b0-z"].map((id) =>
      Math.atan2(sixLayout.positions[id].y, sixLayout.positions[id].x),
    );
    // 360 / 6 = 60 degree sectors: a branch may use at most 54 degrees.
    expect(Math.abs(angles[1] - angles[0]) * (180 / Math.PI)).toBeLessThanOrEqual(54);
  });
});

describe("layoutWorldTree", () => {
  const map = deriveSkillMap(profileData.skillTree as SkillTreeBranchInput[]);
  const layout = layoutWorldTree(map);

  it("puts the start node on top with its label above, and the hubs in one row", () => {
    expect(layout.positions[START_ID]).toEqual({ x: 0, y: 0, label: "above" });
    const hubs = map.branches.map((branch) => layout.positions[branch.nodeId]);
    expect(new Set(hubs.map((hub) => hub.y))).toEqual(new Set([WORLD_TREE.hubY]));
    // Side by side, each branch as wide as its widest row, centred on the start node.
    const xs = hubs.map((hub) => hub.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    const slots = map.branches.map((branch) => branch.slots);
    const total = slots.reduce((sum, n) => sum + n, 0) * WORLD_TREE.slot;
    expect(xs[0]).toBeCloseTo(-total / 2 + (slots[0] * WORLD_TREE.slot) / 2);
  });

  it("grows each branch down one row per depth, inside its column", () => {
    for (const skill of map.skills) {
      expect(layout.positions[skill.id].y).toBe(WORLD_TREE.hubY + skill.depth * WORLD_TREE.row);
    }
    const hub = layout.positions["@hub-frontend"];
    expect(layout.positions["html-css"].x).toBe(hub.x);
    expect(layout.positions["javascript"].x).toBeLessThan(hub.x);
    expect(layout.positions["tailwind-css"].x).toBeGreaterThan(hub.x);
  });

  it("steps every connector and fits the map in its bounds", () => {
    expect(layout.edges).toHaveLength(skillMapLinks(map).length);
    expect(layout.edges.every((edge) => /^M[-\d.]+,[-\d.]+V/.test(edge.d))).toBe(true);
    // The start label above the start node is inside the box.
    const startLabel = labelBox("start", layout.positions[START_ID], "Start");
    expect(layout.bounds.y).toBeLessThan(startLabel.y);
  });
});

describe("buildSkillMap", () => {
  it("counts quests and lays out both layouts without mutating the input", () => {
    const tree = structuredClone([frontEnd]);
    const data = buildSkillMap(tree, [
      makeProject({ tech: ["React", "TypeScript"] }),
      makeProject({ tech: ["react"] }),
    ]);
    expect(data.map.skills.find((skill) => skill.id === "react")?.questCount).toBe(2);
    expect(data.map.skills.find((skill) => skill.id === "nextjs")?.questCount).toBe(0);
    expect(data.layouts.constellation.kind).toBe("constellation");
    expect(data.layouts.tree.kind).toBe("tree");
    expect(tree).toEqual([frontEnd]);
  });
});

describe("pathToStart and isLinkOnPath", () => {
  const map = deriveSkillMap([frontEnd, backEnd]);

  it("follows every prerequisite back to the hub and the start node", () => {
    expect(pathToStart(map, "nextjs")).toEqual(
      new Set([
        "nextjs",
        "react",
        "typescript",
        "javascript",
        "html-css",
        "@hub-frontend",
        START_ID,
      ]),
    );
    expect(pathToStart(map, "rest")).toEqual(
      new Set(["rest", "python", "nodejs", "@hub-backend", START_ID]),
    );
  });

  it("lights a hub with the start node, the start node alone, and nothing for null", () => {
    expect(pathToStart(map, "@hub-backend")).toEqual(new Set(["@hub-backend", START_ID]));
    expect(pathToStart(map, START_ID)).toEqual(new Set([START_ID]));
    expect(pathToStart(map, null).size).toBe(0);
    expect(pathToStart(map, "ghost").size).toBe(0);
  });

  it("lights only the connectors with both ends on the path", () => {
    const path = pathToStart(map, "rest");
    const lit = skillMapLinks(map)
      .filter((link) => isLinkOnPath(link, path))
      .map((link) => `${link.from}>${link.to}`);
    expect(lit).toEqual([
      "@start>@hub-backend",
      "@hub-backend>python",
      "@hub-backend>nodejs",
      "python>rest",
      "nodejs>rest",
    ]);
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

  it("reads hubs with their skill count and the start node with its branch count", () => {
    expect(hubNodeLabel({ name: "Front end", skillIds: ["a", "b"] })).toBe(
      "Front end branch, 2 skills",
    );
    expect(hubNodeLabel({ name: "Solo", skillIds: ["a"] })).toBe("Solo branch, 1 skill");
    expect(startNodeLabel(4)).toBe("Start, 4 branches");
    expect(startNodeLabel(1)).toBe("Start, 1 branch");
  });
});

describe("rovingIndex", () => {
  it("moves with wrap-around and jumps with Home and End", () => {
    expect(rovingIndex("ArrowRight", 0, 3)).toBe(1);
    expect(rovingIndex("ArrowRight", 2, 3)).toBe(0);
    expect(rovingIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(rovingIndex("ArrowLeft", 2, 3)).toBe(1);
    expect(rovingIndex("Home", 2, 3)).toBe(0);
    expect(rovingIndex("End", 0, 3)).toBe(2);
  });

  it("treats the vertical arrows like the horizontal ones and ignores other keys", () => {
    expect(rovingIndex("ArrowDown", 0, 3)).toBe(1);
    expect(rovingIndex("ArrowUp", 0, 3)).toBe(2);
    expect(rovingIndex("Enter", 0, 3)).toBeNull();
    expect(rovingIndex("ArrowRight", 0, 0)).toBeNull();
  });

  it("treats an index outside the list as before the first item", () => {
    expect(rovingIndex("ArrowRight", -1, 3)).toBe(0);
    expect(rovingIndex("ArrowLeft", -1, 3)).toBe(2);
  });
});
