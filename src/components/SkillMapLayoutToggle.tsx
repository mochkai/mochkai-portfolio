import { cx } from "@/lib/cx";
import type { SkillMapLayoutKind } from "@/lib/skill-tree";

/** Props for {@link SkillMapLayoutToggle}. */
export interface SkillMapLayoutToggleProps {
  layout: SkillMapLayoutKind;
  onChange: (layout: SkillMapLayoutKind) => void;
}

/** The two layouts with their button text, in display order. */
const OPTIONS: readonly { value: SkillMapLayoutKind; label: string }[] = [
  { value: "constellation", label: "Constellation" },
  { value: "tree", label: "World tree" },
];

/**
 * The visitor's layout switch: a segmented pair of toggle buttons (`aria-pressed`) in a
 * labelled group. Each is a 44 px target; the pressed one glows.
 */
export function SkillMapLayoutToggle({ layout, onChange }: SkillMapLayoutToggleProps) {
  return (
    <div
      role="group"
      aria-label="Map layout"
      className="inline-flex rounded-lg border border-neon/30 bg-background/60 p-0.5"
    >
      {OPTIONS.map((option) => {
        const pressed = option.value === layout;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
            className={cx(
              "min-h-11 rounded-md px-3.5 font-display text-sm font-semibold",
              "motion-safe:transition-[background-color,box-shadow,color] motion-safe:duration-150 motion-safe:ease-out",
              pressed
                ? "bg-neon/15 text-foreground shadow-glow-sm inset-ring inset-ring-neon"
                : "text-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
