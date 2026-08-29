# Jewel Factory — Complete Setup Guide (Hinglish)

Ye guide **zero se lekar chalne tak** ke saare steps deta hai — har `.env` variable
kaha se laana hai, database kaise banana hai, aur app kaise run karna hai.

Follow karo top se bottom, ek-ek step.

> **Naye client ko handover** kar rahe ho? → **`HANDOVER.md`** use karo (accounts +
> env + DB + deploy + first-login + secret-rotation, ek jagah). Database ka poora
> naksha → **`DATABASE.md`**. System flow → **`flow.md`**. Production AWS setup →
> **`AWS_MIGRATION.md`**.
>
> **Migrations:** `pnpm db:deploy` saari **24 migrations** ek command me apply karta hai
> (init, kiosk_pin, b2b_item_image, branch_hierarchy, order_messages, ... poori list
> `DATABASE.md` me hai) — fresh DB pe kuch manual SQL nahi. `db:seed` = 1 manufacturer
> + 14 categories.

---

## 📋 Kya-kya chahiye (accounts)

Ye accounts banane padenge (jo already hai to skip):

| Service | Kis liye | Free? |
|---|---|---|
| **Supabase** (dev) / **AWS RDS** (production) | Database (Postgres) | ✅ Supabase free tier; RDS paid |
| **AWS S3 + CloudFront** | Images store karne ke liye | Paid (usage-based, cheap) |
| **AI-Features service** (HF Docker Space) | Similar-image search (embedder) + "Generate with AI" | ✅ HF free tier for the Space; OpenAI usage paid |
| **Gmail** (ya koi SMTP) | Password reset emails | ✅ Gmail app password |

> **pgvector** (vector search) ek alag service NAHI hai — ye Postgres ka hi ek
> extension hai, `pgvector` migration se apne aap enable ho jaata hai jab tum
> `pnpm db:deploy` chalate ho. Koi account/signup nahi chahiye.
>
> **Cloudinary aur Qdrant is app me use NAHI hote** (migrated away 2026-07-22 — S3+CloudFront
> aur pgvector ne le li hai jagah). Agar kahin purani checklist me `CLOUDINARY_*`/`QDRANT_*`
> dikhe, wo legacy hai — set karne ki zaroorat nahi.

---

## STEP 0 — Terminal khol lo

```bash
cd "path/to/Jewel Factory"
pnpm install        # dependencies install (agar pehle nahi kiya)
```

---

## STEP 1 — Database: Supabase (dev) ya AWS RDS (production) 🗄️

### Dev / local — Supabase

1. Jao: **https://supabase.com** → Sign in (GitHub se easy hai)
2. **"New Project"** click karo
3. Fill karo:
   - **Name:** `jewel-factory` (kuch bhi)
   - **Database Password:** ek strong password daalo — **ise NOTE kar lo** (ye baad mein chahiye)
   - **Region:** apne paas ka (e.g. Mumbai / Singapore)
4. **"Create new project"** → 1-2 min wait (database ban raha hai)

Connection strings lo:

1. Project ke andar → left sidebar **⚙️ Project Settings** → **Database**
2. Neeche scroll karo → **"Connection string"** section
3. Do connection strings chahiye:

**DATABASE_URL** (pooled — app ke liye):
- Tab select karo: **"Transaction"** mode (ya "Connection pooling")
- Port dikhega **6543**
- String copy karo:
  ```
  postgresql://postgres.abcdxyz:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres
  ```
- `[YOUR-PASSWORD]` ki jagah **wahi password daalo jo upar banaya tha**
- End mein `?pgbouncer=true` add karo

**DIRECT_URL** (direct — migrations ke liye):
- Tab select karo: **"Session"** mode (ya "Direct connection")
- Port dikhega **5432**
- String copy karo (yahan bhi password daalo)

> **Tip:** Dono strings almost same hain — sirf **port alag hai** (6543 vs 5432).
> DATABASE_URL = 6543 + `?pgbouncer=true` · DIRECT_URL = 5432

### ✅ Ab tumhare paas hai:

```
DATABASE_URL="postgresql://postgres.abcdxyz:TumharaPassword@...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.abcdxyz:TumharaPassword@...pooler.supabase.com:5432/postgres"
```

### Production — AWS RDS

