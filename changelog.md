# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `DESIGN.md` design brief (responsive, games/tech feel, black and blue with neon highlights, motion) and the mochkai logo at `public/images/logo.svg`.
- Global error page: a last-resort "Something went wrong" page with a retry button for failures in the root layout.

### Changed

- Invalid server configuration stops the production server (`npm start`, `docker:prod`) at startup with exit code 1 and logs each problem, instead of answering every request with an error. `next dev` (`npm run dev`, `docker:dev`) logs them and keeps running, showing the error on each request.
- `NODE_ENV` is no longer validated as part of the server configuration.
- Docker base images are pinned to `node:22.23.5-alpine3.24`.
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
