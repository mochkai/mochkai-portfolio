# Design Guidelines for this project

## Visual design

### Prioritize responsive design

The interface must always take into account phone, tablet and monitor screen sizes and adapt accordingly.

### Design Direction

This is a portfolio page for a developer with a passion for games and technology and it should reflect that.

### Color Scheme

It should use mainly shades of black, blue and some highlights in white. Use the mochkai logo (public/images/logo.svg) as a reference to the colors and style the author wants to use.
Use lighting and neon effects to give the interface a modern and techy look.

This color scheme wins over the current tokens. All token values in `src/app/globals.css`, both the light set and the dark set under `prefers-color-scheme: dark`, are placeholders. The redesign replaces them with a single dark scheme (black and blue, with neon highlights) that follows this brief.

### Movement

Add some movement to the elements so they don't just sit statically on the page. Use parallax scrolling, interactive hovers, enticing call to action buttons and any other technique that can give the page a fun and dynamic feel.

Motion must respect `prefers-reduced-motion`: for users who prefer reduced motion, parallax, scroll and hover animations are reduced or turned off.

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
- `src/components/`: UI components. Co-locate the component's `*.test.tsx`.
- `src/data/`: JSON content (`profile.json`, `projects.json`, `experience.json`).
- `src/lib/schemas/`: zod schemas that validate the content and URLs.
- `src/lib/data/`: `PortfolioRepository` interface and the JSON implementation. Pages and routes call `getRepository()`, never read JSON directly.
- `src/lib/config/`: validated environment (`server.ts` is `server-only`, `public.ts` is for `NEXT_PUBLIC_*`).
- `src/lib/http/`: API helpers (JSON responses, CORS, error wrapper).
- `src/lib/routing/`, `src/lib/images.ts`, `src/lib/format.ts`: shared helpers.
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

Required for new work: all motion (parallax, scroll and hover animations) is reduced or turned off under `prefers-reduced-motion: reduce`. No code does this yet.

### Workflow

- One branch per change, named `<type>/<issue#>-<slug>` (or `<type>/<slug>` when there is no GitHub issue), where `<type>` is a Conventional Commits type (`feat`, `fix`, `chore`, `docs`, ...).
- Every change adds an entry to `changelog.md` under `## [Unreleased]`.
- Open a pull request for review. The human merges into `master`. Do not merge your own PR.
