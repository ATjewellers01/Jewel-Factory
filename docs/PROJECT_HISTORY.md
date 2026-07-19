# Jewel Factory — Project History & Context (read this first, new agent)

**Purpose of this file:** if you are a Claude Code agent (or a new developer) who
was NOT part of the original conversations, read this to get the full backstory —
what was built, WHY each big decision was made, what's pending, and how the owner
likes to work. Combined with [`../CLAUDE.md`](../CLAUDE.md) (technical) and
[`flow.md`](flow.md) (system flow), this gives you the same context the previous
agent had.

> **You are continuing a real, shipping project.** Everything below is already in
> the code — this is the "why" and "history" that the code alone doesn't tell you.

---

## 0. TL;DR — what this project is

**Jewel Factory** = a **B2B gold-jewellery platform**. One Manufacturer → many
Retailers → each Retailer's Stores (branches) → Store Managers → walk-in Customers.
Single Next.js 15 app (App Router) + Hono BFF + Prisma (Supabase Postgres) +
Tailwind v4. A **clean rebuild** of an older repo called `../LuxeMatch` (same
features, no dead code). There is also a **separate AI service** repo, `AI-Features`
(deployed on a Hugging Face Docker Space), that does all AI (catalog image /
transparent PNG / name-description generation + OpenCLIP embeddings for visual
search).

**Two hard product rules that must NEVER break:**
1. **No price shown anywhere** (gold rates change daily; the store quotes the customer).
2. **Customer personal data never reaches the manufacturer** and is not stored — only
   products + quantity + an editable "requirement note" travel up.

---

## 1. Repos & branches

| Repo | Where | Notes |
|---|---|---|
| **Jewel Factory** (this app) | `github.com/teamai-botivate/Jewel-Factory` | Active branch: **`retailer-multistore`** — ALL current work is here. `master` is the older pre-hierarchy state. **Before handover, merge `retailer-multistore` → `master`** and point Render at it. |
| **AI-Features** | `github.com/teamai-botivate/Jewel-Factory_AI` (local `../AI-Features`) | Branch `main`. One Python/FastAPI service for all AI. Deployed at HF Space `Botivate2026/ai-workspace` → `https://botivate2026-ai-workspace.hf.space`. |
| **LuxeMatch** (old) | `../LuxeMatch` | The original monorepo this was rebuilt from. Reference only — the blueprint is `../LuxeMatch/JEWEL_FACTORY_SYSTEM_DESIGN.txt`. |

**Deploy:** Jewel Factory is on **Render** (`jewel-factory.onrender.com`). AI on the HF Space.

---

## 2. The four roles (current model)

`Manufacturer → Retailer (= Head Office) → Store (branch) → Store Manager → Customer`

- **Manufacturer** — catalog owner + admin. Approves retailers, fulfils orders, ships to the retailer's fixed address. Portal `/manufacturer/*` (login by typing `/manufacturer`).
- **Retailer = Head Office** (`stores` table, `/store/login`) — self-registers → manufacturer approves. Creates Stores + Store Managers, **does all order approvals + per-order chat**, restocks. Portal `/store/*`.
- **Store** (`branches` table) — a physical shop; a retailer has many.
- **Store Manager** (`branch_managers`, `/store-manager/login`) — runs one store's kiosk; sends orders up for approval.
- **Customer** — walk-in, no login, no data stored.

> **Code terminology trap:** `stores` = Retailer, `branches` = Store, `branch_managers`
> = Store Manager. The `store_managers` table is **legacy/inert** (see §3.2).

---

## 3. Chronological history — what was built and WHY

The work happened in several big sessions. Newest first is easier to act on, but
here it's oldest→newest so the "why" chains make sense.

### 3.0 Base rebuild (before these sessions)
The single-app Jewel Factory was rebuilt from LuxeMatch: manufacturer catalog,
retailer/store/manager auth, kiosk, AR try-on, orders, custom design, migrations
(Prisma-managed, idempotent, applied via `pnpm db:deploy` — the Supabase pooler
chokes on `migrate dev`).

