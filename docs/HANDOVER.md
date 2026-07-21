# Jewel Factory — Handover & Fresh Setup Guide

Ye guide **naye owner/client** ke liye hai — apne khud ke accounts par poora system
zero se live karne ke liye. Isko top-se-bottom follow karo. Koi step chhodna mat.

> Roles / flow samajhne ke liye pehle `flow.md` padho. Database samajhne ke
> liye `DATABASE.md`. Technical detail `../CLAUDE.md` me hai. Ye file = **setup + handover**.
> **Non-technical end users ke liye `USER_MANUAL.md`** (roles + demo login credentials
> + step-by-step kaam) — ye woh file hai jo staff ko dena hai.

---

## 0. Kya-kya chahiye (accounts)

| Service | Kis liye | Free? |
|---|---|---|
| **Supabase** | Database (Postgres) | ✅ free tier |
| **Cloudinary** | Product/try-on images | ✅ free tier |
| **Qdrant Cloud** | Photo (visual) search | ✅ free tier (optional) |
| **Gmail / SMTP** | Password-reset + store-approval emails | ✅ Gmail app password (optional) |
| **Render** (ya koi Node host) | App deploy | ✅ free tier |
| **GitHub** | Code host (Render ke liye) | ✅ |

> Qdrant + SMTP + Embedder **optional** hain — inke bina app chalega, bas photo-search
> aur emails band rahenge. Baaki sab (catalog, orders, kiosk, chat) chalega.

---

## 1. Supabase (Database)

1. https://supabase.com → New Project → naam `jewel-factory`, ek **strong DB password** (note kar lo), region apne paas ka.
2. Project → **Settings → Database → Connection string**:
   - **DATABASE_URL** (Transaction / pooled, port **6543**): copy, `[YOUR-PASSWORD]` bharo, end me `?pgbouncer=true` lagao.
   - **DIRECT_URL** (Session / direct, port **5432**): copy, password bharo.
   ```
   DATABASE_URL="postgresql://postgres.xxx:PASS@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.xxx:PASS@aws-0-region.pooler.supabase.com:5432/postgres"
   ```

> **Nayi baat:** ye app Supabase **Auth use NAHI karta** — sirf Postgres. Isliye
> `NEXT_PUBLIC_SUPABASE_*` ki zaroorat nahi. Bas DATABASE_URL + DIRECT_URL.

---

## 2. Auth secrets (4 random strings, min 32 chars each)

Terminal me 4 baar chalao, 4 alag strings copy karo:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
```
MANUFACTURER_SECRET=<1st>
STORE_SECRET=<2nd>
MANAGER_SECRET=<3rd>
BRANCH_MANAGER_SECRET=<4th>   # Store Manager login ke liye — ZAROOR set karo
COOKIE_TTL_SECONDS=28800      # 8 ghante
```
> `BRANCH_MANAGER_SECRET` `.env.example` me nahi hai par production me set karo
> (na karo to MANAGER_SECRET pe fall back hota hai — kaam karega par best practice hai alag).

---

## 3. Cloudinary (images)

1. https://cloudinary.com → sign up → Dashboard.
2. Dashboard se copy:
   ```
   CLOUDINARY_CLOUD_NAME=<cloud name>
   CLOUDINARY_API_KEY=<api key>
   CLOUDINARY_API_SECRET=<api secret>   # "reveal" karke
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<same cloud name>
   ```

---

## 4. Qdrant (photo search — optional)

1. https://cloud.qdrant.io → Create Cluster (free) → Cluster URL + API key.
   ```
   QDRANT_URL="https://xxx.region.aws.cloud.qdrant.io:6333"
   QDRANT_API_KEY=<key>
   QDRANT_MANUFACTURER_COLLECTION=jewelfactory_manufacturer_products
   ```
2. Embedder + AI (photo → vector, aur AI generate) — **ek hi service**: `AI-Features`
   (repo: `github.com/teamai-botivate/Jewel-Factory_AI`, HF Docker Space pe deploy).
   Ye ek Space `/embed/*` (photo-search) + `/catalog` `/transparent` `/describe`
   (AI generate) dono deta hai. Deploy karke (uska apna `HANDOVER`/`README` dekho),
   URL milega, phir:
   ```
   EMBEDDER_URL=https://<user>-ai-features.hf.space      # photo-search (/embed/image)
   EMBEDDER_API_KEY=<Bearer key agar set kiya>
   AI_FEATURES_URL=https://<user>-ai-features.hf.space   # same URL — AI generate
   AI_FEATURES_API_KEY=<x-api-key agar set kiya>
   ```
   AI-Features Space pe `OPENAI_API_KEY` (gpt-image + gpt-4o) set karna zaroori.
   Skip karna ho: `QDRANT_URL`/`EMBEDDER_URL`/`AI_FEATURES_URL` khaali → photo-search +
   "Generate with AI" button band, baaki sab chalega (manual add works).

---

## 5. SMTP / Email (password reset + store approval — optional)

Gmail: Account → Security → 2-Step ON → App passwords → "Mail" → 16-char password.
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465            # Render pe 465 (587 blocked)
SMTP_USER=<your-gmail>
SMTP_PASS=<app password> # normal password NAHI
FROM_EMAIL=<your-gmail>
FROM_NAME=Jewel Factory
```
Skip: sab khaali chhod do → reset link console me print hoga, approval email nahi jaayega (approval phir bhi chalega).

---

## 6. `.env` file banao

```bash
cp .env.example .env
```
`.env` khol ke upar wali saari values bharo. Plus ye 2 (jo .env.example me shayad na hon):
```
BRANCH_MANAGER_SECRET=<4th secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000   # local; deploy pe real URL
ALLOWED_ORIGINS=http://localhost:3000       # deploy pe real URL
NODE_ENV=development                        # deploy pe production
```

---

## 7. Install + Database + Seed  ← ye sabse zaroori (handover ka dil)

```bash
pnpm install          # deps + prisma generate

