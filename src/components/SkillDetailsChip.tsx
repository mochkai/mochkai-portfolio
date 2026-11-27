import type { ReactNode } from "react";

/** Props for {@link SkillDetailsChip}. */
export interface SkillDetailsChipProps {
  /** The node the chip selects. */
  nodeId: string;
  name: string;
  /** A small decorative icon shown before the name. */
  icon: ReactNode;
  /** Selects the node and pans the map to it. */
  onNavigate: (nodeId: string) => void;
}

/**
 * A chip in the details panel ("Unlocks", a hub's skills, the start node's branches) that
 * selects another node on the map. A list item holding a 44 px button.
 */
export function SkillDetailsChip({ nodeId, name, icon, onNavigate }: SkillDetailsChipProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigate(nodeId)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neon/30 py-1 pr-3.5 pl-2 font-mono text-xs text-glow hover:border-neon/70 hover:text-foreground motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out"
      >
        {icon}
        {name}
      </button>
    </li>
  );
}
