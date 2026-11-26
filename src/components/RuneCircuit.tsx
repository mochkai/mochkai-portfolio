import { cx } from "@/lib/cx";

/** Props for {@link RuneCircuit}. */
export interface RuneCircuitProps {
  /** Size, position and color (the lines use a solid `currentColor`, for example `text-neon`). */
  className?: string;
  /**
   * Opacity of the whole SVG, from `0` to `1`. Applied to the root element as one compositing
   * group, so overlapping traces and nodes never stack into a brighter tint than this.
   */
  opacity: number;
}

/** Stepped circuit traces, in the 240 x 160 view box. */
const TRACES = [
  "M0 28 H64 V60 H128 V20 H196 V44 H240",
  "M24 160 V116 H88 V84 H156 V124 H212 V92 H240",
  "M64 60 V100 H40",
  "M156 84 V56 H196",
  "M128 20 V0",
];

/** Rune nodes (diamond centres) on the trace junctions. */
const NODES: ReadonlyArray<readonly [number, number, boolean]> = [
  [64, 28, false],
  [128, 60, true],
  [196, 20, false],
  [88, 116, false],
  [156, 84, true],
  [212, 124, false],
  [40, 100, false],
  [196, 56, false],
];

/**
 * A decorative fragment of glowing rune circuitry (stepped traces with diamond nodes), the same
 * language as the site backdrop and the rune markers in the UI. Hidden from assistive tech.
 * Strokes and nodes use a solid `currentColor` and the faintness comes only from `opacity` on
 * the root, so callers control the worst-case tint exactly (see `HERO_CIRCUIT_OPACITY`).
 */
export function RuneCircuit({ className, opacity }: RuneCircuitProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 160"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      data-testid="rune-circuit"
      style={{ opacity }}
      className={cx("block", className)}
    >
      <g stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        {TRACES.map((d) => (
          <path key={d} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      <g fill="currentColor">
        {NODES.map(([x, y, lit]) => {
          const size = lit ? 4 : 2.5;
          return (
            <path
              key={`${x}-${y}`}
              d={`M${x} ${y - size} L${x + size} ${y} L${x} ${y + size} L${x - size} ${y} Z`}
            />
          );
        })}
      </g>
    </svg>
  );
}
