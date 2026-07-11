# Jewel Factory — Render Deployment Guide (Hinglish)

App ko Render pe live karne ke complete steps. Isse pehle `SETUP_GUIDE.md` ke
saare accounts (Supabase, Cloudinary, Qdrant, SMTP) ready hone chahiye.

---

## Overview — kya hoga

1. Code GitHub pe push karo
2. Render pe web service banao (GitHub se connect)
3. Env vars daalo (secrets)
4. Deploy → build → migrations auto-apply → live
5. Seed data (manufacturer + categories) ek baar

Render **free plan** kaam karega (bas idle hone pe ~30s cold start hota hai).

---

## PART 1 — Code ko GitHub pe daalo

Jewel Factory abhi git repo nahi hai. Pehle banao:

```bash
cd "C:\Users\prabh\Desktop\Jewel Factory"
git init
git add .
git commit -m "Jewel Factory — initial"
```

> ⚠️ Confirm karo `.env` commit NAHI ho raha (`.gitignore` mein already hai).
> Check: `git status` mein `.env` nahi dikhna chahiye.

Ab GitHub pe naya repo banao:
1. **https://github.com/new** → repo name `jewel-factory` → **Private** → Create
2. GitHub jo commands dikhaye, wo chalao (ya ye):
   ```bash
   git branch -M main
   git remote add origin https://github.com/<tumhara-username>/jewel-factory.git
   git push -u origin main
   ```

---

## PART 2 — Render pe Web Service banao

### 2a. Service create
1. Jao: **https://render.com** → Sign in (GitHub se)
2. **New +** → **Web Service**
3. **Connect a repository** → apna `jewel-factory` repo select karo
   (pehli baar GitHub authorize karna padega)

### 2b. Settings bharo
| Field | Value |
|---|---|
| **Name** | `jewel-factory` (kuch bhi) |
| **Region** | apne paas ka (e.g. Singapore) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `pnpm install && pnpm build` |
| **Start Command** | `pnpm render-start` |
| **Instance Type** | `Free` |

> **Start command `pnpm render-start`** important hai — ye deploy pe pehle
> `prisma migrate deploy` chalata hai (DB tables banata/update karta hai), fir
> app start karta hai. Isliye migrations manually chalane ki zaroorat nahi.

> **pnpm:** Render auto-detect kar leta hai (`pnpm-lock.yaml` se). Agar na kare to
> Settings mein add karo — Node version 20+.

---

## PART 3 — Environment Variables daalo

Render dashboard → tumhari service → **Environment** tab → **Add Environment Variable**
(ya "Add from .env" — bulk paste). Ye saare daalo — values apni `.env` file se
copy karo (ye file mein REAL secrets kabhi mat likho, wo git mein chali jaati hai):

```
NODE_ENV=production

DATABASE_URL=<apni-supabase-pooled-url-port-6543-with-?pgbouncer=true>
DIRECT_URL=<apni-supabase-direct-url-port-5432>

MANUFACTURER_SECRET=<32-byte-hex>
STORE_SECRET=<32-byte-hex>
MANAGER_SECRET=<32-byte-hex>
COOKIE_TTL_SECONDS=28800

CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<cloud-name>

EMBEDDER_URL=https://botivate2026-embedder.hf.space
EMBEDDER_API_KEY=
QDRANT_URL=<qdrant-url-with-:6333>
QDRANT_API_KEY=<qdrant-api-key>
QDRANT_MANUFACTURER_COLLECTION=jewelfactory_manufacturer_products

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-gmail>
SMTP_PASS=<gmail-app-password>
FROM_EMAIL=<your-gmail>
FROM_NAME=Jewel Factory
```

> **Values kahan se:** ye sab tumhari local `.env` file mein already hain — wahan
> se copy karke Render dashboard mein paste karo. Docs/git mein real values kabhi
> mat likho.

### ⚠️ 2 env vars deploy ke BAAD update karne padenge:
Pehle deploy karo, Render tumhe ek URL dega (e.g. `https://jewel-factory.onrender.com`).
Fir ye 2 update karo aur redeploy:
```
NEXT_PUBLIC_APP_URL=https://jewel-factory.onrender.com
ALLOWED_ORIGINS=https://jewel-factory.onrender.com
```

