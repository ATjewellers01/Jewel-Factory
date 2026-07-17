# Jewel Factory — Complete Setup Guide (Hinglish)

Ye guide **zero se lekar chalne tak** ke saare steps deta hai — har `.env` variable
kaha se laana hai, database kaise banana hai, aur app kaise run karna hai.

Follow karo top se bottom, ek-ek step.

---

## 📋 Kya-kya chahiye (accounts)

Ye 4 free accounts banane padenge (jo already hai to skip):

| Service                       | Kis liye                         | Free?                 |
| ----------------------------- | -------------------------------- | --------------------- |
| **Supabase**            | Database (Postgres)              | ✅ Free tier          |
| **Cloudinary**          | Images store karne ke liye       | ✅ Free tier          |
| **Qdrant Cloud**        | Similar-image search (vector DB) | ✅ Free tier          |
| **Gmail** (ya koi SMTP) | Password reset emails            | ✅ Gmail app password |

**Embedder** (OpenCLIP) — ye ek Python service hai. Iske bina similar-image
search kaam nahi karega, baaki sab chalega. (Optional — abhi skip kar sakte ho.)

---

## STEP 0 — Terminal khol lo

```bash
cd "C:\Users\prabh\Desktop\Jewel Factory"
pnpm install        # dependencies install (agar pehle nahi kiya)
```

---

## STEP 1 — Supabase (Database) 🗄️

### 1a. Naya project banao

1. Jao: **https://supabase.com** → Sign in (GitHub se easy hai)
2. **"New Project"** click karo
3. Fill karo:
   - **Name:** `jewel-factory` (kuch bhi)
   - **Database Password:** ek strong password daalo — **ise NOTE kar lo** (ye baad mein chahiye)
   - **Region:** apne paas ka (e.g. Mumbai / Singapore)
4. **"Create new project"** → 1-2 min wait (database ban raha hai)

### 1b. Connection strings lo (DATABASE_URL + DIRECT_URL)

1. Project ke andar → left sidebar **⚙️ Project Settings** → **Database**
2. Neeche scroll karo → **"Connection string"** section
3. Do connection strings chahiye:

**DATABASE_URL** (pooled — app ke liye):

- Tab select karo: **"Transaction"** mode (ya "Connection pooling")
- Port dikhega **6543**
- String copy karo — kuch aisa dikhega:
  ```
  postgresql://postgres.abcdxyz:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres
  ```
- `[YOUR-PASSWORD]` ki jagah **wahi password daalo jo 1a mein banaya tha**
- End mein `?pgbouncer=true` add karo

**DIRECT_URL** (direct — migrations ke liye):

- Tab select karo: **"Session"** mode (ya "Direct connection")
- Port dikhega **5432**
- String copy karo:
  ```
  postgresql://postgres.abcdxyz:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres
  ```
- Yahan bhi password daalo

> **Tip:** Dono strings almost same hain — sirf **port alag hai** (6543 vs 5432).
> DATABASE_URL = 6543 + `?pgbouncer=true` · DIRECT_URL = 5432

### ✅ Ab tumhare paas hai:

```
DATABASE_URL="postgresql://postgres.abcdxyz:TumharaPassword@...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.abcdxyz:TumharaPassword@...pooler.supabase.com:5432/postgres"
```

---

## STEP 2 — Auth Secrets 🔑

Ye 3 random secrets hain (min 32 characters). Terminal mein ye command chalao —
har baar ek secret milega:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**3 baar chalao**, teen alag secrets copy karo:

```
MANUFACTURER_SECRET="pehla-random-string-yahan"
STORE_SECRET="dusra-random-string-yahan"
MANAGER_SECRET="teesra-random-string-yahan"
COOKIE_TTL_SECONDS="28800"    # 8 ghante — ise waise hi rakho
```

> **Note:** Teeno alag hone chahiye. Har ek 64 characters ka hoga (32 bytes hex) — bilkul theek.

---

## STEP 3 — Cloudinary (Images) 🖼️

### 3a. Account banao

1. Jao: **https://cloudinary.com** → Sign up (free)
2. Sign up ke baad seedha **Dashboard** khulega

### 3b. Credentials lo

Dashboard pe upar hi ek box dikhega **"Product Environment Credentials"** (ya "Account Details"):

```
Cloud name:  dxxxxxxxx
API Key:     123456789012345
API Secret:  abcXXXXXXXXXXXXXXXXXXXX   (click "reveal" / eye icon)
```

### ✅ Ab tumhare paas hai:

```
CLOUDINARY_CLOUD_NAME="dxxxxxxxx"
CLOUDINARY_API_KEY="123456789012345"
CLOUDINARY_API_SECRET="abcXXXXXXXXXXXXXXXXXXXX"
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="dxxxxxxxx"     # cloud name DOBARA yahan (public)
```

