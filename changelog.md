# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- "Join the party" contact section (#10): the new server component `JoinTheParty` is a `<section id="contact">` labelled by its heading, with a `Player 2 wanted` HUD label, one line of plain copy ("Hiring or building something? Let's talk."), a primary "Email me" `mailto:` CTA (only when `profile.email` is set), the socials as secondary buttons (external, `rel="noopener noreferrer"`, announced as opening in a new tab) and the address as selectable text. It closes the About page (replacing the sidebar "Get in touch" card) and, as a compact `band` variant, the home page. With no email and no socials it renders nothing. While the email CTA is hovered or keyboard focused its glow pulses (`animate-party-pulse`, box-shadow only), applied only under `motion-safe:`.
- `CopyEmailButton` (client): copies the address with the Clipboard API and announces "Copied" in an always-present polite live region (cleared after 2.5 s); when the API is missing or the write is refused it says so and points to the visible address.
- "Contact" nav item linking to `/about#contact`, so the section is reachable from every page. It is never marked `aria-current` (About stays current on `/about`). The section has a scroll margin so the sticky header never covers it.

- About page as a character sheet (#9): two columns from 1024 px, stacked below. The sidebar holds the identity panel (portrait, name, title, `Class · …` and `Region · …` HUD labels, and the character stats from the new `getAboutStats` in `src/lib/stats.ts`: Quests completed, Skills unlocked, Guilds joined (distinct companies), Class and Currently learning, all computed from the content data, none date-derived) and the restyled "Get in touch" links. The main column shows the bio as "Backstory" and the skill tree (`SkillTree`): one panel per category on a dashed rune line, each skill with its owner-set rank as 3 pips (`SkillRankPips`, decorative, lit pips larger and solid, unlit ones hollow) plus a text label (Mastered / Proficient / Learning), and "Used in N quests" linking to `/projects?tech=<name>` (plain "No quests yet" for 0). Lit pips power on with a short staggered unlock (no movement), applied only under `motion-safe:`. No percentage bars, numeric levels or years-per-skill.
- `src/lib/skills.ts`: rank helpers (`RANK_PIPS`, `rankLabel`), `projectUsesTech`, `filterProjectsByTech`, `countProjectsUsingSkill`, `getSkillUsage`, `questUsageLabel`, `techFilterHref` and `parseTechParam`. Skills match project `tech` case-insensitively after trimming (`toNameKey` in the new leaf module `src/lib/names.ts`, shared with the stats and the profile schema). Theme helper `animate-pip-unlock` in `globals.css`.
- `/projects?tech=<name>` (#9) lists only the projects using that technology under a "Quests using <name>" heading (spelled as in the project data) with a "Show all quests" link; an unknown or empty value shows the "No matching quests" empty state (the raw query text is never echoed), and a repeated `tech` param uses its first occurrence. `searchParams` is read inside a Suspense boundary so the page header stays in the static shell. `/projects` without the parameter is unchanged.

- Experience as a quest log (#8): `/experience` keeps its newest-first `<ol>`, now drawn on a glowing rune line with a node per role (filled for an ongoing role) and a `Quest log` page label. Each role is a native `<details>` chapter (no JavaScript needed; Enter or Space on the summary toggles it): the summary shows a `Chapter 01`-style label numbered from the newest role, a `Current` tag for an ongoing role, the role and company, and the location; the body shows the highlights and technology `Tag`s and stays in the DOM while collapsed. The latest chapter starts open. Opening plays a short fade-and-settle reveal (`animate-chapter-reveal`) and turns the chevron marker; both are off under reduced motion. The empty state is unchanged.
- `toPublicExperience` in `src/lib/experience.ts`: the one redaction helper for experience output, used by the Experience page and `/api/experience`. It keeps the order, keeps `startDate`/`endDate` only for roles at the `DATED_COMPANY_LIMIT` most recent distinct companies (trimmed exact match, several roles at one company count once) and omits both keys from every other entry; every entry gets a date-free `current` flag. `DATED_COMPANY_LIMIT` is `0`, so no experience dates are shown or returned anywhere for now; the owner can date recent roles again by changing only that constant. No other output (metadata, JSON-LD, sitemap, feeds) contains experience data.
- `useMediaQuery` hook in `src/lib/hooks/use-media-query.ts` (#7, missing from the #7 entry): whether a media query matches, live, with a calm server value so effects never flash on before hydration. `TiltCard` uses it to tilt only for a fine, hovering pointer.
- `CARD_SURFACE` and `CARD_INTERACTIVE` class strings exported from `Card`, for panel surfaces that cannot be a `Card` element (the quest log's `<details>` chapters).

- Projects as completed quests (#7): `/projects` and the home "Featured projects" section show a responsive card grid (1 column on phones, 2 from 640 px, 3 from 1024 px) built on `Card`. Each card has a decorative image, a `Quest complete` / `Active quest` HUD label, the title, summary and technology `Tag`s. The whole card is one link (the title link stretched over the card, no nested links); hover and keyboard focus light the same glow, and focus draws the ring around the card. On a mouse with a fine, hovering pointer the card tilts towards the pointer (at most 6 degrees, CSS transforms only, reset on leave) via the small client component `TiltCard`; there is no tilt on touch or pen, or under reduced motion (the glow stays).
- The Projects page header is a quest board (`Quest board` label; `PageHeader` takes an optional `label`). The project detail page gets the same style: a ghost "All projects" back link, status label, glowing title, summary, the hero image (still eager, high priority) in a rune-lined frame, the description, and a details panel with the technologies and the live/repo links as `ButtonLink`s (external, `rel="noopener noreferrer"`, announced as opening in a new tab).
- `toPublicProject` / `toPublicProjects` in `src/lib/projects.ts`: the one redaction helper for project output. It returns an allowlist of fields without `startDate`/`endDate` (keys omitted) plus a date-free `status` (`complete` or `active`).

- Home title screen (#6): the hero is a glowing panel where the mochkai logo "boots up" (a CSS flicker-to-steady glow under 1.2 s that starts dimmed, never hidden), a `Player 1 · <title>` HUD label, the name as the only `<h1>`, title, location and bio, a pulsing "Press Start" CTA to `/projects` (accessible name "Press Start: view projects"), and secondary `ButtonLink` CTAs to `/experience` (outlined) and `/about` (ghost), replacing the one-off link styles. A scoreboard below shows Quests completed (project count), Skills unlocked (distinct project technologies, case-insensitive), Class and Currently learning, computed in `src/lib/stats.ts`. Under reduced motion neither animation runs. Featured projects on the home page no longer show dates.
- Optional profile fields `characterClass` and `currentlyLearning` (zod-validated, returned by `/api/profile` when set). Class falls back to `title`; the Currently learning tile is hidden when the field is missing or empty.
- Theme helpers `drop-shadow-glow`, `animate-boot` and `animate-cta-pulse` in `globals.css`.

- HUD frame (#5): a thin glowing "boost meter" fixed to the top of the viewport fills with reading progress (empty at the top of a page, full at the bottom). It is decorative (hidden from screen readers, ignores the pointer, no layout shift); under reduced motion it still shows the position but without easing. Pages too short to scroll show it empty.
- Arcane Tech design system foundation (#4): base UI primitives in `src/components/ui/` (`Card`, `Button`, `ButtonLink`, `Tag`, `Label`, `StatTile`, `StatGrid`), glow utilities (`shadow-glow*`, `inset-shadow-rune`, `text-shadow-glow*`), a `usePrefersReducedMotion` hook and a `cx` class-name helper.
- `DESIGN.md` design brief (responsive, games/tech feel, black and blue with neon highlights, motion) and the mochkai logo at `public/images/logo.svg`.
- Global error page: a last-resort "Something went wrong" page with a retry button for failures in the root layout.

### Changed

- `NavLinks` (#10): on phones the items share one row through `grid-flow-col auto-cols-auto` instead of a fixed `grid-cols-3`, so the fourth item fits at 375 px with 44 px targets; the decorative node markers are hidden below 640 px to make room (the current page keeps its fill and underline bar).
- `DESIGN.md`: the journey table and navigation describe the Contact destination, and the project structure lists `src/lib/names.ts`.

- Skills in `profile.json` (#9) are ranked `{ "name", "rank" }` objects instead of strings, with `rank` one of `mastered`, `proficient` or `learning` (placeholder ranks for now). `profileSchema` rejects an unknown rank, a blank skill name, a blank or empty category name, a category with no skills and duplicate skill names across the whole list (case-insensitive, trimmed; the error names the skill). **Breaking:** `/api/profile` returns the new `skills` item shape.
- `DESIGN.md`: the `accent` token row no longer lists timeline markers, and the project structure lists `src/lib/skills.ts`.

- `/api/experience` (#8) returns redacted entries: no `startDate`/`endDate` keys (with `DATED_COMPANY_LIMIT = 0`), plus a `current` boolean.

- `DESIGN.md` Motion (#7): "no 3D" now means no 3D scenes, models or WebGL. The only perspective effect allowed is the subtle hover tilt on project cards (at most 6 degrees, fine pointer only, off under reduced motion).
- No project dates anywhere (#7, owner update): project cards, the detail page, its metadata, `/api/projects` and `/api/projects/[slug]` no longer render or return `startDate`/`endDate`; every output goes through `toPublicProjects`. Dates stay in `projects.json` for ordering. `ProjectList`'s `showDates` prop is removed, and `ProjectList` only accepts redacted projects.
- `DESIGN.md` "Content and privacy": no dates (dates, date ranges or durations) are rendered or exposed anywhere (pages, API responses, metadata, JSON-LD). Experience keeps a `DATED_COMPANY_LIMIT` constant, currently `0` (#8), and project dates are redacted from pages and API (#7); dates may stay in the JSON data for ordering. This replaces the earlier "dates only for the 4 most recent companies" rule.
- The header is a HUD bar (#5): logo plus name as the home link, nav items as world-map destinations with a rune node marker and dashed path, and the current section shown with a glow, a filled marker and an underline. On phones the three destinations sit in one row of equal, 44 px-tall touch targets; from 640 px up the header stays on screen while scrolling. The footer gets a matching rune-line divider and glowing social links, and the skip link is restyled as a glowing HUD chip. Hovers last 150 ms and are off under reduced motion.
- One dark color scheme replaces the placeholder light and dark tokens: dark slate background, neon blue accents and white highlights, with every text/background pair meeting WCAG AA. Light mode is gone.
- Fonts are now Space Grotesk (headings), Inter (body) and JetBrains Mono (labels, tags, stats).
- Technology lists render as mono `Tag` chips.
- Animations and transitions are turned off when the system asks for reduced motion.
- `DESIGN.md` documents the Arcane Tech direction: audience, concept, journey structure, privacy rules (no age signals), typography, palette with contrast ratios, motion and the base primitives.
- `DESIGN.md` now also documents the development conventions: stack, quality gates, testing, configuration, Docker and workflow. It also records the owner's decisions on reduced motion, the dark color tokens and the Node version.
- Invalid server configuration stops the production server (`npm start`, `docker:prod`) at startup with exit code 1 and logs each problem, instead of answering every request with an error. `next dev` (`npm run dev`, `docker:dev`) logs them and keeps running, showing the error on each request.
- `NODE_ENV` is no longer validated as part of the server configuration.
- Node.js 24 everywhere: `.node-version` and `.nvmrc` (24.22.3), `engines` `>=24 <25`, Docker images `node:24.22.3-alpine3.24`, `@types/node` 24.
- The README's "before opening a PR" checklist now also lists `npm run format:check` and `npm run test:e2e` (for UI or route changes), matching the quality gates in `DESIGN.md`.
- Hero and project images use `loading="eager"` and `fetchPriority="high"` instead of the deprecated `priority` prop.

### Fixed

- The `animate-chapter-reveal` comment in `globals.css` said the reveal was turned off with `motion-reduce:`; it is applied only under `motion-safe:`.

- Unknown `/projects/<slug>` URLs return a real HTTP 404 with the not-found page (previously HTTP 200).
- An API error response still returns the JSON 500 body when the CORS headers cannot be built, for example because `CORS_ALLOWED_ORIGINS` is invalid.

### Security

- Security headers on all responses: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`.
- The `X-Powered-By` header is no longer sent.

## [0.1.0] - 2026-11-21

### Added

- App and pages: Next.js 16 portfolio (App Router, Cache Components, React 19, Tailwind 4) with Home, About, Projects, project detail and Experience pages, plus error and not-found pages.
- Data layer: content in JSON under `src/data/`, validated by zod schemas, read through a `PortfolioRepository` interface selected by `DATA_SOURCE` (only `json` for now); adding a source takes one repository file, an enum value and a switch case.
- API and CORS: read-only endpoints `/api/health`, `/api/profile`, `/api/projects` (with `?featured=true|false`), `/api/projects/[slug]` and `/api/experience`, with `OPTIONS` preflight and origin allow-listing via `CORS_ALLOWED_ORIGINS`.
- Config validation: server and public environment variables validated with zod at startup; `CORS_ALLOWED_ORIGINS` entries must be exact origins or `*`.
- Security hardening: http(s)-only URLs, site-path-only images, start/end date-range validation, an API error wrapper that returns a generic 500, immutable (deep-frozen) repository data, and no echoing of user input in error responses.
- Docker: dev service with hot reload (port 3000, runs as `node`), production profile with a multi-stage standalone image and healthcheck (port 3001), and `docker:dev`, `docker:prod` and `docker:down` scripts.
- Testing: Vitest unit, component and API route tests, and Playwright e2e tests against a production build on port 3100 (`E2E_PORT`).
- Documentation: README with setup, Docker, environment variables, API and workflow guides.

[Unreleased]: https://github.com/mochkai/mochkai-portfolio/commits/master
