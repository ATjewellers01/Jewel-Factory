#!/bin/sh
set -e

# Apply pending Prisma migrations against the runtime database.
# Prisma reads DIRECT_URL from schema.prisma for migrations (set it in env).
echo "→ Applying database migrations..."
./node_modules/.bin/prisma migrate deploy

# Start the Next.js server.
echo "→ Starting Jewel Factory on port ${PORT:-3000}..."
exec ./node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
