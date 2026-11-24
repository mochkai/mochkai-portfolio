# syntax=docker/dockerfile:1
# Production image: multi-stage build of the Next.js standalone server.

# Base images are pinned to an exact Node and Alpine release (node:22.23.5-alpine3.24, checked
# on Docker Hub) so builds are reproducible; bump both FROM lines together.
FROM node:22.23.5-alpine3.24 AS base
# libc6-compat helps some native Node modules run on Alpine (musl).
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Install dependencies from the lockfile only (cached unless it changes).
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build the app. NEXT_PUBLIC_* values are inlined here, so pass them as build args.
FROM base AS builder
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CHATBOT_URL
ARG DATA_SOURCE=json
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_CHATBOT_URL=$NEXT_PUBLIC_CHATBOT_URL \
    DATA_SOURCE=$DATA_SOURCE
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Call `next build` directly: the runner stage copies public/ and .next/static itself, so the
# `postbuild` copy step (only needed for a local `npm start`) is skipped here.
RUN npx next build

# 3. Minimal runtime: only the standalone server, static assets and public files.
#    The standalone output does not include public/ or .next/static, so copy them explicitly.
FROM node:22.23.5-alpine3.24 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1

CMD ["node", "server.js"]
