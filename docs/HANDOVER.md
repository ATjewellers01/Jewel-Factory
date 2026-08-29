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
| **Postgres** (Supabase for dev, **AWS RDS** for production) | Database | ✅ Supabase free tier; RDS is paid |
| **AWS S3 + CloudFront** | Product/try-on image storage | Paid (usage-based, cheap at this scale) |
| **pgvector** | Photo (visual) search — a Postgres extension, not a separate service | ✅ enabled automatically by a migration, no account needed |
| **AI-Features service** (HF Docker Space) | AI-generate (catalog image/description/try-on) + the embedder (visual search) | ✅ HF free tier for the Space; OpenAI usage is paid |
| **Gmail / SMTP** | Password-reset + store-approval emails | ✅ Gmail app password (optional) |
| **AWS EC2** (primary production) or **Render** (alternate) | App deploy | EC2 paid; Render has a free tier |
| **GitHub** | Code host | ✅ |

> pgvector + SMTP + AI-Features **optional** hain — inke bina app chalega, bas photo-search,
> "Generate with AI", aur emails band rahenge. Baaki sab (catalog, orders, kiosk, chat) chalega.
> **Cloudinary aur Qdrant is app me AB use NAHI hote** — inki jagah AWS S3+CloudFront (images)
> aur Postgres pgvector (vector search) ne le li hai (migrated 2026-07-22). Agar kahin purani
> checklist/doc me `CLOUDINARY_*` ya `QDRANT_*` dikhe, wo legacy hai — skip karo.

---

## 1. Database — Postgres (Supabase for dev, AWS RDS for production)

### Dev / staging (Supabase)

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

### Production (AWS RDS)

Production ab **AWS RDS Postgres** pe chalta hai, Supabase pe nahi. Same
`DATABASE_URL`/`DIRECT_URL` shape, bas RDS ka host/credentials. RDS instance
banane ka poora walkthrough (security group, subnet, parameter group) —
**`AWS_MIGRATION.md`** dekho, yahan duplicate nahi kar rahe.

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

## 3. AWS S3 + CloudFront (images)

Image storage Cloudinary se AWS S3+CloudFront pe migrate ho chuka hai
(2026-07-22) — `lib/cloudinary.ts` **deleted hai**, ab ye service use hoti hai.

1. **S3 bucket banao** (AWS Console → S3 → Create bucket): apna region choose karo,
   bucket naam unique rakho (e.g. `yourbrand-jewel-factory-prod`).
2. **IAM user/role banao** jiske paas us bucket pe `PutObject`/`GetObject` permission ho
   (presigned direct-upload flow use hota hai — `lib/storage.ts`).
3. **CloudFront distribution** bucket ke upar banao (public reads fast + cache ke liye);
   distribution ka domain hi `S3_PUBLIC_BASE_URL` banega.
4. Env values:
   ```
   AWS_REGION=ap-south-1
   AWS_S3_BUCKET=yourbrand-jewel-factory-prod
   S3_PUBLIC_BASE_URL=https://xxxxxxxx.cloudfront.net
   # IAM creds (agar EC2 instance-role use nahi kar rahe):
   AWS_ACCESS_KEY_ID=<key>
   AWS_SECRET_ACCESS_KEY=<secret>
   ```
   Uploads presigned PUT se seedha S3 jaate hain (server sirf presigned URL deta hai);
   public reads CloudFront se serve hote hain.

---

## 4. pgvector (photo search — just a Postgres extension, not a separate service)

Purane Qdrant Cloud setup ki jagah ab **pgvector** use hota hai — same RDS/Supabase
Postgres ke andar ek extension, koi alag account/service/cluster nahi chahiye.

- `manufacturer_product_embeddings.embedding vector(512)` column pgvector migration
  se apne aap ban jaata hai jab tum `pnpm db:deploy` chalate ho — koi manual step nahi.
- Koi `QDRANT_URL`/`QDRANT_API_KEY` env var ab is app me exist NAHI karta — agar
  kahin purane notes me dikhe, ignore karo.
- Similarity search `lib/search.ts` me raw SQL (cosine distance) se hota hai.

Embedder + AI (photo → vector, aur AI generate) — **ek hi service**: `AI-Features`
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
Skip karna ho: `EMBEDDER_URL`/`AI_FEATURES_URL` khaali → photo-search +
"Generate with AI" button band, baaki sab chalega (manual add works).

---

## 5. SMTP / Email (password reset + store approval — optional)