pnpm db:deploy        # SAARI migrations apply — poora schema ek command me ban jaata hai
                      #   (5 migrations: init → kiosk_pin → b2b_item_image
                      #    → branch_hierarchy → order_messages). Koi manual SQL nahi.

pnpm db:seed          # 1 manufacturer (admin@atjewellers.com / manufacturer123) + 14 categories
```

Apna manufacturer password/email seed pe set karna ho:
```bash
SEED_MANUFACTURER_EMAIL="admin@yourbrand.com" SEED_MANUFACTURER_PASSWORD="StrongPass123" pnpm db:seed
```

> ⚠️ **Fresh DB pe kuch bhi manual nahi karna.** `pnpm db:deploy` saara schema bana
> deta hai. Ye Prisma-managed hai — schema `prisma/schema.prisma` me, tables
> `DATABASE.md` me documented. (`migrate:categories`/`migrate:branches` sirf ek
> PURANI DB ko upgrade karte waqt chahiye — fresh DB pe NAHI.)

Local test:
```bash
pnpm dev            # http://localhost:3000
```

---

## 8. Pehla login + data banao (order matters)

1. **Manufacturer** → `/manufacturer/login` (`admin@...` / seed password) → catalog me designs add karo.
2. **Retailer** → `/store/register` → manufacturer `/manufacturer/store-registrations` se **approve** kare.
3. Retailer → `/store/login` → **Stores (Branches)** → ek Store (branch) + uska **Store Manager** banao (+ chaaho to restock PIN).
4. **Store Manager** → `/store-manager/login` → kiosk / try-on / search / custom-design / restock / my-orders.
5. Retailer (= Head Office) → `/store/login` → **Pending Approvals** (branch orders approve + chat).

Poora role flow: `flow.md`.

---

## 9. Deploy on Render

1. Code GitHub pe daalo (private repo).
2. Render → New → **Web Service** → repo connect.
3. Settings:
   | Field | Value |
   |---|---|
   | Runtime | **Node** |
   | Build Command | `pnpm install && pnpm build` |
   | Start Command | **`pnpm render-start`** (ye deploy pe migrations auto-apply karta hai) |
   | Health Check Path | `/api/health` |
4. **Environment** tab me `.env` ki saari values daalo. Deploy ke baad ye 3 real URL pe:
   ```
   NODE_ENV=production
   NEXT_PUBLIC_APP_URL=https://<app>.onrender.com
   ALLOWED_ORIGINS=https://<app>.onrender.com
   ```
   → phir **Manual Deploy → Clear cache & deploy**.
5. Seed (ek baar): Render **Shell** paid me hai; free me **local se prod DB pe** chalao —
   `.env` me prod `DATABASE_URL`/`DIRECT_URL` daal ke `pnpm db:seed`.

Detailed Render steps: `DEPLOY_RENDER.md`.

---

## 10. Handover — client ko ye do

- [ ] GitHub repo access (ya code zip)
- [ ] Ye 5 files: `HANDOVER.md`, `DATABASE.md`, `flow.md`, `SETUP_GUIDE.md`, `USER_MANUAL.md` (staff ko dene ke liye)
- [ ] Client apne accounts banaye (Supabase/Cloudinary/Qdrant/SMTP/Render) — step 1–5
- [ ] Client apna `.env` bhare (uske accounts ki values)
- [ ] `pnpm db:deploy` + `pnpm db:seed` (uski DB pe)
- [ ] Render pe deploy (uska account)

### ⚠️ Secrets ROTATE karo (zaroori)
Handover se pehle **saare purane secrets badlो** (kyunki wo tumhare paas the):
- Supabase DB password (dashboard se reset)
- Cloudinary API secret
- Qdrant API key
- Gmail app password
- 4 auth secrets (`node -e ...` se naye banao)
Client apne fresh accounts use karega, toh ye apne aap alag ho jaayenge — bas confirm karo purane kahin (git/chat) me na rahein.

---

## 11. Common issues (troubleshoot)

| Problem | Fix |
|---|---|
| `Invalid server environment` | Koi env missing/galat — Render logs me exact field dikhega |
| "Can't reach database" | `DIRECT_URL` (5432) galat, ya Supabase paused |
| Migrations nahi lagi (deploy) | Start command `pnpm render-start` hai? (`pnpm start` nahi) |
| `prisma migrate dev` pooler pe atakta hai | Local pe `pnpm db:deploy` use karo (ye advisory-lock issue avoid karta hai) |
| Login redirect loop | `NODE_ENV=production` + `NEXT_PUBLIC_APP_URL`/`ALLOWED_ORIGINS` real URL pe |
| Image upload fail | Cloudinary ke 4 env set hain? |
| Photo search "warming up" | Embedder cold-boot (~30–90s) ya `EMBEDDER_URL` set nahi |
| Mobile photo search me galat source khul raha hai | **Take photo** rear-camera input hai; **Choose photo** gallery/file-picker input hai. Dono controls Store Manager aur public storefront search par available hain. |
| Email nahi jaa raha (Render) | `SMTP_PORT=465` + Gmail app password |
| Store Manager login nahi | Retailer ne `/store/branches` me branch + manager banaya? |

---

Bas! `pnpm install → db:deploy → db:seed → dev/deploy`. Poora schema apne aap ban
jaata hai, koi manual DB kaam nahi. Handover complete.