Production ab **AWS RDS Postgres** pe chalta hai (Supabase Auth kabhi use nahi hua,
sirf Supabase Postgres dev/staging ke liye hai). RDS instance banane ka poora
walkthrough (VPC, security group, subnet, parameter group) — **`AWS_MIGRATION.md`**
dekho. Same `DATABASE_URL`/`DIRECT_URL` env shape use hoti hai, bas RDS host/creds ke saath.

---

## STEP 2 — Auth Secrets 🔑

Ye 4 random secrets hain (min 32 characters each). Terminal mein ye command chalao —
har baar ek secret milega:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**4 baar chalao**, chaar alag secrets copy karo:

```
MANUFACTURER_SECRET="pehla-random-string-yahan"
STORE_SECRET="dusra-random-string-yahan"
MANAGER_SECRET="teesra-random-string-yahan"
BRANCH_MANAGER_SECRET="chautha-random-string-yahan"   # Store Manager login ke liye
COOKIE_TTL_SECONDS="28800"    # 8 ghante — ise waise hi rakho
```

> **Note:** Chaaron alag hone chahiye. Har ek 64 characters ka hoga (32 bytes hex) — bilkul theek.
> `BRANCH_MANAGER_SECRET` set na karo to `MANAGER_SECRET` pe fallback hoga (kaam karega,
> par production me alag rakhna best practice hai).

---

## STEP 3 — AWS S3 + CloudFront (Images) 🖼️

Image storage Cloudinary se **AWS S3 + CloudFront** pe migrate ho chuka hai
(2026-07-22) — `lib/cloudinary.ts` deleted hai, is guide me ab yahi flow hai.

### 3a. S3 bucket banao

1. AWS Console → **S3** → **Create bucket**
2. Naam unique rakho (e.g. `yourbrand-jewel-factory-dev`), apna region choose karo
3. Default settings theek hain (public access block rehne do — reads CloudFront se honge)

### 3b. IAM user/role banao

1. AWS Console → **IAM** → naya user (ya EC2 pe instance-role) banao jiske paas is
   bucket pe `PutObject`/`GetObject` permission ho
2. User ke liye access key generate karo (agar instance-role nahi use kar rahe)

### 3c. CloudFront distribution banao

1. AWS Console → **CloudFront** → **Create distribution** → origin = wahi S3 bucket
2. Distribution ready hone ka wait karo (~5-10 min) → uska domain (`xxxxxxxx.cloudfront.net`) copy karo — yahi `S3_PUBLIC_BASE_URL` banega

### ✅ Ab tumhare paas hai:

```
AWS_REGION="ap-south-1"
AWS_S3_BUCKET="yourbrand-jewel-factory-dev"
S3_PUBLIC_BASE_URL="https://xxxxxxxx.cloudfront.net"
AWS_ACCESS_KEY_ID="<iam key>"          # agar instance-role use nahi kar rahe
AWS_SECRET_ACCESS_KEY="<iam secret>"   # agar instance-role use nahi kar rahe
```

> Upload flow: server ek **presigned PUT URL** deta hai, browser seedha S3 pe upload
> karta hai (`lib/storage.ts`). Public reads CloudFront se serve hote hain (fast + cached).

---

## STEP 4 — pgvector (Vector Search) — no separate service needed 🔍

> Purane Qdrant Cloud setup ki tarah is step me koi account/cluster/API-key banane ki
> zaroorat NAHI hai. **pgvector Postgres ka ek extension hai** — jis DB se tum already
> connect ho rahe ho (Supabase ya RDS), usi ke andar `pgvector` migration column bana
> deti hai (`manufacturer_product_embeddings.embedding vector(512)`) jab tum
> STEP 8 me `pnpm db:deploy` chalaoge. Koi env var alag se nahi chahiye is step ke liye.

Similarity search khud `lib/search.ts` me raw SQL (cosine distance) se hota hai —
koi extra config nahi.

---

## STEP 5 — AI-Features service 🧠  [OPTIONAL — abhi skip kar sakte ho]

**Ek hi Python service saara AI karta hai** — photo (visual) search KE SAATH
"Generate with AI" (catalog image + transparent PNG + description). Repo:
`github.com/teamai-botivate/Jewel-Factory_AI` → HuggingFace **Docker Space** pe deploy.
(Us `Jewel-Factory_AI` repo ke apne README + CLAUDE deploy steps dekho.)

