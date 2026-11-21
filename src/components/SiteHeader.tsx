import Link from "next/link";
import { NavLinks, type NavItem } from "./NavLinks";

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/projects", label: "Projects" },
  { href: "/experience", label: "Experience" },
  { href: "/about", label: "About" },
];

/** Props for {@link SiteHeader}. */
export interface SiteHeaderProps {
  /** Site owner's name, shown as the home link. */
  name: string;
}

/** Site-wide header with the home link and primary navigation. */
export function SiteHeader({ name }: SiteHeaderProps) {
  return (
    <header className="border-b border-line">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6"
      >
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          {name}
        </Link>
        <NavLinks items={NAV_ITEMS} />
      </nav>
    </header>
  );
}
