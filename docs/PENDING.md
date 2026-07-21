# Jewel Factory — Pending Work

Kya-kya baaki hai. Code sab `retailer-multistore` branch pe hai; `master` purane
(pre-hierarchy) state pe. Handover se pehle ye complete karo. Tick karte jao.

Related docs: `HANDOVER.md` (client setup) · `DATABASE.md` (schema) ·
`flow.md` (flow) · `SETUP_GUIDE.md` (dev setup) · `../CLAUDE.md` (technical).

---

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
- [x] `GET <URL>/health` → `{"ok":true,"service":"ai-features","openai":true}` verified
- [ ] **BLOCKER: OpenAI quota** — `/describe`, `/catalog`, `/transparent` return `429 insufficient_quota` (HF wraps it as 502). **Add OpenAI billing/credit** (platform.openai.com/account/billing) OR set a funded key in Space → Variables → `OPENAI_API_KEY` + restart Space. Nothing to change in the app.
- [ ] After credit: regenerate a necklace/bangle transparent PNG to confirm the new front-only prompt (open U/V, no back chain).
- Note: `AI_FEATURES_API_KEY` NOT set on the Space → keep it unset on Render too (empty = OK, no x-api-key sent).

## 2. Render env update (done — verify only)
- [x] `AI_FEATURES_URL` set (the AI "Generate with AI" panel shows → env is present). **Must be lowercase host** (capital → 307 body-drop → 502).
- [ ] `EMBEDDER_URL` = same AI-Features URL (embedder merged; `/embed/image` same) — verify set.
- [ ] Purana embedder Space (botivate2026-embedder) retire/pause — optional

## 3. Branch → master merge (handover se pehle)
- [ ] `retailer-multistore` ko `master` me merge karo (pura multi-store + storefront + chat + AI is branch pe hai)
- [ ] Merge ke baad Render ko `master` se deploy

## 4. Live DB (Supabase yiewljdpfbnsbufjepsq)
- [x] `branch_hierarchy` migration applied
- [x] `order_messages` migration applied
- [x] `migrate:branches` run (default "Main Store" branches banaye)
- [ ] (fresh client DB pe: `pnpm db:deploy` + `pnpm db:seed` — HANDOVER.md)

## 5. Secrets rotate (URGENT — live secrets chat me expose ho gaye 18-Jul; handover se pehle bhi)
- [ ] Supabase DB password
- [ ] Cloudinary API secret
- [ ] Qdrant API key
- [ ] Gmail app password (SMTP)
- [ ] 4 auth secrets (MANUFACTURER/STORE/MANAGER/BRANCH_MANAGER — `node -e "..."`)
- [ ] OpenAI key (AI-Features)
- [ ] Confirm purane secrets kahin (git history / chat) me na rahein

## 6. Live end-to-end test
- [ ] Manufacturer → catalog add (manual)
- [ ] Manufacturer → "Generate with AI" (raw photo → name/desc + catalog + transparent, regenerate) — needs AI-Features deployed
- [ ] Retailer → /store/branches → branch + store manager banao (+ restock PIN)
- [ ] Store Manager → /store-manager → kiosk / try-on / search / custom / restock
- [ ] Store Manager → My Orders → status + Mark Completed + Message Head Office
- [ ] Retailer (Head Office) → Pending Approvals → branch + editable note + approve + Message
- [ ] Manufacturer → order dikhe (retailer + branch + note, no customer PII)
- [ ] Photo (visual) search — needs embedder/AI-Features + Qdrant

## 7. Optional / future
- [ ] Product_Recommendation (AI design ranking, folder ../Product_Recommendation) → AI-Features me merge (naya endpoint) — tumhari "sab AI ek service" vision
- [ ] Order-confirmation email/SMS (kiosk) — abhi sirf reset + store-approval emails
- [ ] pin/rate-limit + integration tests (approval + chat flows)

---

## Known / by-design (bug nahi)
- "Generate with AI" button **live pe tabhi dikhega** jab `AI_FEATURES_URL` Render pe set ho (safe default).
- Mobile visual search intentionally uses the rear camera for **Take photo** and the normal image picker for **Choose photo**.
- Migrations Supabase pooler pe `migrate dev` se atakte hain → `pnpm db:deploy` use karo (idempotent, safe).
- AI-Features first `/embed` call cold Space pe ~30-90s (CLIP lazy-load).
