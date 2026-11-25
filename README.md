# mochkai-portfolio

A personal portfolio built with Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind 4 and zod. Content is stored as JSON, validated at load time, and also exposed through a small read-only JSON API that other projects (for example a separate chatbot) can consume.

Repository: https://github.com/mochkai/mochkai-portfolio

## Prerequisites

- Node.js 24 (24.22.3, pinned in `.node-version` and `.nvmrc`). fnm reads either file (switching automatically on `cd` needs fnm's `--use-on-cd` shell setup); nvm users run `nvm use`, which reads `.nvmrc`.
- npm (this project is npm-only; use the committed `package-lock.json`)
- Optional: Docker with Compose 2.24 or newer. On WSL, turn on Docker Desktop's WSL integration.

## Getting started

```bash
npm install
npm run dev      # dev server with hot reload at http://localhost:3000
npm run build    # production build (standalone output)
npm start        # run the standalone server; honours PORT (default 3000)
```

Optionally copy `.env.example` to `.env` first. Every variable is optional.

## Docker

```bash
npm run docker:dev    # dev service with hot reload at http://localhost:3000
npm run docker:prod   # prod profile (standalone build) at http://localhost:3001
npm run docker:down   # stop and remove both
```

- The dev service (`web`) runs `next dev` as the `node` user, with the source bind-mounted. File watching uses polling so it works across the WSL/Windows boundary.
- `docker:dev` passes `--renew-anon-volumes` so the container's `node_modules` and `.next` volumes are recreated from the freshly built image, which makes new dependencies show up after `package.json` changes.
- The prod service builds `Dockerfile` (multi-stage, standalone server, non-root user, `/api/health` healthcheck) and maps container port 3000 to host port 3001.
- Both Dockerfiles pin the base image to `node:24.22.3-alpine3.24`. When upgrading Node, bump these together: `.node-version`, `.nvmrc`, `engines` in `package.json`, the `@types/node` major, the `FROM` lines in `Dockerfile` (both) and `Dockerfile.dev`, the pin comment in `Dockerfile`, and this line.
- Build-time variables: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CHATBOT_URL` and `DATA_SOURCE` are passed as build args, so changing them requires a rebuild (`docker:prod` already uses `--build`). Runtime variables: `CORS_ALLOWED_ORIGINS`, `CONTENT_API_URL` and `CONTENT_API_TOKEN`, read from `.env` when the container starts.

## Scripts

| Script                 | What it does                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`          | Start the Next.js dev server                                                                |
| `npm run build`        | Production build; `postbuild` copies `public/` and static assets into the standalone output |
| `npm start`            | Run `.next/standalone/server.js` (honours `PORT`)                                           |
| `npm run lint`         | ESLint                                                                                      |
| `npm run typecheck`    | `next typegen` then `tsc --noEmit`                                                          |
| `npm test`             | Vitest unit tests (single run)                                                              |
| `npm run test:watch`   | Vitest in watch mode                                                                        |
| `npm run test:e2e`     | Playwright end-to-end tests                                                                 |
| `npm run format`       | Prettier, write changes                                                                     |
| `npm run format:check` | Prettier, check only                                                                        |
| `npm run docker:dev`   | Docker dev service with hot reload (port 3000)                                              |
| `npm run docker:prod`  | Docker prod profile (port 3001)                                                             |
| `npm run docker:down`  | Stop and remove the Docker services                                                         |

## Environment variables

Copy `.env.example` to `.env`. Values are validated with zod when the server starts. Invalid values log every problem and stop the production server with exit code 1; `next dev` keeps running and shows the error on each request. Empty values count as unset.

| Name                      | Required | Default                 | When    | Description                                                                                             |
| ------------------------- | -------- | ----------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `DATA_SOURCE`             | No       | `json`                  | Build   | Where content comes from. Only `json` is implemented. Pages are prerendered, so set it before building. |
| `CORS_ALLOWED_ORIGINS`    | No       | empty (no cross-origin) | Runtime | Comma-separated origins allowed to call `/api` from a browser. `*` allows any origin.                   |
| `CONTENT_API_URL`         | No       | unset                   | Runtime | Placeholder for a future remote content source. Unused by the `json` source.                            |
| `CONTENT_API_TOKEN`       | No       | unset                   | Runtime | Placeholder for a future remote content source. Unused by the `json` source.                            |
| `NEXT_PUBLIC_SITE_URL`    | No       | `http://localhost:3000` | Build   | Canonical site URL for metadata and Open Graph links. Inlined into the bundle.                          |
| `NEXT_PUBLIC_CHATBOT_URL` | No       | unset                   | Build   | URL of a separate chatbot app. Reserved for a future integration; not used yet.                         |

`CORS_ALLOWED_ORIGINS` entries must be exact origins: `*`, or something like `https://example.com` or `http://localhost:4000`, with no path and no trailing slash. Anything else is rejected at startup.

## Content and data layer

Content lives in JSON files in `src/data/` (`profile.json`, `projects.json`, `experience.json`) and is validated by zod schemas in `src/lib/schemas/`. Pages and API routes never read files directly; they call `getRepository()` from `src/lib/data`, which returns a `PortfolioRepository` for the configured `DATA_SOURCE`. The JSON repository validates and deep-freezes its data, so it cannot be mutated by callers.

To add a new source, such as a headless CMS or a custom content API:

1. Add `src/lib/data/<name>-repository.ts` implementing `PortfolioRepository` and validating its output with the schemas.
2. Add `<name>` to `DATA_SOURCES` in `src/lib/config/server.ts`.
3. Add one `case` in `getRepository()` in `src/lib/data/index.ts` (the compiler flags a missing case).

Image rules: images must be site paths under `public/` (for example `/images/avatar.svg`); remote URLs are rejected by the schemas. Once a CMS is added, add its asset host to `images.remotePatterns` in `next.config.ts` and widen `imageSrcSchema`. Links must be `http:` or `https:` URLs, and an `endDate` may not be earlier than its `startDate` (dates are `YYYY-MM`, `endDate: null` means ongoing).

## Public API

A read-only JSON API for other projects. All endpoints use `GET` (and `OPTIONS` for preflight).

| Endpoint               | Returns                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `/api/health`          | `{ "status": "ok" }` (liveness check)                             |
| `/api/profile`         | The profile object                                                |
| `/api/projects`        | Array of projects, newest first. Optional `?featured=true\|false` |
| `/api/projects/[slug]` | A single project                                                  |
| `/api/experience`      | Array of experience entries, most recent first                    |

Errors are JSON `{ "error": "<message>" }`:

- `400`: `?featured` was something other than `true` or `false`.
- `404` `{ "error": "Project not found" }`: unknown or malformed slug. The input is never echoed back.
- `500` `{ "error": "Internal server error" }`: unexpected failure; details are only in the server log.

Unknown `/projects/<slug>` pages show the not-found page with HTTP 404. The check runs in Proxy (`src/proxy.ts`) against the bundled project data, is case-sensitive, and must be updated when content moves to a CMS.

CORS: no cross-origin access by default. Set `CORS_ALLOWED_ORIGINS` to allow browser origins. For an allowed origin (or any origin with `*`), responses carry `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods: GET, OPTIONS`, `Access-Control-Allow-Headers: Content-Type` and `Access-Control-Max-Age: 86400`. Other origins get only `Vary: Origin`. `OPTIONS` requests are answered with `204` and the same CORS headers.

Every response, including pages and static files, also sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`, so the site cannot be embedded in frames. The `X-Powered-By` header is disabled.

## Testing

- Unit and component tests: `npm test` (Vitest, jsdom, Testing Library).
- End-to-end tests: `npm run test:e2e` (Playwright, chromium). They build the app and run the production server on port 3100, so they do not clash with the dev or Docker ports. Change the port with `E2E_PORT`.
- First-time e2e setup: `npx playwright install chromium`. On Linux/WSL, chromium also needs system libraries: `sudo npx playwright install-deps chromium`.

## Project structure

```
src/
  app/          Pages (/, /about, /projects, /projects/[slug], /experience) and /api routes
  components/   UI components
  data/         JSON content (profile, projects, experience)
  lib/
    config/     Validated environment variables (server and public)
    data/       Repository interface and implementations
    http/       API helpers: JSON responses, CORS, error wrapper
    schemas/    zod schemas for the content
e2e/            Playwright tests
tests/          Vitest tests (API routes, pages) and shared setup
public/         Static assets, including images
scripts/        Build helper scripts
```

## Known limitations

- There is no dark-mode toggle; the site follows the system setting.

## Deployment

Not decided yet. Options:

- Vercel.
- The Docker image on a VPS (for example Hetzner, or Fly.io), optionally managed with Coolify.
- A container platform such as Google Cloud Run.

Remember that `NEXT_PUBLIC_*` variables and `DATA_SOURCE` are baked in at build time.

## Contributing

- Work on a feature branch; changes are reviewed and merged into `master` through pull requests.
- Before opening a PR, run `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check` and `npm run build`, plus `npm run test:e2e` for UI or route changes.
- Update `changelog.md` with every change.
