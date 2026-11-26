/**
 * Hidden collectibles (#12): small rune shards placed in fixed spots across the main pages.
 * They are a reward for curious visitors only: nothing (content, links or pages) is ever gated
 * behind them. This file is the single source of truth for which shards exist and where.
 */

/** Routes that host a collectible, in Next.js route notation. */
export type CollectiblePage = "/" | "/projects" | "/projects/[slug]" | "/experience" | "/about";

/** One hidden rune shard. */
export interface Collectible {
  /** Stable id, stored in `localStorage`. Never rename one: saved progress would be lost. */
  readonly id: string;
  /** The route the shard is placed on (documentation and tests; placement is in the page). */
  readonly page: CollectiblePage;
  /** Where to look, shown as the counter's tooltip and announced for the next missing shard. */
  readonly hint: string;
}

/**
 * Every collectible, in display order (shard 1 is the first entry). One per main page; the
 * project detail shard is on every project page and counts once.
 */
export const COLLECTIBLES = [
  { id: "title-screen", page: "/", hint: "Beside the featured projects on the title screen." },
  { id: "quest-board", page: "/projects", hint: "Next to the quest board label." },
  { id: "quest-loot", page: "/projects/[slug]", hint: "With the items of any project." },
  { id: "quest-log-end", page: "/experience", hint: "At the far end of the quest log." },
  {
    id: "character-sheet",
    page: "/about",
    hint: "By the class and region on the character sheet.",
  },
] as const satisfies readonly Collectible[];

/** Id of one of the {@link COLLECTIBLES}. */
export type CollectibleId = (typeof COLLECTIBLES)[number]["id"];

/** How many shards there are to find. */
export const COLLECTIBLE_COUNT = COLLECTIBLES.length;

/** Ids in display order, for validating stored progress. */
const IDS: readonly string[] = COLLECTIBLES.map((item) => item.id);

/**
 * Type guard: whether `value` is the id of a configured collectible.
 *
 * @param value - Any value, for example one parsed from storage.
 */
export function isCollectibleId(value: unknown): value is CollectibleId {
  return typeof value === "string" && IDS.includes(value);
}

/**
 * The collectible with this id and its 1-based number in display order.
 *
 * @param id - A configured collectible id.
 * @returns The item plus `number` (1 to {@link COLLECTIBLE_COUNT}).
 */
export function getCollectible(id: CollectibleId): Collectible & { number: number } {
  const index = IDS.indexOf(id);
  return { ...COLLECTIBLES[index], number: index + 1 };
}

/**
 * The first collectible (in display order) that has not been found yet.
 *
 * @param found - Ids already collected.
 * @returns The next item to look for, or `undefined` when every shard is found.
 */
export function nextCollectible(found: readonly CollectibleId[]): Collectible | undefined {
  return COLLECTIBLES.find((item) => !found.includes(item.id));
}
