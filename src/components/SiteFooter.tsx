import type { SocialLink } from "@/lib/schemas";

/** Props for {@link SiteFooter}. */
export interface SiteFooterProps {
  name: string;
  socials: readonly SocialLink[];
}

/** Site-wide footer with the owner's name and social links. */
export function SiteFooter({ name, socials }: SiteFooterProps) {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {name}</p>
        {socials.length > 0 && (
          <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Social links">
            {socials.map((social) => (
              <li key={social.url}>
                <a
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
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