> Pehli baar temporary rakh sakte ho: `NEXT_PUBLIC_APP_URL=http://localhost:3000`
> Deploy hone ke baad real URL daal ke **Manual Deploy → Clear cache & deploy** karo.

---

## PART 4 — Deploy

1. **Create Web Service** click karo (ya settings save)
2. Render automatically build shuru karega — logs live dikhenge
3. Build steps:
   - `pnpm install` (deps)
   - `pnpm build` (prisma generate + next build)
   - `pnpm render-start` (prisma migrate deploy → tables banenge → app start)
4. "Live" status + green ✓ = deploy ho gaya 🎉
5. URL khol ke test: `https://jewel-factory.onrender.com`

---

## PART 5 — Seed Data (ek baar)

Migrations auto ho gaye (start command se), lekin **manufacturer + categories seed**
karne padenge. Do tareeke:

### Option A — Render Shell se (easiest)
1. Render dashboard → service → **Shell** tab
2. Ye chalao:
   ```bash
   pnpm db:seed
   ```
   (Demo store bhi chahiye to: `SEED_DEMO_STORE=true pnpm db:seed`)

### Option B — Local se prod DB pe seed
Apne PC pe `.env` mein prod `DATABASE_URL`/`DIRECT_URL` daal ke:
```bash
pnpm db:seed
```
(Ya ek `.env.production` bana ke usse.)

> Production ke liye manufacturer password change karo:
> ```bash
> SEED_MANUFACTURER_PASSWORD="MeraStrongPassword" pnpm db:seed
> ```

---

## PART 6 — Verify (live URL pe)

| URL | Test |
|---|---|
| `https://<app>.onrender.com/api/health` | `{"data":{"ok":true}}` dikhna chahiye |
| `https://<app>.onrender.com/portal` | 3 login cards |
| `/manufacturer/login` | `admin@atjewellers.com` / seed password |
| `/store/register` | naya store register (fir manufacturer approve) |

**End-to-end:** manufacturer login → catalog add design → store register → manufacturer
approve (owner ko email jayega) → store login → kiosk pe order → manager approve →
manufacturer ko dikhega.

---

## PART 7 — Future updates (code change ke baad)

```bash
git add .
git commit -m "kya change kiya"
git push
```
Render **auto-deploy** karega (autoDeploy on hai). Migrations bhi auto-apply honge
(`render-start` se). Bas push karo, baaki Render sambhal lega.

---

## ⚠️ Zaroori baatein

1. **Free plan cold start:** 15 min idle ke baad service so jaati hai, agli request
   pe ~30-50s lagta hai jagne mein. Paid plan ($7/mo) se ye issue khatam.

2. **Secrets rotate karo:** Ye credentials chat + is file mein hain. Production live
   karne se pehle Supabase password, Cloudinary secret, Gmail app password, Qdrant
   key naye bana lena (dashboards se), aur Render env update kar dena.

3. **`.env` git mein mat daalo** — sirf Render dashboard mein.

4. **Qdrant port `:6333`** — URL mein port hona zaroori hai (search ke liye).

5. **Custom domain** (baad mein): Render → Settings → Custom Domains → apna domain
   add karo → `NEXT_PUBLIC_APP_URL` + `ALLOWED_ORIGINS` us domain pe update karo.

---

## ❓ Common deploy errors

| Error | Fix |
|---|---|
| Build fail: "prisma not found" | `pnpm install` build command mein hai? postinstall prisma generate karta hai |
| "Can't reach database" | `DIRECT_URL` (port 5432) sahi hai? Supabase active hai? |
| App loads but 500 everywhere | Koi env var missing — Render logs dekho, `Invalid server environment` |
| Migrations nahi lagi | Start command `pnpm render-start` hai? (not `pnpm start`) |
| Login redirect loop / cookies fail | `NODE_ENV=production` + `NEXT_PUBLIC_APP_URL`/`ALLOWED_ORIGINS` real URL pe set hain? |
| Image upload fail | Cloudinary ke 4 env vars set hain? |
| Health check fail | `/api/health` path set hai health check mein? |

---

Bas! Push → Render build → migrate → seed → live. Koi step atke to Render ke
**Logs** tab ka error bhej dena.