> **Important:** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` = wahi `CLOUDINARY_CLOUD_NAME` wala value.

---

## STEP 4 — Qdrant Cloud (Vector Search) 🔍

> Ye sirf **similar-image search** ke liye chahiye. Abhi skip karna hai to
> `QDRANT_URL` aur `QDRANT_API_KEY` khaali chhod do — baaki sab chalega, bas
> photo-search kaam nahi karega.

### 4a. Cluster banao

1. Jao: **https://cloud.qdrant.io** → Sign up (free)
2. **"Create Cluster"** → Free tier select karo → region choose karo → Create
3. Cluster ready hone ka wait (1-2 min)

### 4b. URL + API key lo

1. Cluster pe click → **Cluster URL** copy karo:
   ```
   https://xxxx-xxxx-xxxx.region.aws.cloud.qdrant.io:6333
   ```
2. **"API Keys"** section → **"Create API Key"** → copy karo

### ✅ Ab tumhare paas hai:

```
QDRANT_URL="https://xxxx-xxxx.region.aws.cloud.qdrant.io:6333"
QDRANT_API_KEY="tumhara-qdrant-api-key"
QDRANT_MANUFACTURER_COLLECTION="jewelfactory_manufacturer_products"   # waise hi rakho
```

> Collection automatically ban jayegi jab pehli image index hogi — kuch manually nahi karna.

---

## STEP 5 — Embedder (OpenCLIP) 🧠  [OPTIONAL — abhi skip kar sakte ho]

Similar-image search ke liye ek Python service chahiye jo photo ko vector mein
badalti hai. Do options:

**Option A — Abhi skip karo (recommended for first run):**

```
EMBEDDER_URL=""       # khaali
EMBEDDER_API_KEY=""   # khaali
```

Sab chalega, bas `/search` page pe "warming up" message aayega.

**Option B — Purana LuxeMatch wala HF Space use karo:**
LuxeMatch already ek embedder HuggingFace pe deploy kar chuka hai. Wahi use kar sakte ho:

```
EMBEDDER_URL="https://botivate2026-embedder.hf.space"
EMBEDDER_API_KEY=""   # agar koi key set nahi, khaali
```

(Confirm karo ye Space abhi live hai — `https://botivate2026-embedder.hf.space/health` khol ke dekho.)

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
SMTP_PORT="587"
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

# Auth secrets
MANUFACTURER_SECRET="a1b2c3...64chars"
STORE_SECRET="d4e5f6...64chars"
MANAGER_SECRET="g7h8i9...64chars"
COOKIE_TTL_SECONDS="28800"

# Cloudinary
CLOUDINARY_CLOUD_NAME="dxxxxxxxx"
CLOUDINARY_API_KEY="123456789012345"
CLOUDINARY_API_SECRET="abcXXXXXXXX"
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="dxxxxxxxx"

# Vector search (optional)
EMBEDDER_URL=""
EMBEDDER_API_KEY=""
QDRANT_URL="https://xxxx.aws.cloud.qdrant.io:6333"
QDRANT_API_KEY="tumhara-key"
QDRANT_MANUFACTURER_COLLECTION="jewelfactory_manufacturer_products"

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

---

## STEP 8 — Database Tables banao (Prisma Migrate) 🏗️

Ye command Supabase mein saare tables bana degi (Prisma schema se):

```bash
pnpm db:migrate
```

- Pehli baar chalane pe migration ka naam poochega → `init` type karke Enter
- "Your database is now in sync with your schema" dikhe = ✅ ho gaya

**Agar error aaye "Can't reach database":**

- `DIRECT_URL` check karo — password sahi hai? port 5432 hai?
- Supabase project active hai? (paused to nahi)

---

## STEP 9 — Seed Data daalo (Manufacturer + Categories) 🌱

App mein manufacturer ka koi signup page nahi hai — isliye seed script se banate hain:

```bash
pnpm db:seed
```

Ye banayega:

- **1 Manufacturer** — login: `admin@atjewellers.com` / password: `manufacturer123`
- **10 Categories** (Ring, Earring, Necklace, etc.)

**Testing ke liye ek demo store bhi chahiye?** (recommended pehli baar):

```bash
# Windows PowerShell:
$env:SEED_DEMO_STORE="true"; pnpm db:seed

# ya Git Bash:
SEED_DEMO_STORE=true pnpm db:seed
```

Ye ek approved demo store bhi banayega:

- Store owner: `store@demo.com` / `store123`
- Manager: `manager@demo.com` / `manager123`
- Kiosk URL: `http://localhost:3000/demo`

> **Production ke liye:** `manufacturer123` password turant badal dena. Ya seed se
> pehle apna password set karo:
>
> ```bash
> $env:SEED_MANUFACTURER_PASSWORD="MeraStrongPassword"; pnpm db:seed
> ```

