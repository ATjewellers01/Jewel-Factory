# CLAUDE.md — Jewel Factory (clean rebuild)

Guidance for Claude Code working in this repo.

## What this is

A **clean single-app rebuild** of the old `../LuxeMatch` B2B jewellery platform.
Same features, same UI, zero dead code. Built phase-by-phase from
`../LuxeMatch/JEWEL_FACTORY_SYSTEM_DESIGN.txt` (the blueprint — read it for full context).

**Stack:** Next.js 15 (App Router) + Hono BFF + Prisma (Supabase Postgres) +
Tailwind v4 (CSS-first, no config file) + shadcn/ui (new-york) + lucide + motion.
**Single app** — NO monorepo, NO `packages/*`. Everything under `app/`, `components/`, `lib/`, `hooks/`.

## Four actors

1. **Manufacturer** — global catalog (Gold only, NO price, auto `JF-XXXX` design numbers), approves store registrations, receives B2B/kiosk/custom orders. NEVER sees customer data; ships to store's fixed address. Portal `/manufacturer/*`.
2. **Store Owner** — self-registers → manufacturer approves → dashboard, branding, fixed address, managers, B2B restock orders. Portal `/store/*`.
3. **Store Manager** — added by owner. Approves kiosk/B2B/custom-design orders before they reach the manufacturer. Same portal as owner minus settings/managers.
4. **Customer** — NO login. In-store kiosk at `/<storeSlug>/*` (URL-path tenancy). Browse manufacturer catalog, AR try-on, visual search, guest cart → order, custom-design requests.

## Core rules (never break)

- **No price, no metal** anywhere (manufacturer form, catalog, kiosk, orders).
- **Auto design number** `JF-0001` via Postgres sequence (`lib/design-number.ts`).
- **Customer PII never reaches the manufacturer** — kiosk + custom orders are sanitized; manufacturer sees store identity + specs + **store fixed address** only.
- **Owner-approve writes `null`** to `*ApprovedById`/`reviewedById` (owner is not a `StoreManager` row — see `approverIdOrNull` in `lib/api/guards.ts`).
- **Kiosk order items** carry `manufacturerProductId` + snapshots; `product_id` FK is for STORE products only.
- **Branding on kiosk** — store's own logo + name; footer "Powered by AT Jewellers".

## Layout

```
app/
  layout.tsx, page.tsx (landing -> /portal), globals.css
  api/[[...route]]/route.ts   -> mounts lib/api/app.ts (Hono). Exports GET/POST/PATCH/PUT/DELETE.
  portal/                     staff login selector (3 cards)
  manufacturer/               login, dashboard, catalog(+new/[id]), orders(+[id]), kiosk-orders, custom-designs, stores, store-registrations
  store/                      login/register/forgot/reset, manager/login+forgot+reset, dashboard, pending-approvals,
                              manufacturer-catalog, b2b-orders, kiosk-orders, custom-designs, intelligence, analytics, profile, managers, settings
  [storeSlug]/                KIOSK (public): home, catalog(+[design]), search, try-on, custom-design, checkout(+success)
components/
  ui/           shadcn (51 components)
  auth/         StaffLoginForm, ForgotPasswordForm, ResetPasswordForm
  layout/       ManufacturerLayout, StoreLayout
  manufacturer/ ProductForm (image + tryon upload)
  kiosk/        StoreContext, KioskHeader, ProductCard
  ar/           ARViewport
lib/
  prisma.ts, env.ts, auth.ts (3 HMAC cookies), password.ts (bcrypt), slug.ts,
  reset-token.ts, email.ts, cloudinary.ts, upload-client.ts, design-number.ts,
  search.ts (embedder+qdrant), ar-engine/ (copied wholesale)
  api/  app.ts, envelope.ts, guards.ts, routes/*
  db/   manufacturer-catalog, manufacturer-dashboard, stores, store-read, store-dashboard,
        orders, custom-design, intelligence, indexing
hooks/  use-api, use-guest-cart, use-b2b-cart, use-try-on-engine
prisma/ schema.prisma, seed.ts
```

## Auth (3 cookies, 3 secrets)

| Cookie | Role | Secret | Payload |
|---|---|---|---|
| `jf_manufacturer` | Manufacturer | `MANUFACTURER_SECRET` | `manufacturerId` |
| `jf_store` | Store Owner | `STORE_SECRET` | `storeId` |
| `jf_manager` | Store Manager | `MANAGER_SECRET` | `managerId.storeId` |

All HMAC-SHA256 (Web Crypto, Edge-safe, `lib/auth.ts`). Passwords bcrypt (`lib/password.ts`, Node-only).
Guards in `lib/api/guards.ts`: `manufacturerGuard`, `storeGuard` (owner-only), `managerGuard` (owner OR manager, sets `isOwner`).

## Tenancy

- Store-scoped queries filter by `storeId` (from cookie via guard, never body).
- Manufacturer queries filter by `manufacturerId`.
- Kiosk: `storeSlug` from URL resolves the store server-side (`app/[storeSlug]/layout.tsx` + kiosk API bodies carry `storeSlug`).
- Prisma is the data layer — no service-role RLS-bypass footgun; add checks in code.

## Order flows

