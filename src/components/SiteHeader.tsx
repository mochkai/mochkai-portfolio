import Image from "next/image";
import Link from "next/link";
import { CollectibleCounter } from "./CollectibleCounter";
import { CommandPaletteButton } from "./CommandPaletteButton";
import { NavLinks, type NavItem } from "./NavLinks";

/**
 * The primary destinations. "Contact" is the "Join the party" section at the end of the About
 * page (`/about#contact`), so it works from every page; it is never marked as the current page.
 */
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/projects", label: "Projects" },
  { href: "/experience", label: "Experience" },
  { href: "/about", label: "About" },
  { href: "/about#contact", label: "Contact" },
];

/** Props for {@link SiteHeader}. */
export interface SiteHeaderProps {
  /** Site owner's name, shown as the home link. */
  name: string;
}

/**
 * Site-wide HUD bar: the logo and owner's name as the home link, the rune shard counter (only
 * once a hidden collectible has been found, see {@link CollectibleCounter}) and the primary
 * navigation as world-map destinations. The home link is marked `data-easter-egg="logo"` for
 * the rapid-click Easter egg in `EasterEggs` (clicks are only counted). The "Fast travel"
 * {@link CommandPaletteButton} comes last in the DOM: at the right end of the bar from `sm` up,
 * and on phones moved (with `order`, so no extra row) to the right end of the name's row, above
 * the one-row nav links. On phones the name block has a zero flex basis (`flex-1`), so a long
 * name truncates instead of pushing the button onto its own row. The logo keeps its full 32 px
 * (`shrink-0`, `max-w-none`) and the home link never shrinks below `min-w-24`, so a few
 * characters of the name always show. A slate panel with a
 * rune-line bottom edge; sticky from `sm` up so the HUD stays on screen, and in normal flow on
 * phones (where it takes two rows) to keep the reading area free.
 */
export function SiteHeader({ name }: SiteHeaderProps) {
  return (
    <header className="relative z-40 border-b border-line bg-surface/95 inset-shadow-rune backdrop-blur-sm sm:sticky sm:top-0">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-4 pb-2 sm:flex-nowrap sm:px-6 sm:py-3"
      >
        <div className="flex min-w-0 items-center gap-3 max-sm:-order-1 max-sm:flex-1 sm:mr-auto">
          <Link
            href="/"
            data-easter-egg="logo"
            className="group flex min-h-11 min-w-24 items-center gap-3 rounded-sm font-display text-lg font-semibold tracking-tight text-foreground hover:text-shadow-glow-sm motion-safe:transition-[text-shadow] motion-safe:duration-150 motion-safe:ease-out motion-reduce:transition-none"
          >
            <Image
              src="/images/logo.svg"
              alt=""
              width={32}
              height={32}
              className="size-8 max-w-none shrink-0 rounded-full ring-1 ring-line group-hover:shadow-glow-sm motion-safe:transition-shadow motion-safe:duration-150 motion-safe:ease-out motion-reduce:transition-none"
            />
            <span className="truncate">{name}</span>
          </Link>
          <CollectibleCounter />
        </div>
        <NavLinks items={NAV_ITEMS} />
        <CommandPaletteButton className="shrink-0 max-sm:-order-1 sm:-ml-3" />
      </nav>
      {/* Rune line: a faint neon glow along the bottom edge. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-linear-to-r from-transparent via-neon/60 to-transparent"
      />
    </header>
  );
}
