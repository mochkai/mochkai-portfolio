import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ArcaneBackground } from "@/components/ArcaneBackground";
import { BoostMeter } from "@/components/BoostMeter";
import { CollectibleToast } from "@/components/CollectibleToast";
import { EasterEggs } from "@/components/EasterEggs";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { publicConfig } from "@/lib/config/public";
import { getRepository } from "@/lib/data";
import "./globals.css";

/** Space Grotesk: headings and display text (`font-display`). */
const displayFont = Space_Grotesk({
  variable: "--font-display-face",
  subsets: ["latin"],
});

/** Inter: body text (`font-sans`). */
const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

/** JetBrains Mono: HUD labels, tags and stats (`font-mono`). */
const codeFont = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

/** Site-wide metadata derived from the profile. */
export async function generateMetadata(): Promise<Metadata> {
  const profile = await getRepository().getProfile();
  const siteName = `${profile.name} · ${profile.title}`;
  return {
    metadataBase: new URL(publicConfig.NEXT_PUBLIC_SITE_URL),
    title: { default: siteName, template: `%s · ${profile.name}` },
    description: profile.bio,
    openGraph: { type: "website", siteName, title: siteName, description: profile.bio },
  };
}

/**
 * Root layout: fonts, the decorative Arcane backdrop (fixed behind everything), skip link, boost
 * meter, HUD header, main landmark, footer and the hidden-collectible live region and achievement
 * toast ({@link CollectibleToast}), and the Easter eggs ({@link EasterEggs}: secret-input overdrive,
 * rapid logo clicks and a console greeting).
 * The header is sticky from `sm` up, so `main` gets a matching scroll margin for the skip link.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const profile = await getRepository().getProfile();

  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${codeFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ArcaneBackground />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-60 focus:rounded-sm focus:border focus:border-neon focus:bg-surface-raised focus:px-4 focus:py-2 focus:font-display focus:font-medium focus:text-foreground focus:shadow-glow"
        >
          Skip to content
        </a>
        <BoostMeter />
        <SiteHeader name={profile.name} />
        <main
          id="main"
          className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:scroll-mt-16 sm:px-6 sm:py-16"
        >
          {children}
        </main>
        <SiteFooter name={profile.name} socials={profile.socials} />
        <CollectibleToast />
        <EasterEggs />
      </body>
    </html>
  );
}