### 3.1 Multi-store (retailer) hierarchy
**Why:** the owner said one "Store" is actually a **Retailer** company that runs
**multiple branches**, each with its own manager, and the customer stays with each
branch's manager. So the flat model became `Retailer → HO Manager → Stores →
Store Managers → Customer`. Added `branches` + `branch_managers` tables, branch-
scoped orders (`branch_id`, `branch_name_snapshot`, `requirement_note`), and made
customer PII optional (kept outside the system). Migration `branch_hierarchy`.

### 3.2 HO Manager role — added, then REMOVED
Originally there was a separate **HO Manager** (`store_managers` table,
`/store/manager/login`, cookie `jf_manager`) who did approvals. Later the owner
decided the **Retailer should do everything the HO Manager did** and the HO Manager
role should be **removed entirely** (Option 1: keep the DB table + rows for
historical approver FKs, but remove login/UI/create-feature).

**Result (current):** Retailer = Head Office. `managerGuard` is owner-only now,
`isOwner` is always true in store-ops, and `approverIdOrNull()` always returns
`null` (the owner isn't a `store_managers` row). Deleted: `/store/manager/*`,
`/api/manager/*`, `/store/managers` page + its API routes + DB helpers. The
`store_managers` table stays but is inert. **Do not re-introduce HO Manager as a
live role.**

> **Critical DATA-vs-DISPLAY rule that survived the removal:** the `MessageSender.HO`
> enum and `OrderChat` `viewer='HO'`/`sender:'HO'` prop values are **DATA** — never
> rename them. Only user-facing *display* text was changed from "HO" to
> "Head Office".

### 3.3 Order chat + "My Orders" + Mark Completed
Per-order chat between Head Office and Store Manager (`order_messages`, polymorphic
`order_kind` + `order_id`, scoped to the retailer). Store Manager's My Orders has
Kiosk/Custom/Restock tabs, status buckets, a "Mark Completed" flag, and "Message
Head Office". Head Office has "Message" on Pending Approvals AND Custom Designs.
**Store Manager never sees the manufacturer's granular status** — only Pending /
Approved by Head Office / Rejected / Completed. Full manufacturer status is
Head-Office-only.

### 3.4 Order-list filters (all lists, client-side)
Reusable `components/orders/OrderFilters.tsx` + `lib/order-filters.ts`. Every order
list has: **order-ID search + status dropdown + From/To date range**. Retailer lists
also filter by **Store (branch)** (each row shows a branch badge); Manufacturer
lists filter by **Retailer**. All client-side (`useMemo` over already-fetched data).
`matchOrder()` + `inDateRange()` are the shared matchers. **Why date filter:** the
owner noticed order IDs embed a date; filtering on `createdAt` is more reliable.

### 3.5 AI "Generate with AI" in manufacturer Add Design
The manufacturer uploads a **raw phone photo** (temporary, NOT saved) + specs →
the AI-Features service fills Design Name + Description, a luxury catalog image, and
a transparent try-on PNG. All editable; regenerate with a custom instruction;
click-to-zoom on generated images. **Field order:** specs (Category/Sub/Weight/
Purity) → AI panel → Design Name → rest. New designs default to **Active**. AI is
optional (hidden if `AI_FEATURES_URL` unset). Proxied server-side
(`/api/manufacturer/ai/*`) so the key never hits the browser.

**Bugs fixed here (so you don't reintroduce them):**
- Double-product race: `ensureProductId` created two products on concurrent AI
  uploads → fixed with a ref-based lock.
- **HF host must be lowercase** in `AI_FEATURES_URL`/`EMBEDDER_URL` — a capital-cased
  URL 307-redirects and drops the POST body → upstream 502.
- **AI generation currently fails with OpenAI `429 insufficient_quota`** — this is a
  billing issue, not a code bug. Add OpenAI credit. `/embed/*` (visual search) uses
  local OpenCLIP and is unaffected.

### 3.6 Transparent try-on prompt = FRONT-only
2D AR overlays a PNG on the neck/wrist from the front, so the transparent asset must
be **front-only**: necklace = open U/V drape (no back chain/clasp), bangle = front
arc only. Fixed in AI-Features `lib/prompts.py`. **Old full-loop assets must be
regenerated** after an HF redeploy.

### 3.7 Store Manager storefront + detail modals + try-on flow
Store Manager kiosk/search product cards open a detail modal (gallery, specs,
description, **Try On** when AR, **Similar designs**, image zoom, close-X at card
top-right). Try-on page reads `?product=` (auto-select) + `?back=` (Back button to
the originating page). Visual (similar-design) search: Store Manager → Search →
upload a photo → matching catalog designs.

### 3.8 Manufacturer terminology: "Stores" → "Retailers"
In the manufacturer portal, user-facing "Store(s)" / "Store Registrations" were
renamed to **"Retailer(s)" / "Retailer Registrations"** (nav, headings, dashboard
stat). Code identifiers/routes/types stayed `store` (safe).

### 3.9 Public branded landing (biggest recent UI change)
`/` was a "Rebuild in progress" placeholder. Now it's a **branded landing** for
logged-out visitors:
- Navbar: **text wordmark** "JEWEL FACTORY" (do NOT use `public/logo-wordmark.png` —
  it still says "LUXEMATCH") + Catalog · About · **Login** · **Register here**.
- Hero, **featured real-catalog showcase** (public `GET /api/kiosk/catalog`, no
  price; cards are clickable → detail modal ending in a Register/Login CTA),
  "why" cards (incl. similar-design search), footer.
- **Login popup** = 2 columns (Retailer | Store Manager), embedded compact login
  forms. Reuses `StaffLoginForm` in a new `bare` mode. Manufacturer is NOT here.
- **Register prompt** auto-opens ~5s after load, once per session (sessionStorage),
  dismissible.
- New **`/about`** page.
- **`/manufacturer`** = hidden admin entry: visiting the URL shows the manufacturer
  login popup (or redirects to the dashboard if already signed in).
- **`/portal` deleted → redirects to `/`**; signOut + login footers point to `/`.

### 3.10 Responsive pass
The app was already largely mobile-aware (sidebars have hamburgers, tables auto-
scroll, modals inset+scroll, grids have single-col bases). Fixed the few real
issues: hero headings (smaller mobile base + `break-words`), a retailer-row
truncation, and some card/heading padding.

### 3.11 Docs reorganised
All docs moved into **`docs/`** (except `CLAUDE.md` + `README.md`, which stay at the
repo root — `CLAUDE.md` is auto-loaded by Claude Code, `README.md` is the GitHub
landing). `SYSTEM_FLOW.txt` → `docs/flow.md` (rewritten as full markdown). Stale
`USER_FLOWS_AND_GUIDE.txt` deleted. This file (`PROJECT_HISTORY.md`) added.

---

## 4. What's PENDING (see docs/PENDING.md for the live checklist)

1. **Merge `retailer-multistore` → `master`** and **redeploy Render** from it — the
   live site may still be running older code.
2. **OpenAI credit** — AI generate returns 429 until billing is added (or a funded
   `OPENAI_API_KEY` is set on the HF Space + restart).
3. **Rotate secrets** — live secrets were exposed in chat once (Supabase pwd,
   Cloudinary secret, Qdrant key, Gmail app pwd, auth secrets). Rotate them in the
   dashboards before real use. **Never commit secrets.**
4. **Live end-to-end test** — all flows on the deployed site.
5. **Embedder/visual-search live verify** (HF `/embed` + Qdrant).
6. **AWS migration** — planned in `docs/AWS_MIGRATION.md` (RDS + pgvector + S3/
   CloudFront + EC2), not executed. Owner has the AWS .pem, will do it later.

---

## 5. How the owner likes to work (preferences — follow these)

- **Language:** talk in **Hindi-English (Hinglish)**, casual and clear. Docs meant
  for staff (USER_MANUAL) are in Hinglish too.
- **"don't modify the code now / tell me what you understood first":** the owner
  often wants you to **explain your understanding + plan BEFORE editing**. When they
  say this, do NOT touch code — describe what you'll do and ask to confirm. Only
  start after they say "start" / "do" / "yes".
- **Push after each change:** the owner asks you to **commit + push** each finished
  change (usually to `retailer-multistore`). Commit messages end with the
  `Co-Authored-By: Claude ...` trailer (see the git log for the exact format).
- **Verify before pushing:** run `pnpm typecheck` (and `pnpm build` for structural
  changes / new pages) before committing. Both must pass.
- **Explain trade-offs, then recommend one option** — the owner picks. Use short,
  concrete questions when a decision is genuinely theirs (role visibility, data
  showing publicly, etc.).
- **Respect the two hard rules** (no price, no customer PII to manufacturer) in every
  change.
- The owner reviews via **screenshots of the live/deployed site** — so after a UI
  change, remember it only shows up once Render redeploys from this branch.

---

## 6. First things to do on a fresh clone (new laptop)

```bash
git clone https://github.com/teamai-botivate/Jewel-Factory.git
cd Jewel-Factory
git checkout retailer-multistore     # all current work is here
pnpm install                         # deps + prisma generate
cp .env.example .env                 # then fill it — see docs/HANDOVER.md
pnpm db:deploy && pnpm db:seed       # schema + 1 manufacturer (+ demo retailer if SEED_DEMO_STORE=true)
pnpm dev                             # http://localhost:3000
```
Also clone the AI service if you'll touch AI: `github.com/teamai-botivate/Jewel-Factory_AI`.

Then, as an agent: **read `../CLAUDE.md`, this file, and `flow.md`** — that's the full
context. Demo logins after seed: Manufacturer `admin@atjewellers.com /
manufacturer123`; Retailer `store@demo.com / store123`; Store Manager is created by
the Retailer (no default).

---

## 7. Map of the docs

- [`../CLAUDE.md`](../CLAUDE.md) — technical guidance, architecture, gotchas (auto-loaded).
- [`flow.md`](flow.md) — complete system flow (start here for "how it works").
- [`USER_MANUAL.md`](USER_MANUAL.md) — non-technical staff guide + demo credentials.
- [`HANDOVER.md`](HANDOVER.md) — fresh client setup, zero to live.
- [`DATABASE.md`](DATABASE.md) — schema reference.
- [`SETUP_GUIDE.md`](SETUP_GUIDE.md) — detailed dev setup.
- [`DEPLOY_RENDER.md`](DEPLOY_RENDER.md) — Render deploy. [`AWS_MIGRATION.md`](AWS_MIGRATION.md) — AWS plan.
- [`PENDING.md`](PENDING.md) — live remaining-work checklist.
- **This file** — history, decisions, owner preferences.
