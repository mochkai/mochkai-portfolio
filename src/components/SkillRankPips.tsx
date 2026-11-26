import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import type { SkillRank } from "@/lib/schemas";
import { PIP_COUNT, RANK_PIPS } from "@/lib/skills";

/** Props for {@link SkillRankPips}. */
export interface SkillRankPipsProps {
  rank: SkillRank;
  /**
   * Base delay in milliseconds for the unlock stagger, so pips further down the tree light up a
   * little later. Each lit pip adds a further step.
   */
  unlockDelayMs?: number;
}

/** Delay between consecutive lit pips of one skill. */
const PIP_STEP_MS = 90;

/**
 * Three rune diamonds showing a skill rank: 3 lit for Mastered, 2 for Proficient, 1 for
 * Learning. Decorative (`aria-hidden`): the rank is always given as text next to it. Lit and
 * unlit pips differ in shape and fill, not only color: a lit pip is a larger, solid, glowing
 * diamond; an unlit pip is a smaller hollow outline.
 *
 * Lit pips "unlock" on load (dim to glowing, no movement) only under `motion-safe:`, so the
 * animation never runs under reduced motion.
 */
export function SkillRankPips({ rank, unlockDelayMs = 0 }: SkillRankPipsProps) {
  const lit = RANK_PIPS[rank];
  return (
    <span aria-hidden="true" data-testid="rank-pips" className="inline-flex items-center gap-1.5">
      {Array.from({ length: PIP_COUNT }, (_, index) => {
        const isLit = index < lit;
        const style: CSSProperties | undefined = isLit
          ? { animationDelay: `${unlockDelayMs + index * PIP_STEP_MS}ms` }
          : undefined;
        return (
          <span
            key={index}
            data-lit={isLit}
            data-testid="rank-pip"
            style={style}
            className={cx(
              "block rotate-45",
              isLit
                ? "size-2.5 border border-glow bg-neon shadow-glow-sm motion-safe:animate-pip-unlock"
                : "size-2 border border-muted/60 bg-transparent",
            )}
          />
        );
      })}
    </span>
  );
}
