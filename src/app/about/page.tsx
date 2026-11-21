import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { getRepository } from "@/lib/data";

export const metadata: Metadata = {
  title: "About",
  description: "Background, skills and how to get in touch.",
};

/** Bio, grouped skills and contact links. */
export default async function AboutPage() {
  const profile = await getRepository().getProfile();

  return (
    <>
      <PageHeader title="About">
        <p>{profile.bio}</p>
      </PageHeader>

      <section aria-labelledby="skills-heading" className="max-w-3xl">
        <h2 id="skills-heading" className="mb-6 font-display text-2xl font-semibold tracking-tight">
          Skills
        </h2>
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-[10rem_1fr]">
          {profile.skills.map((group) => (
            <div key={group.category} className="contents">
              <dt className="font-medium">{group.category}</dt>
              <dd className="text-muted">{group.items.join(", ")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="contact-heading" className="mt-16 max-w-3xl">
        <h2
          id="contact-heading"
          className="mb-4 font-display text-2xl font-semibold tracking-tight"
        >
          Get in touch
        </h2>
        <ul className="flex flex-col gap-2">
          {profile.email && (
            <li>
              <a href={`mailto:${profile.email}`} className="text-accent hover:underline">
                {profile.email}
              </a>
            </li>
          )}
          {profile.socials.map((social) => (
            <li key={social.url}>
              <a
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                {social.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
