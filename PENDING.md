# Jewel Factory — Pending Work

Kya-kya baaki hai. Code sab `retailer-multistore` branch pe hai; `master` purane
(pre-hierarchy) state pe. Handover se pehle ye complete karo. Tick karte jao.

Related docs: `HANDOVER.md` (client setup) · `DATABASE.md` (schema) ·
`SYSTEM_FLOW.txt` (flow) · `SETUP_GUIDE.md` (dev setup) · `CLAUDE.md` (technical).

---

## 1. AI-Features service deploy  (repo: github.com/teamai-botivate/Jewel-Factory_AI)
- [ ] HuggingFace **Docker Space** banao, `Jewel-Factory_AI` repo se deploy
- [ ] Space → Variables: `OPENAI_API_KEY` (zaroori), `EMBEDDER_API_KEY` (agar Bearer chahiye), `AI_FEATURES_API_KEY` (agar x-api-key chahiye)
- [ ] URL note karo + `GET <URL>/health` → `{"ok":true,"openai":true}` verify

## 2. Render env update (AI-Features deploy ke baad)
- [ ] `EMBEDDER_URL` = AI-Features Space URL (embedder ab isme merged; /embed/image same)
- [ ] `AI_FEATURES_URL` = same URL (add)
- [ ] `AI_FEATURES_API_KEY` + `EMBEDDER_API_KEY` = jo Space pe set kiye
- [ ] Save → redeploy
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
- [ ] Store Manager → My Orders → status + Mark Completed + Message HO
- [ ] HO Manager → Pending Approvals → branch + editable note + approve + Message
- [ ] Manufacturer → order dikhe (retailer + branch + note, no customer PII)
- [ ] Photo (visual) search — needs embedder/AI-Features + Qdrant

## 7. Optional / future
- [ ] Product_Recommendation (AI design ranking, folder ../Product_Recommendation) → AI-Features me merge (naya endpoint) — tumhari "sab AI ek service" vision
- [ ] Order-confirmation email/SMS (kiosk) — abhi sirf reset + store-approval emails
- [ ] pin/rate-limit + integration tests (approval + chat flows)

---

## Known / by-design (bug nahi)
- "Generate with AI" button **live pe tabhi dikhega** jab `AI_FEATURES_URL` Render pe set ho (safe default).
- Migrations Supabase pooler pe `migrate dev` se atakte hain → `pnpm db:deploy` use karo (idempotent, safe).
- AI-Features first `/embed` call cold Space pe ~30-90s (CLIP lazy-load).
