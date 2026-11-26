# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Home title screen (#6): the hero is a glowing panel where the mochkai logo "boots up" (a CSS flicker-to-steady glow under 1.2 s that starts dimmed, never hidden), a `Player 1 · <title>` HUD label, the name as the only `<h1>`, title, location and bio, a pulsing "Press Start" CTA to `/projects` (accessible name "Press Start: view projects"), and secondary `ButtonLink` CTAs to `/experience` (outlined) and `/about` (ghost), replacing the one-off link styles. A scoreboard below shows Quests completed (project count), Skills unlocked (distinct project technologies, case-insensitive), Class and Currently learning, computed in `src/lib/stats.ts`. Under reduced motion neither animation runs. Featured projects on the home page no longer show dates.
- Optional profile fields `characterClass` and `currentlyLearning` (zod-validated, returned by `/api/profile` when set). Class falls back to `title`; the Currently learning tile is hidden when the field is missing or empty.
- Theme helpers `drop-shadow-glow`, `animate-boot` and `animate-cta-pulse` in `globals.css`.

- HUD frame (#5): a thin glowing "boost meter" fixed to the top of the viewport fills with reading progress (empty at the top of a page, full at the bottom). It is decorative (hidden from screen readers, ignores the pointer, no layout shift); under reduced motion it still shows the position but without easing. Pages too short to scroll show it empty.
- Arcane Tech design system foundation (#4): base UI primitives in `src/components/ui/` (`Card`, `Button`, `ButtonLink`, `Tag`, `Label`, `StatTile`, `StatGrid`), glow utilities (`shadow-glow*`, `inset-shadow-rune`, `text-shadow-glow*`), a `usePrefersReducedMotion` hook and a `cx` class-name helper.
- `DESIGN.md` design brief (responsive, games/tech feel, black and blue with neon highlights, motion) and the mochkai logo at `public/images/logo.svg`.
- Global error page: a last-resort "Something went wrong" page with a retry button for failures in the root layout.

### Changed

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
