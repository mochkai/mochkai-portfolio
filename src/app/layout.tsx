import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
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

/** Root layout: fonts, skip link, header, main landmark and footer. */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const profile = await getRepository().getProfile();

  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${codeFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader name={profile.name} />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
          {children}
        </main>
        <SiteFooter name={profile.name} socials={profile.socials} />
      </body>
    </html>
  );
}
