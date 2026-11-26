"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

/** A primary navigation destination. */
export interface NavItem {
  href: string;
  label: string;
}

/** Props for {@link NavLinks}. */
export interface NavLinksProps {
  items: readonly NavItem[];
}

/**
 * Returns true when `pathname` is `href` or a page nested under it. A link to a section of a
 * page (`/about#contact`) is never current: the page's own item (`/about`) already is, and only
 * one item may carry `aria-current`.
 */
function isActive(pathname: string, href: string): boolean {
  if (href.includes("#")) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Snappy (150 ms) hover/active changes, under `motion-safe:` only; none under reduced motion. */
const TRANSITION =
  "motion-safe:transition-[color,border-color,background-color,box-shadow,text-shadow] motion-safe:duration-150 motion-safe:ease-out motion-reduce:transition-none";

/**
 * Primary navigation as world-map destinations: each link has a rune node marker, joined to
 * the previous one by a dashed path from `sm` up. On phones the links share one row
 * (`grid-flow-col`, so any number of items stays on one line; each column is as wide as its
 * label plus an equal share of the spare width) with 44 px touch targets; the node markers are
 * hidden there to make room, and the current page keeps its fill and underline bar.
 *
 * The current section (including nested pages such as `/projects/[slug]`) gets
 * `aria-current="page"`, a glow, and two non-color cues: a filled node marker and an
 * underline bar.
 */
export function NavLinks({ items }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <ul className="grid w-full auto-cols-auto grid-flow-col gap-1 text-sm sm:flex sm:w-auto sm:items-center sm:gap-0">
      {items.map((item, index) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href} className="flex items-center">
            {index > 0 && (
              <span
                aria-hidden="true"
                className="hidden w-5 border-t border-dashed border-line sm:block"
              />
            )}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group relative flex min-h-11 w-full items-center justify-center gap-2 rounded-sm px-1.5 font-display font-medium sm:w-auto sm:px-3",
                TRANSITION,
                active
                  ? "bg-accent-soft text-foreground text-shadow-glow-sm"
                  : "text-muted hover:bg-surface-raised hover:text-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "size-2 shrink-0 rotate-45 border max-sm:hidden",
                  TRANSITION,
                  active
                    ? "border-neon bg-neon shadow-glow-sm"
                    : "border-muted group-hover:border-neon group-hover:shadow-glow-sm",
                )}
              />
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-neon shadow-glow-sm"
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
