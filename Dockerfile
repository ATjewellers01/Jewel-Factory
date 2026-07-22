# ── Jewel Factory — production Dockerfile (multi-stage, standalone output) ────
# Next.js 15 (output:'standalone') + Prisma + pnpm. Runs `prisma migrate deploy`
# on container start, then the standalone Next server.

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Prisma needs openssl at build + run time.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# 1. Install dependencies (with lockfile)
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# 2. Build (prisma generate + next build in STANDALONE mode)
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DOCKER_BUILD=1 turns on output:'standalone' in next.config.ts.
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy DB URLs so Prisma/Next don't fail at build time; real values at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV DIRECT_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN pnpm build

# 3. Runtime image — only the standalone server + static + public + prisma
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone bundles the minimal server + traced node_modules into .next/standalone.
COPY --from=build /app/.next/standalone ./
# Static assets + public are NOT included in standalone — copy them alongside.
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Keep the pnpm dependency graph intact so Prisma CLI's linked runtime
# dependencies are available for `migrate deploy` at container start.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
