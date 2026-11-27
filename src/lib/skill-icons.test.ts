import { describe, expect, it } from "vitest";
import profileData from "@/data/profile.json";
import {
  FALLBACK_ICON,
  SKILL_ICONS,
  SKILL_ICON_NAMES,
  isSkillIconName,
  resolveSkillIconName,
  skillIcon,
} from "./skill-icons";

describe("skill icons", () => {
  it("has an icon for every skill and branch in profile.json", () => {
    for (const branch of profileData.skillTree) {
      expect(isSkillIconName(branch.id), branch.id).toBe(true);
      for (const skill of branch.skills) expect(isSkillIconName(skill.id), skill.id).toBe(true);
    }
  });

  it("uses brand logos for technologies and line icons for concepts and hubs", () => {
    expect(SKILL_ICONS.react.kind).toBe("brand");
    expect(SKILL_ICONS.langgraph).toMatchObject({ kind: "brand", source: "LangChain" });
    expect(SKILL_ICONS["rest-apis"]).toMatchObject({ kind: "line", source: "webhook" });
    expect(SKILL_ICONS.frontend).toMatchObject({ kind: "line", source: "panels-top-left" });
    for (const name of SKILL_ICON_NAMES) {
      const icon = SKILL_ICONS[name];
      if (icon.kind === "brand") expect(icon.path).toMatch(/^M/);
      else expect(icon.shapes.length).toBeGreaterThan(0);
    }
  });

  it("resolves an override, then the id, then the fallback glyph", () => {
    expect(resolveSkillIconName("react")).toBe("react");
    expect(resolveSkillIconName("anything", "docker")).toBe("docker");
    expect(resolveSkillIconName("unknown")).toBeNull();
    expect(resolveSkillIconName("react", "not-an-icon")).toBeNull();
    expect(skillIcon(null)).toBe(FALLBACK_ICON);
    expect(skillIcon("git")).toBe(SKILL_ICONS.git);
  });

  it("does not treat inherited object keys as icon names", () => {
    expect(isSkillIconName("toString")).toBe(false);
    expect(isSkillIconName("__proto__")).toBe(false);
  });
});
