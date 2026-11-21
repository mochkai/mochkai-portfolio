"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A primary navigation destination. */
export interface NavItem {
  href: string;
  label: string;
}

/** Props for {@link NavLinks}. */
export interface NavLinksProps {
  items: readonly NavItem[];
}

/** Returns true when `pathname` is `href` or a page nested under it. */
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Primary navigation links. Marks the current section with `aria-current="page"`.
 */
export function NavLinks({ items }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "font-medium text-foreground underline decoration-accent decoration-2 underline-offset-8"
                  : "text-muted transition-colors hover:text-foreground"
              }
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
