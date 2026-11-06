# ==============================================================================
# NIVA Web Frontend — Production Multi-Stage Dockerfile
# ==============================================================================

# --- Stage 1: Build & Standalone Tracing ---
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# Copy monorepo workspace configuration, tsconfig base, and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy packages and web application source
COPY packages ./packages
COPY apps/web ./apps/web

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Build Next.js with standalone output enabled for container runtime
ENV DOCKER_BUILD=1 NODE_ENV=production
RUN pnpm --filter @niva/web build

# --- Stage 2: Minimal Production Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

# Install wget for container healthchecks
RUN apk add --no-cache wget

# Create non-root system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Copy standalone output bundle and static assets
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
