# Jewel Factory

A B2B gold-jewellery platform connecting one **Manufacturer** to its network of
**Purchase Managers** (multi-store retailers), each running one or more physical
**Stores** staffed by **Store Managers**, serving walk-in **Customers**.

Next.js 15 (App Router) + Hono BFF + Prisma (Postgres — Supabase for dev, AWS
RDS in production) + Tailwind v4 (CSS-first) + shadcn/ui (new-york) + lucide +
motion. Single app — no monorepo, no `packages/*`.

**No price is shown anywhere** (gold-only business), **karigar (artisan) codes
are manufacturer-internal only**, and **customer personal data never reaches
the manufacturer**.

## Terminology — UI name vs. code/table name

The database kept its original identifier names through two display-only
renames, so the words in the UI and the words in the code deliberately differ:

| UI display text | Code / DB / routes |
|---|---|
| **Purchase Manager** (Head Office) | `stores` table, `Store` model, `jf_store` login, "Retailer" everywhere in code |
| **Store** (one physical shop) | `branches` table, `Branch` model |
| **Store Manager** | `branch_managers` table, `BranchManager` model, `jf_branch_manager` login |
| **Catalog order** | `B2bOrder` model, `OrderKind.B2B`, `/store/b2b-orders`, `useB2bCart` |
| **Customised order** | `CustomDesignOrder` model, `OrderKind.CUSTOM` |

The old **"HO Manager"** role (a separate approver above the retailer) has been
**removed entirely** — the Purchase Manager (Head Office) now does every
approval itself. The `store_managers` table still exists but is inert, kept
only for historical approver foreign keys; there is no login or creation path
for it anymore.

## Four roles, one app

- **Manufacturer** — global catalog (gold only, no price, auto `JF-XXXX` design
  numbers), manufacturer-editable Category / Sub-category 1 / Sub-category 2 /
  Purity taxonomy, approves Purchase Manager registrations, receives and
  fulfils Catalog / Kiosk / Customised orders, assigns Karigars to items
  (optionally handed off to the external Order-to-Delivery system). Never sees
  customer data; ships to the Purchase Manager's fixed Head-Office address.
  Portal `/manufacturer/*` (login at `/manufacturer`).
- **Purchase Manager** (Head Office) — self-registers with a mobile number
  (email optional) → manufacturer approves. Has one fixed HO address. Creates
  its own Stores (branches) and each Store's Store Managers. Does **all**
  approvals (kiosk / Catalog / Customised) for every branch, can edit the
  requirement note/remark, chats with Store Managers per order, sets/resets
  each branch's Restock PIN, and can place Catalog orders directly. Portal
  `/store/*` (login `/store/login`, register at `/store/register`).
- **Store Manager** — runs one Store's Kiosk (customer-facing, no PII
  collected) and PIN-walled Restock ordering; sends orders up to the Purchase
  Manager for approval; marks its own orders Completed once delivered to the
  customer. Portal `/store-manager/*` (login `/store-manager/login`).
- **Customer** — walk-in, no login, **no data stored**. The Store Manager
  operates the kiosk on the customer's behalf; a requirement is captured only
  as an editable note, never a name/phone/address. A legacy public kiosk at
  `/<storeSlug>/*` still exists, but the primary in-store path is the Store
  Manager's own `/store-manager/kiosk`.

See **[CLAUDE.md](CLAUDE.md)** for the full technical guidance this repo is
built against, and **[docs/flow.md](docs/flow.md)** for the complete order
flow across all four roles.

## Setup

```bash
pnpm install                # deps + Prisma client (postinstall runs prisma generate)
cp .env.example .env        # fill in DATABASE_URL/DIRECT_URL, auth secrets, AWS S3, AI-Features, SMTP — see below
pnpm db:deploy               # apply all migrations to a fresh Postgres (Supabase for dev, RDS in prod)
pnpm db:seed                  # 1 manufacturer + 14-category taxonomy (+ demo Purchase Manager if SEED_DEMO_STORE=true)
pnpm dev                      # http://localhost:3000
```

Demo Purchase Manager for local testing:
```bash
SEED_DEMO_STORE=true pnpm db:seed
# then log in and explore at /demo (the kiosk slug the seed creates)
```

No `NEXT_PUBLIC_SUPABASE_*` vars are needed — the app talks to Postgres
directly via Prisma, not Supabase Auth.

## Routes

- `/` — branded public landing (navbar, featured catalogue showcase, login
  popup, About page, register prompt)
- `/about` — what the platform is and how it works
- `/manufacturer` — hidden admin entry (login popup); `/manufacturer/*` is the
  full portal (catalogue, orders, Karigar assignment, store registrations,
  retailer intelligence)
- `/store/*` — Purchase Manager (Head Office) portal: login / register /
  forgot-password / reset, dashboard, pending-approvals, manufacturer
  catalogue (+ place Catalog orders), order history, custom-design requests,
  intelligence / analytics, profile, branches (Stores + Store Managers + PIN)
- `/store-manager/*` — Store Manager storefront (login-gated): home, kiosk,
  try-on, visual search, restock (PIN-walled), my-orders (status + chat +
  Mark Completed)
