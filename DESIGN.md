# Design Guidelines for this project

## Visual design

### Audience

Recruiters and people at any tech company. The site has a personal feel, but the content is clean, scannable and professional: someone skimming for 30 seconds should find the role, skills, projects and contact without decoding a game.

### Concept: Arcane Tech

A dark slate background lit by glowing blue, rune-like circuit lines, with white highlights. Picture glowing blue ancient technology on dark stone, the energy of a high-speed arcade sports game, and the journey structure of a fantasy RPG. These are inspiration only: no names, logos, characters, art, fonts, sounds or assets from any game.

The colors come from the mochkai logo (`public/images/logo.svg`): blues `#0071bc` and `#0000ff`, plus `#1a1a1a`, `#4d4d4d` and white. `#0000ff` is too dark to read on the dark background, so it is reserved for decorative gradients.

**Gaminess 5/10.** Game touches live in the frame and the details (HUD labels, rune lines, glow, journey naming, the boost meter), never in the content. Headings, job titles, project summaries and skills read like a normal professional portfolio.

### Journey structure

| Page       | Framing          |
| ---------- | ---------------- |
| Home       | Title screen     |
| About      | Character sheet  |
| Experience | Quest log        |
| Projects   | Completed quests |
| Contact    | "Join the party" |

Navigation is a HUD-style bar. A thin scroll "boost meter" shows reading progress. The framing shows in labels and layout, not in renamed content: an Experience entry still says "Senior Developer, Company", not "Level 40 Wizard".

### Content and privacy

**No age signals anywhere on the site.** No total years of experience, no "years coding" stat, no years-per-skill stat, no career start year, no graduation years, no birth date. They are never rendered or exposed in pages, API responses, JSON-LD, metadata, alt text or stats. Every later issue must follow this rule.

