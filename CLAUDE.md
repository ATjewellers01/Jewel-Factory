# CLAUDE.md — Jewel Factory (clean rebuild)

Guidance for Claude Code working in this repo.

## What this is

A **clean single-app rebuild** of the old `../LuxeMatch` B2B jewellery platform.
Same features, same UI, zero dead code. Built phase-by-phase from
`../LuxeMatch/JEWEL_FACTORY_SYSTEM_DESIGN.txt` (the blueprint — read it for full context).

**Workspace layout:** three repos sit as SIBLINGS in one parent folder — `LuxeMatch/`
(git `B2B_Luxmatch`, reference only), `AI-Features/` (git `Jewel-Factory_AI`), and
`Jewel Factory/` (this app). The `../LuxeMatch` and `../AI-Features` relative paths
in the docs depend on this layout. Clone order + commands: `docs/PROJECT_HISTORY.md` §6.

**Stack:** Next.js 15 (App Router) + Hono BFF + Prisma (Postgres — Supabase for dev, **AWS RDS in production**, see `docs/AWS_MIGRATION.md`) +
Tailwind v4 (CSS-first, no config file) + shadcn/ui (new-york) + lucide + motion.
**Single app** — NO monorepo, NO `packages/*`. Everything under `app/`, `components/`, `lib/`, `hooks/`.

## Actors — MULTI-STORE hierarchy (read docs/flow.md for the full flow)

