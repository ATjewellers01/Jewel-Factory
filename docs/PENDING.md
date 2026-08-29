# Jewel Factory — Pending Work

**Updated 2026-08-29.** `master` is the active branch. Production is live on **AWS EC2**
(RDS + pgvector + S3/CloudFront + Docker), see `AWS_MIGRATION.md`; the redeploy
command (rebuild image at the new commit hash, restart the container) is now
documented in `../CLAUDE.md`'s "Production deployments" section. Whether Render is
still serving traffic alongside AWS is **still unconfirmed** — check before assuming
either. Tick karte jao.

Related docs: `HANDOVER.md` (client setup) · `DATABASE.md` (schema) ·
`flow.md` (flow) · `SETUP_GUIDE.md` (dev setup) · `AWS_MIGRATION.md` (prod infra) ·
`WHATSAPP_SETUP.md` (Meta setup, prep only — see §2b below) · `../CLAUDE.md` (technical,
full chronological Status section — source of truth for what's actually shipped).

---

## 0. Biggest open item — confirm what's actually deployed on AWS EC2

`../CLAUDE.md`'s Status section documents a long, fast run of sessions
(2026-07-30 → 2026-08-11) that repeatedly says **"not yet deployed"** for that
session's own migrations, and no later session in that log explicitly confirms a
rebuild+redeploy happened since. That means, as of this write-up:

- [ ] **Confirm the currently-running EC2 container's commit hash** (`sudo docker
      ps` / check the image tag) against `git log` on `master`, and rebuild+restart
      if it's stale. Use the documented command in `../CLAUDE.md` → "Production
      deployments" → "To redeploy AWS after a code fix".
- [ ] If a rebuild is done, confirm all 24 migrations apply cleanly (`prisma migrate
      deploy` runs automatically on container start — check the boot log for "No
      pending migrations to apply").
- [ ] Until this is confirmed, **do not assume** any of the following are live in
      production, even though they're merged to `master`: Karigar-assignment +
      dual-PDF generation (all 4 phases), JFA-/JFC- order numbering, the
      order-status rework (`IN_PROCESS`/`GHAT_RECEIVED`/etc.), per-item order
      status, the "Catalogue" rename, favorites, retailer badges, email-optional
      registration, cascade-delete fix, or any other change from a session that
      flagged itself "not yet deployed."

## 1. Karigar-assignment + dual-PDF generation (built, not yet fully bedded in)

Built across several sessions (2026-08-09 → 2026-08-11), all 4 phases implemented
per `../CLAUDE.md`'s Status section. Confirmed working through several rounds of
live client feedback and fixes. Still open:

- [ ] **Deploy** — see item 0 above; migration `karigar_assignment_phase1` (+ the
      later `karigar_form_extra_fields` migration) need to land on EC2.
- [ ] **"Order Stage" field** — deliberately a plain free-text input, not a
      dropdown, because the client hadn't decided the real option list as of the
      last session. Don't invent options — ask the client, then build the dropdown.
- [ ] **"Expected Delivery Date"** — deliberately NOT implemented anywhere on the
      Karigar form; the client hadn't decided what it should mean (distinct from
      the existing client/Karigar delivery dates). Needs a client decision before
      any code.
- [ ] **Live end-to-end verification** of the full flow post-deploy: assign Karigar
      from an existing Catalog/Kiosk order → JFC-#### order created → items flip to
      IN_PROCESS → both PDFs generate correctly → the retailer-bespoke-request path
      (pending request → Karigar assigned → real CustomDesignOrder created) works
      too.

## 2. System-wide required/optional form convention retrofit — NOT STARTED

Explicitly deferred out of the Karigar-assignment work per the client's own
instruction to keep it separate (`../CLAUDE.md` 2026-08-09 session). The ask: a
consistent red-asterisk-for-required / "(Optional)"-for-optional convention across
**every existing form** in the app (manufacturer Add/Edit Design, all 3
registration/login forms, custom-design forms, branch/store-manager creation,
etc.) — currently inconsistent, each form does its own thing. Genuinely
un-started; scope out which forms first before touching code.

## 2b. WhatsApp send integration — prep only, NOT implemented

`docs/WHATSAPP_SETUP.md` is a complete Meta WhatsApp Cloud API setup guide (Business
Portfolio → App → WhatsApp product → phone number → business verification →
permanent access token → 2 branded templates), written so whoever sets it up only
needs to log into Meta once. **This is documentation only.** The actual send code —
forgot-password link via WhatsApp, approval-notification via WhatsApp — does not
exist yet. Both flows remain fully email-based today.

- [ ] Blocked on the client completing Meta's own setup and handing over:
      permanent access token, Phone Number ID, WABA ID, approved template names.
- [ ] Once credentials exist: build the actual send calls (forgot-password,
      approval notification), gated behind whatever env vars make sense, falling
      back to the existing email flow if unset (same pattern SMTP already uses).

## 3. `gpt-image-1` deprecation — 2026-10-23, re-test before then

Flagged since the 2026-07-24 session, restated as still relevant in the
2026-08-09 session's cost-analysis note. The transparent-background step of AI
try-on generation depends on `gpt-image-1`'s native `background="transparent"`
support. **Not resolved as of the latest session** — the date is under 2 months
away as of this writing (today: 2026-08-29).

- [ ] Re-test the transparent-PNG generation path against whatever OpenAI recommends
      as the replacement model before 2026-10-23, or the try-on pipeline breaks.
- [ ] Regenerate existing transparent try-on assets if the replacement model's
      output differs meaningfully from `gpt-image-1`'s.

## 4. Secrets rotation — still outstanding, no confirmation any of these were rotated

- [ ] **AWS RDS database password** — printed in plaintext during the 2026-07-24 SSH
      debugging session (a `sed` redaction pattern missed the `DATABASE_URL=` line).
      No later session confirms this was rotated — treat as still live/exposed.
- [ ] Supabase (dev) DB password — exposed earlier, same status.
- [ ] Gmail app password (SMTP).
- [ ] Auth secrets — now **5**, not 4: MANUFACTURER / STORE / MANAGER /
      BRANCH_MANAGER (+ whatever backs the mobile-client bearer-token fallback,
      merged in from a concurrent commit around 2026-07-30 — confirm whether that
      reuses an existing secret or introduces a new one).
- [ ] OpenAI key (AI-Features).
- [ ] Confirm no rotated-out secret still sits in git history or old chat transcripts.
- [x] ~~Cloudinary API secret~~ / ~~Qdrant API key~~ — moot, both retired in
      production (AWS migration); rotate only if still used in a dev fallback.

## 5. Deploy-target confirmation — still open

- [ ] **Confirm whether Render is retired or still serving traffic in parallel**
      with AWS EC2. `../CLAUDE.md` states this explicitly as unconfirmed as of its
      most recent edit — don't assume either way when debugging a production issue.
- [ ] If Render is still live: confirm its env vars and migration state are in
      sync with what's documented for AWS (Render does NOT auto-apply migrations
      on `pnpm run start` — only `pnpm render-start` or Docker do).

## 6. Live end-to-end test — do after confirming deploy (item 0)

Re-run against whichever deploy target is authoritative:
- [ ] Manufacturer → catalog add (manual) + "Generate with AI" (regenerate, custom
      instructions)
- [ ] Manufacturer → Intelligence page (top-products/retailers/category-weight) —
      previously fixed (BigInt bug), re-verify still fixed post-redeploy
- [ ] Retailer (Purchase Manager UI) → `/store/branches` → create Store + Store
      Manager + restock PIN
- [ ] Store Manager → kiosk / try-on / search / custom-design upload / restock
- [ ] Store Manager → My Orders → status + Mark Completed + Head Office chat
- [ ] Retailer → Pending Approvals → branch + editable note + approve (with
      delivery date) + chat
- [ ] Full order-status lifecycle: PENDING → IN_PROCESS → GHAT_RECEIVED →
      READY_FOR_DELIVERY → DISPATCHED → COMPLETED, per-item status advancing
      independently of order-level status
- [ ] JFA-#### / JFC-#### order numbering — confirm both counters increment
      correctly under concurrent placements
- [ ] Karigar assignment → dual-PDF generation (see item 1)
- [ ] Manufacturer sees order with retailer business name but NOT city/branch name
      (privacy rule — confirm it hasn't regressed)
- [ ] Photo (visual) search — including the new AI-cleanup pre-processing step
      (`/classify` → `/catalog` → embed) — needs AI-Features + pgvector (RDS) both up
- [ ] Cart recommendations ("You may also like" / "More from {category}") on the
      retailer catalogue page
- [ ] Favorites — Kiosk vs Restock split scoping (Store Manager), separate from
      Retailer's own favorites list

## 7. Photo Search Web Enhancement — DETAILED SPEC (deferred, approved 2026-07-24)

**Status:** Approved scope + recommendations. Still waiting for owner sign-off on
API choice + budget before any code is written. No evidence in `../CLAUDE.md`'s
later sessions that this moved forward — treat as still fully pending.

**Problem:** Store Manager kiosk only searches own catalog via pgvector. If no good
match, customer leaves. **Solution:** Also search web for similar images, expand
options seamlessly.

**UX Design:**
- **Customer:** Sees blended results (catalog + web mixed), no distinction, feels
  like store's own collection
- **Store Manager:** Sees badges (🏠 Catalog | 🌐 Web) so they know which is which
  while helping customer
- **Retailer/Manufacturer:** In order details, sees source badge ("Reference image
  from web search")

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
7. Custom Design goes: Store Manager → Retailer approval → Manufacturer (same
   pipeline)

**API Choice: Azure Bing Visual Search** ✅
- Real reverse-image-search (not wrapper)
- Best for jewelry/fashion
- Cost: ~₹500-600/month (100 searches/day × 30 days × $0.25/search)
- Free tier: 100 calls/month
- Reliable, Azure ecosystem, clear pricing
- Alternative: SerpApi (cheaper but third-party wrapper), TinEye (specialist but
  less jewelry-focused)

**Safety & Reliability:**
- ✅ Non-blocking: If web-search fails → catalog still works
- ✅ Timeouts: Web-search max 5 seconds
- ✅ Image validation: File size (<5MB), format (jpg/png), magic bytes
- ✅ URL validation: Whitelist domains, no suspicious/internal URLs
- ✅ S3 upload: Images downloaded + re-uploaded to our S3 (immutable, CDN-cached,
  no hotlink issues)
- ✅ Rate limiting: Max 100 searches/day per store, circuit breaker (3 failures →
  5-min cooldown)
- ✅ Cost monitoring: Logged every call, set budget alerts, disable if over-quota
- ✅ Feature flag: `ENABLE_WEB_SEARCH=true/false` to toggle instantly
- ✅ Error logging: Every failure logged (web-search timeout, image validation
  fail, S3 upload fail)

**Implementation Details:**
- **New endpoint:** `POST /api/branch-manager/search` (lib/api/routes/branch-manager.ts)
- **Helper functions:** embedImage(), searchWebImages(), downloadAndUploadToS3(),
  validateImage()
- **Frontend:** `/store-manager/search` page shows blended results with Store
  Manager badges
- **Custom design:** If web image selected → use s3Url (not external URL) in
  custom design request

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
- E2E test: Customer uploads → sees blended results → picks web image → custom
  design created → Retailer approves
- Use Python Colab script (referenced in an earlier session) to validate API before
  full implementation

---

## 8. Known gaps (not bugs, just incomplete by design — revisit if the client asks)

- **Forgot-password is email-only** — a retailer registered with a mobile number
  alone can't self-serve a reset until they add an email in `/store/profile`.
  Standing gap since the 2026-07-31 session, no fix since.
- **A retailer's password doesn't auto-update** if their registered mobile number
  changes later via `/store/profile` — accepted gap, not a bug (see `../CLAUDE.md`
  Gotchas).
- **`orderRef` (shop's own order number) is separate from the system's JFC-####
  numbering** — don't merge them if touching custom-design code.
- **`MEENA_OPTIONS` / `SCREW_OPTIONS`** in the custom-design form are guessed shop
  vocabulary, not confirmed with the client — verify before relying on them being
  exhaustive.
- **The old `nextCustomOrderSeq`/JFC-#### counter path from the pre-unification
  numbering is dead code** — left in place unused after Customised orders moved to
  share the JFA-#### counter, then Karigar orders got their own separate JFC-####
  counter again. Don't be confused by two different things both called "JFC-####"
  at different points in the project's history — the one that matters today is the
  Karigar-assignment one (`nextKarigarOrderNumber`).

## 9. Optional / future (low priority, unscoped)

- [ ] Product_Recommendation (AI design ranking, folder `../Product_Recommendation`)
      → merge into AI-Features as a new endpoint — the "one AI service" vision.
- [ ] Order-confirmation email/SMS (kiosk) — currently only reset + store-approval
      emails exist.
- [ ] Rate-limit + integration tests (approval + chat flows).

---

## Known / by-design (bug nahi)

- "Generate with AI" button **live pe tabhi dikhega** jab `AI_FEATURES_URL` set ho
  (safe default, hides gracefully when unset).
- Mobile visual search intentionally uses the rear camera for **Take photo** and
  the normal image picker for **Choose photo**.
- Migrations Supabase pooler pe `migrate dev` se atakte hain → `pnpm db:deploy` use
  karo (idempotent, safe). Same reasoning applies to AWS RDS migrations — they run
  automatically on container start via `prisma migrate deploy`.
- AI-Features first `/embed` call cold Space pe ~30-90s (CLIP lazy-load).
- The `store_managers` DB table is permanently inert (historical approver FK rows
  only) — this is intentional, not a cleanup task.
- `karigarCode` is structurally omitted (`omit: { karigarCode: true }`) from every
  retailer/store-manager/customer-facing query — this is a deliberate privacy
  boundary, not a bug if a new read path needs the same treatment added to it.