**Option A — Abhi skip karo (recommended for first run):**
```
EMBEDDER_URL=""
EMBEDDER_API_KEY=""
AI_FEATURES_URL=""
AI_FEATURES_API_KEY=""
```
Sab chalega, bas photo-search "warming up" dikhega + "Generate with AI" button hidden.

**Option B — AI-Features deploy karke use karo:**
1. `Jewel-Factory_AI` repo ko HF Docker Space pe deploy karo.
2. Us Space pe `OPENAI_API_KEY` set karo (gpt-image + gpt-4o ke liye). Optional:
   `EMBEDDER_API_KEY` (Bearer, `/embed/*`), `AI_FEATURES_API_KEY` (x-api-key).
3. URL milega. Yahan bharo (dono EMBEDDER_URL + AI_FEATURES_URL = **same** URL, aur
   **lowercase hi rakho** — capital host 307-redirect karta hai aur POST body drop kar
   deta hai):
```
EMBEDDER_URL="https://<user>-ai-features.hf.space"       # visual search (/embed/image)
EMBEDDER_API_KEY=""                                       # jo Space pe set kiya
AI_FEATURES_URL="https://<user>-ai-features.hf.space"     # same URL — AI generate
AI_FEATURES_API_KEY=""                                    # jo Space pe set kiya
```
(Verify: `<URL>/health` → `{"ok":true,"openai":true}`.)

> Embedder ab AI-Features me merged hai — koi alag embedder Space nahi chahiye.
> `/embed/image` ka contract same hai, toh Jewel Factory code me kuch nahi badalna.

---

## STEP 6 — Email / SMTP (Password Reset) 📧  [OPTIONAL]

Password reset emails ke liye. Skip karo to reset link **console mein print** hoga
(dev ke liye theek hai).

**Gmail se karna ho (dev):**

1. Gmail account → **Google Account** → **Security** → **2-Step Verification ON** karo
2. Fir **"App passwords"** search karo → naya app password banao ("Mail")
3. 16-character password milega (spaces hata do)

```
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"           # production hosts (Render/EC2) pe 465 use karo — 587 blocked hota hai
SMTP_USER="tumhara-email@gmail.com"
SMTP_PASS="16charapppassword"       # app password, normal Gmail password NAHI
FROM_EMAIL="tumhara-email@gmail.com"
FROM_NAME="Jewel Factory"
NEXT_PUBLIC_APP_URL="http://localhost:3000"    # local ke liye; deploy pe apna domain
```

**Skip karna ho:**

```
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""
FROM_EMAIL=""
FROM_NAME="Jewel Factory"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## STEP 7 — `.env` file banao ✍️

1. Project folder mein `.env.example` ko copy karke `.env` banao:
   ```bash
   cp .env.example .env
   ```
2. `.env` file khol ke **upar wale saare steps ke values paste karo**.

### Final `.env` aisa dikhega (example):

```env
# Database
DATABASE_URL="postgresql://postgres.abcd:MyPass123@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.abcd:MyPass123@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

# Auth secrets (4 — each 64 hex chars)
MANUFACTURER_SECRET="a1b2c3...64chars"
STORE_SECRET="d4e5f6...64chars"
MANAGER_SECRET="g7h8i9...64chars"
BRANCH_MANAGER_SECRET="j0k1l2...64chars"   # Store Manager login
COOKIE_TTL_SECONDS="28800"

# AWS S3 + CloudFront (images)
AWS_REGION="ap-south-1"
AWS_S3_BUCKET="yourbrand-jewel-factory-dev"
S3_PUBLIC_BASE_URL="https://xxxxxxxx.cloudfront.net"
AWS_ACCESS_KEY_ID="<iam key>"
AWS_SECRET_ACCESS_KEY="<iam secret>"

# AI-Features service (visual search + AI generate) — one URL, optional
EMBEDDER_URL=""            # AI-Features Space URL (embedder merged here)
EMBEDDER_API_KEY=""
AI_FEATURES_URL=""         # same URL as EMBEDDER_URL
AI_FEATURES_API_KEY=""

