/** Props for {@link SkillMapZoomControls}. */
export interface SkillMapZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

/**
 * Square 44 px buttons in the secondary button style, with a large glyph. Written out rather
 * than passed to `Button`, whose size classes would compete with a square size and glyph.
 */
const SQUARE =
  "grid size-11 place-items-center rounded-lg border border-neon/50 font-mono text-xl " +
  "leading-none text-glow hover:border-neon hover:bg-neon/10 hover:shadow-glow-sm " +
  "motion-safe:transition-[background-color,border-color,box-shadow] motion-safe:duration-150 " +
  "motion-safe:ease-out motion-safe:active:translate-y-px";

/**
 * The − and + zoom buttons. They sit in the toolbar above the map, never over it, so they can
 * never cover a node or a name, and pressing them never starts a drag.
 */
export function SkillMapZoomControls({ onZoomIn, onZoomOut }: SkillMapZoomControlsProps) {
  return (
    <>
      <button type="button" aria-label="Zoom out" onClick={onZoomOut} className={SQUARE}>
        <span aria-hidden="true">−</span>
      </button>
      <button type="button" aria-label="Zoom in" onClick={onZoomIn} className={SQUARE}>
        <span aria-hidden="true">+</span>
      </button>
    </>
  );
}
