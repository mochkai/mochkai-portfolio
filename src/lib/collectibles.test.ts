import { describe, expect, it } from "vitest";
import {
  COLLECTIBLES,
  COLLECTIBLE_COUNT,
  getCollectible,
  isCollectibleId,
  nextCollectible,
} from "./collectibles";

describe("collectibles config", () => {
  it("has five shards, one per main page, with unique ids and hints", () => {
    expect(COLLECTIBLE_COUNT).toBe(5);
    expect(new Set(COLLECTIBLES.map((item) => item.id)).size).toBe(5);
    expect(COLLECTIBLES.map((item) => item.page).sort()).toEqual(
      ["/", "/about", "/experience", "/projects", "/projects/[slug]"].sort(),
    );
    for (const item of COLLECTIBLES) expect(item.hint.trim()).not.toBe("");
  });

  it("recognises configured ids only", () => {
    expect(isCollectibleId("quest-board")).toBe(true);
    expect(isCollectibleId("nope")).toBe(false);
    expect(isCollectibleId(3)).toBe(false);
    expect(isCollectibleId(null)).toBe(false);
  });

  it("numbers shards from 1 in display order", () => {
    expect(getCollectible("title-screen").number).toBe(1);
    expect(getCollectible("character-sheet")).toMatchObject({ number: 5, page: "/about" });
  });

  it("finds the next missing shard", () => {
    expect(nextCollectible([])?.id).toBe("title-screen");
    expect(nextCollectible(["title-screen", "quest-loot"])?.id).toBe("quest-board");
    expect(nextCollectible(COLLECTIBLES.map((item) => item.id))).toBeUndefined();
  });
});
