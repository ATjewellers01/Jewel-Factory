# Jewel Factory — Pending Work

**Updated 2026-07-24.** `retailer-multistore` is now merged into `master` — code is
on `master`. Production is live on **AWS EC2** (RDS + pgvector + S3/CloudFront +
Docker), see `AWS_MIGRATION.md`; whether Render is still serving traffic alongside
it is unconfirmed. Tick karte jao.

Related docs: `HANDOVER.md` (client setup) · `DATABASE.md` (schema) ·
`flow.md` (flow) · `SETUP_GUIDE.md` (dev setup) · `AWS_MIGRATION.md` (prod infra) ·
`../CLAUDE.md` (technical).

---

## -1. This session's fixes (2026-07-24)
- [x] **Manufacturer Intelligence 500s fixed** — BigInt-from-`SUM()` not being converted to `Number` before `JSON.stringify` in `lib/db/analytics-queries.ts` (3 functions). Pushed to `origin/master` + `teamai/feature/sales-analytics`.
- [ ] **AWS EC2 container needs rebuild + redeploy** to pick up the above fix — pushing to git does NOT update the running Docker container by itself. Exact rebuild command not identified this session — ask Abhay or find the deploy script/CI config.
- [x] **Retailer sidebar "Analytics" link hidden** (page kept, not deleted — it's reachable directly at `/store/analytics`).
- [ ] **Rotate the RDS database password** — printed in plaintext during this session's SSH debugging (redaction pattern missed `DATABASE_URL=`).
- [ ] **Confirm actual EC2 redeploy process** and document it in `AWS_MIGRATION.md`.
- [ ] **Confirm whether Render is still live** alongside AWS EC2, or should be retired.

## 0. Recently completed (done — no action)
- [x] **HO Manager role removed** — 4 roles now: Manufacturer · Retailer (= Head Office) · Store Manager (`branch_managers`, `/store-manager/login`) · Customer (walk-in). Old `/store/manager/login` route + `store_managers` table are gone/legacy-inert.
- [x] **Public landing rebuilt** — branded Jewel Factory site: navbar (logo, Catalog, About, Login, Register), featured real-catalog showcase (public `GET /api/kiosk/catalog`, no price), 2-column Login popup (Retailer | Store Manager), auto register-prompt (~5s, once/session), `/about` page, `/manufacturer` as hidden admin entry. `/portal` now just redirects to `/`.
- [x] **Order-list filters** — every order list (Retailer, Manufacturer, Store Manager) has client-side filters: order-ID search + status + From/To date. Retailer lists also filter by Store (branch); Manufacturer lists by Retailer.
- [x] **Similar-design (visual/photo) search** — Store Manager → Search, powered by AI-Features `/embed`.
- [x] **Mobile image source choice** — Store Manager and storefront search provide separate **Take photo** and **Choose photo** actions.
- [x] **Responsive / mobile-friendly** across the app.
- [x] **Shared portal-entry UI** — responsive `PortalLoginScreen` now covers Retailer, Store Manager, and Manufacturer sign-in plus Retailer registration; sign-in stays centred and the long registration form scrolls inside its panel.
- [x] **Docs reorganised** into `docs/` folder (`SYSTEM_FLOW.txt` → `flow.md`, stale `USER_FLOWS_AND_GUIDE.txt` deleted).

## 1. AI-Features service deploy  (repo: github.com/teamai-botivate/Jewel-Factory_AI; local `../AI-Features`)
- [x] HuggingFace **Docker Space** deployed → `Botivate2026/ai-workspace` (URL `https://botivate2026-ai-workspace.hf.space`)
- [x] `GET <URL>/health` → `{"ok":true,"service":"ai-features","openai":true}` verified (re-verified 2026-07-24)
- [x] **OpenAI quota** — appears resolved (a successful "Generate All" run was observed this session); not exhaustively re-tested end-to-end. If `429 insufficient_quota` reappears: add OpenAI billing/credit or fund `OPENAI_API_KEY` on the Space + restart.
- [ ] Regenerate a necklace/bangle transparent PNG to confirm the front-only prompt (open U/V, no back chain) on current assets.
- [ ] **NEW (this session):** `gpt-image-1` (used for the transparent-background step) retires **2026-10-23** — re-test/repoint `TRANSPARENT_BG_MODEL` before then, see `../AI-Features/CLAUDE.md`.
- Note: `AI_FEATURES_API_KEY` NOT set on the Space → keep it unset on Render/EC2 too (empty = OK, no x-api-key sent).

## 2. Render env update (done — verify only; may not be the active deploy anymore, see §3)
- [x] `AI_FEATURES_URL` set (the AI "Generate with AI" panel shows → env is present). **Must be lowercase host** (capital → 307 body-drop → 502).
- [ ] `EMBEDDER_URL` = same AI-Features URL (embedder merged; `/embed/image` same) — verify set.
- [ ] Purana embedder Space (botivate2026-embedder) retire/pause — optional

## 3. Branch → master merge — DONE
- [x] `retailer-multistore` merged into `master` (confirmed via `git status` — `master` is now the active/current branch).
- [ ] **Confirm which deploy target is authoritative:** AWS EC2 is confirmed live in production (see `AWS_MIGRATION.md`); whether Render is still serving traffic in parallel, or was retired when AWS went live, is **unconfirmed** — check before assuming either.
- [ ] **AWS EC2 redeploy process undocumented** — the running container is pinned to a specific commit's Docker image; a code fix merged to `master` does NOT reach production until the image is rebuilt and the container restarted. Find/document the actual rebuild command.

## 4. Live DB — now AWS RDS in production (was Supabase)
- [x] All 8 migrations applied on RDS (`branch_hierarchy`, `order_messages`, `add_analytics_indexes`, `custom_design_weight_range`, `pgvector`, + the original 3) — confirmed via container boot log ("No pending migrations to apply").
- [x] `migrate:branches` run (default "Main Store" branches banaye) — historical, pre-AWS-migration.
- [x] Cloudinary → S3 and Qdrant → pgvector data migrations run (`scripts/migrate_cloudinary_to_s3.ts`, `scripts/migrate_qdrant_to_pgvector.ts`).
- [ ] Supabase (dev) DB — separate from production RDS now; still used for local dev per `.env`. (fresh client DB pe: `pnpm db:deploy` + `pnpm db:seed` — HANDOVER.md)

## 5. Secrets rotate (URGENT — some live secrets have been exposed in chat/session output more than once)
- [ ] **AWS RDS database password** — printed in plaintext during SSH debugging this session (2026-07-24, a `sed` redaction pattern missed the `DATABASE_URL=` line).
- [ ] Supabase DB password (dev; exposed 18-Jul per earlier note)
- [ ] ~~Cloudinary API secret~~ / ~~Qdrant API key~~ — moot, both services retired in production (AWS migration); rotate only if still used anywhere (e.g. a dev fallback).
- [ ] Gmail app password (SMTP)
- [ ] 4 auth secrets (MANUFACTURER/STORE/MANAGER/BRANCH_MANAGER — `node -e "..."`)
- [ ] OpenAI key (AI-Features)
- [ ] Confirm purane secrets kahin (git history / chat) me na rahein

## 6. Live end-to-end test (test against whichever deploy is authoritative — see §3)
- [ ] Manufacturer → catalog add (manual)
- [ ] Manufacturer → "Generate with AI" (raw photo → name/desc + catalog + transparent, regenerate) — needs AI-Features deployed
- [x] Manufacturer → Intelligence page (top-products/retailers/category-weight) — was 500ing (BigInt bug), fixed this session; **verify on production after redeploy**.
- [ ] Retailer → /store/branches → branch + store manager banao (+ restock PIN)
- [ ] Store Manager → /store-manager → kiosk / try-on / search / custom / restock
- [ ] Store Manager → My Orders → status + Mark Completed + Message Head Office
- [ ] Retailer (Head Office) → Pending Approvals → branch + editable note + approve + Message
- [ ] Manufacturer → order dikhe (retailer + branch + note, no customer PII)
- [ ] Photo (visual) search — needs embedder/AI-Features + pgvector (RDS)

## 7. Photo Search Web Enhancement — DETAILED SPEC (deferred, approved 2026-07-24)

**Status:** Approved scope + recommendations. Waiting for owner sign-off on API choice + budget. Test script provided (Python/Colab).

**Problem:** Store Manager kiosk only searches own catalog via pgvector. If no good match, customer leaves. **Solution:** Also search web for similar images, expand options seamlessly.

**UX Design:**
- **Customer:** Sees blended results (catalog + web mixed), no distinction, feels like store's own collection
- **Store Manager:** Sees badges (🏠 Catalog | 🌐 Web) so they know which is which while helping customer
- **Retailer/Manufacturer:** In order details, sees source badge ("Reference image from web search")

**Technical Flow:**
1. Customer uploads photo → Store Manager kiosk
2. Backend parallel calls:
   - AI-Features `/embed/image` → 512-d vector embedding
   - pgvector search RDS → catalog results
   - Azure Bing Visual Search API → web results (non-blocking, 5s timeout)
3. Results merged + blended for customer (seamless view)
4. Store Manager sees badges (hidden from customer)
5. If customer picks web image → existing Custom Design Request flow (no changes)
6. Web image downloaded + uploaded to S3 (stable URL, no expiry/hotlink issues)
7. Custom Design goes: Store Manager → Retailer approval → Manufacturer (same pipeline)

**API Choice: Azure Bing Visual Search** ✅
- Real reverse-image-search (not wrapper)
- Best for jewelry/fashion
- Cost: ~₹500-600/month (100 searches/day × 30 days × $0.25/search)
- Free tier: 100 calls/month
- Reliable, Azure ecosystem, clear pricing
- Alternative: SerpApi (cheaper but third-party wrapper), TinEye (specialist but less jewelry-focused)

**Safety & Reliability:**
- ✅ Non-blocking: If web-search fails → catalog still works
- ✅ Timeouts: Web-search max 5 seconds
- ✅ Image validation: File size (<5MB), format (jpg/png), magic bytes
- ✅ URL validation: Whitelist domains, no suspicious/internal URLs
- ✅ S3 upload: Images downloaded + re-uploaded to our S3 (immutable, CDN-cached, no hotlink issues)
- ✅ Rate limiting: Max 100 searches/day per store, circuit breaker (3 failures → 5-min cooldown)
- ✅ Cost monitoring: Logged every call, set budget alerts, disable if over-quota
- ✅ Feature flag: `ENABLE_WEB_SEARCH=true/false` to toggle instantly
- ✅ Error logging: Every failure logged (web-search timeout, image validation fail, S3 upload fail)

**Implementation Details:**
- **New endpoint:** `POST /api/branch-manager/search` (lib/api/routes/branch-manager.ts)
- **Helper functions:** embedImage(), searchWebImages(), downloadAndUploadToS3(), validateImage()
- **Frontend:** `/store-manager/search` page shows blended results with Store Manager badges
- **Custom design:** If web image selected → use s3Url (not external URL) in custom design request

**Rollout Plan:**
1. Week 1: Code locally + test (use Colab script below to validate Azure Bing API)
2. Week 2: Feature flag OFF on staging, full regression test
3. Week 3: Feature flag ON for 1 pilot store (10% traffic), monitor costs/errors
4. Week 4: 100% rollout if stable + within budget

**Decisions Made (approved 2026-07-24):**
- ✅ Use Azure Bing Visual Search API
- ✅ Download web images → re-upload to S3 (safety over simplicity)
- ✅ Blend results (no separate sections) for customer
- ✅ Show badges only to Store Manager (internal knowledge)

**Testing:**
- Unit test: Image validation (size, format, magic bytes)
- Integration test: Azure Bing API call + response parsing
- E2E test: Customer uploads → sees blended results → picks web image → custom design created → Retailer approves
- Use Python Colab script below to validate API before full implementation

---

## 7b. Optional / future
- [ ] Product_Recommendation (AI design ranking, folder ../Product_Recommendation) → AI-Features me merge (naya endpoint) — tumhari "sab AI ek service" vision
- [ ] Order-confirmation email/SMS (kiosk) — abhi sirf reset + store-approval emails
- [ ] pin/rate-limit + integration tests (approval + chat flows)

---

## Known / by-design (bug nahi)
- "Generate with AI" button **live pe tabhi dikhega** jab `AI_FEATURES_URL` Render pe set ho (safe default).
- Mobile visual search intentionally uses the rear camera for **Take photo** and the normal image picker for **Choose photo**.
- Migrations Supabase pooler pe `migrate dev` se atakte hain → `pnpm db:deploy` use karo (idempotent, safe).
- AI-Features first `/embed` call cold Space pe ~30-90s (CLIP lazy-load).
