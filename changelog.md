# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

### Known issues

- Unknown `/projects/<slug>` pages show the not-found UI with `noindex` but return HTTP 200 because of Cache Components; the API returns a proper 404.

[Unreleased]: https://github.com/mochkai/mochkai-portfolio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mochkai/mochkai-portfolio/releases/tag/v0.1.0