- **Kiosk:** customer → `placeKioskOrder` (pendingStoreApproval) → manager approves (`forwardedToManufacturer=true`) → manufacturer (PII stripped, ships to store address).
- **B2B:** store cart → `placeB2bOrder` (pendingManagerApproval) → manager approves → manufacturer → on DELIVERED, `fulfillB2bOrder` materializes into store `Product` table (transactional).
- **Custom design:** kiosk form → `CustomDesignRequest` (PII) → manager approves → `forwardCustomRequest` creates sanitized `CustomDesignOrder` (transactional, atomic) → manufacturer.

## Store registration → approval → email

- Store self-registers at `/store/register` (status `PENDING`, `isActive=false`, no `manufacturerId`) + creates its first manager in the same transaction.
- Manufacturer approves at `/manufacturer/store-registrations` → `approveRegistration` sets `APPROVED` + `isActive=true` + links `manufacturerId`, and returns owner email + slug + manager emails.
- On approve, the store OWNER gets a **store-approved email** (`storeApprovedEmail` in `lib/email.ts`, sent fire-and-forget from `manufacturer-stores.ts`): confirmation + owner/manager login emails + portal URLs + kiosk URL (`/<slug>`) + forgot-password links. **No passwords** in the email (bcrypt-hashed; owner set them at registration). Email only sends if SMTP is configured, else logs to console — never blocks approval.
- Store + managers are NOT hardcoded — only `pnpm db:seed` with `SEED_DEMO_STORE=true` creates the demo store for testing.

## External services (same as old system)

- **Cloudinary** — signed direct upload (`lib/cloudinary.ts`). Buckets: catalog, tryon (png only), logo.
- **Qdrant** — one collection `QDRANT_MANUFACTURER_COLLECTION` (customers search manufacturer catalog).
- **OpenCLIP embedder** — 512-d (`lib/search.ts`, `EMBEDDER_URL`). Indexing fire-and-forget on image add.
- **SMTP** — password reset + store-approval email (`lib/email.ts`; logs to console if unset, never blocks the flow). On Render: use **port 465** (587 is blocked → `ETIMEDOUT`) and the transporter forces **`family: 4`** (Render can't reach Gmail over IPv6 → `ENETUNREACH`). `lib/email.ts` logs `[email] sent to …` / `[email] send FAILED: …` so Render Logs show the real reason.

## Commands

```bash
pnpm install                    # deps + prisma generate
pnpm dev | build | start | typecheck | lint
pnpm db:migrate | db:deploy | db:seed | db:studio | db:generate
SEED_DEMO_STORE=true pnpm db:seed   # + demo store at /demo
```

## Setup for a fresh DB

1. `cp .env.example .env` — fill DATABASE_URL + DIRECT_URL (Supabase), 3 secrets (min 32 chars), Cloudinary, Qdrant, EMBEDDER_URL, SMTP.
2. `pnpm db:migrate` then `pnpm db:seed` (seeds 1 manufacturer + categories).
3. `pnpm dev`.

## Status

**All 11 phases complete. Full production build passes (42 routes).** Not yet
connected to a live DB — needs a fresh Supabase project + env before running.

## Gotchas

- Catch-all route MUST export every method incl. **PUT** (password resets use PUT). The old LuxeMatch app 405'd because PUT was missing.
- Manufacturer product delete removes children + detaches store products, else archives (FK-safe).
- ar-engine copied verbatim — `overlayMath.ts` is the shared source of truth; mirror landmarks once then smooth; Y-down camera. Don't fight it.
- Try-on `Calibration` uses snake_case fields (`pivot_x`, `x_offset`, …).
- No price component anywhere — audit before adding product UI.
- **Auth cookies = `SameSite=Lax` + `credentials:'same-origin'`** on every authed fetch; login uses `window.location.assign` (not router.push) so the cookie is committed before the dashboard's first API call. Strict + router.push caused a login→redirect loop.
- **Hono `.use('*', guard)` leaks across sub-apps mounted on the same base.** store-portal + store-catalog apply `storeGuard` PER-ROUTE (not `.use('*')`) so a manager's `/store/dashboard` isn't 401'd by an owner-only wildcard. Only store-ops keeps a wildcard (managerGuard). Don't add a second `.use('*')` on `/store`.
- **SMTP on Render:** port **465** (587 blocked → ETIMEDOUT) + `family: 4` in the transporter (IPv6 unreachable → ENETUNREACH). `family` isn't in nodemailer's TS type — cast `as nodemailer.TransportOptions`.
- **Order-item images:** kiosk items snapshot the image at order time; B2B items snapshot image + design number (migration `20260715120000_b2b_item_image`) — only orders placed AFTER that commit have B2B images. Store list APIs `include: { items: true }`; thumbnails are `h-20 w-20 object-contain` on white.
- **Migrations on Supabase pooler** hit an advisory-lock timeout via `migrate dev`. Workaround used: apply DDL with `prisma db execute --url <DIRECT_URL>`, hand-write the migration file, and insert the `_prisma_migrations` row manually. Render currently runs `pnpm run start` (Node runtime, `next start`) — migrations are NOT auto-applied there; use `pnpm render-start` or Docker runtime to auto-migrate.
