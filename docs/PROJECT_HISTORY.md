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

> **Display-text update (2026-07-30, see §3.21):** everywhere a human actually reads
> this in the app, "Retailer" now shows as **"Purchase manager"** — this is a
> display-text-only rename, same as the HO-Manager-to-Head-Office rename above it.
> Code, routes, DB tables/columns, and this doc's own narrative below still say
> "Retailer" throughout, and that's intentional — don't go find/replace it.

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

### 3.20 Cart persistence + photo-search UX fixes (2026-07-26)
Two user-facing bugs discovered and fixed:

1. **Cart disappears on page refresh** — Both guest cart (`use-guest-cart.ts`) and
   B2B cart (`use-b2b-cart.ts`) used `sessionStorage`, which browsers automatically
   clear on refresh. **Fix:** Changed to `localStorage`, which persists across sessions.
   Affects all cart flows: Retailer catalog → kiosk, Store Manager kiosk/restock,
   B2B orders.

2. **Photo search result click → catalog navigation (UX break)** — When Store Manager
   clicked a similar image from photo search (`/store-manager/search`), detail modal
   opened but the primary action was "Order from Catalog" (a hard `<Link>` to
   `/store-manager/kiosk`), causing navigation away and loss of search context.
   **Fix:** Imported `useGuestCart` hook into search page, changed primary action
   to directly add product to cart + close modal. User now stays on search page,
   can accumulate multiple similar images in one cart, then proceed to checkout.
   Same UX as kiosk "Add to Order" flow.

### 3.21 The 2026-07-30 client punch list (11 items) — design name removed, Favorites, badges, registration overhaul, cascade-delete fix, display renames
The client sent an 11-item punch list in one go. All 11 were built, committed, and pushed in this session (though NOT yet deployed to AWS as of that write-up — 4 new migrations were pending a container rebuild):

