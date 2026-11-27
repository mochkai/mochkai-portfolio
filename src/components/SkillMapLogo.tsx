import type { SVGProps } from "react";

/*
 * Path data from the owner's logo (`public/images/logo.svg`), with its own transforms, so the
 * shapes line up exactly as in the original 132.29-unit view box.
 */

/** The gamepad silhouette. */
const GAMEPAD =
  "m 163.08984,169.75586 v 0.13476 c -34.83393,1.31165 -62.40338,29.91874 -62.42773,64.77735 " +
  "-2.9e-4,35.82636 29.04278,64.86943 64.86914,64.86914 19.01333,-0.0177 37.06164,-8.37605 " +
  "49.37305,-22.86523 h 52.1582 c 12.31185,14.4897 30.36099,22.84813 49.375,22.86523 " +
  "35.8256,-7.8e-4 64.86748,-29.04354 64.86719,-64.86914 -4.9e-4,-33.16301 -25.01419,-60.9855 " +
  "-57.99024,-64.50195 -52.46287,-0.8403 -107.02542,-0.41016 -160.22461,-0.41016 z";

/** The d-pad: the cross without its top arm, then the top arm (white in the original). */
const DPAD = [
  "m 129.90039,226.49219 c -3.22919,0 -5.82812,2.60088 -5.82812,5.83008 v 13.32226 c 0,3.22919 " +
    "2.59893,5.83008 5.82812,5.83008 h 19.15234 V 270.625 c 0,3.22919 2.59894,5.83008 " +
    "5.82813,5.83008 h 13.32422 c 3.22919,0 5.82812,-2.60089 5.82812,-5.83008 v -19.15039 h " +
    "19.15235 c 3.22919,0 5.82812,-2.60089 5.82812,-5.83008 v -13.32226 c 0,-3.2292 " +
    "-2.59893,-5.83008 -5.82812,-5.83008 h -0.41602 -18.73633 -24.98047 -16.23828 z",
  "m 154.88086,201.51172 c -3.22919,0 -5.82813,2.60089 -5.82813,5.83008 v 19.15039 H 174.0332 " +
    "V 207.3418 c 0,-3.22919 -2.59893,-5.83008 -5.82812,-5.83008 z",
];

/** The four face buttons: centre x, centre y (radius 3.54 each). */
const BUTTONS: readonly [number, number][] = [
  [84.214783, 56.825615],
  [91.191811, 63.581146],
  [77.791489, 63.581146],
  [84.214783, 69.782944],
];

/**
 * The owner's logo restyled for the skill map's start node: the white disc and grey swooshes
 * are dropped, the tilted gamepad silhouette is drawn in the glow colour, its face buttons are
 * cut out in the node's dark fill, and the d-pad is neon with a dark rim so it stays distinct
 * from the silhouette. Decorative (`aria-hidden`): the node's accessible name says "Start".
 * Pass `x`, `y`, `width` and `height` to nest it in the map's SVG, or a size class in HTML.
 */
export function SkillMapLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 132.29167 132.29167"
      aria-hidden="true"
      focusable="false"
      data-testid="skill-map-logo"
      {...props}
    >
      <g transform="matrix(1.1311998,0.30310408,-0.30310408,1.1311998,-1.1651473,-36.711994)">
        <g transform="matrix(1.3229167,0,0,1.3229167,-6.3890908,-11.691698)">
          <path d={GAMEPAD} transform="scale(0.26458333)" className="fill-glow" />
          {BUTTONS.map(([cx, cy]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={3.5438852}
              className="fill-accent-soft"
            />
          ))}
          {DPAD.map((d) => (
            <path
              key={d.slice(0, 12)}
              d={d}
              transform="scale(0.26458333)"
              strokeWidth={9}
              strokeLinejoin="round"
              className="fill-neon stroke-accent-soft [paint-order:stroke]"
            />
          ))}
        </g>
      </g>
    </svg>
  );
}