# Email (optional)
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""
FROM_EMAIL=""
FROM_NAME="Jewel Factory"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Deploy
ALLOWED_ORIGINS="http://localhost:3000"
NODE_ENV="development"
```

> ⚠️ `.env` file kabhi git mein commit mat karna (`.gitignore` mein already hai).
> ⚠️ `CLOUDINARY_*` / `QDRANT_*` vars **is file me set NAHI karni** — legacy/unused hain,
> S3+CloudFront aur pgvector ne inki jagah le li hai. `.env.example` me kahin dikhe to
> bhi khaali chhod do.

---

## STEP 8 — Database Tables banao (Prisma Migrate) 🏗️

Fresh DB ke liye ye command Postgres mein saare tables bana degi — **all 24
existing migrations apply karo**, koi nayi migration create nahi kar rahe:

```bash
pnpm db:deploy
```

"No pending migrations to apply" ya migrations ki list apply hoti dikhe = ✅ ho gaya.
Ye `pgvector` migration bhi is me shaamil hai — vector-search column apne aap ban jaata hai.

> ⚠️ **`pnpm db:migrate` (migrate dev) fresh DB pe use MAT karo.** Wo command sirf
> tab chalao jab tum khud **local pe ek nayi migration create** kar rahe ho (schema
> me naya change likh ke). `migrate dev` Supabase ke connection pooler pe advisory-lock
> timeout hit kar sakta hai — isliye existing migrations apply karne ke liye hamesha
> `pnpm db:deploy` (migrate deploy) use karo, `db:migrate` nahi.

**Agar error aaye "Can't reach database":**

- `DIRECT_URL` check karo — password sahi hai? port 5432 hai?
- Supabase project active hai? (paused to nahi), ya RDS security group block to nahi kar raha

---

## STEP 9 — Seed Data daalo (Manufacturer + Categories) 🌱

App mein manufacturer ka koi signup page nahi hai — isliye seed script se banate hain:

```bash
pnpm db:seed
```

Ye banayega:

- **1 Manufacturer** — login: `admin@atjewellers.com` / password from `SEED_MANUFACTURER_PASSWORD`
- **14 Categories** (full taxonomy — Rings, Earrings, Necklaces, Bangles + sub-categories, etc. — see `lib/categories.ts`)

**Testing ke liye ek demo store bhi chahiye?** (recommended pehli baar):

```bash
# Windows PowerShell:
$env:SEED_DEMO_STORE="true"; pnpm db:seed

# ya Git Bash:
SEED_DEMO_STORE=true pnpm db:seed
```

Ye ek approved demo store bhi banayega:

- Purchase manager (code: Retailer / Head Office): `store@demo.com` / `store123`
- Kiosk URL: `http://localhost:3000/demo`

> **Production ke liye:** seed se pehle apna password set karo:
>
> ```bash
> $env:SEED_MANUFACTURER_PASSWORD="MeraStrongPassword"; pnpm db:seed
> ```

> **Note:** `pnpm db:deploy` (STEP 8) me saari 24 migrations aa jaati hain — including
> `branch_hierarchy` (multi-store: Purchase manager → Stores/branches →
> Store Managers). Fresh DB pe kuch extra nahi karna.

---

## STEP 9b — Purani DB upgrade kar rahe ho? (Branch migration) 🔁

Sirf tab jab **pehle se data wali DB** ko naye multi-store structure me la rahe ho
(fresh DB pe skip karo). Migration apply hone ke baad ye ek baar chalao:

```bash
pnpm migrate:branches
```

Ye har purane Purchase manager ke andar ek default **"Main Store"** branch bana deta hai
aur purane kiosk/B2B/custom orders usse link kar deta hai. Dobara chalana safe hai.

> Roles ka mapping (Option A): purana **Store Owner → Purchase manager (= Head Office)**,
> + har purchase manager ka ek default **Store (branch)**. (Purana "Manager" data ab
> `store_managers` table me inert reh jaata hai — HO Manager role hata diya gaya;
> Purchase manager hi sab approvals karta hai.) Naye real branches + store managers
> `/store/branches` se banao.

---

## STEP 10 — App Chalao 🚀

```bash
pnpm dev
```

Browser mein khol ke test karo:

| URL                                           | Kya                                                        |
| --------------------------------------------- | ---------------------------------------------------------- |
| `http://localhost:3000`                     | Branded Jewel Factory landing (navbar + featured catalog + **Login popup**: Purchase manager \| Store Manager) |
| `http://localhost:3000/about`               | About page (linked from landing navbar) |
| `http://localhost:3000/manufacturer/login`  | `admin@atjewellers.com` / password from `SEED_MANUFACTURER_PASSWORD` (Manufacturer — hidden admin entry) |
| `http://localhost:3000/store/login`         | `store@demo.com` / `store123` — **Purchase manager** (owner / Head Office) |
| `http://localhost:3000/store/branches`      | Purchase manager: manage **Stores (branches)** + store managers + restock PIN |
| `http://localhost:3000/store-manager/login` | **Store Manager** (no default login — create one in /store/branches first) |
| `http://localhost:3000/demo`                | Legacy public kiosk (branch kiosk is inside /store-manager) |

