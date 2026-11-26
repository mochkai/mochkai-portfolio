import type { SocialLink } from "@/lib/schemas";

/** Props for {@link SiteFooter}. */
export interface SiteFooterProps {
  name: string;
  socials: readonly SocialLink[];
}

/**
 * Site-wide footer matching the HUD header: a rune-line divider (a glowing line with a central
 * diamond node), the `©` line, and the social links as glowing neon links.
 */
export function SiteFooter({ name, socials }: SiteFooterProps) {
  return (
    <footer className="mt-auto bg-surface">
      <div aria-hidden="true" className="flex items-center">
        <span className="h-px flex-1 bg-linear-to-r from-transparent via-line to-neon/60" />
        <span className="size-2 rotate-45 border border-neon bg-background shadow-glow-sm" />
        <span className="h-px flex-1 bg-linear-to-l from-transparent via-line to-neon/60" />
      </div>
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {name}</p>
        {socials.length > 0 && (
          <ul className="-mx-2 flex flex-wrap gap-x-1" aria-label="Social links">
            {socials.map((social) => (
              <li key={social.url}>
                <a
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-sm px-2 font-medium text-neon hover:text-glow hover:text-shadow-glow-sm motion-safe:transition-[color,text-shadow] motion-safe:duration-150 motion-safe:ease-out motion-reduce:transition-none"
                >
                  {social.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
