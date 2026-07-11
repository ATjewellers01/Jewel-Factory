# ── Jewel Factory — production Dockerfile (multi-stage) ──────────────────────
# Next.js 15 + Prisma + pnpm. Runs `prisma migrate deploy` on container start,
# then `next start`.

FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Prisma needs openssl at build + run time.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# 1. Install dependencies (with lockfile)
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# 2. Build (prisma generate + next build)
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy DB URLs so Prisma/Next don't fail at build time; real values at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV DIRECT_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# 3. Runtime image — copy built app + prod deps
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# App + built output + deps (node_modules already contains the generated Prisma client)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
