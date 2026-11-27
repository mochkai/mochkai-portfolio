import type { ReactNode } from "react";

/** Props for {@link SkillDetailsHeading}. */
export interface SkillDetailsHeadingProps {
  /** The icon or logo drawn in the round badge (decorative). */
  badge: ReactNode;
  /** Small HUD label above the name: the branch, "Branch" or "Start node". */
  label: string;
  name: string;
}

/**
 * The details panel's heading block: a glowing round badge with the node's icon, a mono HUD
 * label and the name as an `h3`.
 */
export function SkillDetailsHeading({ badge, label, name }: SkillDetailsHeadingProps) {
  return (
    <div className="flex items-center gap-3.5">
      <span
        aria-hidden="true"
        className="grid size-13 shrink-0 place-items-center rounded-full border-[1.5px] border-neon bg-accent-soft text-foreground shadow-glow"
      >
        {badge}
      </span>
      <div className="min-w-0">
        <p className="font-mono text-xs tracking-[0.2em] text-neon uppercase">{label}</p>
        <h3 className="font-display text-xl leading-tight font-semibold break-words text-foreground">
          {name}
        </h3>
      </div>
    </div>
  );
}