Gmail: Account → Security → 2-Step ON → App passwords → "Mail" → 16-char password.
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465            # Render/EC2 pe 465 use karo (587 blocked, ETIMEDOUT)
SMTP_USER=<your-gmail>
SMTP_PASS=<app password> # normal password NAHI
FROM_EMAIL=<your-gmail>
FROM_NAME=Jewel Factory
```
> Transporter code me `family: 4` bhi force karta hai (Render/some hosts IPv6 se
> Gmail tak nahi pahunch pate → ENETUNREACH). `lib/email.ts` logs `[email] sent to …`
> / `[email] send FAILED: …` — real reason dekhne ke liye host logs check karo.

Skip: sab khaali chhod do → reset link console me print hoga, approval email nahi jaayega (approval phir bhi chalega).

---

## 6. `.env` file banao

```bash
cp .env.example .env
```
`.env` khol ke upar wali saari values bharo. Plus ye env bhi confirm karo:
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

pnpm db:deploy        # SAARI 24 migrations apply — poora schema ek command me ban jaata hai
                      #   Koi manual SQL nahi. Poori list docs/DATABASE.md me hai.

SEED_MANUFACTURER_PASSWORD="<strong-password>" pnpm db:seed
# 1 manufacturer (admin@atjewellers.com / env-set password) + 14 categories
```

Apna manufacturer password/email seed pe set karna ho:
```bash
SEED_MANUFACTURER_EMAIL="admin@yourbrand.com" SEED_MANUFACTURER_PASSWORD="StrongPass123" pnpm db:seed
```

> ⚠️ **Fresh DB pe kuch bhi manual nahi karna.** `pnpm db:deploy` saara schema bana
> deta hai. Ye Prisma-managed hai — schema `prisma/schema.prisma` me, tables
> `DATABASE.md` me documented. (`migrate:categories`/`migrate:branches` sirf ek
> PURANI DB ko upgrade karte waqt chahiye — fresh DB pe NAHI.)
>
> **`pnpm db:migrate` fresh DB pe use mat karo** — ye local dev me NAYI migration
> banane ke liye hai, aur Supabase pooler ke saath advisory-lock timeout hit kar
> sakta hai (`CLAUDE.md` Gotchas me documented). Existing migrations apply karne
> ke liye hamesha `pnpm db:deploy`.

Local test:
```bash
pnpm dev            # http://localhost:3000
```

---

## 8. Pehla login + data banao (order matters)

1. **Manufacturer** → `/manufacturer/login` (`admin@...` / seed password) → catalog me designs add karo.
2. **Purchase manager** (code/DB me "Retailer"/"store") → `/store/register` → manufacturer `/manufacturer/store-registrations` se **approve** kare.
3. Purchase manager → `/store/login` → **Stores (Branches)** → ek Store (branch) + uska **Store Manager** banao (+ chaaho to restock PIN).
4. **Store Manager** → `/store-manager/login` → kiosk / try-on / search / custom-design / restock / my-orders.
5. Purchase manager (= Head Office) → `/store/login` → **Pending Approvals** (branch orders approve + chat).

Poora role flow: `flow.md`.

---

## 9. Deploy — TWO targets exist

Production abhi **do jagah** deploy ho sakta hai — AWS EC2 primary hai, Render
alternate/secondary. Dono ka poora detail `CLAUDE.md`'s "Production deployments"
section me hai; yahan sirf summary.

### 9a. AWS EC2 (current PRIMARY production target)

- App ek **Docker container** me chalta hai EC2 host pe, image tag = **git commit hash**
  (e.g. `jewel-factory-prod:529b664`) — matlab sirf `master` pe merge karne se
  running container update NAHI hota, image ko us naye commit pe rebuild + restart
  karna padta hai.
- DB = **AWS RDS Postgres**. Storage = **S3 + CloudFront**. Vector search = **pgvector**
  (same RDS). AI-Features Space wahi rehta hai (EC2 pe move nahi hua).
- Migrations container start pe **auto-apply** hoti hain (`prisma migrate deploy` before
  `next start`).
- Poora rebuild+redeploy command aur SSH access detail: **`AWS_MIGRATION.md`** —
  yahan duplicate nahi kar rahe, wahi authoritative hai.

### 9b. Render (alternate)

1. Code GitHub pe daalo (private repo).
2. Render → New → **Web Service** → repo connect.
3. Settings:
   | Field | Value |
   |---|---|
   | Runtime | **Node** |
   | Build Command | `pnpm install && pnpm build` |
   | Start Command | **`pnpm render-start`** (ye deploy pe migrations auto-apply karta hai) |
   | Health Check Path | `/api/health` |
4. **Environment** tab me `.env` ki saari values daalo (Supabase DB, S3/CloudFront,
   secrets, EMBEDDER_URL/AI_FEATURES_URL, SMTP). Deploy ke baad ye 3 real URL pe:
   ```
   NODE_ENV=production
   NEXT_PUBLIC_APP_URL=https://<app>.onrender.com
   ALLOWED_ORIGINS=https://<app>.onrender.com
   ```
   → phir **Manual Deploy → Clear cache & deploy**.
5. Seed (ek baar): Render **Shell** paid me hai; free me **local se prod DB pe** chalao —
   `.env` me prod `DATABASE_URL`/`DIRECT_URL` daal ke `pnpm db:seed`.

