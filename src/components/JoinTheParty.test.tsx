import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JoinTheParty } from "./JoinTheParty";

const SOCIALS = [
  { label: "GitHub", url: "https://github.com/ada" },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/ada" },
];

describe("JoinTheParty", () => {
  it("is a #contact section labelled by its heading, with one line of copy", () => {
    render(<JoinTheParty email="ada@example.com" socials={SOCIALS} />);
    const section = screen.getByRole("region", { name: "Join the party" });
    expect(section.tagName).toBe("SECTION");
    expect(section).toHaveAttribute("id", "contact");
    expect(screen.getByRole("heading", { level: 2, name: "Join the party" })).toHaveAttribute(
      "id",
      "contact-heading",
    );
    expect(within(section).getByText("Hiring or building something? Let's talk.")).toBeVisible();
    // Clears the sticky header when reached through /about#contact.
    expect(section).toHaveClass("sm:scroll-mt-24");
  });

  it("renders a primary mailto CTA and the socials as external secondary buttons", () => {
    render(<JoinTheParty email="ada@example.com" socials={SOCIALS} />);
    const email = screen.getByRole("link", { name: "Email me" });
    expect(email).toHaveAttribute("href", "mailto:ada@example.com");
    expect(email).toHaveClass("bg-neon/15");
    expect(email).not.toHaveAttribute("target");
    for (const social of SOCIALS) {
      const link = screen.getByRole("link", {
        name: new RegExp(`^${social.label}\\b.*opens in a new tab`),
      });
      expect(link).toHaveAttribute("href", social.url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveClass("border-neon/50");
    }
    const list = screen.getByRole("list", { name: "Ways to get in touch" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows the address as selectable text with a Copy email button", () => {
    render(<JoinTheParty email="ada@example.com" socials={SOCIALS} />);
    expect(screen.getByText("ada@example.com")).toHaveClass("select-all", "break-all");
    expect(screen.getByRole("button", { name: "Copy email" })).toBeInTheDocument();
  });

  it("renders no mail button, address or copy button when the email is absent", () => {
    const { container } = render(<JoinTheParty socials={SOCIALS} />);
    expect(screen.queryByRole("link", { name: "Email me" })).toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy email" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(SOCIALS.length);
  });

  it("renders nothing when there is no email and no social link", () => {
    const { container } = render(<JoinTheParty socials={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("pulses the CTA glow on hover and focus under motion-safe only", () => {
    render(<JoinTheParty email="ada@example.com" socials={SOCIALS} />);
    const email = screen.getByRole("link", { name: "Email me" });
    expect(email).toHaveClass(
      "motion-safe:hover:animate-party-pulse",
      "motion-safe:focus-visible:animate-party-pulse",
    );
    // No unconditional animation that a motion-reduce: variant would have to override.
    for (const name of email.className.split(/\s+/)) {
      if (name.includes("animate-")) expect(name.startsWith("motion-safe:")).toBe(true);
    }
  });

  it("gives the band its own ids, never id=contact (Home stays mounted after navigation)", () => {
    const { container } = render(
      <JoinTheParty email="ada@example.com" socials={SOCIALS} variant="band" />,
    );
    const band = screen.getByRole("region", { name: "Join the party" });
    expect(band).toHaveAttribute("id", "contact-band");
    expect(band).toHaveAttribute("aria-labelledby", "contact-band-heading");
    expect(screen.getByRole("heading", { level: 2 })).toHaveAttribute("id", "contact-band-heading");
    expect(container.querySelector("#contact, #contact-heading")).toBeNull();
  });

  it("lays the band variant out as a compact row from md up", () => {
    render(<JoinTheParty email="ada@example.com" socials={SOCIALS} variant="band" />);
    const heading = screen.getByRole("heading", { level: 2, name: "Join the party" });
    expect(heading).toHaveClass("text-2xl");
    expect(heading.closest(".grid")).toHaveClass("md:grid-cols-[minmax(0,1fr)_auto]");
  });
});
