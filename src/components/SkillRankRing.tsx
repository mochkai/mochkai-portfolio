import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import type { SkillRank } from "@/lib/schemas";
import { PIP_COUNT, RANK_PIPS } from "@/lib/skills";

/** Props for {@link SkillRankRing}. */
export interface SkillRankRingProps {
  rank: SkillRank;
  /** Ring radius, in map units. */
  radius: number;
  /** Base delay for the unlock stagger, in ms; each lit segment adds a further step. */
  unlockDelayMs?: number;
}

/** Gap between segments, in radians. */
const GAP = 0.32;

/** Delay between consecutive lit segments of one skill. */
const SEGMENT_STEP_MS = 90;

/**
 * The SVG arc for one of the three ring segments, clockwise from the top.
 *
 * @param index - Segment 0, 1 or 2.
 * @param radius - Ring radius.
 * @returns Path data centred on 0,0.
 */
export function ringSegmentPath(index: number, radius: number): string {
  const third = (2 * Math.PI) / PIP_COUNT;
  const from = -Math.PI / 2 + index * third + GAP / 2;
  const to = from + third - GAP;
  const point = (angle: number) =>
    `${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`;
  return `M${point(from)}A${radius},${radius} 0 0 1 ${point(to)}`;
}

/**
 * A skill's rank as a ring of 3 arc segments around its node, lit by rank: 3 for Mastered, 2
 * for Proficient, 1 for Learning. Decorative (`aria-hidden`): the rank is in the node's
 * accessible name. Lit segments "unlock" on load (dim to bright, no movement) only under
 * `motion-safe:`.
 */
export function SkillRankRing({ rank, radius, unlockDelayMs = 0 }: SkillRankRingProps) {
  const lit = RANK_PIPS[rank];
  return (
    <g
      aria-hidden="true"
      data-testid="rank-ring"
      fill="none"
      strokeWidth={3.2}
      strokeLinecap="round"
    >
      {Array.from({ length: PIP_COUNT }, (_, index) => {
        const isLit = index < lit;
        const style: CSSProperties | undefined = isLit
          ? { animationDelay: `${unlockDelayMs + index * SEGMENT_STEP_MS}ms` }
          : undefined;
        return (
          <path
            key={index}
            d={ringSegmentPath(index, radius)}
            data-testid="rank-segment"
            data-lit={isLit}
            style={style}
            className={cx(isLit ? "stroke-neon motion-safe:animate-pip-unlock" : "stroke-neon/20")}
          />
        );
      })}
    </g>
  );
}