> `/portal` ab sirf `/` (landing) pe redirect karta hai. Staff landing ke **Login popup**
> se ya seedha `/store/login` · `/store-manager/login` · `/manufacturer` se login karte hain.

**Roles (3 staff + customer):** Manufacturer · Purchase manager (`/store`, = Head Office, does all approvals + chat) ·
Store Manager (`/store-manager`) · Customer (walk-in, no login). See `flow.md` for the full flow.

**Store Manager first login:** the Purchase manager (Head Office) must first create a Store (branch) and a
Store Manager under it at `/store/branches`. Then that store manager logs in at
`/store-manager/login` → gets their branch's Kiosk + Restock.

---

## 🧪 Pehla End-to-End Test (5 min)

1. **Manufacturer login** → `/manufacturer/login`
2. **Catalog → Add Design** → photo upload + category + Status "Active" → Save
   (Design number `JF-0001` auto milega — design *name* ka field ab exist nahi karta)
3. **Store kiosk** khol → `http://localhost:3000/demo/catalog` → wo product dikhega
4. Product pe **Add to Bag** → Cart → **Checkout** → naam/phone daal ke Place Order
5. **Purchase manager login** (`store@demo.com`) → **Pending Approvals** → Approve
6. **Manufacturer** → **Kiosk Orders** → order dikhega (customer ka naam NAHI, sirf
   business name + ship-to address) ✅

Agar ye chal gaya to pura system working hai! 🎉

---

## 🛠️ Useful Commands

```bash
pnpm dev              # development server
pnpm build            # production build
pnpm db:studio        # database GUI (browser mein tables dekho/edit karo)
pnpm db:deploy        # EXISTING migrations apply karo (fresh DB / normal upgrade path)
pnpm db:migrate       # sirf jab NAYI migration create kar rahe ho (local dev only)
pnpm db:seed          # seed data (dobara chala sakte ho — safe hai)
pnpm typecheck        # type errors check
```

---

## ❓ Common Problems

| Problem                        | Fix                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `Can't reach database`       | `DIRECT_URL` ka password/port check karo; Supabase paused to nahi, ya RDS security group block kar raha |
| `Invalid server environment` | koi required env missing/khaali hai — 4 secrets min 32 chars hone chahiye            |
| `prisma migrate dev` pooler pe atakta hai | `pnpm db:deploy` use karo instead — fresh/existing DB pe ye hi correct command hai |
| Image upload fail              | `AWS_REGION`/`AWS_S3_BUCKET`/`S3_PUBLIC_BASE_URL` + IAM creds bhare hain?            |
| Search "warming up"            | AI-Features Space set nahi (STEP 5) — ye normal hai agar skip kiya                    |
| Password reset email nahi aaya | SMTP set nahi to link **terminal/console mein** print hoga — wahan se copy karo      |
| Manufacturer login fail        | Seed chalaya? `SEED_MANUFACTURER_PASSWORD` sahi value ke saath `pnpm db:seed`.       |

---

## 🌐 Deploy karte waqt (baad mein)

Production ke liye **do target** hain — AWS EC2 (primary) aur Render (alternate).
Poora detail `AWS_MIGRATION.md` / `DEPLOY_RENDER.md` me hai; yahan sirf env checklist:

- `NODE_ENV="production"`
- `NEXT_PUBLIC_APP_URL="https://tumhara-domain.com"`
- `ALLOWED_ORIGINS="https://tumhara-domain.com"`
- Production DB = **AWS RDS** (EC2 path) ya alag Supabase project (Render path)
- Baaki saare env values same rahenge
- **AWS EC2:** Docker image git commit hash se tag hota hai — code push karne se
  running container update NAHI hota, image rebuild + container restart chahiye
  (poora command `AWS_MIGRATION.md` me). Migrations container start pe auto-apply hoti hain.
- **Render:** Build command `pnpm install && pnpm build` · Start command `pnpm render-start`
  (auto-migrates; plain `pnpm start` migrations apply NAHI karta)

---

Bas! Ye guide follow karke system chal jayega. Koi step atke to us step ka
screenshot/error bhej dena.
