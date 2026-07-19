# Jewel Factory

A B2B gold-jewellery platform connecting one **Manufacturer** to its **Retailer**
network and their in-store **Customers**. Next.js 15 (App Router) + Hono BFF +
Prisma (Supabase Postgres) + Tailwind v4 + shadcn/ui.

**No price is shown anywhere** (gold-only business) and **customer personal data
never reaches the manufacturer**.

## Four roles, one app

- **Manufacturer** — global catalog (gold only, no price, auto `JF-XXXX` design
  numbers), approves retailers, receives + fulfils orders (never sees customer
  data). Portal `/manufacturer/*` (login at `/manufacturer`).
- **Retailer** (= Head Office) — self-registers → manufacturer approves. Creates
  Stores (branches) + Store Managers, does **all** order approvals + per-order
  chat, restocks from the catalog, manages branding + fixed address. Portal
  `/store/*` (login `/store/login`).
- **Store Manager** — runs one store's kiosk: catalog, AR try-on, similar-design
  search, custom-design and restock; sends orders up to the Retailer for approval.
  Portal `/store-manager/*` (login `/store-manager/login`).
- **Customer** — no login. In-store kiosk (the Store Manager operates it): browse,
  AR try-on, visual search, custom-design requests. No personal data is stored.

> The old separate "HO Manager" role has been removed — the Retailer is the Head
> Office. See **[docs/flow.md](docs/flow.md)** for the complete system flow.

## Setup

```bash
pnpm install                # deps + Prisma client
cp .env.example .env        # DATABASE_URL, secrets, Cloudinary, Qdrant, EMBEDDER_URL/AI_FEATURES_URL, SMTP
pnpm db:deploy              # apply all migrations on a fresh Supabase Postgres
pnpm db:seed                # 1 manufacturer + categories (+ demo retailer if SEED_DEMO_STORE=true)
pnpm dev                    # http://localhost:3000
```

Demo retailer for local testing:
```bash
SEED_DEMO_STORE=true pnpm db:seed
# Manufacturer: admin@atjewellers.com / manufacturer123
# Retailer:     store@demo.com / store123   (Store Managers are created by the Retailer)
```

## Routes

- `/` — branded public landing (navbar, featured showcase, Login popup, About, register prompt)
- `/about` — what the platform is + how it works
- `/manufacturer` — hidden admin entry (manufacturer login popup); `/manufacturer/*` portal
- `/store/*` — Retailer / Head Office portal (login/register/dashboard/approvals/orders/branches/profile)
- `/store-manager/*` — Store Manager (kiosk/try-on/search/custom-design/restock/my-orders)
- `/<storeSlug>/*` — public customer kiosk (URL-path tenancy)
- `/portal` → redirects to `/` (the login popup replaced the old selector)

## Key invariants (do not break)

- **No price, no metal** anywhere.
- **Auto design number** `JF-0001` via a Postgres sequence.
- **Customer PII never reaches the manufacturer** — kiosk/custom orders are
  sanitized; the manufacturer ships to the **retailer's fixed Head-Office address**.
- **3 logins / cookies** — manufacturer (`jf_manufacturer`), retailer (`jf_store`),
  store manager (`jf_branch_manager`); HMAC (Edge-safe), bcrypt passwords.
- Order approvals are done by the Retailer; `approverIdOrNull` writes `null` (the
  owner is not a `store_managers` row). The `store_managers` table is legacy/inert.

## External services

- **Cloudinary** — image storage (signed direct upload).
- **Qdrant** — vector DB for similar-design (visual) search.
- **AI-Features** (one Python service, HF Docker Space) — catalog/transparent/
  describe generation **and** OpenCLIP embeddings for search. One `AI_FEATURES_URL`
  (also `EMBEDDER_URL`). Optional — manual add + non-search flows work without it.
- **SMTP** — password-reset + store-approval emails (optional; logs to console if unset).

## Scripts

```bash
pnpm dev | build | start | typecheck | lint
pnpm db:deploy | db:seed | db:studio | db:generate
pnpm migrate:branches   # one-off: back-fill a default branch for an existing DB
```

## Docs (in `docs/`)

- **[docs/PROJECT_HISTORY.md](docs/PROJECT_HISTORY.md)** — full backstory, decisions & owner preferences (new machine/agent: read first)
- **[docs/flow.md](docs/flow.md)** — complete system flow (start here)
- **[docs/USER_MANUAL.md](docs/USER_MANUAL.md)** — non-technical staff guide + demo credentials
- **[docs/HANDOVER.md](docs/HANDOVER.md)** — fresh client setup, zero to live
- **[docs/DATABASE.md](docs/DATABASE.md)** — schema reference
- **[docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)** — detailed dev setup
- **[docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md)** — Render deploy · **[docs/AWS_MIGRATION.md](docs/AWS_MIGRATION.md)** — AWS plan
- **[docs/PENDING.md](docs/PENDING.md)** — remaining work checklist
- **[CLAUDE.md](CLAUDE.md)** — technical guidance for AI/dev work
