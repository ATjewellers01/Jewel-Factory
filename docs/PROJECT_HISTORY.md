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
| **Jewel Factory** (this app) | `github.com/ATjewellers01/Jewel-Factory` (client `origin`) + `github.com/teamai-botivate/Jewel-Factory` (team `teamai`, `feature/sales-analytics` kept in sync) | Active branch: **`master`** — `retailer-multistore` was merged in (as of the 2026-07-24 session it shows merged; this doc previously said the opposite — that was stale). Team's `teamai` remote's `feature/sales-analytics` branch mirrors client `master`, by deliberate choice (keeps the team repo's own `master` untouched). |
| **AI-Features** | `github.com/teamai-botivate/Jewel-Factory_AI` (+ mirror `github.com/ATjewellers01/Jewel-Factory-AI`, both kept in sync; local `../AI-Features`) | Branch `main`. One Python/FastAPI service for all AI. Deployed at HF Space `Botivate2026/ai-workspace` → `https://botivate2026-ai-workspace.hf.space`. |
| **LuxeMatch** (old) | `github.com/teamai-botivate/B2B_Luxmatch` (local `../LuxeMatch`) | The original monorepo this was rebuilt from. **Reference only** — the blueprint is `../LuxeMatch/JEWEL_FACTORY_SYSTEM_DESIGN.txt`. Not needed to run the app. |

**Deploy:** Jewel Factory has **TWO known production targets**: the original **Render**
(`jewel-factory.onrender.com`) and, since 2026-07-22, **AWS EC2** (`13.126.65.154`,
Docker, RDS + pgvector + S3/CloudFront — see `AWS_MIGRATION.md`), confirmed live via
SSH on 2026-07-24. **Whether Render is still serving traffic in parallel, or was
retired when AWS went live, is unconfirmed** — don't assume either without checking.
AI stays on the HF Space regardless of which app deploy is live.

**Workspace layout (keep the three repos as SIBLINGS in one parent folder** — the
`../LuxeMatch` and `../AI-Features` relative paths in the docs depend on this):
```
<workspace>/
  ├── LuxeMatch/        (git: B2B_Luxmatch — reference/blueprint only)
  ├── AI-Features/      (git: Jewel-Factory_AI — Python AI service)
  └── Jewel Factory/    (git: Jewel-Factory — main app, active work)
```

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

### 3.12 Shared responsive portal entry UI
Retailer, Store Manager, and Manufacturer sign-in pages, plus the Retailer
registration page, now share `components/auth/PortalLoginScreen.tsx`. The shell
uses the same contained width and spacing on desktop/tablet and collapses cleanly
on mobile. Sign-in content is vertically centred; registration alone opts into an
internally scrolling right panel so its long form remains inside the rounded
frame. `StaffLoginForm` continues to own authentication behavior, with visible
labels on full pages and a compact mode in the public login modal. Manufacturer
entry authentication is checked server-side to avoid signed-out 401 console noise.

### 3.13 Mobile visual-search source selection
Store Manager and storefront visual search now provide explicit **Take photo**
and **Choose photo** actions. The camera action uses `capture="environment"` to
request the rear camera on mobile; the chooser deliberately omits `capture` and
opens the device's normal image picker. Both paths feed the same preview and
similarity-search request, and the action pair stacks into full-width touch
targets on mobile.

### 3.14 Sales Analytics & Star Ratings
**Why:** the owner wanted a way to see which products are actually selling —
per-branch for Store Managers, across all branches for the Retailer, system-wide
for the Manufacturer — instead of a flat catalog with no signal on performance.
Every catalog product now shows a **1–5 star rating** (last-30-days units sold:
0-10→⭐, 11-30→⭐⭐, 31-60→⭐⭐⭐, 61-100→⭐⭐⭐⭐, 100+→⭐⭐⭐⭐⭐) plus a trend
arrow (↑/↓/→, last 30d vs previous 30d, 5% threshold). Backend is raw SQL
(`lib/db/analytics-queries.ts`) — a `UNION ALL` CTE combines kiosk + B2B order
items **before** joining to `manufacturer_products` once, specifically to avoid
the cross-join row-multiplication bug that two separate `LEFT JOIN`s would cause.
New pages: Store Manager `/store-manager/restock` (best-sellers, this branch),
Retailer `/store/intelligence` (branch selector + breakdowns, all branches),
Manufacturer `/manufacturer/intelligence` (system-wide, all retailers). Built on
branch `feature/sales-analytics`, later merged into `master`.

**Bug found + fixed much later (2026-07-24, see §3.17):** three of the
manufacturer-facing query functions returned Postgres `SUM()` results (a JS
`BigInt`) straight to `c.json()` without converting to `Number` first —
`JSON.stringify` can't serialize `BigInt`, so all three Manufacturer Intelligence
endpoints 500'd once real order data existed to sum. Dev/staging DBs being empty
is why this went unnoticed for a while.

### 3.15 Similar Design Search extended to Retailers
The Store Manager's AI-powered visual (photo) search — upload a jewelry photo,
find visually similar catalog pieces via OpenCLIP embeddings — was extended to
the **Retailer (Head Office)** portal too (`POST /api/store/search/image`,
`/store/similar-search` page, same embed-and-search logic, new sidebar item under
"Operations"). Also surfaced on the public landing page + About page as a live
demo (upload → search → results, `app/page.tsx`) so visitors understand the
capability before registering.

### 3.16 AI category-aware theme generation
**Problem:** AI-generated catalog/try-on images had no visual consistency across
a category — necklaces and bangles looked stylistically unrelated, and the
catalog read as disjointed. **Fix:** `category` + `subCategory` are now passed to
every AI-Features endpoint (`/describe`, `/catalog`, `/transparent`) via a new
`aiFormWithCategory()` helper in `components/manufacturer/ProductForm.tsx`, so the
AI service can apply category-specific themes/backgrounds consistently. The
Python-side prompt work to actually USE that category context for themed
generation was flagged as a next step for `../AI-Features` — check
`lib/prompts.py` there for whether it was completed.

### 3.17 AWS production migration (executed by Abhay, 2026-07-22)
**Why:** move off Render/Supabase/Cloudinary/Qdrant/HF-for-app-hosting onto AWS
for production. Executed in one commit (`fe95556 feat: migrate production
services to AWS`), phase-by-phase per the original plan in `AWS_MIGRATION.md`
(now rewritten to reflect what actually happened, since it originally read as an
unexecuted plan):
- **DB:** Supabase → **AWS RDS Postgres**.
- **Vectors:** Qdrant → **pgvector** in the same RDS (new column + migration
  `20260722090000_pgvector`; `lib/search.ts` internals swapped, function names
  kept so callers didn't change).
- **Storage:** Cloudinary → **S3 + CloudFront** (`lib/cloudinary.ts` deleted,
  replaced by new `lib/storage.ts`; presigned S3 PUT uploads).
- **App:** Render → **EC2 via Docker** (deviates from the original PM2/nginx/
  certbot plan — simpler to just run the existing Dockerfile; TLS/domain via
  `sslip.io` rather than a real domain + Let's Encrypt).
- **AI-Features deliberately NOT moved** — it stays on the HF Space, called
  externally from the EC2 app exactly as Render called it. No reason to migrate a
  separately-deployed, already-working service.

**This was undiscovered/undocumented in this history file until the next session
(§3.18)** — CLAUDE.md and this file both still described Cloudinary/Qdrant/Render
as current for two days after the migration actually happened and shipped.

### 3.18 Production debugging session (2026-07-24) — found the AWS deploy, fixed Intelligence 500s
The owner reported the Manufacturer Intelligence page showing "Could not load
intelligence data" (500s on 3 endpoints) and asked to fix it. This had been
investigated in an earlier session via static code review alone (no bug found,
because the bug only manifests with real data — see §3.14). This session:
1. **Got SSH access** to the AWS EC2 box (`13.126.65.154`) that had been blocked
   earlier by a Security Group IP restriction — the restriction had since been
   lifted (or the assistant's IP changed to one already allowed).
2. **Discovered the AWS production deployment** existed at all and was live —
   found the RDS DB, S3/CloudFront, Docker container, confirming §3.17 had
   actually happened (this had not been communicated/documented anywhere the
   assistant had access to before this session).
3. **Reproduced the bug live**: tailed `docker logs -f` for 90s while asking the
   owner to reload the Intelligence page in their browser, capturing the real
   stack trace: `TypeError: Do not know how to serialize a BigInt`.
4. **Root-caused and fixed**: `getManufacturerRetailerSales`,
   `getManufacturerCategoryWeightBreakdown`, `getManufacturerTopProducts` in
   `lib/db/analytics-queries.ts` returned raw `$queryRaw` rows (with a `BigInt`
   `total_units` from `SUM()`) directly to the client. Fixed by mapping
   `total_units` through `Number(...)` before returning — matching the pattern
   `getRetailerBranchSales` already used correctly.
5. **Also fixed (pending from an earlier session):** hid "Analytics" from the
   Retailer sidebar (`components/layout/StoreLayout.tsx`) without deleting the
   page — the owner was explicit that "remove" and "hide" are NOT the same thing
   and corrected a prior misunderstanding sharply. `/store/analytics` still works
   directly; its data duplicates `/store/intelligence`'s stat cards.
6. **AI image-generation cost analysis** — verified real OpenAI pricing (not
   guessed) for the manufacturer's "Generate with AI" feature: ~₹57 per "Generate
   All" click at the likely-actual default (`quality="auto"` resolves to High for
   our detailed prompts, since no route sets `quality=` explicitly), ~₹15 if
   forced to Medium. Documented in `../AI-Features/CLAUDE.md`. Also surfaced a
   **critical flag**: `gpt-image-1` (the model the transparent-background step of
   try-on generation depends on for its native `background="transparent"`
   support) **retires 2026-10-23** — must be re-tested/repointed before then or
   the try-on pipeline breaks.
7. **Incidental secret exposure**: while diagnosing over SSH, a `sed` redaction
   pattern missed the `DATABASE_URL=` line and the RDS database password was
   printed in plaintext into the session transcript. Flagged to the owner;
   rotating that password is now in `PENDING.md`.
8. **Docs corrected** (this file, `CLAUDE.md`, `AWS_MIGRATION.md`, `PENDING.md`) —
   they had been describing a pre-AWS-migration, pre-merge state for two days
   after the actual code/infra had moved on. Lesson for future agents: **when
   debugging production, check whether there's an AWS deploy before assuming
   Render is the only one** — this doc will hopefully now save that rediscovery.

### 3.19 Retailer profile expansion + photo-search web enhancement planning (2026-07-24 continued)
The owner asked for complete visibility into retailers at the manufacturer's manage-
retailers page, plus planning for web-based photo search. This session:

1. **Expanded retailer profile modal** — Manufacturer now sees complete retailer
   details in `/manufacturer/stores` edit modal: business contact (name/email/phone
   /city, editable), owner details (read-only), full HQ address (street/city/state
   /pincode/landmark, read-only), operations stats (active stores + store manager
   count, read-only), registration status + joined date (read-only), + editable
   extra-stores-granted field. Backend updated (`lib/db/stores.ts`
   `listStoresByManufacturer`) to return branches with manager info.

2. **Stores (branches) list in modal** — New section shows each retailer's active
   stores: name, location, manager count, restock PIN set/not-set status. Hidden
   from customer; staff-only (badges show source: 🏠 catalog or 🌐 web).

3. **Store-limit enforcement** — Enforced per-retailer limit: 2 free branches +
   manufacturer-editable `extraBranchAllowance`. API returns 409 + "You've reached
   your store limit" message when exceeded.

4. **AWS redeploy** — Built `jewel-factory-prod:c54a967`, all migrations applied,
   container verified running. Tested expanded modal live; shows all fields.

5. **Feature/sales-analytics branch synced** — Merged `master` (7 commits) into
   `feature/sales-analytics` so the team's branch reflects all recent work (store-
   limit, expanded modal, stores list, product-detail modal, restock PIN fix,
   analytics cleanup). Team's `teamai/feature/sales-analytics` now mirrors
   `origin/master` again.

6. **Photo-search web enhancement spec** — Comprehensive plan approved and saved
   to `docs/PENDING.md` (section 7): Blend catalog + web results for customer
   (seamless, no source labels), show badges to Store Manager (🏠 | 🌐), use
   Azure Bing Visual Search API (vs SerpApi/TinEye; real reverse-image-search,
   best for jewelry, ~₹500-600/month, reliable). Safety: timeouts (5s max),
   rate-limiting (100/day), image validation (size/format/magic bytes), circuit
   breaker (3 fails → 5-min cooldown), feature flag (instant disable). Rollout:
   code → staging (flag OFF) → pilot store (10%) → 100% if stable. Python Colab
   test script created (`bing_visual_search_test.py`) to validate Azure Bing API
   before implementation. **Pending:** Owner sign-off on Bing API choice + budget
   before writing code.

7. **Docs updated** — CLAUDE.md, PROJECT_HISTORY.md, PENDING.md all reflect
   this session's work.

---

## 4. What's PENDING (see docs/PENDING.md for the live checklist — this section is a summary, PENDING.md is the source of truth)

1. ~~Merge `retailer-multistore` → `master`~~ — **DONE**, `master` is now the
   active branch (see §3.17/§3.18).
2. ~~AWS migration~~ — **DONE** (§3.17): RDS + pgvector + S3/CloudFront + EC2/Docker,
   all confirmed live. **What's still open:** confirm whether Render is retired or
   still live in parallel; document the actual EC2 redeploy (rebuild+restart)
   command — it's not automatic on `git push`.
3. **Rotate secrets** — the **AWS RDS database password** was freshly exposed in
   plaintext during the 2026-07-24 debugging session (see §3.18) — rotate it.
   Also still outstanding from earlier: Supabase (dev) DB pwd, Gmail app pwd, the
   4 auth secrets. Cloudinary/Qdrant secrets are now moot (retired in prod).
4. **Live end-to-end test** — all flows, on whichever deploy target is
   authoritative (Render vs AWS EC2 — see #2).
5. **OpenAI quota** — appeared resolved as of 2026-07-24 (a successful generation
   was observed), not exhaustively re-verified.
6. **`gpt-image-1` deprecation (2026-10-23)** — the transparent-background step of
   AI try-on generation depends on it; re-test/repoint before that date (§3.18).

---

## 5. How the owner likes to work (preferences — follow these)

- **Language:** talk in **Hindi-English (Hinglish)**, casual and clear. Docs meant
  for staff (USER_MANUAL) are in Hinglish too.
- **"don't modify the code now / tell me what you understood first":** the owner
  often wants you to **explain your understanding + plan BEFORE editing**. When they
  say this, do NOT touch code — describe what you'll do and ask to confirm. Only
  start after they say "start" / "do" / "yes".
- **Push after each change:** the owner asks you to **commit + push** each finished
  change (to `master` now that `retailer-multistore` is merged in). Commit messages
  end with the `Co-Authored-By: Claude ...` trailer (see the git log for the exact
  format). **Careful with remotes:** `origin` = client repo (`ATjewellers01`) —
  push `master` there directly; `teamai` = team repo — push to its
  `feature/sales-analytics` branch (`git push teamai master:feature/sales-analytics`),
  NOT `teamai`'s own `master` — the owner has corrected this mix-up before.
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

Make one parent folder and clone all three repos as SIBLINGS inside it (so the
`../LuxeMatch` / `../AI-Features` relative paths keep working):

```bash
mkdir jewel-workspace && cd jewel-workspace
git clone https://github.com/teamai-botivate/B2B_Luxmatch.git "LuxeMatch"        # reference only
git clone https://github.com/teamai-botivate/Jewel-Factory_AI.git "AI-Features"  # AI service
git clone https://github.com/teamai-botivate/Jewel-Factory.git "Jewel Factory"   # main app

cd "Jewel Factory"
# master is now the active branch (retailer-multistore was merged in — see §3.17/3.18)
pnpm install                         # deps + prisma generate
cp .env.example .env                 # then fill it — see docs/HANDOVER.md (rotate leaked secrets)
pnpm db:deploy && pnpm db:seed       # schema + 1 manufacturer (+ demo retailer if SEED_DEMO_STORE=true)
pnpm dev                             # http://localhost:3000
```

Then, as an agent: **read `../CLAUDE.md`, this file, and `flow.md`** — that's the full
context. Demo logins after seed: Manufacturer `admin@atjewellers.com /
<SEED_MANUFACTURER_PASSWORD>`; Retailer `store@demo.com / store123`; Store Manager is created by
the Retailer (no default).

---

## 7. Map of the docs

- [`../CLAUDE.md`](../CLAUDE.md) — technical guidance, architecture, gotchas (auto-loaded).
- [`flow.md`](flow.md) — complete system flow (start here for "how it works").
- [`USER_MANUAL.md`](USER_MANUAL.md) — non-technical staff guide + demo credentials.
- [`HANDOVER.md`](HANDOVER.md) — fresh client setup, zero to live.
- [`DATABASE.md`](DATABASE.md) — schema reference.
- [`SETUP_GUIDE.md`](SETUP_GUIDE.md) — detailed dev setup.
- [`DEPLOY_RENDER.md`](DEPLOY_RENDER.md) — Render deploy. [`AWS_MIGRATION.md`](AWS_MIGRATION.md) — the AWS production deploy (done, not just a plan — RDS/pgvector/S3/EC2).
- [`PENDING.md`](PENDING.md) — live remaining-work checklist.
- **This file** — history, decisions, owner preferences.