> **Terminology (UI name vs code/table):** the DB kept its original table/identifier
> names through two renames, so watch the mapping — **the UI display text is now
> "Purchase manager" everywhere a human reads it, but the code/DB/routes still say
> "Retailer"/"store" (display-text-only rename, 2026-07-30 — see Status below)**:
> - `stores` table + `jf_store` login = **Purchase manager** (UI) / "Retailer" or "Store" in code (= Head Office; was "Store Owner")
> - `store_managers` table = **LEGACY/INERT** — the old "HO Manager" role is REMOVED; table kept only for historical approver FK rows, no login/creation
> - `branches` table = **Store** (a purchase manager's individual shop) — NEW
> - `branch_managers` table + `jf_branch_manager` login = **Store Manager** — NEW
> - Order types (UI display only, code/DB unchanged): "B2B order" → **"Catalog order"**, "Custom (design) order" → **"Customised order"**. `B2bOrder`/`CustomDesignOrder` Prisma models, `OrderKind.B2B`/`OrderKind.CUSTOM` enum values, `/store/b2b-orders` route, `useB2bCart` — all unchanged.

**3 staff roles + Customer:**
1. **Manufacturer** — global catalog (Gold only, NO price, auto `JF-XXXX`), approves **Purchase manager** registrations, receives Catalog/kiosk/customised orders. NEVER sees customer data; ships to the **Purchase manager's fixed HO address**. Portal `/manufacturer/*`.
2. **Purchase manager** (`stores`, code identifier still "Retailer"/"store") = **Head Office** — self-registers → manufacturer approves. Has ONE fixed HO address. Creates its **Stores (branches)** and each branch's Store Managers. **Also does ALL approvals** (kiosk/Catalog/customised) for every branch, can **edit the requirement note**, and chats with Store Managers per order — this absorbs everything the old "HO Manager" did. Portal `/store/*` (login `/store/login`). Branch mgmt at `/store/branches`.
3. **Store Manager** (`branch_managers`) — runs ONE branch. Login `/store-manager/login` → that branch's **Kiosk** (customer, no PII) + **Restock** (PIN-walled). Sends orders to the Purchase manager (Head Office) for approval. Portal `/store-manager/*`.
4. **Customer** — walk-in, NO login, **NO data stored**. The Store Manager helps them on the kiosk. Requirement captured as an editable note only. (Legacy public kiosk `/<storeSlug>/*` still exists but the primary path is the Store Manager's `/store-manager/kiosk`.)

## Core rules (never break)

- **No price, no metal** anywhere (manufacturer form, catalog, kiosk, orders).
- **Auto design number** `JF-0001` via Postgres sequence (`lib/design-number.ts`).
- **No design name** (removed 2026-07-30, client request) — `ManufacturerProduct.name` is nullable and unused by new products; the **design number is the sole identifier** shown everywhere (catalog, kiosk, order snapshots, search results). The AI "Generate all" flow now does Description → Catalog image → Try-on PNG (no name-generation step). Order-item snapshots fall back to `designNumber` when `name` is empty.
- **`karigarCode`** on `ManufacturerProduct` — manufacturer-internal only (which artisan makes the piece), manually entered, filterable in the manufacturer catalog list. **Structurally never exposed** to retailer/store-manager/customer reads — every public/tenant-scoped query (`listActiveProducts`, `getActiveProductByDesignOrId`, kiosk/branch-manager/store-portal search & catalog routes) uses Prisma's `omit: { karigarCode: true }`, not just UI hiding.
- **`pieces`** on `ManufacturerProduct` (default 1) — how many physical pieces make up the entered `weightGrams` (e.g. a bangle pair = 2).
- **Favorites** (`FavoriteProduct` model, migration `favorite_products`) — server-backed, scoped by `(storeId, branchId)`: Purchase manager's own favorites have `branchId=null`, a Store Manager's are scoped to their branch — the two never share a list even though a Store Manager's `storeId` tenancy value equals the retailer's id. `hooks/use-favorites.ts` (optimistic toggle) + `GET/POST/DELETE /api/store/favorites` and `/api/branch-manager/favorites`.
- **Retailer badges** (`Manufacturer.retailerBadgeLabels: String[]`, `Store.badgeLabel`) — manufacturer defines their own custom labels (e.g. "Gold Customer", "Premium") via `/manufacturer/stores` edit modal, then assigns one per purchase manager. Deleting a label unassigns it from every store using it.
- **Customer PII is NOT stored and never reaches the manufacturer.** Kiosk/custom orders carry only products + qty + an editable `requirementNote`. Customer name/phone are nullable (store manager keeps them outside the system). Manufacturer sees: retailer name, branch name, requirement note, retailer HO ship-to address.
- **The requirement note** (`requirementNote` on kiosk/B2B orders) is written by the Store Manager, **editable by Store Manager AND Retailer (Head Office)** (PATCH `/store/{kiosk,b2b}-orders/:id/note`), and forwarded to the manufacturer.
- **Restock is PIN-walled** per branch (`branches.restock_pin_hash`, cookie `jf_restock`). Set/reset by Store Manager or Retailer (Head Office).
- **Store Manager "My Orders"** (`/store-manager/my-orders`) — their branch's kiosk/custom/restock orders with status (Pending→Approved→**Completed**). Store Manager sets **Completed** (`completedAt`) when the piece reaches the customer/store — a flag, separate from the approval status.
- **Per-order chat** (`order_messages`, polymorphic by `OrderKind`+orderId) — Retailer (Head Office) ↔ Store Manager, scoped by `storeId`. APIs: `/api/store/messages/:kind/:id` (Head Office) and `/api/branch-manager/messages/:kind/:id` (Store Manager). Shared UI `components/orders/OrderChat.tsx`. **NOTE:** the `MessageSender.HO` enum value and `OrderChat` `viewer='HO'` / `sender:'HO'` are DATA — do NOT rename them; only display text reads "Head Office".
- **Store Manager storefront = LuxeMatch look** (rich hero + sections), header/nav/branding = Jewel Factory. Gold-only — no blue/diamond stock imagery. Don't simplify it back to a plain dashboard.
- **Owner-approve writes `null`** to `*ApprovedById`/`reviewedById` (the Retailer/owner is not a `StoreManager` row — see `approverIdOrNull` in `lib/api/guards.ts`). Since the HO Manager role is gone, `approverIdOrNull` now **always returns null** (all approvals are the owner).
- **Kiosk order items** carry `manufacturerProductId` + snapshots; `product_id` FK is for STORE products only.
- **Branding on kiosk** — store's own logo + name; footer "Powered by AT Jewellers".

## Layout

```
app/
  layout.tsx, page.tsx (landing -> /portal), globals.css
  api/[[...route]]/route.ts   -> mounts lib/api/app.ts (Hono). Exports GET/POST/PATCH/PUT/DELETE.
  portal/                     staff login selector (3 cards: Retailer / Store Manager / Manufacturer)
  manufacturer/               login, dashboard, catalog(+new/[id]), orders(+[id]), kiosk-orders, custom-designs, stores, store-registrations
  store/                      RETAILER (Head Office) portal: login/register/forgot/reset, dashboard,
                              pending-approvals (branch + editable note), manufacturer-catalog, b2b-orders, kiosk-orders,
                              custom-designs, intelligence, analytics, profile, branches (stores + branch mgrs + PIN), settings
                              (the old HO Manager login /store/manager/* + Managers(HO) page are REMOVED)
  store-manager/              STORE MANAGER storefront (login-gated, LuxeMatch-style, real catalog data):
                              home (full-bleed hero + Popular now + Try-On banner + More to explore + rich footer),
                              kiosk, try-on, search, custom-design (image upload), restock (PIN-walled),
                              my-orders (kiosk/custom/restock tabs · status · Mark Completed · per-order chat), CatalogOrderPanel
  [storeSlug]/                LEGACY public kiosk: home, catalog(+[design]), search, try-on, custom-design, checkout(+success)
components/
  ui/           shadcn (51 components)
  auth/         StaffLoginForm, ForgotPasswordForm, ResetPasswordForm
  layout/       ManufacturerLayout, StoreLayout
  manufacturer/ ProductForm (image + tryon upload)
  kiosk/        StoreContext, KioskHeader, ProductCard
  orders/       OrderChat (per-order HO↔Store-Manager chat, reused both sides)
                ImageZoomModal (clickable product images with lightbox zoom)
  ar/           ARViewport
lib/
  prisma.ts, env.ts, auth.ts (3 HMAC cookies), password.ts (bcrypt), slug.ts,
  reset-token.ts, email.ts, storage.ts (S3 presigned upload), upload-client.ts, design-number.ts,
  search.ts (embedder+pgvector), ar-engine/ (copied wholesale)
  categories.ts (14-category taxonomy + sub-categories), format.ts (titleCaseName/formatWeight)
  api/  app.ts, envelope.ts, guards.ts, routes/* (incl. branch-manager.ts)
  db/   manufacturer-catalog, manufacturer-dashboard, stores, store-read, store-dashboard,
        orders, custom-design, intelligence, indexing, branches (Branch + BranchManager CRUD)
hooks/  use-api, use-guest-cart, use-b2b-cart, use-try-on-engine
prisma/ schema.prisma, seed.ts
```

## Auth (3 login cookies + 2 PIN cookies)

| Cookie | Role (UI) | Secret | Payload |
|---|---|---|---|
| `jf_manufacturer` | Manufacturer | `MANUFACTURER_SECRET` | `manufacturerId` |
| `jf_store` | Retailer (Head Office) | `STORE_SECRET` | `storeId` (= retailerId) |
| `jf_manager` | **REMOVED** (was HO Manager) — login gone; `MANAGER_SECRET` still exists in env but no cookie is issued | `MANAGER_SECRET` | *(deprecated)* |
| `jf_branch_manager` | Store Manager | `BRANCH_MANAGER_SECRET` (falls back to `MANAGER_SECRET`) | `bmId.branchId.retailerId` |
| `jf_kiosk` | legacy kiosk device unlock | `STORE_SECRET:kiosk` | `storeId` |
| `jf_restock` | branch restock unlock (PIN) | `STORE_SECRET:restock` | `branchId` |

> The `store_managers` DB table remains for historical approver FK references only — no login/creation.

All HMAC-SHA256 (Web Crypto, Edge-safe, `lib/auth.ts`). Passwords bcrypt (`lib/password.ts`, Node-only).
Guards in `lib/api/guards.ts`: `manufacturerGuard`, `storeGuard` (retailer/owner-only), `managerGuard` (now **owner-only** — accepts `jf_store` only; the HO-manager fallback is removed, so `isOwner` is always true), `branchManagerGuard` (store manager; sets `branchId` + `branchManagerId` + `storeId`=retailerId for tenancy). Branch-manager API is `/api/branch-manager/*` (`lib/api/routes/branch-manager.ts`), per-route guarded.

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

- Store self-registers at `/store/register` (status `PENDING`, `isActive=false`, no `manufacturerId`). (A `store_managers` row may still be written silently in the same transaction, but it is inert — there is no HO Manager login; the Retailer is the Head Office.)
- Manufacturer approves at `/manufacturer/store-registrations` → `approveRegistration` sets `APPROVED` + `isActive=true` + links `manufacturerId`, and returns owner email + slug + manager emails.
- On approve, the store OWNER gets a **store-approved email** (`storeApprovedEmail` in `lib/email.ts`, sent fire-and-forget from `manufacturer-stores.ts`): confirmation + owner/manager login emails + portal URLs + kiosk URL (`/<slug>`) + forgot-password links. **No passwords** in the email (bcrypt-hashed; owner set them at registration). Email only sends if SMTP is configured, else logs to console — never blocks approval.
- Store + managers are NOT hardcoded — only `pnpm db:seed` with `SEED_DEMO_STORE=true` creates the demo store for testing.

## External services (same as old system)

- **S3 + CloudFront** — signed direct upload (`lib/storage.ts`, presigned PUT via `@aws-sdk/client-s3` + `s3-request-presigner`; public reads via `S3_PUBLIC_BASE_URL`/CloudFront). Buckets/folders: catalog, tryon (png only), logo, custom. **Replaced Cloudinary** (migrated 2026-07-22, see `docs/AWS_MIGRATION.md`) — `lib/cloudinary.ts` is deleted; `CLOUDINARY_*` vars in `lib/env.ts` are optional/unused leftovers, don't rely on them.
- **pgvector (in RDS)** — `manufacturer_product_embeddings.embedding vector(512)` column, cosine-distance search via raw SQL in `lib/search.ts`. **Replaced Qdrant** (same migration) — no `QDRANT_*` env vars exist anymore.
- **OpenCLIP embedder** — 512-d visual search (`lib/search.ts`, `EMBEDDER_URL`, `POST /embed/image`, Bearer auth). Indexing fire-and-forget on image add. **Still external** — this did NOT move to EC2 with the rest of the stack; it stays on the AI-Features HF Space (`botivate2026-ai-workspace.hf.space`), called over the internet from the EC2 app the same way Render called it.
- **AI-Features service** (separate Python repo: `github.com/teamai-botivate/Jewel-Factory_AI`, deploy on HF Docker Space) — **ONE service for all AI**: `/catalog`, `/transparent`, `/describe` (OpenAI, gated by `x-api-key`=`AI_FEATURES_API_KEY`) **and** `/embed/*` (OpenCLIP, merged in — same contract as the old embedder). Env: `AI_FEATURES_URL` + `AI_FEATURES_API_KEY`. **The embedder is now part of this service** — point `EMBEDDER_URL` at the same Space (`/embed/image` unchanged). If `AI_FEATURES_URL` is unset, the manufacturer "Generate with AI" button is hidden and manual add works as before.
  - **Manufacturer Add Design → "Generate with AI"**: raw photo (temp, not saved) → `/api/manufacturer/ai/{describe,catalog,transparent}` (server proxy `lib/api/routes/manufacturer-ai.ts`, forwards with `x-api-key`) → auto-fills name/description + catalog image + transparent try-on PNG. All editable; regenerate + custom `extraInstructions` supported. Uses the existing `handleImageUpload`/`handleTryonUpload` flow (base64 → File).
- **SMTP** — password reset + store-approval email (`lib/email.ts`; logs to console if unset, never blocks the flow). On Render: use **port 465** (587 is blocked → `ETIMEDOUT`) and the transporter forces **`family: 4`** (Render can't reach Gmail over IPv6 → `ENETUNREACH`). `lib/email.ts` logs `[email] sent to …` / `[email] send FAILED: …` so Render Logs show the real reason.

## Commands

```bash
pnpm install                    # deps + prisma generate
pnpm dev | build | start | typecheck | lint
pnpm db:migrate | db:deploy | db:seed | db:studio | db:generate
SEED_DEMO_STORE=true pnpm db:seed   # + demo store at /demo
pnpm migrate:categories             # map legacy flat categories -> 14-cat taxonomy (existing DB only)
pnpm migrate:branches               # Option-A: default "Main Store" branch per retailer + link old orders (existing DB only)
```

## Setup for a fresh DB

1. `cp .env.example .env` — fill DATABASE_URL + DIRECT_URL (Postgres — Supabase for dev, or RDS in production, see `docs/AWS_MIGRATION.md`), secrets (min 32 chars: MANUFACTURER/STORE/MANAGER/**BRANCH_MANAGER**), AWS S3 (`AWS_REGION`/`AWS_S3_BUCKET`/`S3_PUBLIC_BASE_URL` + IAM creds or role), EMBEDDER_URL (+ optional AI_FEATURES_URL/AI_FEATURES_API_KEY for AI generate), SMTP. No `NEXT_PUBLIC_SUPABASE_*` — app uses Postgres directly, not Supabase Auth. (Cloudinary/Qdrant env vars are legacy-optional, not needed on a fresh setup.)
2. `pnpm db:deploy` (runs all 8 migrations → full schema, no manual SQL) then `pnpm db:seed` (1 manufacturer + 14 categories).
3. `pnpm dev`.
**New agent / new machine? Read [`docs/PROJECT_HISTORY.md`](docs/PROJECT_HISTORY.md) first** — full backstory, every big decision + why, what's pending, and how the owner likes to work. It gives you the same context the previous agent had.

**All docs live in `docs/` (except this file + `README.md`, which stay at the repo root).**
Handover / client onboarding: `docs/HANDOVER.md` (zero-to-live). Schema: `docs/DATABASE.md`.
Full system flow: `docs/flow.md`. Detailed dev setup: `docs/SETUP_GUIDE.md`. Render deploy:
`docs/DEPLOY_RENDER.md`. AWS migration (now the live production deploy): `docs/AWS_MIGRATION.md`.
Pending work / checklist: `docs/PENDING.md`. End-user (non-technical) guide with roles + demo
login credentials + step-by-step workflows: `docs/USER_MANUAL.md`.

## Production deployments (TWO targets exist — know which one you're debugging)

| | Render | AWS EC2 (primary production) |
|---|---|---|
| App | `jewel-factory.onrender.com`, `pnpm render-start` | Docker container `jewel-factory` on `13.126.65.154`, image tag = git commit hash (e.g. `jewel-factory-prod:529b664`), reverse-proxied via `13-126-65-154.sslip.io` |
| DB | Supabase Postgres | **AWS RDS Postgres** (`database-1.c98u4y6sk2lz.ap-south-1.rds.amazonaws.com`, db `jewel_factory`) |
| Storage | — | **S3 + CloudFront** (bucket `atjewellers01-jewel-factory-prod-*`, see `lib/storage.ts`) |
| Vector search | — | **pgvector** in the same RDS (see External services) |
| AI-Features | HF Space | **Same HF Space** (`botivate2026-ai-workspace.hf.space`) — AI-Features was NOT moved to EC2, stays external on both deploys |
| Migrations | manual (`pnpm render-start` or Docker) | **auto-applied on container start** (`prisma migrate deploy` runs before `next start` — confirmed via container boot log: "Applying database migrations... No pending migrations to apply.") |
| SSH | — | `ssh -i jewel-factory-prod-<date>.pem ec2-user@13.126.65.154` (Amazon Linux 2023, passwordless `sudo`, app runs in Docker — `sudo docker logs jewel-factory`, `sudo docker exec jewel-factory ...`) |

**To redeploy AWS after a code fix:** the running container is tagged to a specific commit — merging to `master` alone does NOT update it. Rebuild the Docker image at the new commit and restart the container on the EC2 host (ask whoever owns the deploy script/CI for the exact rebuild command — not yet documented here as of 2026-07-24).

Whether Render is still actively used alongside AWS EC2, or AWS is now the sole production target, was **not confirmed this session** — check with the team before assuming Render is retired.

## Migrations (15, all Prisma-managed, idempotent)
`0001 jewel_factory` · `kiosk_pin` · `b2b_item_image` · `branch_hierarchy` (branches + branch_managers + branch_id/requirement_note on orders + nullable PII) · `order_messages` (order_messages table + OrderKind/MessageSender enums + completed_at on kiosk/b2b/custom) · `add_analytics_indexes` · `custom_design_weight_range` · `pgvector` (adds the `vector(512)` embedding column on `manufacturer_product_embeddings`, used by pgvector search — see External services) · `extra_branch_allowance` · **`product_karigar_pieces_nullable_name`** (2026-07-30: `ManufacturerProduct.name` DROP NOT NULL, adds `pieces` + `karigar_code`) · **`favorite_products`** (2026-07-30: new table, see Core rules) · **`retailer_badges`** (2026-07-30: `manufacturers.retailer_badge_labels` + `stores.badge_label`) · **`retailer_delete_cascade`** (2026-07-30: `b2b_orders`/`kiosk_orders`/`custom_design_orders` FK to stores switched from `ON DELETE RESTRICT` to `CASCADE` — see Gotchas) · **`favorite_kind_kiosk_restock`** (2026-07-30: adds `FavoriteKind` enum + `kind` column on `favorite_products`, unique/index widened to include it — see Status) · **`store_email_optional`** (2026-07-31: `stores.email` DROP NOT NULL + index on `owner_phone` — mobile-only purchase manager signup, see Gotchas). `pnpm db:deploy` applies all. `migrate:categories`/`migrate:branches` = one-off upgrades for an EXISTING DB only.

## Status

**Latest session (2026-07-31) — email-optional purchase manager registration + auth login responsiveness:**
- **[x] `Store.email` is now nullable** (migration `20260731000000_store_email_optional`, + index on `owner_phone`). Older retailers don't use email, so registration accepts a mobile number only. **The login username is the email when present, otherwise the mobile number**; the password is always the mobile number (`approveRegistration` unchanged). `POST /api/store/login` still takes `{ email, password }` — the `email` field is treated as the *username* and routed by whether it contains `@`. No endpoint or payload-field changes anywhere (explicit client constraint).
- **[x] Mobile uniqueness is app-level, not a DB constraint** — `POST /api/store/register` rejects a duplicate `ownerPhone` **only when no email is given** (that's when the mobile is the username); login-by-mobile uses `findFirst` ordered by `createdAt`. Pre-existing rows may share a phone.
- **[x] Email can be added later** from `/store/profile` (`PATCH /api/store/profile` gained an optional `email`; a collision returns 409).
- **[x] Registration form is ONE step** (was 2: Business → Address). Stepper removed; email, street address and landmark are all optional; the "no password to set" note switches copy when no email is entered; "Optional" chips sit next to their label instead of far-right; the "Use the Head Office details…" subtitle is gone.
- **[x] `PortalLoginScreen` is mobile-responsive** — below `md` the page scrolls naturally (was `h-dvh` + `overflow-hidden`, which clipped the form on short viewports); the card takes `min-h` so a short login still centres. Covers `/manufacturer/login`, `/store/login`, `/store-manager/login` and `/store/register`.
- **[x] Product-detail popup now lists similar designs as FULL blocks** (`components/kiosk/StoreManagerProductDetailModal.tsx`) — was a row of 6 small thumbnails you had to click to switch the modal's subject. Extracted a `ProductBlock` (gallery + specs + description + primary action + Try On) and rendered it for the opened design *and* every similar design, so each one has its own "Add to order" and the user just scrolls. The modal no longer closes on add in `CatalogOrderPanel` (button flips to "Add another"); `/store-manager/search` still closes on add, unchanged. Affects all 5 callers (kiosk, restock, store-manager search, retailer manufacturer-catalog, retailer similar-search).
- **[x] Items-per-row control** on the Store Manager kiosk + restock catalog (`app/store-manager/CatalogOrderPanel.tsx`) — 1 or 2 below `md`, 2–5 from `md` up; only the set that applies to the current width is rendered. Tailwind needs literal class names, so the two scales are the `MOBILE_COLS`/`WIDE_COLS` lookup maps — don't switch them to interpolated `grid-cols-${n}`. Choice persists in `localStorage` under `jf.catalog.cols`.
- **[x] Landing-page product popup made responsive** (`app/page.tsx`) — the panel was taller than a phone viewport with no inner scroll, so it clipped at both ends; now `max-h-[calc(100dvh-3rem)]` + inner scroll, top-aligned below `sm`, tighter padding, plus body scroll-lock and Escape-to-close.
- **[x] Retailer Admin header reworked** (`components/layout/StoreLayout.tsx`) — the mobile burger + its left drawer are **deleted**. Manufacturer Catalog and Similar Design Search now sit next to the logo at every width (icon-only below `lg`, icon + label from `lg` up) and the **Dashboard button moved to the far right** at every width (icon-only below `lg`). The Dashboard drawer is the only panel left; nothing else opens an overlay.
- **[x] Catalog nav icon is a jewellery storefront, not a diamond** — `components/icons/JewelleryStoreIcon.tsx` (custom SVG on lucide's 24×24 grid, 1.8px stroke, `currentColor` so it flips white on the active gold pill), wired into `TOP_NAV` in `StoreLayout.tsx`. Replaces lucide `Gem`, which contradicted the gold-only/no-diamond-imagery rule. Two candidate source files (`public/catalog.svg` — a 1.5 MB PNG wrapped in SVG — and `public/jewelry-store-svgrepo-com.svg`) were evaluated and **deleted**: both are illegible at the 18px nav size, and the first can't recolour. Draw new chrome icons on the lucide grid rather than dropping in stock art.
- **Known gap:** forgot-password is email-only, so a retailer registered with a mobile number alone can't self-serve a reset until they add an email in their profile.
- **Not yet deployed** — needs `prisma migrate deploy` + container rebuild on EC2.

**Previous session (2026-07-30 continued) — retailer self-approval bug, split Kiosk/Restock favorites, clickable order items, karigar-code-on-orders follow-through:**
- **[x] Fixed: Retailer's own direct catalog order no longer needs its own approval.** `placeB2bOrder()` (`lib/db/orders.ts`) previously relied on the schema's unconditional `pendingManagerApproval @default(true)`, so an order the Retailer placed themselves (via `/store/manufacturer-catalog` → `POST /api/store/orders`) landed in `/store/pending-approvals` waiting on the Retailer's own sign-off — a no-op approval step with no one above the Retailer to grant it. Added an optional `pendingManagerApproval` param; the Retailer's own route (`lib/api/routes/store-catalog.ts`) now passes `false` (pre-approved, `managerApprovedAt` stamped, goes straight to the manufacturer queue — same effect as if approved). Store-Manager-originated orders (`lib/api/routes/branch-manager.ts`, via `/api/branch-manager/orders`) are untouched and still default to `true`, correctly needing the Retailer's (Head Office's) approval.
- **[x] Kiosk vs Restock favorites split** — new `FavoriteKind` enum (`KIOSK`/`RESTOCK`) on `FavoriteProduct`, compound-unique widened to `[storeId, branchId, kind, manufacturerProductId]`. Previously a Store Manager's Kiosk and Restock pages showed the same favorites count because both wrote to one list scoped only by `(storeId, branchId)`. `lib/db/favorites.ts`, `lib/api/routes/branch-manager.ts` (`?kind=` query param, defaults `KIOSK`), `hooks/use-favorites.ts` (`useFavorites(basePath, kind?)`), and `CatalogOrderPanel.tsx` (passes `'RESTOCK'` when `showPopularity` — the existing Restock-page flag) all updated. Retailer's own favorites (`/api/store/favorites`, `branchId=null`) always use the `KIOSK` default — no Kiosk/Restock split applies to that side.
- **[x] Order line items are clickable** on Store Manager My Orders (all 3 tabs) and all 3 Retailer order-list pages with linked catalog products (`kiosk-orders`, `b2b-orders`, `pending-approvals`) — opens `components/orders/OrderItemDetailModal.tsx`, a karigarCode-free product detail popup (image, category/sub-category, purity, weight, description). Retailer's `custom-designs` page intentionally excluded — custom requests carry a reference image, not a linked `ManufacturerProduct`, so there's no product to open. Backing data: `lib/db/orders.ts`'s `hydrateItemsForStoreManager()` (a `select`-whitelist join, never includes `karigarCode`) is now applied to every store/branch-scoped order read (`getKioskOrdersByBranch`, `getB2bOrdersByBranch`, `getKioskOrdersByStore`, `getKioskOrderForStore`, `getB2bOrdersByStore`, `getB2bOrderForStore`).
- **[x] "Custom Design(s)" → "Customised Design(s)"** rename finished in the remaining order-type-label spots the previous pass missed: Retailer dashboard stat card, both portals' sidebar nav item (Retailer + Manufacturer), Store Manager My Orders tab, Retailer's own custom-design request-list page heading. **Left unchanged on purpose:** `/store-manager/custom-design` and `/[storeSlug]/custom-design` page titles/nav labels — those name the *feature* ("request a bespoke piece"), not the order-type status label, so they stay "Custom Design" per the display-text-only rename's original scope.
- **Not yet deployed to AWS as of this write-up** — the `favorite_kind_kiosk_restock` migration (5th new migration this session) needs `prisma migrate deploy` on the EC2 container; rebuild+redeploy with the latest commit hash to make all of this session's fixes live.
- **Merged in from a concurrent commit on `master`** (`feat: mobile-client auth support`, unrelated to this work) — bearer-token fallback for all 4 guards + `token` in branch-manager login/restock-unlock responses, for a future native mobile client. No conflict with the fixes above; auto-merged cleanly.

**Previous session (2026-07-30) — 11-item client punch list: design-name removal, favorites, badges, registration overhaul, cascade-delete fix, display renames:**

**Latest session (2026-07-30) — 11-item client punch list: design-name removal, favorites, badges, registration overhaul, cascade-delete fix, display renames:**
- **[x] Design name removed** — see Core rules. `components/manufacturer/ProductForm.tsx` no longer has a name field; `lib/db/manufacturer-catalog.ts` create/update no longer accepts `name`. Every catalog/kiosk/order display across all 3 portals switched from `product.name` to `product.designNumber` (19 files in one pass — `app/manufacturer/catalog/**`, `app/store-manager/**`, `app/store/**`, `app/[storeSlug]/**`, `components/kiosk/*`, `components/analytics/ProductDetailModal.tsx`).
- **[x] Karigar Code + Pieces** added to Add/Edit Design form (`components/manufacturer/ProductForm.tsx`) — see Core rules for the privacy/omit guarantee on karigarCode.
- **[x] Manual "Generate Try-On" button** in the AR Try-On section of ProductForm (independent of "Generate all"), plus a per-catalog-image "Try-on" quick-generate button in edit mode (`generateTryOnFromImage()` — fetches the existing S3 image back as the AI's raw input, no re-upload needed).
- **[x] Retailer gets a product detail modal** on `/store/manufacturer-catalog` (previously static cards, no click-through) — now reuses `StoreManagerProductDetailModal`, matching the Store Manager's kiosk/search UX.
- **[x] Similar-search pagination** — `/store-manager/search` and `/store/similar-search` now show top 5 results + a "Show more" button (+5 per click), backend pool unchanged (still fetches up to ~24, just paginated client-side).
- **[x] Retailer similar-search gets Add-to-Cart** — `/store/similar-search` previously had `primaryAction={() => null}`; now adds to the B2B cart like Store Manager's search does.
- **[x] Favorites** (server-backed) — see Core rules. Heart toggle on `KioskProductCard`, the Store Manager's `CatalogOrderPanel` grid, and the retailer's `manufacturer-catalog` grid; a "Favorites" panel next to the Cart button on both portals.
- **[x] Cart-time remarks** — audited, already existed: `requirementNote` (Store Manager writes at checkout in `CatalogOrderPanel.tsx`, Purchase manager can edit on `pending-approvals`, forwarded to manufacturer). No code change needed for this item.
- **[x] Retailer badges** — see Core rules. `app/manufacturer/stores/page.tsx` edit modal gets a badge dropdown + inline add/remove; list rows show the assigned badge as a chip.
- **[x] Dashboard "Approvals" → "Pending Approval"** stat label.
- **[x] Registration overhaul** — see Core rules + Gotchas. 3 steps → 2 (Business, Address); manager-account step removed entirely; field renames "Owner name"→"Person name", "Owner/Store phone"→"Mobile number" (label-level only, `ownerName`/`ownerPhone` DB columns unchanged); validators added (business name / person name / 10-digit Indian mobile / email); PIN-code-first address; no manual password (mobile number becomes the password on approval).
- **[x] Cascade-delete fix** — see Gotchas. Deleting a retailer previously threw a FK-violation the moment it had any order history (silently "worked" only for brand-new zero-order retailers) — now fully cleans up.
- **[x] Display-text rename** — "B2B order"→"Catalog order", "Custom (design) order"→"Customised order", "Retailer"→"Purchase manager" across all 3 portals + landing + email templates. **Routes, DB/Prisma identifiers, enum values (`OrderKind.B2B`, `MessageSender.HO`), variable/type names, and code comments are all unchanged** — same precedent as the earlier "HO Manager"→"Head Office" rename. See the Terminology note at the top of this file for the full mapping.
- **[x] Raw AI photo upload limit** raised 3MB → 15MB (`ProductForm.tsx` `MAX_IMAGE_SIZE`, `next.config.ts` `bodyParser.sizeLimit` → 20mb to give headroom).
- **[x] Post-session audit fix** — `app/manufacturer/stores/page.tsx`'s retailer delete/active-toggle and badge add/remove had no try/catch, so a failed request silently did nothing (no error, no feedback) — riskiest on the delete button since that triggers the cascade-delete. Now all four surface a red error banner on failure via the existing `apiPost`/`apiSend` helpers (which already degrade a non-JSON 500 to a generic "Request failed" message).
- **Not yet deployed to AWS as of this write-up** — 4 new migrations (see Migrations section) need `prisma migrate deploy` to run on the EC2 container; rebuild+redeploy with the latest commit hash before this session's work is live in production.

**Previous session (2026-07-26) — Cart persistence fix + Photo search direct add:**
- **[x] Fixed cart disappears on refresh** — Changed `sessionStorage` → `localStorage` in `hooks/use-guest-cart.ts` + `hooks/use-b2b-cart.ts`. Cart now persists across page refreshes and browser tab closures. Affects: Retailer catalog orders, Store Manager kiosk, restock orders, B2B orders.
- **[x] Fixed photo search direct add** — Store Manager photo search (`/store-manager/search`) now directly adds similar images to cart instead of navigating to catalog. Updated `app/store-manager/search/page.tsx` to import `useGuestCart`, pass product to `primaryAction` callback. "Add to Order" button now adds directly + closes modal, maintaining search context.
- **[x] Docs updated** — CLAUDE.md + PROJECT_HISTORY.md

**Previous session (2026-07-24) — AWS prod bug hunt + docs correction:**
- **`retailer-multistore` is merged into `master`** — the paragraphs below that say "master stays at the pre-hierarchy state, merge before handover" are now **stale/incorrect**; `master` is the active branch (confirmed via `git status`) and is what's actually deployed. Don't re-attempt that merge.
- **AWS EC2 is now a live production deployment**, alongside (or instead of — unconfirmed) Render. See the new "Production deployments" section above for full detail (RDS, S3+CloudFront, pgvector, SSH access). This was discovered/verified this session via direct SSH — it was not previously documented here.
- **Fixed: Manufacturer Intelligence page 500s** (`/manufacturer/retailers`, `/manufacturer/top-products`, `/manufacturer/category-weight`) — root-caused via live container logs (`sudo docker logs jewel-factory`) to `TypeError: Do not know how to serialize a BigInt`. `getManufacturerRetailerSales`/`getManufacturerCategoryWeightBreakdown`/`getManufacturerTopProducts` in `lib/db/analytics-queries.ts` returned raw `$queryRaw` rows straight to `c.json()`; Postgres `SUM()` comes back as a JS `BigInt`, which `JSON.stringify` can't serialize — only crashed once real order data existed to sum (empty dev/staging DBs never hit it). Fixed by mapping `total_units` through `Number(...)` before returning, matching the pattern `getRetailerBranchSales` already used. **This fix needs the AWS container rebuilt/redeployed to take effect** — pushing to git alone does not update the running container (see "Production deployments").
- **Retailer sidebar "Analytics" link hidden** (not deleted) — `components/layout/StoreLayout.tsx` NAV no longer includes it; `/store/analytics` still works if visited directly. Its data (`/api/store/intelligence/summary`) fully duplicates the stat cards already on `/store/intelligence`, so it was redundant, not broken.
- **8 migrations now exist** (was 5 last time this doc was updated) — `add_analytics_indexes`, `custom_design_weight_range`, and `pgvector` were added since. All confirmed applied on the AWS RDS production DB.
- **AI image-generation cost analysis** done (see `../AI-Features/CLAUDE.md` "Cost per generation" — verified per-call OpenAI pricing, ~₹57/"Generate All" click at the likely-actual `quality="auto"`→High tier, ~₹15 if forced to Medium) and a **critical flag**: `gpt-image-1` (used for the transparent-background step of try-on generation) is **retiring 2026-10-23** — re-test before then.
- **Found + should be rotated:** the AWS RDS database password was inadvertently printed in plaintext during this session's SSH debugging (a `sed` redaction pattern missed the `DATABASE_URL=` line). Rotate it when convenient.

**Previous session — public landing + docs reorg:**
- **Branded landing** at `/` (was "Rebuild in progress"): navbar (logo · Catalog · About · Login · Register) + hero + **featured real-catalog showcase** (public `GET /api/kiosk/catalog`, no price) + "why" cards + footer. **Login popup** = 2 columns (Retailer | Store Manager) via `components/landing/LoginModal.tsx` reusing `StaffLoginForm` in a new `bare` mode. **Register prompt** auto-opens ~5s once per session (`components/landing/RegisterPromptModal.tsx`, sessionStorage). New **`/about`** page. **`/manufacturer`** is a hidden admin entry — visiting it shows the manufacturer login popup (`app/manufacturer/page.tsx`). **`/portal` deleted → redirects to `/`**; signOut + login footers repointed to `/`.
- **Similar-design (visual) search** surfaced on landing + About (real Store Manager `/search` feature, AI-Features `/embed`).
- **Responsive pass** — app was already mostly mobile-aware; fixed hero headings (smaller base + break-words), a retailer-row truncation, and card/heading padding.
- **Docs moved to `docs/`** (except this file + `README.md`); `SYSTEM_FLOW.txt` → `docs/flow.md`; stale `USER_FLOWS_AND_GUIDE.txt` deleted.

**HO Manager role REMOVED (prior session):** The Retailer is now the Head Office and does everything the old HO Manager did (all kiosk/custom/restock approvals + per-order chat + all order lists/filters) plus its own tasks. `/store/manager/*` + `/api/manager/*` + the Managers(HO) page (`/store/managers`) are deleted. The `store_managers` table is kept but inert (historical approver FKs only). `isOwner` is always true in store-ops now; `approverIdOrNull` always returns null. The `MessageSender.HO` enum + `OrderChat` `viewer='HO'`/`sender:'HO'` values are DATA — unchanged; only display text says "Head Office".

**Multi-store hierarchy + Store Manager storefront + per-order chat: all on branch `retailer-multistore`.**
Retailer (Head Office) → Stores(branches) → Store Managers → Customer. Store Manager has a
full LuxeMatch-style storefront (hero/catalog/try-on/search/custom/restock) + My Orders
(status, Mark Completed, Head Office chat). Head Office ↔ Store Manager per-order chat both sides.
**Live DB (Supabase) has all 5 migrations applied** (branch_hierarchy + order_messages done;
`migrate:branches` run once). `master` stays at the pre-hierarchy state — **merge `retailer-multistore` → `master` when handing over.**

**Latest session (all on `retailer-multistore`):**
- **AI Add Design** — manufacturer "Generate with AI" (raw photo → name/description + catalog image + transparent try-on PNG via AI-Features); field order = specs → AI panel → name → rest; new products default **Active**; generated catalog/try-on images click-to-zoom (lightbox). Race-lock on `ensureProductId` (no double product). AI proxy lowercases the HF host (307 body-drop → 502 fix) and surfaces the real upstream error. **AI-Features (`../AI-Features`, HF Space `Botivate2026/ai-workspace`) currently returns OpenAI `429 insufficient_quota` → add OpenAI credit to make generation work.**
- **Transparent try-on prompt** (AI-Features `lib/prompts.py`) — necklace + bangle now render FRONT drape only (open U/V, no back chain/clasp) so 2D overlay sits correctly; regenerate old assets after HF redeploy.
- **Store Manager kiosk + search** — product cards open a detail modal (gallery, specs, description, **Try On** when AR, **Similar designs**); modal image click-to-zoom; close X at card top-right; Try-On page reads `?product=` (auto-select) + `?back=` (Back button to originating page).
- **Login fix** — `StaffLoginForm` resets loading on a server error (wrong creds no longer freeze the button). Affects all 4 logins.
- **HO ↔ Store Manager chat** added on the HO custom-designs page (was only on pending-approvals). Store Manager no longer sees the manufacturer's granular status ("Approved by HO" only).
- **Nav** — removed "Kiosk PIN" from the Retailer sidebar (managed per-Store on Branches); "Store Profile" → "**Retailer Profile**". (The old HO Manager sidebar is gone — the Retailer/Head Office has the full menu.)
- **Order filters (all lists)** — reusable `components/orders/OrderFilters.tsx` + `lib/order-filters.ts`: order-ID search + status dropdown + **From/To date range** (on `createdAt`) everywhere; **Store (branch) filter** on HO lists (kiosk/custom/b2b) with a branch badge per row; **Retailer filter** on Manufacturer lists (kiosk/custom/orders); Store Manager My Orders searches by order-ID + derived status bucket + date range. HO custom list gained `branch{name}` via `listCustomRequests`.
- **Wordmark** — landing + About navbars use a **"JEWEL FACTORY" text wordmark** (`FACTORY` in gold `#c9a84c`), NOT `public/logo-wordmark.png` — that PNG still shows "LUXEMATCH", so don't use it. Favicon is `public/logo-icon.png`.

## Latest session (2026-07-24 continued) — Retailer profile expansion + photo-search web enhancement planning

**Completed:**
- **[x] Expanded retailer detail modal** (`app/manufacturer/stores/page.tsx`) — Manufacturer now sees complete retailer profile in modal with 5 clear sections: Contact Info (editable name/email/phone/city), Owner Details (read-only), Headquarters Address (read-only, full breakdown), Operations (read-only stores + managers count), Status (read-only registration status + joined date), Extra stores granted (editable). Scrollable `max-h-[70vh]` modal with clear read-only indicators.
- **[x] Stores (branches) list in retailer profile** — Backend query expanded (`lib/db/stores.ts` `listStoresByManufacturer`) to include branches with managers. Modal now shows list of all stores per retailer: name, location (city), manager count, restock PIN status (set/not set). Staff only (Store Manager sees badges 🏠 Catalog | 🌐 Web; customer sees blended results).
- **[x] Store-limit enforcement** — `FREE_BRANCH_LIMIT=2` enforced + manufacturer-editable `extraBranchAllowance` per retailer. Retailer can't exceed limit without manufacturer grant. API returns 409 "You've reached your store limit" error.
- **[x] AWS redeploy** — Built Docker image `jewel-factory-prod:c54a967`, all 9 Prisma migrations applied, container running healthy. Verified: expanded retailer modal now shows all fields (owner, address, operations, status, stores list).
- **[x] Merged feature/sales-analytics ← master** — 7 commits fast-forwarded (store-limit + expanded modal + stores list + product-detail modal + restock PIN fix + analytics cleanup + docs). Branch now in sync.
- **[x] Photo-search web enhancement spec** — Comprehensive plan saved to `docs/PENDING.md` (section 7): Blend catalog + web results for customer (no visible source distinction), show badges to Store Manager (🏠 | 🌐), use Azure Bing Visual Search API (~₹500-600/month), safety checklist (timeouts, rate-limiting, image validation, circuit breaker), rollout phases. Python Colab test script created (`bing_visual_search_test.py`) to validate API before implementation.
- **[x] Docs updated** — CLAUDE.md, PROJECT_HISTORY.md, PENDING.md reflect all work.

**API Choice:** Azure Bing Visual Search ✅ (vs SerpApi, TinEye). Real reverse-image-search, best for jewelry, cost-effective (~$0.25/search), reliable.

**Pending:** Owner sign-off on Bing API + budget before implementation. Python Colab test ready to validate.

## Latest updates (branch: `feature/order-image-zoom`)

**Abhay's UI Refinements (8 commits on `renderdep`):**
- **Auth UI consolidation** — `PortalLoginScreen.tsx` + `PortalShell.tsx` reusable components consolidate login + registration; all 4 sign-in screens (Retailer, Manufacturer, Store Manager, Register) share one look.
- **Store Manager layout polish** — Mobile hamburger nav + page-title tracking (tabs show "Catalog | Search | ...") + store-logo fallback favicon.
- **Landing page assets** — Wordmark component + new branding AVIF logos (JF monogram, Jewel Factory logo, store medallion fallback, register hero image).
- **Responsive fixes** — Mobile-friendly hero headings + padding tweaks.
- **Code quality** — Variable renaming (p → product, res → response), alphabetized imports, useEffect cleanup (cancelled flag).
- **Render deploy config** — `render.yaml` + `.env.example` clarified for Blueprint env prompts (BRANCH_MANAGER_SECRET, AI_FEATURES_URL, AI_FEATURES_API_KEY).
- **AR viewport enhancements** — `fill` prop for full-screen immersive try-on + `onCameraAspectRatioChange` callback for responsive camera.

**Order Image Zoom Feature (ALL 8 order pages + new component):**
- **New component:** `components/orders/ImageZoomModal.tsx` — Lightbox modal (click image → zoom, next/prev for galleries, close via × or Escape).
- **Product details shown:** Product Name + Design Number (from `productDesignSnapshot` on B2B; from FK lookup on kiosk). Custom orders show "Reference Image".
- **Integrated on all 8 pages:**
  - Store Manager: `/store-manager/my-orders` (kiosk/custom/restock tabs)
  - Retailer (HO): `/store/{pending-approvals, kiosk-orders, b2b-orders, custom-designs}` 
  - Manufacturer: `/manufacturer/{kiosk-orders, orders/[id], custom-designs}`
- **UX:** Thumbnail click → modal. Multiple images render gallery counter + next/prev arrows. Close × top-right, ESC key, click outside.

**Landing Page Animation Demo (Hero → Features Section):**
- **New section** added right after hero (`app/page.tsx` lines ~152–190): "Find similar designs with AI in seconds." — **AI-Powered branding throughout**
- **AI Similar Image Search workflow animation (4s loop, wide max-w-5xl, compact height py-8/12):**
  1. Upload box appears (0–0.6s): Search icon scales in, "Drag & drop or click to upload" text
  2. Search progress (0.4–0.7s): 3 pulsing dots + "Searching similar designs…" (loads while upload fades)
  3. Results appear (2.5s+): 4 catalog products in horizontal grid fade-in + scale, **"AI found similar designs"** label
  - Real workflow demo: upload → AI search → results discovered
  - Demonstrates the AI-powered visual-search feature so visitors understand the capability
- **Layout:** Single column, wider container (max-w-5xl, not max-w-2xl). Compact padding: card p-5, boxes p-4/5, results grid 4 cols. Slides in from bottom (y: 24) on scroll trigger via `whileInView`.
- **Purpose:** Showcase AI-powered Similar Search with realistic animation so visitors instantly see the intelligent discovery feature on the landing page.

**Similar Design Search for Retailers (Head Office):**
- **Feature:** Retailers now have the same AI-powered similar design search as Store Managers
- **Implementation:**
  - New API endpoint: `POST /api/store/search/image` (store-portal.ts) — protected by `storeGuard`
  - New UI page: `/store/similar-search` (upload image → find similar catalog pieces)
  - Same visual-search logic: embed image → search pgvector (RDS) → return similar manufacturer products
  - New menu item in Retailer sidebar under "Operations" section
- **Usage:** Retailer can upload a jewelry photo to discover visually similar pieces from the manufacturer catalog
- **Same as:** Store Manager search feature (`/store-manager/search`), but accessible from Retailer portal

**AI Category-Aware Theme Generation:**
- **Problem:** AI-generated images had no consistency per product category. Necklaces looked different from bangles, creating a disjointed catalog.
- **Solution:** Pass `category` + `subCategory` to ALL AI endpoints (`/describe`, `/catalog`, `/transparent`)
- **Implementation (components/manufacturer/ProductForm.tsx):**
  - New helper: `aiFormWithCategory()` — includes category + subCategory in FormData
  - Updated `aiCatalog()` — uses new helper to send category info
  - Updated `aiTransparent()` — uses new helper to send category info
  - `aiDescribe()` already sent category (no change needed)
- **Result:** AI-Features service receives category context and can generate:
  - **Consistent backgrounds per category** (all necklaces have similar aesthetic)
  - **Themed product presentations** (bangles style ≠ necklace style)
  - **Cohesive catalog appearance** across same category/subcategory
- **Next step:** AI-Features service (`../Jewel-Factory_AI`) must use category in prompts to apply category-specific themes

**Sales Analytics & Star Ratings (branch: `feature/sales-analytics`):**
- **Multi-role analytics system** showing sales insights for Store Manager, Retailer (HO), and Manufacturer
- **Star Ratings on Catalogs:** Every product shows ⭐ stars (1-5) based on last 30 days sales + trend indicator (↑ up, ↓ down, → stable)
  * Star mapping: 0-10 units → ⭐ | 11-30 → ⭐⭐ | 31-60 → ⭐⭐⭐ | 61-100 → ⭐⭐⭐⭐ | 100+ → ⭐⭐⭐⭐⭐
  * Trend: Compares last 30 days vs previous 30 days (5% threshold); shows % change
- **Backend:** `lib/db/analytics.ts` (helpers) + `lib/db/analytics-queries.ts` (raw SQL aggregations) + `lib/api/routes/analytics.ts` (8 GET endpoints)
- **Analytics Endpoints (all guarded):**
  * `/api/analytics/store-manager/restock` → Best-sellers in branch (sorted by stars)
  * `/api/analytics/store/branches` → Branch-wise breakdown (top products, by category, by weight)
  * `/api/analytics/manufacturer/overview` → Top 10, category/weight distribution (all retailers)
- **UI Components:** `components/ui/StarRating.tsx` + `components/ui/TrendBadge.tsx`
- **Intelligence Pages:**
  * Store Manager: `/store-manager/restock` — Table of best-sellers (sortable by stars/units/trend)
  * Retailer: `/store/intelligence` — Branch selector, top products, category/weight breakdowns
  * Manufacturer: `/manufacturer/intelligence` — System overview, top products, distributions
- **Data Scoping:** Store Manager sees THIS branch only; Retailer sees ALL branches; Manufacturer sees ALL retailers
- **Queries use raw SQL** for complex date-range aggregations (last 30d vs previous 30d); results include snapshots (category, weight, product name) stored at order time

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
- **Migrations on Supabase pooler** hit an advisory-lock timeout via `migrate dev`. Workaround used: apply DDL with `prisma db execute --url <DIRECT_URL>`, hand-write the migration file, and insert the `_prisma_migrations` row manually. The `20260717000000_branch_hierarchy` migration is hand-authored + idempotent (IF NOT EXISTS / DROP NOT NULL) so a partial re-run is safe. Render runs `pnpm run start` (`next start`) — migrations are NOT auto-applied; use `pnpm render-start` or Docker to auto-migrate.
- **Terminology trap:** `stores` table = Retailer (= Head Office), `store_managers` = **legacy/inert** (old HO Manager role removed; kept for historical approver FKs), `branches` = Store, `branch_managers` = Store Manager. Don't assume "store" means a shop in code — it's the retailer. New shop-level things go on `branches`.
- **Don't rename the `MessageSender.HO` enum or `OrderChat` `viewer='HO'`/`sender:'HO'` values** — those are DATA (stored rows + wire values). The HO Manager role is gone, but "HO" here just means the Head Office side of the chat, which is now the Retailer. Only the display text should read "Head Office".
- **Branch tenancy:** `branchManagerGuard` sets `storeId = retailerId`, so existing retailer-scoped DB helpers work unchanged; `branchId` narrows to the shop. Kiosk/restock orders from a branch carry `branchId` + `branchNameSnapshot`.
- **Kiosk sanitize is a DENYLIST** (`manufacturer-orders.ts sanitizeKiosk`) — it drops `customerName/Phone/Email/deliveryAddress` and lets everything else (incl. `branchNameSnapshot`, `requirementNote`) pass through. Any NEW PII field must be added to the drop-list.
- **`CustomDesignOrder` has NO branch/requirement columns** (only the sanitized snapshot). To surface branch/note on the manufacturer's custom-design view you'd add columns there + copy them in `forwardCustomRequest`.
- **Full-bleed sections:** the store-manager `layout` `<main>` is full-width (no `max-w`). Sections use `max-w-[1400px] mx-auto px-6`. For an edge-to-edge band use `left-1/2 w-screen -translate-x-1/2` — **NOT** `left-1/2 right-1/2 -mx-[50vw]` (that combo collapsed the hero). Non-home store-manager pages add their own `px-4 py-6` since the layout no longer pads.
- **`order_messages` is polymorphic** (`orderKind` + `orderId`, no FK) so one table serves kiosk/b2b/custom chat. Always query it scoped by `storeId`. `OrderChat.tsx` is shared — pass `viewer` ('HO' | 'STORE_MANAGER') and the right `basePath`.
- **`completedAt` is a flag, not a status** — set by the Store Manager via `markKiosk/B2b/CustomCompleted(branchId, id)`. Doesn't touch the approval status enum (avoids clashing with the existing flow).
- **Store Manager storefront images must be gold** (gold-only business). Try-On banner pulls a real catalog piece, not a stock photo; hero background is a gold showroom. Don't reintroduce blue/diamond stock imagery.
- **Order filters are CLIENT-SIDE.** `OrderFilters` (search + status + group dropdown + From/To date) + `lib/order-filters.ts` (`matchOrder`, `inDateRange`, `uniqueBranchOptions`, `*_STATUS_OPTIONS`). Pages fetch all orders then filter in a `useMemo`. The "group" dropdown is generic: HO passes the **branch** name (`branchNameSnapshot`), Manufacturer passes the **retailer** name (`storeNameSnapshot`/`storeName`) into `matchOrder`'s `branchName`. Date range filters on `createdAt` (`inDateRange` compares the `YYYY-MM-DD` slice lexicographically — every list row must carry `createdAt`). If you paginate/switch to server-side, move this into the API query params instead. Store Manager filters on a DERIVED bucket (`bucketOf`/`customBucketOf`), not the raw enum (it never shows manufacturer status).
- **Login handler must reset loading on error.** `StaffLoginForm.submit` sets `setLoading(false)` before the error `return`; only the success path (which `window.location.assign`s away) leaves it true. Don't remove it or wrong creds freeze the button again.
- **AI generation runs on OpenAI** (via AI-Features). A `502` on `/api/manufacturer/ai/*` usually wraps an OpenAI `429 insufficient_quota` — check OpenAI billing, not the app. HF Space `AI_FEATURES_URL` must be **lowercase** (capital host 307-redirects and drops the POST body).
- **Deleting a purchase manager (retailer) must cascade fully** — `deleteStoreByManufacturer` (`lib/db/stores.ts`) runs in a transaction: `b2b_orders`/`kiosk_orders`/`custom_design_orders` now cascade via FK (fixed 2026-07-30, were `ON DELETE RESTRICT` and would throw the moment a retailer had any order history), while `favorite_products`/`order_messages`/`product_views`/`tryon_events`/`product_sales` have **no FK to stores at all** (plain `storeId` string) so they're deleted explicitly before the store row. If you add a new table scoped by `storeId`, decide: real FK with `onDelete: Cascade`, or add it to this explicit cleanup list — don't leave it as neither (silent orphan rows) or a bare FK with no cascade (blocks every future delete).
- **`Store.email` is nullable and doubles as the login username** (2026-07-31) — a retailer may register with a mobile number only. `POST /api/store/login`'s `email` field is a *username*: it's looked up by `email` if it contains `@`, else by `ownerPhone`. Don't re-add `.email()` to that validator, and don't assume `store.email` is a string in new code (manufacturer list/registration views fall back to `ownerPhone`). Registration only enforces mobile uniqueness for email-less signups, so `ownerPhone` is NOT unique in the DB.
- **Purchase manager (retailer) has no password at registration** (removed 2026-07-30) — `POST /api/store/register` creates the row with a random unguessable placeholder hash (login is impossible pre-approval anyway, since `registrationStatus !== 'APPROVED'` blocks it). On approval, `approveRegistration` (`lib/db/stores.ts`) hashes the retailer's **mobile number** (`ownerPhone`) as the real `passwordHash` — login is email (username) + mobile number (password). If the retailer's registered mobile number changes later via `/store/profile`, their password does **not** auto-update (they'd need the existing forgot-password/reset flow) — this is a known, accepted gap, not a bug to "fix" by auto-syncing.
- **Registration address is PIN-code-first** — `app/store/register/page.tsx` calls `api.postalpincode.in/pincode/{pin}` client-side on a 6-digit PIN to auto-fill city/state (falls back to manual entry on a miss). This is the same India Post API referenced for future Karigar/address-autofill work; no server proxy, no API key needed, no rate limit per their docs.