- No dates (dates, date ranges or durations) are rendered or exposed anywhere: pages, API responses, metadata, JSON-LD.
- Experience keeps a single `DATED_COMPANY_LIMIT` constant in `src/lib/experience.ts`, currently `0` (see #8), so the owner can switch dates back on later for the roles at the most recent companies only. Every experience output (the page, `/api/experience`, any future metadata or feed) goes through `toPublicExperience`, which omits the date keys of every entry outside that limit. An ongoing role may be labelled "Current" (no dates, no durations, no "Active quest"); undated roles get no "earlier experience" heading and no count of years or roles.
- Project dates are also redacted from pages and API (see #7).
- Dates may remain in the JSON data for ordering.
- Stat tiles use values derived from the content data (for example projects completed, distinct technologies, class/role, currently learning), never invented numbers.
- Skills are a skill tree with owner-set ranks **Mastered / Proficient / Learning**, shown as 3 pips with a text label, plus "Used in N quests" (counted from the projects). Never percentage bars.

### Responsive design

The interface must always take into account phone, tablet and monitor screen sizes and adapt accordingly. Check every change at 375 px, 768 px and 1280 px: no horizontal scrolling, nothing clipped or overlapping.

### Typography

Loaded with `next/font/google` in `src/app/layout.tsx` (self-hosted, no requests to Google).

| Role                       | Font           | CSS variable          | Utility        |
| -------------------------- | -------------- | --------------------- | -------------- |
| Headings, display, buttons | Space Grotesk  | `--font-display-face` | `font-display` |
| Body text                  | Inter          | `--font-body`         | `font-sans`    |
| HUD labels, tags, stats    | JetBrains Mono | `--font-code`         | `font-mono`    |

`h1` to `h6` get `font-display` from the base layer. Keep mono for short labels and data, never paragraphs. Body copy stays under about 75 characters per line (`max-w-prose` / `max-w-2xl`).

### Color palette

One dark scheme, no light mode and no theme toggle. `color-scheme: dark` is set on `html`. Tokens are CSS variables in `src/app/globals.css`, exposed as Tailwind utilities through `@theme inline` (`bg-surface`, `text-neon`, `border-line`, ...). Components use the utilities, never raw colors.

| Token               | Value          | Role                                                                                     |
| ------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| `background`        | `#07090f`      | Page background (dark stone).                                                            |
| `surface`           | `#0e1420`      | Slate panels: cards, header and footer.                                                  |
| `surface-raised`    | `#141c2c`      | Panels on panels, ghost button hover.                                                    |
| `line`              | `#12304d`      | Thin rune-line borders and dividers. Decorative only, never the only cue for a control.  |
| `foreground`        | `#eef6ff`      | Primary text and headings (white highlight).                                             |
| `muted`             | `#8aa3bd`      | Secondary text: intros, summaries, metadata.                                             |
| `brand`             | `#0071bc`      | Logo blue. Fills, borders, glow sources and large text (24 px+, or 18.66 px+ bold) only. |
| `neon`              | `#39a8ff`      | Links, HUD labels, focus ring, primary button border and glow source.                    |
| `glow`              | `#7cc7ff`      | Glowing highlights: tag text, stat values, secondary button text.                        |
| `accent`            | = `neon`       | Legacy name kept for existing components (links, solid buttons).                         |
| `accent-foreground` | = `background` | Text on a solid `accent` fill.                                                           |
| `accent-soft`       | `#0b2440`      | Tinted blue panel fill.                                                                  |

Measured WCAG 2.2 contrast ratios (AA: 4.5:1 body text, 3:1 large text and UI parts):

| Text / part                     | on `background` | on `surface` | on `surface-raised` | on `accent-soft` |
| ------------------------------- | --------------- | ------------ | ------------------- | ---------------- |
| `foreground`                    | 18.26           | 16.90        | 15.63               | 14.37            |
| `muted`                         | 7.63            | 7.07         | 6.54                | 6.01             |
| `neon` (also the focus ring)    | 7.79            | 7.21         | 6.67                | 6.13             |
| `glow`                          | 10.87           | 10.07        | 9.31                | 8.56             |
| `brand` (large text / UI only)  | 3.88            | 3.59         | 3.32                | 3.05             |
| `line` (decorative, no minimum) | 1.47            | 1.37         | 1.26                | 1.16             |

Other pairs in use:

- `accent-foreground` on solid `accent`: 7.79.
- `foreground` on `brand` fill: 4.71.
- Primary button, `foreground` on `neon` at 15% over `background` / `surface`: 15.00 / 13.40; at 25% (hover): 12.26 / 10.90.
- Secondary button hover, `glow` on `neon` at 10% over `background` / `surface`: 9.69 / 8.69.

Do not use `brand` for small text: it fails 4.5:1 on every background.

### Glow and surfaces

Glow helpers are theme values in `globals.css`, so nobody hand-rolls a box-shadow:

- `shadow-glow-sm`, `shadow-glow`, `shadow-glow-lg`: outer neon halo (small details, buttons and focused cards, hover emphasis).
- `inset-shadow-rune`: faint inner light on panels.
- `text-shadow-glow` (headlines) and `text-shadow-glow-sm` (stat values): glowing text. Use on large text only.

Glow marks what matters: the primary call to action, the hovered or focused card, the headline and key numbers. If everything glows, nothing does.

### Motion

- No 3D scenes, models or WebGL. The only perspective effect allowed is the subtle hover tilt on project cards (at most 6 degrees, fine pointer only, off under reduced motion).
- Hovers and focus effects are snappy (about 150 ms, `ease-out`): border and glow changes, a 1 px press on buttons.
- Use movement to draw attention, not as a constant: at most one orchestrated page-load moment and subtle background parallax, no fade-in on every section.
- Under `prefers-reduced-motion: reduce` every animation is off or minimal (no movement, at most a short fade). `globals.css` has a baseline that makes every transition and animation finish instantly and turns off smooth scrolling; components add `motion-reduce:` utilities for transforms; JS-driven effects check `usePrefersReducedMotion()` from `src/lib/hooks/use-prefers-reduced-motion.ts` (it returns `true` on the server, so effects never flash on before the preference is known).

### Base primitives

In `src/components/ui/`, server components, each with a co-located test. Build pages from these instead of one-off styles.

| Primitive               | Use it for                                                                                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Card`                  | Grouped content (a project, a role, a stat block): slate panel, thin `line` border, inner dashed rune line. `as` picks the element (`div`, `article`, `section`, `li`). Add `interactive` only when it contains a link or button: it glows on hover and focus-within. |
| `Button`                | Actions that do not navigate. Native `<button>`, `type="button"` by default.                                                                                                                                                                                          |
| `ButtonLink`            | Calls to action that navigate (wraps `next/link`). Same variants as `Button`.                                                                                                                                                                                         |
| `Tag`                   | A technology or skill chip (JetBrains Mono, `glow` text). For lists use `TechList`, which renders `Tag`s inside a labelled `<ul>`.                                                                                                                                    |
| `Label`                 | Small uppercase mono HUD label (`Player 1`, `Quest 02`). Write normal case, the uppercase is CSS. `rune` adds a decorative diamond. Not a form label.                                                                                                                 |
| `StatTile` / `StatGrid` | Scoreboard values: `StatGrid` is a labelled `<dl>`, each `StatTile` a `dt` (mono label) and `dd` (large glowing value). Values come from content data.                                                                                                                |

Button variants: `primary` is the glowing blue CTA, one per view; `secondary` is outlined for alternatives; `ghost` is text-only for low-emphasis actions. Join class names with `cx()` from `src/lib/cx.ts`.

## Development

### Stack

- Next.js 16.4.6, App Router, with Cache Components (`cacheComponents: true`) and partial prefetching. Configured in `next.config.ts`.
- React and React DOM 19.3.0.
- TypeScript 5 with `strict` on, `moduleResolution: bundler`, `isolatedModules`, and the `@/*` alias for `src/*` (`tsconfig.json`).
- Tailwind CSS 4.3.3. Design tokens are CSS variables in `src/app/globals.css`; components use token utilities such as `bg-surface` and `text-muted`, not raw colors.
- zod 4 for all content and environment validation.
- npm only. Commit `package-lock.json` and install with `npm ci` or `npm install` (never another package manager).
- Node.js 24, pinned to 24.22.3 in `.node-version` and `.nvmrc`, with `engines` `>=24 <25`. fnm reads either file (auto-switching on `cd` needs fnm's `--use-on-cd` shell setup); nvm users run `nvm use`, which reads `.nvmrc`. Docker images pin `node:24.22.3-alpine3.24`. When upgrading Node, change all of these together: `.node-version`, `.nvmrc`, `engines` in `package.json`, the `@types/node` major, both `FROM` lines in `Dockerfile` and the one in `Dockerfile.dev`, the pin comment in `Dockerfile`, and the Docker pin line in `README.md`.

### Next.js rule

This Next.js version has breaking changes from what you may remember. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code, as described in `AGENTS.md`.

### Project structure

- `src/app/`: pages (`/`, `/about`, `/projects`, `/projects/[slug]`, `/experience`), `error.tsx`, `global-error.tsx`, `not-found.tsx`, and API routes under `api/`.
- `src/components/`: UI components. Co-locate the component's `*.test.tsx`. Base primitives (`Card`, `Button`, `ButtonLink`, `Tag`, `Label`, `StatTile`, `StatGrid`) live in `src/components/ui/`.
- `src/data/`: JSON content (`profile.json`, `projects.json`, `experience.json`).
- `src/lib/schemas/`: zod schemas that validate the content and URLs.
- `src/lib/data/`: `PortfolioRepository` interface and the JSON implementation. Pages and routes call `getRepository()`, never read JSON directly.
- `src/lib/config/`: validated environment (`server.ts` is `server-only`, `public.ts` is for `NEXT_PUBLIC_*`).
- `src/lib/http/`: API helpers (JSON responses, CORS, error wrapper).
- `src/lib/routing/`, `src/lib/images.ts`, `src/lib/format.ts`, `src/lib/cx.ts`, `src/lib/stats.ts`: shared helpers. `src/lib/projects.ts` and `src/lib/experience.ts`: the redaction helpers every project and experience output goes through. `src/lib/skills.ts`: skill ranks, "Used in N quests" counts and the `/projects?tech=` matching. `src/lib/hooks/`: client hooks (`usePrefersReducedMotion`, `useMediaQuery`).
- `src/proxy.ts`: runs for `/projects/:slug` only and answers unknown slugs with a real 404.
- `src/instrumentation.ts` and `src/instrumentation-node.ts`: validate server config at startup.
- `public/`: static assets, including `public/images/`.
- `tests/`: Vitest tests for API routes and pages, plus `setup.ts` and fixtures. `e2e/`: Playwright tests.
- `scripts/`: build helpers (`prepare-standalone.mjs`).

Put new content in `src/data/` and its schema in `src/lib/schemas/`. A new data source needs a repository file, an entry in `DATA_SOURCES` and a `case` in `getRepository()`.

### Quality gates

Every change must pass these before a PR is opened:

- `npm run lint` (ESLint 9 flat config: `eslint-config-next` core web vitals and TypeScript).
- `npm run typecheck` (`next typegen` then `tsc --noEmit`).
- `npm test` (Vitest).
- `npm run format:check` (Prettier). Run `npm run format` to fix. Prettier uses `printWidth: 100` and `prettier-plugin-tailwindcss`, which sorts Tailwind classes.
- `npm run build` (standalone output plus `postbuild`).
- `npm run test:e2e` for any UI or route change.

### Testing

- Unit and component tests: Vitest with jsdom and Testing Library (`@testing-library/react`, `dom`, `jest-dom`, `user-event`). Setup lives in `tests/setup.ts`.
- Test files are `*.test.ts(x)`, either next to the code in `src/` or under `tests/`.
- End-to-end tests: Playwright, Chromium only. They build the app and run the standalone server on port 3100 (`E2E_PORT` overrides it).
- New behavior needs tests.

### Configuration and secrets

- Environment variables are validated with zod at startup. Empty values count as unset.
- Build-time variables (inlined or baked into the build): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CHATBOT_URL`, `DATA_SOURCE`. Changing them requires a rebuild.
- Runtime variables: `CORS_ALLOWED_ORIGINS`, `CONTENT_API_URL`, `CONTENT_API_TOKEN`.
- The full list with defaults is in `.env.example` and the README.
- `.env*` is git-ignored. Only `.env.example` is committed. Never commit secrets.

### Docker

- `npm run docker:dev`: `web` service on port 3000, `next dev` with hot reload, source bind-mounted, polling enabled for WSL.
- `npm run docker:prod`: `prod` profile on port 3001, multi-stage standalone image as a non-root user, with a `/api/health` healthcheck.
- Both Dockerfiles pin the base image. Change both `FROM` lines together.

### Accessibility and performance

Current code evidence only:

- Semantic landmarks and labels: `aria-label` on the main nav and social links, `aria-current="page"` on the active nav link, `aria-labelledby` on page sections.
- Decorative images use `alt=""`. Meaningful images have descriptive alt text.
- Hero and project detail images use `loading="eager"` and `fetchPriority="high"`. Other images use the `next/image` defaults.

Required for new work: all motion (parallax, scroll and hover animations) is reduced or turned off under `prefers-reduced-motion: reduce`. The global baseline in `globals.css`, the `motion-reduce:` utilities and `usePrefersReducedMotion()` do this (see Motion above).

### Workflow

- One branch per change, named `<type>/<issue#>-<slug>` (or `<type>/<slug>` when there is no GitHub issue), where `<type>` is a Conventional Commits type (`feat`, `fix`, `chore`, `docs`, ...).
- Every change adds an entry to `changelog.md` under `## [Unreleased]`.
- Open a pull request for review. The human merges into `master`. Do not merge your own PR.