1. **Design name removed entirely.** The client's real reason: the **design number is the only identifier that matters** on the floor — nobody was using the free-text name field, and it added clutter. `ManufacturerProduct.name` became nullable and unused by new products; every catalog/kiosk/order display across all 3 portals (19 files in one pass) switched from `product.name` to `product.designNumber`. The AI "Generate all" flow dropped its name-generation step (now just Description → Catalog image → Try-on PNG). Order-item snapshots fall back to `designNumber` when `name` is empty, so old rows with a name still show fine.
2. **Karigar Code + Pieces** added to Add/Edit Design. `karigarCode` is manufacturer-internal only — which artisan makes the piece — and I made a point of **structurally** omitting it from every retailer/store-manager/customer-facing query (`omit: { karigarCode: true }` in Prisma, not just hiding it in the UI), since this is exactly the kind of field that leaks by accident if you only hide it client-side. `pieces` (default 1) records how many physical pieces make up the entered weight — a bangle pair being the obvious example.
3. **Manual "Generate Try-On" button**, independent of "Generate all" — plus a per-catalog-image quick-generate in edit mode that reuses the already-uploaded S3 image as the AI's input instead of asking the manufacturer to re-upload.
4. **Retailer gets a product detail modal** on `/store/manufacturer-catalog` — previously just static cards with no click-through. Reused the existing `StoreManagerProductDetailModal` rather than building a second one.
5. **Similar-search pagination** — top 5 + "Show more" (+5/click), both `/store-manager/search` and `/store/similar-search`. Backend pool unchanged.
6. **Retailer similar-search gets Add-to-Cart** — it previously had a no-op primary action; now behaves like the Store Manager's version.
7. **Favorites**, server-backed, scoped by `(storeId, branchId)` — a new `FavoriteProduct` model. The subtlety worth remembering: a Store Manager's `storeId` tenancy value equals the retailer's id, so `branchId` is the only thing that keeps the Purchase Manager's own favorites and a Store Manager's favorites from silently merging into one list.
8. **Cart-time remarks** — turned out this already existed via `requirementNote`; no code change needed, just confirmed.
9. **Retailer badges** — manufacturer defines their own custom labels (e.g. "Gold Customer") and assigns one per retailer from the `/manufacturer/stores` edit modal. Deleting a label unassigns it everywhere it was used.
10. **Registration overhaul** — 3 steps collapsed to 2 (Business, Address), the manager-account step removed entirely (there's no HO Manager to create an account for anymore), field renames at the label level only (`ownerName`/`ownerPhone` columns untouched), PIN-code-first address entry, and — the biggest behavioural change — **no manual password at registration**: the retailer's mobile number becomes their password once the manufacturer approves them.
11. **Cascade-delete fix** — this was a real bug, not a nice-to-have: deleting a retailer threw an FK-violation the moment that retailer had ANY order history, so it had only ever "worked" in testing against brand-new zero-order retailers. Fixed by switching `b2b_orders`/`kiosk_orders`/`custom_design_orders`' FK to stores from `ON DELETE RESTRICT` to `CASCADE`.

Also in the same session: the **"B2B order" → "Catalog order", "Custom (design) order" → "Customised order", "Retailer" → "Purchase manager"** display-text rename across all 3 portals + landing + email templates — same precedent as the earlier HO-Manager-to-Head-Office rename: routes, DB/Prisma identifiers, and enum values (`OrderKind.B2B`, `MessageSender.HO`) are all untouched, only what a human reads changed. And the raw AI photo upload limit went 3MB → 15MB. A same-day audit fix added try/catch + error banners to the retailer delete/active-toggle and badge add/remove buttons in `app/manufacturer/stores/page.tsx`, which had been failing silently.

**Later the same day (2026-07-30 continued):** three more things came out of testing this batch live:
- **Retailer's own direct catalog order needed its own approval** — a real bug: `placeB2bOrder()` defaulted `pendingManagerApproval` to `true` unconditionally, so an order the retailer placed themselves landed in their own Pending Approvals list waiting on a sign-off with no one above them to grant it. Fixed with an optional param the retailer's own route now passes as `false` (pre-approved). Store-Manager-originated orders are untouched and still correctly need the retailer's approval.
- **Kiosk vs Restock favorites were incorrectly sharing one list** — both wrote to the same `(storeId, branchId)` scope, so a Store Manager's Kiosk and Restock pages showed the same favorites count. Added a `FavoriteKind` enum (`KIOSK`/`RESTOCK`) to split them.
- **Order line items became clickable** on every order list with a linked catalog product, opening a karigarCode-free detail popup. Deliberately NOT added to the retailer's custom-designs page — custom requests carry a reference image, not a linked product, so there's nothing to open there.

### 3.22 Email-optional purchase manager registration + auth responsiveness (2026-07-31)
The client's real-world observation: a lot of older/smaller retailers don't use email at all, so requiring it at registration was locking people out. `Store.email` became nullable, and **the login username became "email if present, else mobile number"** — the password stays the mobile number either way. Mobile uniqueness is enforced at the app level (not a DB constraint), and only when no email is given, since that's the only case where the mobile *is* the username. Email can be added later from `/store/profile` if a collision doesn't already exist.

The registration form itself dropped from 2 steps to 1 (email, street address, and landmark are all optional now), and `PortalLoginScreen` — which the retailer, store manager, and manufacturer logins all share — got a real mobile-responsiveness fix: it used to be `h-dvh` + `overflow-hidden`, which just clipped the form on a short viewport instead of scrolling.

Also this session: the product-detail popup's "similar designs" went from a row of small thumbnails you had to click through to full scrollable blocks (each with its own "Add to order"), an items-per-row control on the Store Manager's kiosk/restock catalog (persisted in `localStorage`), a responsive fix to the landing-page product popup, and a full rework of the Retailer Admin's top header — the mobile burger + drawer are gone; Catalog and Similar Search sit next to the logo at every width now, and Dashboard moved to the far right. Also swapped the nav's diamond icon (`Gem` from lucide) for a custom jewellery-storefront SVG — this business is gold-only, no diamond imagery anywhere, and that lucide icon had been quietly violating that rule.

**Known gap left from this session:** forgot-password is still email-only, so a retailer registered with mobile-only can't self-serve a password reset until they add an email to their profile.

### 3.23 Cart UX, "Catalogue" rename, customised-order spec fields (2026-08-01)
Product popups no longer close when you add to cart — across every page that opens one — because similar designs are listed below the opened product, and closing on add defeated the point of showing them. A new shared `CartQtyControl` (gold "Add" button at qty 0, a `− n +` stepper above it) replaced a dead "In cart" badge that had no way back out of the cart.

**"Catalog" became "Catalogue"** in all display text (23 files) — routes, API paths, component names, and DB identifiers stayed exactly as they were; this is purely cosmetic, matching every other rename this project has done.

The bigger structural change: **customised-order spec fields** — sub-category, order ref, delivery date, quantity, meena, length, size, broadness, screw, sample weight — added to both the request and order tables, all nullable. Worth remembering: `orderRef` is the *shop's own* order number, not the system's `JFC-####` (that numbering didn't exist yet at this point — it landed a few days later, see §3.25). The `MEENA_OPTIONS`/`SCREW_OPTIONS` constants in the custom-design form are **guessed shop vocabulary**, not something the client confirmed — flagged in the code as needing real-world confirmation.

Bangle sizing got its own optional field, form-gated to only show for the Bangles category (switching away sends `size: null` so a stale value can't linger on a non-bangle design). And "Draft" status became displayed as "Inactive" (again, display-text only — the `ProductStatus.DRAFT` enum is unchanged), alongside a new catalogue status filter with bulk-activate for the manufacturer's catalog page.

### 3.24 Customised-order UX + navbar cleanup (2026-08-03, early)
Bangle sub-categories got reordered per client confirmation (new "Ultra Light Bangles" and "Nakshi Bangles" added). The retailer gained the ability to **place a Customised Order directly** (auto-forwards immediately, same self-approval-bypass precedent as the B2B fix in §3.21), and those requests started showing on Pending Approvals alongside kiosk/catalog orders. "Product Catalogue" was removed from the retailer's top navbar (still reachable via Dashboard). The custom-design form's previously-optional counter-spec fields became required, with narrower option sets (Meena: Yes/No; Screw: English/Pongli) and quantity switched from a number to free text ("2 pcs" — the client's actual usage didn't fit an integer).

### 3.25 Order-status rework, per-item status, JFA-/JFC- order numbering (2026-08-03/04)
This was the session that replaced the whole order-status vocabulary. The old `PENDING/CONFIRMED/PACKED/SHIPPED/DELIVERED/CANCELLED` didn't match how the client's own floor actually talks about a job — they gave a reference screenshot with their real stages: `PENDING/IN_PROCESS/GHAT_RECEIVED/READY_FOR_DELIVERY/DISPATCHED/COMPLETED/CANCELLED`. Historical rows were remapped automatically by the migration itself (`CONFIRMED→IN_PROCESS`, `PACKED→GHAT_RECEIVED`, `SHIPPED→DISPATCHED`, `DELIVERED→COMPLETED`) via a Postgres enum recreate + `USING CASE` cast, since Postgres won't let you drop an enum value in place. Every place that used to key off `'DELIVERED'` — the B2B "materialize into store inventory" trigger, six analytics queries — now keys off `'COMPLETED'`.

Each **line item** within an order also got its own independent status (`kiosk_order_items`/`b2b_order_items` gained a `status` column), since in practice different products on the same order finish at different times. Custom design orders were deliberately excluded from this — they're generally a single design per order, so item-level granularity doesn't add anything.

The other big piece: **JFA-#### / JFC-#### order numbering**, replacing the old `GK-YYYYMMDD-XXXX`/`B2B-YYYYMMDD-XXXX`/`CD-YYYYMMDD-XXXX` formats. Kiosk and Catalog/B2B orders share one counter (`JFA-####`) since they were already merged into one list everywhere; Customised orders get their own (`JFC-####`). The counter is **per manufacturer**, shared across every retailer that manufacturer serves, and increments via an atomic `UPDATE ... RETURNING` rather than a transaction — deliberately, so concurrent order placements from different retailers never collide on the same number. Old orders keep their old `orderNumber` untouched; there was no backfill.

Also: Sales Code + Sales Person Name became required fields at the Store Manager's kiosk checkout (later removed entirely — see §3.28), and "Requirement note" became displayed as "Remark" everywhere (again, display-only).

### 3.26 Customised-order merge/privacy/badges, registration + login polish (2026-08-05)
Several threads converged in one session. The **Customised Design feature was removed from the Store Manager portal entirely** — the client's reasoning was that the manufacturer's granular per-item production status is Head-Office-only information; the Store Manager should just see a simple Pending/Approved/Completed badge, nothing more granular.

The retailer's **Order History page** (renamed from "Catalogue Orders" to "Order History", then unified further) went through two passes in one day: first it merged Restock/Kiosk/Customised orders into one list with type/status/date filters and a "Placed by" dropdown; then, on the *same day*, the client came back and said that was too much filtering for what they actually wanted — a simpler list. The filters got removed again, replaced with just a visible Order Date column and clearer headers, plus source-kind badges ("Restock"/"Store Customer"/"Customised" — note "Kiosk" is deliberately labelled "Store Customer" per the client's own wording, not a translation slip).

**Manufacturer order-view privacy went back and forth within the same session** — worth remembering as a cautionary tale about not committing to a privacy decision without checking with the client first. The first pass stripped the retailer's business name, city, AND branch name from every manufacturer order view, on the theory that "customer PII never reaches the manufacturer" should extend to retailer identity too. The client immediately pushed back: they need the business name to know **who placed each order** — that's basic order-management, not a privacy concern. So the business name join/select was restored everywhere, while city and branch name stayed stripped. The rule that survived: manufacturer sees the retailer's business name + requirement note + HO ship-to address + product/spec detail, but never city or branch.

Several rounds of bangle-rendering prompt fixes went into the AI-Features repo this session too, all diagnosed from client screenshots: a bangle rendering as a flat 2D ribbon, then as an open "C"-shape with a gap, then with what looked like a fake clasp (which turned out, on closer inspection, to actually be a display prop/stand passing *through* the bangle's own opening rather than invented hardware — worth remembering as an example of "the AI didn't hallucinate a defect, the prompt just didn't constrain where props could touch the piece").

Also this session: registration-form polish (support number visible, logo upload moved to the last field), unified mobile-number login labeling across both portals, past-dates disabled on the custom-order delivery-date picker, responsive nav labels (so icon-only buttons always show at least an abbreviated label — new users genuinely couldn't tell what bare icons meant), and weight relabeled "g" → "gm" everywhere via the shared `formatWeight()` helper.

**Also parked this session:** `docs/WHATSAPP_SETUP.md`, a complete Meta WhatsApp Cloud API setup guide — but this is **prep documentation only**. The actual send integration (forgot-password via WhatsApp, approval notifications via WhatsApp) is not built; it's waiting on the client completing Meta's own setup and handing over credentials.

### 3.27 Similar-search AI-cleanup, cart recommendations, Karigar-assignment + dual-PDF generation (2026-08-07 through 2026-08-11)
This stretch of sessions is the largest single feature built in the project's history — a full Karigar (artisan) assignment workflow with dual PDF generation — plus two unrelated but significant fixes that happened alongside it.

**Similar-design search accuracy.** The client's complaint was concrete: uploading a raw photo (cluttered background, hand-held) almost never matched its own catalogue studio shot of the same product, because the background was dominating the OpenCLIP embedding more than the jewellery itself. The fix pre-processes the query photo through AI-Features before embedding: a new `/classify` endpoint guesses the category from the image alone (this search page has no category picker), then the same background-cleanup pipeline the manufacturer's Add Design already uses runs on it, and only the *cleaned* image gets embedded — never the raw one, and the cleaned image itself is never saved or returned anywhere. Deliberately **category-only**, never sub-category — because an AI-guessed sub-category on this path won't always match a human's manually-chosen one on Add Design, and the two would get visibly different cleanups that drift the embeddings apart rather than together. As a stopgap while this was being validated, the similarity floor was also lowered (0.65 → 0.35) — real query photos just embed further from their own catalogue shot than two catalogue photos embed from each other.

**Cart recommendations.** The retailer's catalogue page gained "You may also like" and "More from {category}" sections that replace the normal grid while the cart is open, powered by a simple priority-ranking helper (category weight 6, purity weight 3 — deliberately simplified, no sub-category or weight-closeness scoring, per client request). A keyword-search input was added alongside the existing exact-design-number search.

**Karigar-assignment + dual-PDF — built in one continuous push across several sessions, each one driven by the client walking through the actual screen and catching real gaps:**
- The **first pass** (Phases 1–4, built in one go per the client's explicit instruction to build everything and typecheck once at the end) added a manufacturer-scoped `Karigar` master-list, checkbox multi-select over unassigned order items, an "Assign Karigar" action that creates a `JFC-####` Customised Order and flips those items to `IN_PROCESS`, an assignment form with auto-filled + manually-filled fields, and client-side PDF generation — two separate PDFs (Customer PDF, showing full store identity; Karigar PDF, omitting store identity but including all internal notes since production notes aren't PII).
- The client then walked through the live screen and asked for a **different layout** (2026-08-10): the dashed "ASSIGN KARIGAR" box was replaced with a dropdown on the same row as "Ship to", checkboxes moved directly onto each item row, and assignment moved into a separate modal reused for both assigning and editing. The biggest structural change here: a retailer's own bespoke request no longer creates a `CustomDesignOrder` immediately — it lands as a PENDING row in the manufacturer's merged list first, and only becomes a real order once a Karigar is assigned to it.
- Then **three more rounds of real-screen feedback** in quick succession: the reference-form fields needed to be editable inputs, not read-only display (2026-08-11); the checked items' own detail (image, design number, spec) needed to actually appear in the modal and the PDF, not just be assigned invisibly; and then three concrete bugs surfaced from live use — clearing the Karigar Code field silently failed to save the clear (an `undefined`-vs-`null` bug, the same class of bug the `size` field had already been fixed for once before), the Karigar dropdown showed empty even when a product clearly had a code (the product-level free-text code and the separate master-list table were silently out of sync — fixed with a sync-on-read upsert), and there was no way to remove a selected code or pick one that wasn't already on the order.

The pattern worth internalizing from this whole stretch: **the client validates by using the actual deployed screen, not by reading a spec**, and each round of feedback was concrete and screen-specific. Expect this to keep happening on any UI-heavy feature — build it, ship it, and expect a follow-up round once it's actually clickable.

**Deliberately deferred, per explicit client instruction to keep it separate:** a system-wide retrofit of every form to use a consistent required-field-asterisk / "(Optional)" convention. This is still an open, un-started task (see PENDING.md).

**Not yet deployed as of the last of these sessions** — the `karigar_assignment_phase1` migration needs `prisma migrate deploy` + a container rebuild on EC2.

---

## 4. What's PENDING (see docs/PENDING.md for the live checklist — this section is a summary, PENDING.md is the source of truth)

1. ~~Merge `retailer-multistore` → `master`~~ — **DONE**, `master` is now the
   active branch (see §3.17/§3.18).
2. ~~AWS migration~~ — **DONE** (§3.17): RDS + pgvector + S3/CloudFront + EC2/Docker,
   all confirmed live. ~~Document the actual EC2 redeploy (rebuild+restart)
   command~~ — **DONE**, it's now in `../CLAUDE.md`'s "Production deployments"
   section (rebuild the Docker image at the new commit, restart the container).
   **Still open:** confirm whether Render is retired or still live in parallel —
   not confirmed as of the 2026-08-09 session either.
3. **Rotate secrets** — the **AWS RDS database password** was freshly exposed in
   plaintext during the 2026-07-24 debugging session (see §3.18) — no later
   session confirms this was rotated, so treat it as still outstanding.
   Also still outstanding from earlier: Supabase (dev) DB pwd, Gmail app pwd, the
   4 auth secrets (now 5, `BRANCH_MANAGER_SECRET` added). Cloudinary/Qdrant
   secrets are now moot (retired in prod).
4. **Live end-to-end test** — all flows, on whichever deploy target is
   authoritative (Render vs AWS EC2 — see #2). Multiple migrations landed since
   this item was first written (see the Migrations section of `../CLAUDE.md` —
   24 total now) and haven't all been confirmed applied on a live end-to-end pass.
5. **OpenAI quota** — appeared resolved as of 2026-07-24 (a successful generation
   was observed), not exhaustively re-verified.
6. **`gpt-image-1` deprecation (2026-10-23)** — the transparent-background step of
   AI try-on generation depends on it; re-test/repoint before that date (§3.18).
   Still not resolved as of the latest session — the date is getting close.
7. **AWS EC2 container rebuild + redeploy** — several sessions' worth of
   migrations (see `../CLAUDE.md` Migrations, up through `karigar_assignment_phase1`)
   have NOT been confirmed deployed to production as of the last session that
   mentions it (2026-08-09/11). Confirm current deployed commit on EC2 before
   assuming any post-2026-07-24 feature (Karigar assignment, JFA-/JFC- numbering,
   order-status rework, Catalogue rename, etc.) is actually live.
8. **WhatsApp send integration** — `docs/WHATSAPP_SETUP.md` is prep documentation
   only (Meta Cloud API setup guide). The actual send code (forgot-password link
   via WhatsApp, approval notification via WhatsApp) is NOT implemented; both
   flows remain fully email-based. Blocked on the client finishing Meta's own
   setup and handing over the access token / Phone Number ID / WABA ID / approved
   template names (§3.26).
9. **System-wide required/optional form convention retrofit** — a consistent
   red-asterisk-for-required / "(Optional)"-for-optional convention across every
   existing form, explicitly deferred out of the Karigar-assignment work per the
   client's own instruction to keep it as a separate follow-up task (§3.27). Not
   started.
10. **Karigar "Order Stage" and "Expected Delivery Date"** — deliberately left as
    a plain free-text field / not implemented at all respectively, because the
    client hadn't decided the real option list or the field's meaning as of the
    last Karigar session. Don't invent options for either — ask the client.

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
- [`WHATSAPP_SETUP.md`](WHATSAPP_SETUP.md) — Meta WhatsApp Cloud API setup guide (prep only — the send integration itself isn't built yet, see §3.26 and §4 item 8).
- [`PENDING.md`](PENDING.md) — live remaining-work checklist.
- **This file** — history, decisions, owner preferences.
