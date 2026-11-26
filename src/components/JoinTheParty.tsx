import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { cx } from "@/lib/cx";
import type { SocialLink } from "@/lib/schemas";
import { CopyEmailButton } from "./CopyEmailButton";

/** The About section's fragment id: the nav "Contact" item links to `/about#contact`. */
export const CONTACT_SECTION_ID = "contact";

/**
 * The Home band's id. It must differ from {@link CONTACT_SECTION_ID}: Next keeps the Home page
 * mounted (hidden) after client navigation, so a shared id would be duplicated on `/about`.
 */
export const CONTACT_BAND_ID = "contact-band";

/** Props for {@link JoinTheParty}. */
export interface JoinThePartyProps {
  /** The owner's email (`profile.email`). Without it there is no mail button and no copy row. */
  email?: string;
  /** The owner's social links (`profile.socials`), shown as secondary buttons. */
  socials: readonly SocialLink[];
  /**
   * `section` (default) is the full contact section at the end of the About page; `band` is the
   * shorter CTA band at the bottom of the home page.
   */
  variant?: "section" | "band";
  /** Extra classes for the outer panel, such as a top margin. */
  className?: string;
}

/**
 * "Join the party": the contact section. A glowing panel with a `Player 2 wanted` HUD label, the
 * heading, one line of plain copy, then the ways to get in touch: a primary "Email me" `mailto:`
 * CTA (only when `email` is set), the socials as secondary buttons (external, new tab), and the
 * address as selectable text with a {@link CopyEmailButton}.
 *
 * It is a `<section>` labelled by its heading: `id="contact"` for the About `section` variant,
 * `id="contact-band"` for the Home `band` (see {@link CONTACT_BAND_ID}), with a scroll margin so the sticky
 * header never covers it after `/about#contact`. While the email CTA is hovered or focused its
 * glow pulses, under `motion-safe:` only. Renders nothing when there is no email and no social
 * link, so no empty or broken section appears.
 */
export function JoinTheParty({
  email,
  socials,
  variant = "section",
  className,
}: JoinThePartyProps) {
  if (!email && socials.length === 0) return null;
  const band = variant === "band";
  const id = band ? CONTACT_BAND_ID : CONTACT_SECTION_ID;
  const headingId = `${id}-heading`;

  return (
    <Card
      as="section"
      id={id}
      aria-labelledby={headingId}
      data-testid="join-the-party"
      className={cx(
        "scroll-mt-6 bg-radial-[at_85%_100%] from-accent-soft to-surface to-65% sm:scroll-mt-24",
        band ? "px-5 py-7 sm:px-8" : "px-5 py-8 sm:px-10 sm:py-10",
        className,
      )}
    >
      <div
        className={cx(
          "relative grid gap-6",
          band && "md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10",
        )}
      >
        <div className="min-w-0">
          <Label as="p" rune>
            Player 2 wanted
          </Label>
          <h2
            id={headingId}
            className={cx(
              "mt-3 font-display font-semibold tracking-tight text-shadow-glow",
              band ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl",
            )}
          >
            Join the party
          </h2>
          <p className="mt-2 max-w-prose text-lg text-muted">
            Hiring or building something? Let&apos;s talk.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <ul aria-label="Ways to get in touch" className="flex flex-wrap gap-3">
            {email && (
              <li>
                <ButtonLink
                  href={`mailto:${email}`}
                  data-testid="contact-email"
                  className="motion-safe:hover:animate-party-pulse motion-safe:focus-visible:animate-party-pulse"
                >
                  Email me
                </ButtonLink>
              </li>
            )}
            {socials.map((social) => (
              <li key={social.url}>
                <ButtonLink
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                >
                  {social.label}
                  <span aria-hidden="true">↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </ButtonLink>
              </li>
            ))}
          </ul>
          {email && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="font-mono text-sm break-all text-foreground select-all">{email}</p>
              <CopyEmailButton email={email} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