> **Note:** `pnpm db:migrate` (STEP 8) me saari migrations aa jaati hain — including
> `20260717000000_branch_hierarchy` (multi-store: Retailer → Stores/branches →
> Store Managers). Fresh DB pe kuch extra nahi karna.

---

## STEP 9b — Purani DB upgrade kar rahe ho? (Branch migration) 🔁

Sirf tab jab **pehle se data wali DB** ko naye multi-store structure me la rahe ho
(fresh DB pe skip karo). Migration apply hone ke baad ye ek baar chalao:

```bash
pnpm migrate:branches
```

Ye har purane Retailer ke andar ek default **"Main Store"** branch bana deta hai
aur purane kiosk/B2B/custom orders usse link kar deta hai. Dobara chalana safe hai.

> Roles ka mapping (Option A): purana **Store Owner → Retailer**, purana
> **Manager → HO Manager**, + har retailer ka ek default **Store (branch)**.
> Naye real branches + store managers `/store/branches` se banao.

---

## STEP 10 — App Chalao 🚀

```bash
pnpm dev
```

Browser mein khol ke test karo:

| URL                                           | Kya                                                        |
| --------------------------------------------- | ---------------------------------------------------------- |
| `http://localhost:3000`                     | Landing → Staff Portal                                    |
| `http://localhost:3000/portal`              | 3 login cards                                              |
| `http://localhost:3000/manufacturer/login`  | `admin@atjewellers.com` / `manufacturer123` (Manufacturer) |
| `http://localhost:3000/store/login`         | `store@demo.com` / `store123` — **Retailer** (owner)   |
| `http://localhost:3000/store/manager/login` | `manager@demo.com` / `manager123` — **HO Manager**     |
| `http://localhost:3000/store/branches`      | Retailer: manage **Stores (branches)** + store managers + restock PIN |
| `http://localhost:3000/store-manager/login` | **Store Manager** (create one in /store/branches first) |
| `http://localhost:3000/demo`                | Legacy public kiosk (branch kiosk is inside /store-manager) |

**Roles (4):** Manufacturer · Retailer (`/store`) · HO Manager (`/store/manager`) ·
Store Manager (`/store-manager`). See `SYSTEM_FLOW.txt` for the full flow.

**Store Manager first login:** Retailer/HO must first create a Store (branch) and a
Store Manager under it at `/store/branches`. Then that store manager logs in at
`/store-manager/login` → gets their branch's Kiosk + Restock.

---

## 🧪 Pehla End-to-End Test (5 min)

1. **Manufacturer login** → `/manufacturer/login`
2. **Catalog → Add Design** → naam + photo upload + category + Status "Active" → Save
   (Design number `JF-0001` auto milega)
3. **Store kiosk** khol → `http://localhost:3000/demo/catalog` → wo product dikhega
4. Product pe **Add to Bag** → Cart → **Checkout** → naam/phone daal ke Place Order
5. **Store login** (`store@demo.com`) → **Pending Approvals** → Approve
6. **Manufacturer** → **Kiosk Orders** → order dikhega (customer ka naam NAHI, sirf store + ship-to address) ✅

Agar ye chal gaya to pura system working hai! 🎉

---

## 🛠️ Useful Commands

```bash
pnpm dev              # development server
pnpm build            # production build
pnpm db:studio        # database GUI (browser mein tables dekho/edit karo)
pnpm db:migrate       # naye schema changes apply karo
pnpm db:seed          # seed data (dobara chala sakte ho — safe hai)
pnpm typecheck        # type errors check
```

---

## ❓ Common Problems

| Problem                        | Fix                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `Can't reach database`       | `DIRECT_URL` ka password/port check karo; Supabase paused to nahi                   |
| `Invalid server environment` | koi required env missing/khaali hai — 3 secrets min 32 chars hone chahiye            |
| Image upload fail              | Cloudinary ke teeno values +`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` bhare hain?         |
| Search "warming up"            | Embedder set nahi (STEP 5) — ye normal hai agar skip kiya                            |
| Password reset email nahi aaya | SMTP set nahi to link**terminal/console mein** print hoga — wahan se copy karo |
| Manufacturer login fail        | Seed chalaya?`pnpm db:seed`. Password `manufacturer123`                           |

---

## 🌐 Deploy karte waqt (baad mein)

Deploy pe (Render/Vercel) ye badalna:

- `NODE_ENV="production"`
- `NEXT_PUBLIC_APP_URL="https://tumhara-domain.com"`
- `ALLOWED_ORIGINS="https://tumhara-domain.com"`
- Baaki saare env values same rahenge (production Supabase alag project bana sakte ho)
- Build command: `pnpm build` · Start: `pnpm start`

---

Bas! Ye guide follow karke system chal jayega. Koi step atke to us step ka
screenshot/error bhej dena.
