# ==============================================================================
# NIVA Core API — Production Multi-Stage Dockerfile
# ==============================================================================

# --- Stage 1: Build & Compile ---
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# Copy monorepo workspace configuration, tsconfig base, and lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy packages and API application source
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies and compile TypeScript
RUN pnpm install --frozen-lockfile
RUN pnpm build:packages && \
    pnpm --filter @niva/api build

# Prune development dependencies for lean production deployment
RUN pnpm --filter @niva/api --prod --legacy deploy /app/pruned-api

# --- Stage 2: Minimal Production Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

# Install wget for container healthchecks
RUN apk add --no-cache wget

# Create unprivileged system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

ENV NODE_ENV=production \
    PORT=4000

# Copy pruned production dependencies, compiled dist, and migration files
COPY --from=builder --chown=nestjs:nodejs /app/pruned-api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/src/database/migrations ./dist/database/migrations
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/src/database/migrations ./src/database/migrations

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health || exit 1

# Support graceful shutdown on SIGTERM
STOPSIGNAL SIGTERM

CMD ["node", "-e", "const fs=require('fs'); const m=fs.existsSync('./dist/main.js')?'./dist/main.js':'./dist/apps/api/src/main.js'; require(m);"]
