#!/bin/sh
set -e

# Apply pending Prisma migrations against the runtime database.
# Prisma reads DIRECT_URL from schema.prisma for migrations (set it in env).
echo "-> Applying database migrations..."
./node_modules/.bin/prisma migrate deploy || echo "WARN: migrate deploy failed (continuing)"

# Start the standalone Next.js server. output:'standalone' emits server.js at
# the app root, and reads PORT + HOSTNAME from env.
echo "-> Starting Jewel Factory on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}..."
exec node server.js
