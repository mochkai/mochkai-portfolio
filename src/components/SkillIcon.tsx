import { createElement, type SVGProps } from "react";
import { skillIcon, type SkillIconName } from "@/lib/skill-icons";

/** Props for {@link SkillIcon}: any `<svg>` attribute (size, position, class) plus the icon. */
export interface SkillIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  /** A resolved icon name, or `null` for the neutral fallback glyph. */
  name: SkillIconName | null;
}

/**
 * A skill or branch icon from the inlined icon map: a filled Simple Icons logo or a stroked
 * Lucide line icon, both in `currentColor` in a 24-unit box. Decorative (`aria-hidden`): the
 * name is always given as text. Works on its own in HTML and nested inside the map's SVG
 * (pass `x`, `y`, `width` and `height`).
 */
export function SkillIcon({ name, ...props }: SkillIconProps) {
  const icon = skillIcon(name);
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      data-icon={icon.source}
      {...props}
    >
      {icon.kind === "brand" ? (
        <path d={icon.path} fill="currentColor" />
      ) : (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon.shapes.map((shape, index) =>
            createElement(shape.tag, { key: index, ...shape.attrs }),
          )}
        </g>
      )}
    </svg>
  );
}