- `/<storeSlug>/*` — legacy public customer kiosk (URL-path tenancy): home,
  catalog, search, try-on, custom-design, checkout
- `/portal` → redirects to `/` (the login popup replaced the old role selector)

## Key invariants (do not break)

- **No price, no metal** shown anywhere — audit before adding any product UI.
- **No design name** — the auto `JF-0001` design number (Postgres sequence,
  `lib/design-number.ts`) is the sole identifier everywhere.
- **`karigarCode`** (which artisan makes a piece) is manufacturer-internal
  only — every public/tenant-scoped read structurally omits it via Prisma's
  `omit`, not just UI hiding.
- **Customer PII never reaches the manufacturer.** Kiosk/custom orders carry
  only products + quantity + an editable requirement note/remark. The
  manufacturer sees the Purchase Manager's business name, the note, the
  ship-to address, and product detail — never the retailer's city, branch
  name, or the customer's name/phone.
- **3 login cookies + 2 PIN cookies** — `jf_manufacturer`, `jf_store`
  (Purchase Manager), `jf_branch_manager` (Store Manager); plus `jf_kiosk`
  (legacy public kiosk unlock) and `jf_restock` (per-branch restock PIN
  unlock). All HMAC-SHA256 (Edge-safe), passwords bcrypt.
- **Restock is PIN-walled per branch.** Set/reset by the Store Manager or the
  Purchase Manager.
- Order approvals are always done by the Purchase Manager; `approverIdOrNull`
  always writes `null` now that the HO Manager role is gone.

## External services

- **AWS S3 + CloudFront** — signed direct upload for catalogue / try-on / logo
  / custom-design images (`lib/storage.ts`). Replaced Cloudinary.
- **PostgreSQL `pgvector`** — cosine-distance similar-design (visual) search,
  in the same database as everything else. Replaced Qdrant.
- **AI-Features** (separate Python repo, deployed as a Hugging Face Docker
  Space) — one service for `/catalog`, `/transparent`, `/describe` (OpenAI,
  used by the manufacturer's "Generate with AI" button) **and** `/embed/*`
  (OpenCLIP embeddings that back the pgvector search above). One
  `AI_FEATURES_URL` + `AI_FEATURES_API_KEY` pair; optional — if unset, AI
  generation is hidden and manual catalogue entry still works.
- **SMTP** — password-reset and store-approval emails; optional, logs to the
  console instead of blocking the flow if unset.

## Scripts

```bash
pnpm dev | build | start | typecheck | lint
pnpm db:generate | db:migrate | db:deploy | db:seed | db:studio
pnpm migrate:categories            # one-off: map a pre-existing DB's flat category list to the current taxonomy
pnpm migrate:branches              # one-off: back-fill a default "Main Store" branch for an existing DB
pnpm backfill:set-subcategory2     # one-off: seed default Sub-category 2 values under Set's Sub-category 1 rows
```

`render-start` (`prisma migrate deploy && next start`) is what Render's start
command runs; plain `pnpm start` does **not** apply migrations — see the AWS
deploy note below.

## Production deployments

Two targets exist historically — check with the team before assuming either
is retired:

- **AWS EC2** (primary production) — a Docker container tagged to a specific
  git commit hash, running against AWS RDS Postgres + S3/CloudFront. Migrations
  auto-apply on container start. Redeploying after a code change means
  rebuilding the Docker image at the new commit and restarting the container
  — merging to `master` alone does not update what's live. See CLAUDE.md's
  "Production deployments" section for the exact rebuild command.
- **Render** — `jewel-factory.onrender.com`, backed by Supabase Postgres,
  started via `pnpm render-start` (which does apply migrations).

## Docs (in `docs/`)

- **[docs/FIRST_PROMPT.txt](docs/FIRST_PROMPT.txt)** — on a new machine, paste this as the first message to a fresh Claude Code agent
- **[docs/PROJECT_HISTORY.md](docs/PROJECT_HISTORY.md)** — full backstory, every major decision and why, what's pending, how the owner likes to work
- **[docs/flow.md](docs/flow.md)** — complete system flow across all four roles
- **[docs/USER_MANUAL.md](docs/USER_MANUAL.md)** — non-technical staff guide, roles, demo credentials, step-by-step workflows
- **[docs/HANDOVER.md](docs/HANDOVER.md)** — zero-to-live client onboarding
- **[docs/DATABASE.md](docs/DATABASE.md)** — schema reference
- **[docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)** — detailed dev environment setup
- **[docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md)** — Render deploy guide
- **[docs/AWS_MIGRATION.md](docs/AWS_MIGRATION.md)** — the AWS migration plan (now the live production deploy)
- **[docs/WHATSAPP_SETUP.md](docs/WHATSAPP_SETUP.md)** — Meta WhatsApp Cloud API setup (prep work — send integration not yet built)
- **[docs/O2D-INTEGRATION.md](docs/O2D-INTEGRATION.md)** — spec for the Order-to-Delivery (O2D) Karigar-assignment integration
- **[docs/PENDING.md](docs/PENDING.md)** — remaining work checklist
- **[CLAUDE.md](CLAUDE.md)** — full technical guidance for AI/dev work on this repo (read this first for anything non-trivial)