Detailed Render steps: `DEPLOY_RENDER.md`.

> Whether Render abhi bhi live use ho raha hai ya AWS EC2 hi sole production target hai —
> ye is doc ke last update ke time confirm nahi tha. Team se check karo before assuming
> Render retired hai.

---

## 10. Env var reference (quick table)

| Var | Kis liye | Status |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Postgres connection (pooled/direct) | Required |
| `MANUFACTURER_SECRET` / `STORE_SECRET` / `MANAGER_SECRET` / `BRANCH_MANAGER_SECRET` | Auth cookie signing (min 32 chars each) | Required |
| `AWS_REGION` / `AWS_S3_BUCKET` / `S3_PUBLIC_BASE_URL` | S3 + CloudFront image storage | Required (replaces Cloudinary) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM creds for S3 (skip if EC2 instance-role used) | Required unless using an instance role |
| `EMBEDDER_URL` / `EMBEDDER_API_KEY` | Visual search embedding calls (AI-Features `/embed/image`) | Optional — photo-search disabled without it |
| `AI_FEATURES_URL` / `AI_FEATURES_API_KEY` | AI-generate (`/catalog` `/transparent` `/describe`) | Optional — "Generate with AI" hidden without it |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `FROM_EMAIL` / `FROM_NAME` | Password reset + store-approval email | Optional — falls back to console log |
| `NEXT_PUBLIC_APP_URL` / `ALLOWED_ORIGINS` / `NODE_ENV` | App URL + CORS + env mode | Required |
| `CLOUDINARY_*` / `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | ~~Image storage~~ | **Legacy/unused** — replaced by AWS S3 + CloudFront (2026-07-22). `lib/cloudinary.ts` is deleted. Don't set these. |
| `QDRANT_*` | ~~Vector search~~ | **Legacy/unused** — replaced by pgvector in the same Postgres DB (same migration). No Qdrant account needed. |

---

## 11. Handover — client ko ye do

- [ ] GitHub repo access (ya code zip)
- [ ] Ye files: `HANDOVER.md`, `DATABASE.md`, `flow.md`, `SETUP_GUIDE.md`, `AWS_MIGRATION.md`, `USER_MANUAL.md` (staff ko dene ke liye)
- [ ] Client apne accounts banaye (Postgres/AWS S3+CloudFront/AI-Features/SMTP/EC2 ya Render) — step 1–9
- [ ] Client apna `.env` bhare (uske accounts ki values)
- [ ] `pnpm db:deploy` + `pnpm db:seed` (uski DB pe)
- [ ] AWS EC2 (ya Render) pe deploy (uska account)

### ⚠️ Secrets ROTATE karo (zaroori)
Handover se pehle **saare purane secrets badlो** (kyunki wo tumhare paas the):
- DB password (Supabase/RDS dashboard se reset)
- AWS IAM access key/secret (S3)
- Gmail app password
- 4 auth secrets (`node -e ...` se naye banao)
Client apne fresh accounts use karega, toh ye apne aap alag ho jaayenge — bas confirm karo purane kahin (git/chat) me na rahein.

---

## 12. Common issues (troubleshoot)

| Problem | Fix |
|---|---|
| `Invalid server environment` | Koi env missing/galat — host logs me exact field dikhega |
| "Can't reach database" | `DIRECT_URL` (5432) galat, ya Supabase paused, ya RDS security group block kar raha |
| Migrations nahi lagi (Render deploy) | Start command `pnpm render-start` hai? (`pnpm start` nahi) |
| Migrations nahi lagi (AWS EC2) | Container boot log check karo — `prisma migrate deploy` auto-run hota hai; agar rebuild nahi hua to purana commit hi chal raha hai |
| `prisma migrate dev` pooler pe atakta hai | Local pe `pnpm db:deploy` use karo (ye advisory-lock issue avoid karta hai) |
| Login redirect loop | `NODE_ENV=production` + `NEXT_PUBLIC_APP_URL`/`ALLOWED_ORIGINS` real URL pe |
| Image upload fail | `AWS_REGION`/`AWS_S3_BUCKET`/`S3_PUBLIC_BASE_URL` + IAM creds sahi hain? |
| Photo search "warming up" | AI-Features Space cold-boot (~30–90s) ya `EMBEDDER_URL` set nahi |
| Mobile photo search me galat source khul raha hai | **Take photo** rear-camera input hai; **Choose photo** gallery/file-picker input hai. Dono controls Store Manager aur public storefront search par available hain. |
| Email nahi jaa raha (Render/EC2) | `SMTP_PORT=465` + Gmail app password + `family: 4` (code me already forced) |
| Store Manager login nahi | Purchase manager ne `/store/branches` me branch + manager banaya? |

---

Bas! `pnpm install → db:deploy → db:seed → dev/deploy`. Poora schema apne aap ban
jaata hai, koi manual DB kaam nahi. Handover complete.
