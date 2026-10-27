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
  // Longer TTL for the mobile client's bearer token (decision #2). The browser
  // cookie keeps COOKIE_TTL_SECONDS; this is used only when issuing/verifying a
  // token presented by the native app, so an 8h hard logout doesn't hit mid-shift
  // on a shop floor. Default 7 days. Optional — falls back to this default.
  MOBILE_TOKEN_TTL_SECONDS: z.coerce.number().default(604800),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),

  EMBEDDER_URL: z.string().optional(),
  EMBEDDER_API_KEY: z.string().optional(),
  // AI-Features service (catalog image + transparent PNG + name/description).
  // Same deployment can also serve /embed/* — see EMBEDDER_URL. Optional: if unset,
  // the "Generate with AI" button is hidden and manual add works as before.
  AI_FEATURES_URL: z.string().optional(),
  AI_FEATURES_API_KEY: z.string().optional(),

  // O2D order-creation integration (lib/integrations/o2d.ts) -- server-to-server,
  // shared secret, no manufacturer login. Optional: if unset, "Assign items" keeps
  // working exactly as before (internal Customised Order only, no O2D order).
  O2D_INTEGRATION_BASE_URL: z.string().optional(),
  O2D_INTEGRATION_SECRET: z.string().optional(),

  // WhatsApp Cloud API (lib/whatsapp.ts). Optional: if the token or phone
  // number ID is unset, no WhatsApp message is sent and email works as before.
  // The sending number is whichever WHATSAPP_PHONE_NUMBER_ID points at.
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_TEMPLATE_ORDER_APPROVED: z.string().default('jf_order_approved_2'),
  WHATSAPP_TEMPLATE_ORDER_PLACED: z.string().default('jf_order_placed'),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().default('en_US'),
  // Attach the order PDF to the order-placed message. Needs a Document-header
  // template; leave false until WHATSAPP_TEMPLATE_ORDER_PLACED points at one,
  // or Meta rejects the send (text-only until then).
  WHATSAPP_ORDER_PDF: z.coerce.boolean().default(false),
  // Outside production every message goes ONLY to this number (the local DB
  // holds real retailers' numbers); unset there = nothing is sent at all.
  // Ignored in production.
  WHATSAPP_TEST_RECIPIENT: z.string().optional(),

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
