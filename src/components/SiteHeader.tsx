import Image from "next/image";
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

/**
 * Site-wide HUD bar: the logo and owner's name as the home link, and the primary navigation as
 * world-map destinations. A slate panel with a rune-line bottom edge; sticky from `sm` up so
 * the HUD stays on screen, and in normal flow on phones (where it takes two rows) to keep the
 * reading area free.
 */
export function SiteHeader({ name }: SiteHeaderProps) {
  return (
    <header className="relative z-40 border-b border-line bg-surface/95 inset-shadow-rune backdrop-blur-sm sm:sticky sm:top-0">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-4 pb-2 sm:flex-nowrap sm:px-6 sm:py-3"
      >
        <Link
          href="/"
          className="group flex min-h-11 min-w-0 items-center gap-3 rounded-sm font-display text-lg font-semibold tracking-tight text-foreground transition-[text-shadow] duration-150 ease-out hover:text-shadow-glow-sm motion-reduce:transition-none"
        >
          <Image
            src="/images/logo.svg"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-full ring-1 ring-line transition-shadow duration-150 ease-out group-hover:shadow-glow-sm motion-reduce:transition-none"
          />
          <span className="truncate">{name}</span>
        </Link>
        <NavLinks items={NAV_ITEMS} />
      </nav>
      {/* Rune line: a faint neon glow along the bottom edge. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-linear-to-r from-transparent via-neon/60 to-transparent"
      />
    </header>
  );
}
