import { z } from 'zod';

/**
 * Server-only env. Import from server code (route handlers, server components,
 * scripts) — never from client components. Values are validated lazily on first
 * access so the app can still build without every secret set.
 */
const ServerEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  MANUFACTURER_SECRET: z.string().min(32),
  STORE_SECRET: z.string().min(32),
  MANAGER_SECRET: z.string().min(32),
  // Store-manager (branch) login secret. Optional so existing deploys don't break;
  // falls back to MANAGER_SECRET at use-site. Set a distinct value in production.
  BRANCH_MANAGER_SECRET: z.string().min(32).optional(),
  COOKIE_TTL_SECONDS: z.coerce.number().default(28800),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  EMBEDDER_URL: z.string().optional(),
  EMBEDDER_API_KEY: z.string().optional(),
  // AI-Features service (catalog image + transparent PNG + name/description).
  // Same deployment can also serve /embed/* — see EMBEDDER_URL. Optional: if unset,
  // the "Generate with AI" button is hidden and manual add works as before.
  AI_FEATURES_URL: z.string().optional(),
  AI_FEATURES_API_KEY: z.string().optional(),
  QDRANT_URL: z.string().optional(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_MANUFACTURER_COLLECTION: z
    .string()
    .default('jewelfactory_manufacturer_products'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  FROM_EMAIL: z.string().optional(),
  FROM_NAME: z.string().default('Jewel Factory'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),

  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
  }
  cached = parsed.data;
  return cached;
}
