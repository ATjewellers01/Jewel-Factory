# Jewel Factory — AWS Migration (executed 2026-07-22, verified live 2026-07-24)

> **Status: DONE, not a plan.** All four phases below were carried out by Abhay
> (commit `fe95556 feat: migrate production services to AWS`, 2026-07-22) and are
> confirmed live on the AWS EC2 production server as of 2026-07-24 (verified via
> direct SSH — container env vars + `docker logs` boot output + `prisma/schema.prisma`
> all checked against this doc). Kept below for reference on WHY each choice was
> made; the "how to do it" steps are now historical, not a to-do list.

**Decisions (locked, all executed):**
- **DB:** Supabase → **RDS PostgreSQL** ✅ (`database-1.c98u4y6sk2lz.ap-south-1.rds.amazonaws.com`, db `jewel_factory`).
- **Vectors:** Qdrant → **pgvector** in the SAME RDS ✅ (`manufacturer_product_embeddings.embedding vector(512)`, migration `20260722090000_pgvector`).
- **Storage:** Cloudinary → **S3 + CloudFront CDN** ✅ (bucket `atjewellers01-jewel-factory-prod-*`, served via `S3_PUBLIC_BASE_URL` = a CloudFront domain).
- **App:** Render → **EC2, via Docker** ✅ (deviates from the original PM2/nginx/certbot plan — Docker was simpler; TLS/domain via `sslip.io` rather than a custom domain + Let's Encrypt).
- **AI-Features (embedder + catalog/describe/transparent):** **stayed on the Hugging Face Docker Space** — the original plan's "also move AI-Features to EC2" sub-step was deliberately skipped. It works fine called externally, so there was no need to migrate a separately-deployed, working service. `AI_FEATURES_URL`/`EMBEDDER_URL` on the EC2 app still point at `https://botivate2026-ai-workspace.hf.space`.

---

## What actually changed (code)

- **`lib/cloudinary.ts` → deleted**, replaced by **`lib/storage.ts`** (not `lib/s3.ts` as originally sketched) — presigned S3 PUT via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, public reads via CloudFront. Same `Bucket` folder concept (`catalog`/`tryon`/`logo`/`custom`).
- **`lib/search.ts`** — Qdrant calls replaced with raw SQL against the new `vector(512)` column (cosine distance `<=>`, HNSW-ish ANN via whatever index the migration created). Function names/signatures kept, so callers (`kiosk.ts`, `branch-manager.ts`, `store-portal.ts`, `manufacturer-catalog.ts`) needed only minor updates.
- **`lib/db/indexing.ts`**, **`lib/upload-client.ts`**, **2 inline upload flows** (`app/[storeSlug]/custom-design/page.tsx`, `app/store-manager/custom-design/page.tsx`), **`components/manufacturer/ProductForm.tsx`**, **`next.config.ts`** (image host) — all updated to the S3/CloudFront flow.
- **`lib/env.ts`** — added AWS/S3 vars; `CLOUDINARY_*` vars kept but marked `.optional()` (dead/unused now, not required — don't rely on them existing).
- **New migration** `20260722090000_pgvector` — adds the `vector(512)` column.
- **New one-off scripts** (already run against production, kept for reference / re-runs on a future DB): `scripts/migrate_cloudinary_to_s3.ts`, `scripts/migrate_qdrant_to_pgvector.ts`.
- Full diff: `git show fe955564d62ce466bb04eecf023752fa9e018c3c --stat` in this repo.

## Live production env (confirmed via SSH, 2026-07-24 — values redacted)

```
DATABASE_URL      -> postgresql://<user>:<redacted>@database-1.c98u4y6sk2lz.ap-south-1.rds.amazonaws.com:5432/jewel_factory?sslmode=require
AWS_REGION        -> ap-south-1
AWS_S3_BUCKET     -> atjewellers01-jewel-factory-prod-152439496944
S3_PUBLIC_BASE_URL -> https://d3ux0gjx94zt93.cloudfront.net
EMBEDDER_URL / AI_FEATURES_URL -> https://botivate2026-ai-workspace.hf.space   (unchanged — still HF, not EC2)
NODE_ENV          -> production
```
No `QDRANT_*`, no `CLOUDINARY_*` set in the running container (confirmed absent).

## How the app actually runs on EC2 (differs from the original PM2/systemd plan)

- **Docker**, not PM2/systemd directly. Image tag = the git commit hash it was built
  from (e.g. `jewel-factory-prod:529b664`), container name `jewel-factory`, port
  mapped `127.0.0.1:3000->3000` (fronted by something on 80/443 — not yet confirmed
  what; likely nginx or a load balancer, check `sudo docker ps`/`sudo ss -tlnp` if
  you need to know).
- **Migrations auto-apply on container start** — the boot log shows `-> Applying
  database migrations...` then `prisma migrate deploy` output, before `next start`.
  So a fresh container boot brings the schema up to date by itself; no manual
  migration step needed on redeploy.
- **Access:** `ssh -i jewel-factory-prod-<date>.pem ec2-user@13.126.65.154` (Amazon
  Linux 2023). `ec2-user` has **passwordless `sudo`**. Docker requires `sudo` (the
  user isn't in the `docker` group). Useful commands:
  ```bash
  sudo docker ps -a                              # confirm the running container + its image tag
  sudo docker logs jewel-factory --since 30m      # recent logs
  sudo docker logs -f jewel-factory                # follow live (use `timeout N` to bound it)
  sudo docker exec jewel-factory printenv          # confirm live env (careful — includes secrets)
  ```
- **Redeploying a fix:** the container is pinned to whatever commit it was built
  from — pushing to `master` does NOT update it by itself. Rebuilding the image and
  restarting the container is a separate step; the exact rebuild command/script
  was **not identified this session** — ask whoever set up the original deploy
  (Abhay) or check for a CI workflow / deploy script in the repo before assuming
  it's manual.

## Order of operations (what was actually done, for reference)
1. RDS created, schema deployed (`pnpm db:deploy`), data copied from Supabase.
2. `pgvector` extension + column added on the same RDS; embeddings backfilled.
3. S3 bucket + CloudFront created; existing Cloudinary assets migrated
   (`scripts/migrate_cloudinary_to_s3.ts`); DB URL columns repointed to CloudFront.
4. EC2 provisioned, Docker image built from the app + this env, container started;
   AI-Features left as-is on the HF Space (no migration needed there).

## Known deviations from the original plan (read before assuming anything)
- App runs via **Docker**, not PM2 + nginx + certbot as originally sketched.
- Domain is **`13-126-65-154.sslip.io`** (a wildcard-DNS-to-IP service), not a
  custom domain + Let's Encrypt cert.
- **AI-Features was NOT moved to EC2** — still the same external HF Space call,
  for both Render and AWS EC2.
- Whether **Render is still live in parallel** with AWS EC2, or has been retired,
  is **unconfirmed** — treat both as potentially real until checked.

## Outstanding follow-ups (from this migration, not yet done as of 2026-07-24)
- [ ] Confirm/document the actual redeploy mechanism for the EC2 container (rebuild + restart steps).
- [ ] Confirm whether Render is still serving production traffic or has been retired.
- [ ] Rotate the RDS database password — it was printed in plaintext in a debugging session on 2026-07-24 (a redaction `sed` pattern missed the `DATABASE_URL=` line).
- [ ] Decide whether to delete the now-dead `lib/cloudinary.ts`-shaped `CLOUDINARY_*` optional env vars from `lib/env.ts`/`.env.example`, or keep them as intentional legacy no-ops.
- [ ] `scripts/migrate_cloudinary_to_s3.ts` / `scripts/migrate_qdrant_to_pgvector.ts` are one-off migration scripts already run against production — safe to keep for reference, but don't re-run against a DB that's already migrated without checking they're idempotent first.

## Post-Deploy Verification Checklist

- [ ] App is running (`sudo docker ps` and `sudo docker logs --tail 100 jewel-factory`).
- [ ] Prisma migrations applied successfully during container startup.
- [ ] S3 CORS is configured:
  ```bash
  aws s3api get-bucket-cors \
    --bucket atjewellers01-jewel-factory-prod-152439496944
  ```
- [ ] S3 CORS allows `https://jewelfactory.in` and the temporary
  `https://13-126-65-154.sslip.io` origin for `GET`, `PUT`, `POST`, and `DELETE`.
- [ ] Manufacturer **Generate with AI** image upload works.
- [ ] Custom-design image upload works.
- [ ] Public and authenticated application endpoints respond successfully.
